const kakushi = (() => {
    const MAGIC = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"
    const HEADER_BYTES = 8; // 4 bytes Magic + 4 bytes Length
    const DEFAULT_ALPHA_THRESHOLD = 250;
    const DEFAULT_TOP_STRIP = 200;

    /**
     * Checks if the image contains the Kakushi signature.
     * Scans the image for the first contiguous block of opaque pixels to find the header.
     * @param {CanvasImageSource} source
     * @returns {boolean}
     */
    function peek(source, options = {}) {
        try {
            // Header is 8 bytes = 64 bits.
            // 3 channels/pixel = 22 pixels needed.
            // We'll read a reasonable chunk (e.g. 200px height or full) to find opacity.
            // To be robust, let's just get the full context (or a large enough strip).
            // Usually header is at top. If top is transparent, we scan down.

            const w = source.naturalWidth || source.width;
            const h = source.naturalHeight || source.height;
            const ctx = getContextForReading(source, w, h);
            if (!ctx) return false;

            const imageData = ctx.getImageData(0, 0, w, h);
            const mask = normalizeMask(options, imageData.data.length);
            const regions = getScanRegions(options, h);
            const alphaThreshold = getAlphaThreshold(options);

            for (const region of regions) {
                const headerBytes = extractBytes(imageData.data, HEADER_BYTES, mask, {
                    width: w,
                    height: h,
                    startY: region.startY,
                    endY: region.endY,
                    alphaThreshold
                });

                if (hasMagic(headerBytes)) return true;
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
        const alphaThreshold = getAlphaThreshold(options);

        // Check capacity
        // Count opaque pixels
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i+=4) {
            // STRICT OPACITY CHECK: Alpha must be >= threshold.
            // Semi-transparent pixels (antialiasing) are corrupted by browser premultiplication logic.
            if (data[i+3] >= alphaThreshold && !isMasked(mask, i)) opaquePixels++;
        }

        const bitsNeeded = payload.length * 8;
        const pixelsNeeded = Math.ceil(bitsNeeded / 3);

        if (pixelsNeeded > opaquePixels) {
            throw new Error(`Payload too large: need ${pixelsNeeded} opaque pixels, have ${opaquePixels}`);
        }

        embedBytes(data, payload, mask, alphaThreshold);
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
        const regions = getScanRegions(options, h);

        let headerBytes = null;
        for (const region of regions) {
            const candidate = extractBytes(data, HEADER_BYTES, mask, {
                width: w,
                height: h,
                startY: region.startY,
                endY: region.endY,
                alphaThreshold
            });

            if (hasMagic(candidate)) {
                headerBytes = candidate;
                break;
            }
        }

        if (!headerBytes) {
            return { cleanImage: canvas, secret: null };
        }

        const view = new DataView(headerBytes.buffer);
        const payloadLength = view.getUint32(4, false);

        if (payloadLength === 0) {
             sanitizeRegion(data, HEADER_BYTES * 8, mask, alphaThreshold);
             ctx.putImageData(imageData, 0, 0);
             return { cleanImage: canvas, secret: "" };
        }

        const totalBytes = HEADER_BYTES + payloadLength;
        const bitsNeeded = totalBytes * 8;

        // Extract Full Payload
        // We re-extract everything to be safe (or could just continue)
        // extractBytes is deterministic on the opaque stream
        const fullBytes = extractBytes(data, totalBytes, mask, {
            width: w,
            height: h,
            startY: 0,
            endY: h,
            alphaThreshold
        });
        const compressedPayload = fullBytes.slice(HEADER_BYTES);

        sanitizeRegion(data, bitsNeeded, mask, alphaThreshold);
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
    function embedBytes(data, bytes, mask, alphaThreshold) {
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
            // STRICT OPACITY: Skip below threshold alpha
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
        let byteIndex = 0;
        let bitIndex = 0;
        const width = options.width;
        const height = options.height;
        const startY = Math.max(0, options.startY || 0);
        const endY = Math.min(height || 0, options.endY ?? height ?? 0);
        const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;

        if (!width || !height || endY <= startY) return bytes;

        for (let y = startY; y < endY; y++) {
            let rowIndex = y * width * 4;
            for (let x = 0; x < width; x++) {
                const i = rowIndex + x * 4;
                // STRICT OPACITY: Skip below threshold alpha
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
        }
        return bytes;
    }

    // Helper: Sanitizes pixels, skipping transparent ones
    function sanitizeRegion(data, bitsToWipe, mask, alphaThreshold) {
        let bitsWiped = 0;
        for (let i = 0; i < data.length; i += 4) {
             // STRICT OPACITY: Skip below threshold alpha
             if (data[i + 3] < alphaThreshold || isMasked(mask, i)) continue;

             for (let c = 0; c < 3; c++) {
                 if (bitsWiped >= bitsToWipe) return;
                 data[i + c] = data[i + c] & 0xFE;
                 bitsWiped++;
             }
        }
    }

    function hasMagic(header) {
        if (header.length < MAGIC.length) return false;
        for (let i = 0; i < MAGIC.length; i++) {
            if (header[i] !== MAGIC[i]) return false;
        }
        return true;
    }

    function getAlphaThreshold(options = {}) {
        if (typeof options.alphaThreshold === 'number') return options.alphaThreshold;
        return DEFAULT_ALPHA_THRESHOLD;
    }

    function getScanRegions(options, height) {
        if (!height) return [{ startY: 0, endY: 0 }];
        const topStrip = Math.min(DEFAULT_TOP_STRIP, height);
        const midStart = Math.max(0, Math.floor(height / 2 - DEFAULT_TOP_STRIP / 2));
        const midEnd = Math.min(height, midStart + DEFAULT_TOP_STRIP);

        const modes = {
            top: [{ startY: 0, endY: topStrip }],
            middle: [{ startY: midStart, endY: midEnd }],
            full: [{ startY: 0, endY: height }],
            all: [
                { startY: 0, endY: topStrip },
                { startY: midStart, endY: midEnd },
                { startY: 0, endY: height }
            ]
        };

        return modes[options.scanMode] || modes.all;
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

// Node.js export for testing
if (typeof module !== 'undefined') {
    module.exports = kakushi;
} else {
    window.kakushi = kakushi;
}
