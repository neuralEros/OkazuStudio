const kakushi = (() => {
    const MAGIC_V1 = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"
    const MAGIC_V2 = new Uint8Array([0x4f, 0x4b, 0x5a, 0x32]); // "OKZ2"
    const HEADER_BYTES_V1 = 8; // 4 bytes Magic + 4 bytes Length
    const HEADER_BYTES_V2 = 12; // 4 bytes Magic + 4 bytes Length + 4 bytes CRC32
    const DEFAULT_ALPHA_THRESHOLD = 250;
    const DEFAULT_HEADER_COPIES = 2;
    const DEFAULT_SCAN_MODES = ['top'];
    const DEFAULT_FALLBACK_SCAN_MODES = ['middle', 'full'];
    const DEFAULT_ALPHA_THRESHOLDS = [DEFAULT_ALPHA_THRESHOLD, 255, 240];

    const CRC_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            const byte = bytes[i];
            crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

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
            const headerInfo = findHeaderCandidate(imageData.data, w, h, mask, options);

            return Boolean(headerInfo);
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
        const payloadCrc = crc32(compressed);

        const header = new Uint8Array(HEADER_BYTES_V2);
        header.set(MAGIC_V2, 0);
        const view = new DataView(header.buffer);
        view.setUint32(4, compressed.length, false);
        view.setUint32(8, payloadCrc, false);

        const headerCopies = options.headerCopies ?? DEFAULT_HEADER_COPIES;
        const headerBlockSize = HEADER_BYTES_V2 * headerCopies;

        const payload = new Uint8Array(headerBlockSize + compressed.length);
        for (let i = 0; i < headerCopies; i++) {
            payload.set(header, i * HEADER_BYTES_V2);
        }
        payload.set(compressed, headerBlockSize);

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
        const alphaThreshold = resolveAlphaThreshold(options);

        // Check capacity
        // Count opaque pixels
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] >= alphaThreshold && !isMasked(mask, i)) opaquePixels++;
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
        const alphaThresholds = resolveAlphaThresholds(options);
        const scanModes = resolveScanModes(options);
        const fallbackScanModes = resolveFallbackScanModes(options);

        const scanPlan = [...scanModes, ...fallbackScanModes];
        const candidates = [];

        for (const alphaThreshold of alphaThresholds) {
            for (const scanMode of scanPlan) {
                const region = getScanRegion(w, h, scanMode);
                const headerInfo = findHeaderCandidate(data, w, h, mask, {
                    ...options,
                    alphaThresholds: [alphaThreshold],
                    scanModes: [scanMode],
                    fallbackScanModes: []
                }, region);

                if (headerInfo) {
                    candidates.push({ ...headerInfo, alphaThreshold, region });
                }
            }
        }

        for (const candidate of candidates) {
            const header = candidate.header;
            const headerBytes = candidate.headerBytes;
            const headerCopies = candidate.headerCopies;
            const payloadLength = candidate.payloadLength;

            if (payloadLength === 0) {
                const bitsToWipe = (headerBytes * headerCopies) * 8;
                sanitizeRegion(data, bitsToWipe, mask, { alphaThreshold: candidate.alphaThreshold });
                ctx.putImageData(imageData, 0, 0);
                return { cleanImage: canvas, secret: "" };
            }

            const payloadOffsetBytes = headerBytes * headerCopies;
            const payloadBytes = extractBytes(data, payloadLength, mask, {
                alphaThreshold: candidate.alphaThreshold,
                width: w,
                region: candidate.region,
                skipBits: payloadOffsetBytes * 8
            });

            if (candidate.hasCrc) {
                const payloadCrc = crc32(payloadBytes);
                if (payloadCrc !== candidate.payloadCrc) {
                    continue;
                }
            }

            try {
                const secret = await decompressString(payloadBytes);
                const bitsToWipe = (payloadOffsetBytes + payloadLength) * 8;
                sanitizeRegion(data, bitsToWipe, mask, { alphaThreshold: candidate.alphaThreshold });
                ctx.putImageData(imageData, 0, 0);
                return { cleanImage: canvas, secret };
            } catch (e) {
                console.error("Decompression failed:", e);
            }
        }

        return { cleanImage: canvas, secret: null };
    }

    // --- Helpers ---

    function resolveAlphaThreshold(options) {
        return options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
    }

    function resolveAlphaThresholds(options) {
        if (options.alphaThresholds && options.alphaThresholds.length) return options.alphaThresholds;
        return [resolveAlphaThreshold(options), ...DEFAULT_ALPHA_THRESHOLDS.filter(v => v !== resolveAlphaThreshold(options))];
    }

    function resolveScanModes(options) {
        if (options.scanModes && options.scanModes.length) return options.scanModes;
        return DEFAULT_SCAN_MODES;
    }

    function resolveFallbackScanModes(options) {
        if (options.fallbackScanModes && options.fallbackScanModes.length) return options.fallbackScanModes;
        return DEFAULT_FALLBACK_SCAN_MODES;
    }

    function getScanRegion(w, h, mode) {
        if (mode === 'top') {
            return { x: 0, y: 0, w, h: Math.min(h, 220) };
        }
        if (mode === 'middle') {
            const midStart = Math.floor(h * 0.4);
            const midHeight = Math.min(h - midStart, Math.max(160, Math.floor(h * 0.2)));
            return { x: 0, y: midStart, w, h: midHeight };
        }
        return { x: 0, y: 0, w, h };
    }

    function findHeaderCandidate(data, w, h, mask, options, explicitRegion = null) {
        const scanModes = resolveScanModes(options);
        const fallbackScanModes = resolveFallbackScanModes(options);
        const alphaThresholds = resolveAlphaThresholds(options);
        const scanPlan = explicitRegion ? [explicitRegion] : [...scanModes.map(mode => getScanRegion(w, h, mode)), ...fallbackScanModes.map(mode => getScanRegion(w, h, mode))];

        const specs = [
            { magic: MAGIC_V2, headerBytes: HEADER_BYTES_V2, hasCrc: true, maxCopies: options.headerCopies ?? DEFAULT_HEADER_COPIES },
            { magic: MAGIC_V1, headerBytes: HEADER_BYTES_V1, hasCrc: false, maxCopies: 1 }
        ];

        for (const alphaThreshold of alphaThresholds) {
            for (const region of scanPlan) {
                for (const spec of specs) {
                    const headerCopies = readHeaderCopies(data, w, mask, spec, region, alphaThreshold);
                    if (!headerCopies.length) continue;

                    const header = majorityVoteBytes(headerCopies);
                    if (!hasMagic(header, spec.magic)) continue;

                    const view = new DataView(header.buffer);
                    const payloadLength = view.getUint32(4, false);
                    const payloadCrc = spec.hasCrc ? view.getUint32(8, false) : null;

                    return {
                        header,
                        headerBytes: spec.headerBytes,
                        headerCopies: headerCopies.length,
                        payloadLength,
                        payloadCrc,
                        hasCrc: spec.hasCrc,
                        region,
                        alphaThreshold
                    };
                }
            }
        }

        return null;
    }

    function readHeaderCopies(data, width, mask, spec, region, alphaThreshold) {
        const copies = [];
        for (let i = 0; i < spec.maxCopies; i++) {
            const header = extractBytes(data, spec.headerBytes, mask, {
                alphaThreshold,
                width,
                region,
                skipBits: i * spec.headerBytes * 8
            });
            if (!hasMagic(header, spec.magic)) break;
            copies.push(header);
        }
        return copies;
    }

    function majorityVoteBytes(byteArrays) {
        if (!byteArrays.length) return null;
        if (byteArrays.length === 1) return byteArrays[0];

        const length = byteArrays[0].length;
        const result = new Uint8Array(length);
        const threshold = Math.ceil(byteArrays.length / 2);

        for (let i = 0; i < length; i++) {
            let value = 0;
            for (let bit = 0; bit < 8; bit++) {
                let ones = 0;
                for (const bytes of byteArrays) {
                    ones += (bytes[i] >> (7 - bit)) & 1;
                }
                if (ones >= threshold) {
                    value |= (1 << (7 - bit));
                }
            }
            result[i] = value;
        }
        return result;
    }

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
        const alphaThreshold = resolveAlphaThreshold(options);
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
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
        const bytes = new Uint8Array(byteCount);
        const alphaThreshold = resolveAlphaThreshold(options);
        const width = options.width || 0;
        const region = options.region || { x: 0, y: 0, w: width || 0, h: (data.length / 4) / (width || 1) };
        let byteIndex = 0;
        let bitIndex = 0;
        let skipBits = options.skipBits || 0;

        for (let y = region.y; y < region.y + region.h; y++) {
            for (let x = region.x; x < region.x + region.w; x++) {
                const i = (y * width + x) * 4;
                if (data[i + 3] < alphaThreshold || isMasked(mask, i)) continue;

                for (let c = 0; c < 3; c++) {
                    if (skipBits > 0) {
                        skipBits--;
                        continue;
                    }

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
        }
        return bytes;
    }

    // Helper: Sanitizes pixels, skipping transparent ones
    function sanitizeRegion(data, bitsToWipe, mask, options = {}) {
        const alphaThreshold = resolveAlphaThreshold(options);
        let bitsWiped = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < alphaThreshold || isMasked(mask, i)) continue;

            for (let c = 0; c < 3; c++) {
                if (bitsWiped >= bitsToWipe) return;
                data[i + c] = data[i + c] & 0xFE;
                bitsWiped++;
            }
        }
    }

    function hasMagic(header, magic) {
        if (!header || header.length < magic.length) return false;
        for (let i = 0; i < magic.length; i++) {
            if (header[i] !== magic[i]) return false;
        }
        return true;
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
