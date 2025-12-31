const kakushi = (() => {
    const MAGIC_V1 = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"
    const MAGIC_V2 = new Uint8Array([0x4f, 0x4b, 0x5a, 0x32]); // "OKZ2"
    const HEADER_BYTES_V1 = 8; // 4 bytes Magic + 4 bytes Length
    const HEADER_BYTES_V2 = 12; // 4 bytes Magic + 4 bytes Length + 4 bytes CRC32
    const DEFAULT_ALPHA_THRESHOLD = 250;
    const DEFAULT_HEADER_COPIES = 2;

    /**
     * Checks if the image contains the Kakushi signature.
     * Scans the image for the first contiguous block of opaque pixels to find the header.
     * @param {CanvasImageSource} source
     * @returns {boolean}
     */
    function peek(source, options = {}) {
        try {
            const w = source.naturalWidth || source.width;
            const h = source.naturalHeight || source.height;
            const ctx = getContextForReading(source, w, h);
            if (!ctx) return false;

            const imageData = ctx.getImageData(0, 0, w, h);
            const mask = normalizeMask(options, imageData.data.length);
            const headerInfo = findHeader(imageData.data, mask, {
                alphaThreshold: getAlphaThreshold(options),
                headerCopies: options.headerCopies || DEFAULT_HEADER_COPIES,
                robustHeader: options.robustHeader !== false,
                scanFallback: options.scanFallback !== false,
                scanModes: options.scanModes
            }, w, h);

            return !!headerInfo;
        } catch (e) {
            console.error("Kakushi peek failed:", e);
            return false;
        }
    }

    /**
     * Embeds a secret string into the source image.
     * Uses GZIP compression and writes only to opaque pixels.
     * @param {CanvasImageSource} source
     * @param {string} secret
     * @returns {Promise<HTMLCanvasElement>} The laced canvas.
     */
    async function seal(source, secret, options = {}) {
        const compressed = await compressString(secret);

        const headerCopies = options.headerCopies || DEFAULT_HEADER_COPIES;
        const crc = crc32(compressed);
        const header = new Uint8Array(HEADER_BYTES_V2);
        header.set(MAGIC_V2, 0);
        const view = new DataView(header.buffer);
        view.setUint32(4, compressed.length, false);
        view.setUint32(8, crc, false);

        const payload = new Uint8Array((header.length * headerCopies) + compressed.length);
        for (let i = 0; i < headerCopies; i++) {
            payload.set(header, i * header.length);
        }
        payload.set(compressed, header.length * headerCopies);

        const canvas = document.createElement('canvas');
        const w = source.naturalWidth || source.width;
        const h = source.naturalHeight || source.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const mask = normalizeMask(options, data.length);
        const alphaThreshold = getAlphaThreshold(options);

        // Check capacity
        // Count opaque pixels
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i+=4) {
            // STRICT OPACITY CHECK: Alpha must be 255.
            // Semi-transparent pixels (antialiasing) are corrupted by browser premultiplication logic.
            if (data[i+3] >= alphaThreshold && !isMasked(mask, i)) opaquePixels++;
        }

        const bitsNeeded = payload.length * 8;
        const pixelsNeeded = Math.ceil(bitsNeeded / 3);

        if (pixelsNeeded > opaquePixels) {
            throw new Error(`Payload too large: need ${pixelsNeeded} opaque pixels, have ${opaquePixels}`);
        }

        embedBytes(data, payload, mask, { alphaThreshold });
        ctx.putImageData(imageData, 0, 0);

        return canvas;
    }

    /**
     * Extracts the secret string and returns a sanitized image.
     * @param {CanvasImageSource} source
     * @returns {Promise<{ cleanImage: HTMLCanvasElement, secret: string|null }>}
     */
    async function reveal(source, options = {}) {
        const canvas = document.createElement('canvas');
        const w = source.naturalWidth || source.width;
        const h = source.naturalHeight || source.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const mask = normalizeMask(options, data.length);
        const alphaThreshold = getAlphaThreshold(options);
        const headerCopies = options.headerCopies || DEFAULT_HEADER_COPIES;
        const headerInfo = findHeader(data, mask, {
            alphaThreshold,
            headerCopies,
            robustHeader: options.robustHeader !== false,
            scanFallback: options.scanFallback !== false,
            scanModes: options.scanModes
        }, w, h);

        if (!headerInfo) {
            return { cleanImage: canvas, secret: null, status: 'no_header' };
        }

        const payloadLength = headerInfo.length;
        if (payloadLength === 0) {
            const bitsNeeded = headerInfo.headerSize * headerInfo.headerCopies * 8;
            sanitizeRegion(data, bitsNeeded, mask, { alphaThreshold });
            ctx.putImageData(imageData, 0, 0);
            return { cleanImage: canvas, secret: "", status: 'empty_payload' };
        }

        const headerBytesTotal = headerInfo.headerSize * headerInfo.headerCopies;
        const totalBytes = headerBytesTotal + payloadLength;
        const bitsNeeded = totalBytes * 8;

        const fullBytes = extractBytes(data, totalBytes, mask, {
            alphaThreshold,
            startIndex: headerInfo.startIndex
        });
        const compressedPayload = fullBytes.slice(headerBytesTotal);

        sanitizeRegion(data, bitsNeeded, mask, { alphaThreshold });
        ctx.putImageData(imageData, 0, 0);

        if (headerInfo.version === 2) {
            const crc = crc32(compressedPayload);
            if (crc !== headerInfo.crc) {
                console.error("CRC mismatch:", headerInfo.crc, crc);
                return { cleanImage: canvas, secret: null, status: 'crc_mismatch' };
            }
        }

        try {
            const secret = await decompressString(compressedPayload);
            return { cleanImage: canvas, secret, status: 'ok' };
        } catch (e) {
            console.error("Decompression failed:", e);
            return { cleanImage: canvas, secret: null, status: 'decompress_failed' };
        }
    }

    // --- Helpers ---

    function getContextForReading(source, w, h) {
        if (source instanceof HTMLCanvasElement) return source.getContext('2d');
        if (source instanceof CanvasRenderingContext2D) return source;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(source, 0, 0, w, h, 0, 0, w, h);
        return ctx;
    }

    // Helper: Embeds bytes into pixels, skipping transparent ones
    function embedBytes(data, bytes, mask, options = {}) {
        const alphaThreshold = getAlphaThreshold(options);
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
            // STRICT OPACITY: Skip non-255 alpha
            if (data[i + 3] < alphaThreshold || isMasked(mask, i)) continue;

            for (let c = 0; c < 3; c++) {
                if (byteIndex >= bytes.length) return;

                const bit = (bytes[byteIndex] >> (7 - bitIndex)) & 1;
                data[i + c] = (data[i + c] & 0xFE) | bit;

                bitIndex++;
                if (bitIndex === 8) {
                    bitIndex = 0;
                    byteIndex++;
                }
            }
        }
    }

    // Helper: Extracts bytes from pixels, skipping transparent ones
    function extractBytes(data, byteCount, mask, options = {}) {
        const alphaThreshold = getAlphaThreshold(options);
        const startIndex = options.startIndex || 0;
        if (!options.robust) {
            return extractBytesFromStream(data, byteCount, mask, startIndex, alphaThreshold);
        }

        const sampleOffsets = options.sampleOffsets || [0, 4, 8];
        const samples = sampleOffsets.map(offset => extractBytesFromStream(
            data,
            byteCount,
            mask,
            startIndex + offset,
            alphaThreshold
        ));

        return majorityVoteBytes(samples);
    }

    // Helper: Sanitizes pixels, skipping transparent ones
    function sanitizeRegion(data, bitsToWipe, mask, options = {}) {
        const alphaThreshold = getAlphaThreshold(options);
        let bitsWiped = 0;
        for (let i = 0; i < data.length; i += 4) {
             // STRICT OPACITY: Skip non-255 alpha
             if (data[i + 3] < alphaThreshold || isMasked(mask, i)) continue;

             for (let c = 0; c < 3; c++) {
                 if (bitsWiped >= bitsToWipe) return;
                 data[i + c] = data[i + c] & 0xFE;
                 bitsWiped++;
             }
        }
    }

    function hasMagic(header, magic) {
        if (header.length < magic.length) return false;
        for (let i = 0; i < magic.length; i++) {
            if (header[i] !== magic[i]) return false;
        }
        return true;
    }

    function findHeader(data, mask, options, w, h) {
        const scanModes = options.scanFallback ? (options.scanModes || ['top', 'middle', 'bottom']) : ['top'];
        const alphaThreshold = options.alphaThreshold;
        const headerCopies = options.headerCopies || DEFAULT_HEADER_COPIES;
        const maxHeaderBytes = Math.max(HEADER_BYTES_V1, HEADER_BYTES_V2) * headerCopies;

        const scanOffsets = buildScanOffsets(scanModes, w, h);

        for (const startIndex of scanOffsets) {
            const headerBlock = extractBytes(data, maxHeaderBytes, mask, {
                startIndex,
                alphaThreshold,
                robust: false
            });
            const headerInfo = parseHeaderBlock(headerBlock, headerCopies);
            if (headerInfo) return { ...headerInfo, startIndex };
        }

        if (options.robustHeader) {
            for (const startIndex of scanOffsets) {
                const headerBlock = extractBytes(data, maxHeaderBytes, mask, {
                    startIndex,
                    alphaThreshold,
                    robust: true
                });
                const headerInfo = parseHeaderBlock(headerBlock, headerCopies);
                if (headerInfo) return { ...headerInfo, startIndex };
            }
        }

        return null;
    }

    function parseHeaderBlock(headerBlock, headerCopies) {
        const v2Header = extractHeaderCopy(headerBlock, HEADER_BYTES_V2, headerCopies);
        if (v2Header && hasMagic(v2Header, MAGIC_V2)) {
            const view = new DataView(v2Header.buffer);
            const length = view.getUint32(4, false);
            const crc = view.getUint32(8, false);
            return {
                version: 2,
                headerSize: HEADER_BYTES_V2,
                headerCopies,
                length,
                crc
            };
        }

        const v1Header = headerBlock.slice(0, HEADER_BYTES_V1);
        if (v1Header && hasMagic(v1Header, MAGIC_V1)) {
            const view = new DataView(v1Header.buffer);
            const length = view.getUint32(4, false);
            return {
                version: 1,
                headerSize: HEADER_BYTES_V1,
                headerCopies: 1,
                length,
                crc: null
            };
        }

        return null;
    }

    function extractHeaderCopy(headerBlock, headerSize, headerCopies) {
        if (headerBlock.length < headerSize) return null;
        if (headerCopies <= 1) return headerBlock.slice(0, headerSize);

        const copies = [];
        for (let i = 0; i < headerCopies; i++) {
            const start = i * headerSize;
            const end = start + headerSize;
            if (end > headerBlock.length) break;
            copies.push(headerBlock.slice(start, end));
        }

        if (!copies.length) return null;
        return majorityVoteBytes(copies);
    }

    function buildScanOffsets(scanModes, w, h) {
        const offsets = new Set();
        const rowStride = w * 4;
        scanModes.forEach(mode => {
            if (mode === 'top') offsets.add(0);
            if (mode === 'middle') offsets.add(Math.floor(h / 2) * rowStride);
            if (mode === 'bottom') offsets.add(Math.max(0, h - 200) * rowStride);
        });
        return [...offsets];
    }

    function extractBytesFromStream(data, byteCount, mask, startIndex, alphaThreshold) {
        const bytes = new Uint8Array(byteCount);
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = Math.max(0, startIndex); i < data.length; i += 4) {
            if (data[i + 3] < alphaThreshold || isMasked(mask, i)) continue;

            for (let c = 0; c < 3; c++) {
                const bit = data[i + c] & 1;
                bytes[byteIndex] = (bytes[byteIndex] << 1) | bit;

                bitIndex++;
                if (bitIndex === 8) {
                    bitIndex = 0;
                    byteIndex++;
                    if (byteIndex >= byteCount) return bytes;
                }
            }
        }
        return bytes;
    }

    function majorityVoteBytes(samples) {
        if (!samples.length) return new Uint8Array();
        const byteCount = samples[0].length;
        const out = new Uint8Array(byteCount);

        for (let i = 0; i < byteCount; i++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                let ones = 0;
                for (const sample of samples) {
                    if (((sample[i] >> (7 - bit)) & 1) === 1) ones++;
                }
                if (ones >= Math.ceil(samples.length / 2)) {
                    byte |= (1 << (7 - bit));
                }
            }
            out[i] = byte;
        }

        return out;
    }

    function normalizeMask(options, dataLength) {
        if (!options) return null;
        const mask = options.data || options.mask || options;
        if (!mask) return null;
        if (mask.length !== dataLength) return null;
        return mask;
    }

    function isMasked(mask, index) {
        if (!mask) return false;
        return mask[index + 3] > 0;
    }

    function getAlphaThreshold(options) {
        if (!options) return DEFAULT_ALPHA_THRESHOLD;
        if (typeof options.alphaThreshold === 'number') return options.alphaThreshold;
        if (typeof options.alphaMin === 'number') return options.alphaMin;
        return DEFAULT_ALPHA_THRESHOLD;
    }

    function crc32(bytes) {
        let crc = 0 ^ (-1);
        for (let i = 0; i < bytes.length; i++) {
            crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xFF];
        }
        return (crc ^ (-1)) >>> 0;
    }

    const CRC32_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c >>> 0;
        }
        return table;
    })();

    async function compressString(str) {
        const encoder = new TextEncoder();
        const input = encoder.encode(str);
        const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function decompressString(compressedBytes) {
        const stream = new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const decompressed = await new Response(stream).arrayBuffer();
        const decoder = new TextDecoder();
        return decoder.decode(decompressed);
    }

    return {
        peek,
        seal,
        reveal
    };
})();

// Node.js export for testing
if (typeof module !== 'undefined') {
    module.exports = kakushi;
} else {
    window.kakushi = kakushi;
}
