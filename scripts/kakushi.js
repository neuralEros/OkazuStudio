const kakushi = (() => {
    const MAGIC = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"
    const HEADER_BYTES = 8; // 4 bytes Magic + 4 bytes Length

    const DEFAULT_ALPHA_THRESHOLD = 250;
    const DEFAULT_HEADER_SEARCH_BYTES = 4096;

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
            const alphaThreshold = normalizeAlphaThreshold(options);
            const headerBytes = extractBytes(imageData.data, HEADER_BYTES, mask, { alphaThreshold });
            if (hasMagic(headerBytes)) return true;

            const searchBytes = options.headerSearchBytes ?? DEFAULT_HEADER_SEARCH_BYTES;
            if (searchBytes > HEADER_BYTES) {
                const stream = extractBytes(imageData.data, searchBytes, mask, { alphaThreshold });
                return findMagicOffset(stream) !== -1;
            }

            return false;
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

        const header = new Uint8Array(HEADER_BYTES);
        header.set(MAGIC, 0);
        const view = new DataView(header.buffer);
        view.setUint32(4, compressed.length, false);

        const payload = new Uint8Array(header.length + compressed.length);
        payload.set(header, 0);
        payload.set(compressed, header.length);

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
        const alphaThreshold = normalizeAlphaThreshold(options);

        // Check capacity
        // Count opaque pixels
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i+=4) {
            // STRICT OPACITY CHECK: Alpha must be 255.
            // Semi-transparent pixels (antialiasing) are corrupted by browser premultiplication logic.
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
        const alphaThreshold = normalizeAlphaThreshold(options);

        // Extract Header
        let headerBytes = extractBytes(data, HEADER_BYTES, mask, { alphaThreshold });
        let headerOffsetBits = 0;
        if (!hasMagic(headerBytes)) {
            const searchBytes = options.headerSearchBytes ?? DEFAULT_HEADER_SEARCH_BYTES;
            if (searchBytes > HEADER_BYTES) {
                const stream = extractBytes(data, searchBytes, mask, { alphaThreshold });
                const headerOffsetBytes = findMagicOffset(stream);
                if (headerOffsetBytes !== -1) {
                    headerOffsetBits = headerOffsetBytes * 8;
                    headerBytes = extractBytesFromBitOffset(data, HEADER_BYTES, mask, { alphaThreshold }, headerOffsetBits);
                }
            }
        }

        if (!hasMagic(headerBytes)) {
            return { cleanImage: canvas, secret: null };
        }

        const view = new DataView(headerBytes.buffer);
        const payloadLength = view.getUint32(4, false);
        const availableBytes = estimateAvailableBytes(data, mask, { alphaThreshold }) - (headerOffsetBits / 8);

        if (payloadLength === 0) {
             sanitizeRegion(data, HEADER_BYTES * 8, mask, { alphaThreshold }, headerOffsetBits);
             ctx.putImageData(imageData, 0, 0);
             return { cleanImage: canvas, secret: "" };
        }
        if (payloadLength < 0 || payloadLength > availableBytes - HEADER_BYTES) {
            return { cleanImage: canvas, secret: null };
        }

        const totalBytes = HEADER_BYTES + payloadLength;
        const bitsNeeded = totalBytes * 8;

        // Extract Full Payload
        // We re-extract everything to be safe (or could just continue)
        // extractBytes is deterministic on the opaque stream
        const fullBytes = extractBytesFromBitOffset(data, totalBytes, mask, { alphaThreshold }, headerOffsetBits);
        const compressedPayload = fullBytes.slice(HEADER_BYTES);

        sanitizeRegion(data, bitsNeeded, mask, { alphaThreshold }, headerOffsetBits);
        ctx.putImageData(imageData, 0, 0);

        try {
            const secret = await decompressString(compressedPayload);
            return { cleanImage: canvas, secret };
        } catch (e) {
            console.error("Decompression failed:", e);
            return { cleanImage: canvas, secret: null };
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
        let byteIndex = 0;
        let bitIndex = 0;
        const alphaThreshold = normalizeAlphaThreshold(options);

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
        return extractBytesFromBitOffset(data, byteCount, mask, options, 0);
    }

    function extractBytesFromBitOffset(data, byteCount, mask, options = {}, bitOffset = 0) {
        const bytes = new Uint8Array(byteCount);
        let byteIndex = 0;
        let bitIndex = 0;
        let skippedBits = 0;
        const alphaThreshold = normalizeAlphaThreshold(options);

        for (let i = 0; i < data.length; i += 4) {
            // STRICT OPACITY: Skip non-255 alpha
            if (data[i + 3] < alphaThreshold || isMasked(mask, i)) continue;

            for (let c = 0; c < 3; c++) {
                if (skippedBits < bitOffset) {
                    skippedBits++;
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
        return bytes;
    }

    // Helper: Sanitizes pixels, skipping transparent ones
    function sanitizeRegion(data, bitsToWipe, mask, options = {}, bitOffset = 0) {
        let bitsWiped = 0;
        let skippedBits = 0;
        const alphaThreshold = normalizeAlphaThreshold(options);
        for (let i = 0; i < data.length; i += 4) {
             // STRICT OPACITY: Skip non-255 alpha
             if (data[i + 3] < alphaThreshold || isMasked(mask, i)) continue;

             for (let c = 0; c < 3; c++) {
                 if (skippedBits < bitOffset) {
                     skippedBits++;
                     continue;
                 }
                 if (bitsWiped >= bitsToWipe) return;
                 data[i + c] = data[i + c] & 0xFE;
                 bitsWiped++;
             }
        }
    }

    function estimateAvailableBytes(data, mask, options = {}) {
        let eligiblePixels = 0;
        const alphaThreshold = normalizeAlphaThreshold(options);
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < alphaThreshold || isMasked(mask, i)) continue;
            eligiblePixels++;
        }
        return Math.floor((eligiblePixels * 3) / 8);
    }

    function hasMagic(header) {
        if (header.length < MAGIC.length) return false;
        for (let i = 0; i < MAGIC.length; i++) {
            if (header[i] !== MAGIC[i]) return false;
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

    function normalizeAlphaThreshold(options) {
        if (!options || typeof options.alphaThreshold !== 'number') return DEFAULT_ALPHA_THRESHOLD;
        return Math.min(255, Math.max(0, Math.round(options.alphaThreshold)));
    }

    function isMasked(mask, index) {
        if (!mask) return false;
        return mask[index + 3] > 0;
    }

    function findMagicOffset(stream) {
        if (!stream || stream.length < MAGIC.length) return -1;
        const limit = stream.length - MAGIC.length;
        for (let i = 0; i <= limit; i++) {
            let match = true;
            for (let j = 0; j < MAGIC.length; j++) {
                if (stream[i + j] !== MAGIC[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
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

// Node.js export for testing
if (typeof module !== 'undefined') {
    module.exports = kakushi;
} else {
    window.kakushi = kakushi;
}
