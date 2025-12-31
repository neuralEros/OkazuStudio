const kakushi = (() => {
    const MAGIC = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"
    const HEADER_BYTES = 8; // 4 bytes Magic + 4 bytes Length
    const ALPHA_THRESHOLD = 250; // Relaxed from 255 to allow minor alpha erosion

    function debugLog(msg) {
        if (window.Logger) window.Logger.info(`[Kakushi] ${msg}`);
        else console.log(`[Kakushi] ${msg}`);
    }

    function bytesToHex(bytes) {
        return Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
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
            debugLog(`Peek scanning image: ${w}x${h}`);

            const ctx = getContextForReading(source, w, h);
            if (!ctx) {
                debugLog("Peek failed: No context.");
                return false;
            }

            const imageData = ctx.getImageData(0, 0, w, h);
            const mask = normalizeMask(options, imageData.data.length);

            // Tolerant Scan: Read first 1024 bytes (approx 2700 pixels) to find header
            const scanBytes = extractBytes(imageData.data, 1024, mask);
            debugLog(`Peek read header bytes: ${bytesToHex(scanBytes.slice(0, 8))}...`);

            const offset = findMagic(scanBytes);
            if (offset !== -1) {
                debugLog(`Peek result: FOUND at offset ${offset}`);
                return true;
            } else {
                debugLog("Peek result: NOT FOUND");
                return false;
            }
        } catch (e) {
            debugLog(`Peek error: ${e.message}`);
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

        // Check capacity
        // Count opaque pixels using relaxed threshold
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i+=4) {
            if (data[i+3] >= ALPHA_THRESHOLD && !isMasked(mask, i)) opaquePixels++;
        }

        const bitsNeeded = payload.length * 8;
        const pixelsNeeded = Math.ceil(bitsNeeded / 3);

        if (pixelsNeeded > opaquePixels) {
            throw new Error(`Payload too large: need ${pixelsNeeded} opaque pixels, have ${opaquePixels}`);
        }

        embedBytes(data, payload, mask);
        ctx.putImageData(imageData, 0, 0);

        return canvas;
    }

    /**
     * Extracts the secret string and returns a sanitized image.
     * @param {CanvasImageSource} source
     * @returns {Promise<{ cleanImage: HTMLCanvasElement, secret: string|null }>}
     */
    async function reveal(source, options = {}) {
        debugLog("Reveal started.");
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

        // Scan for Header (Robustness)
        const scanBytes = extractBytes(data, 1024, mask);
        const offset = findMagic(scanBytes);

        if (offset === -1) {
            debugLog("Reveal failed: Magic header not found.");
            return { cleanImage: canvas, secret: null };
        }
        debugLog(`Reveal: Header found at offset ${offset}.`);

        // Header found at offset. Length is at offset + 4.
        const view = new DataView(scanBytes.buffer);
        // Safety check
        if (offset + 8 > scanBytes.length) {
             debugLog("Reveal error: Header boundary exceeds scan buffer.");
             return { cleanImage: canvas, secret: null };
        }

        const payloadLength = view.getUint32(offset + 4, false);
        debugLog(`Reveal: Payload Length ${payloadLength} bytes.`);

        if (payloadLength === 0) {
             debugLog("Reveal: Payload is empty.");
             sanitizeRegion(data, (offset + HEADER_BYTES) * 8, mask);
             ctx.putImageData(imageData, 0, 0);
             return { cleanImage: canvas, secret: "" };
        }

        // Total bytes needed (including garbage offset)
        const totalBytes = offset + HEADER_BYTES + payloadLength;
        const bitsNeeded = totalBytes * 8;

        // Extract Full Payload
        const fullBytes = extractBytes(data, totalBytes, mask);

        if (fullBytes.length < totalBytes) {
             debugLog(`Reveal error: Insufficient opaque pixels. Need ${totalBytes}, got ${fullBytes.length}`);
             return { cleanImage: canvas, secret: null };
        }
        debugLog(`Reveal: Extracted ${fullBytes.length} bytes.`);

        const compressedPayload = fullBytes.slice(offset + HEADER_BYTES);

        sanitizeRegion(data, bitsNeeded, mask);
        ctx.putImageData(imageData, 0, 0);

        try {
            const secret = await decompressString(compressedPayload);
            debugLog(`Reveal: Decompression successful (${secret.length} chars).`);
            return { cleanImage: canvas, secret };
        } catch (e) {
            debugLog(`Reveal error: Decompression failed - ${e.message}`);
            console.error("Decompression failed:", e);
            return { cleanImage: canvas, secret: null };
        }
    }

    // --- Helpers ---

    function getContextForReading(source, w, h) {
        if (source instanceof HTMLCanvasElement) return source.getContext('2d');
        if (source instanceof CanvasRenderingContext2D) return source;
        // ImageBitmap or Image
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, w, h, 0, 0, w, h);
        return ctx;
    }

    function findMagic(bytes) {
        if (bytes.length < MAGIC.length) return -1;
        for (let i = 0; i <= bytes.length - MAGIC.length; i++) {
            let match = true;
            for (let j = 0; j < MAGIC.length; j++) {
                if (bytes[i + j] !== MAGIC[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    }

    // Helper: Embeds bytes into pixels, skipping transparent ones
    function embedBytes(data, bytes, mask) {
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
            // STRICT OPACITY: Skip non-opaque alpha (Relaxed)
            if (data[i + 3] < ALPHA_THRESHOLD || isMasked(mask, i)) continue;

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
    function extractBytes(data, byteCount, mask) {
        const bytes = new Uint8Array(byteCount);
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
            // STRICT OPACITY: Skip non-opaque alpha (Relaxed)
            if (data[i + 3] < ALPHA_THRESHOLD || isMasked(mask, i)) continue;

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

    // Helper: Sanitizes pixels, skipping transparent ones
    function sanitizeRegion(data, bitsToWipe, mask) {
        let bitsWiped = 0;
        for (let i = 0; i < data.length; i += 4) {
             // STRICT OPACITY: Skip non-opaque alpha (Relaxed)
             if (data[i + 3] < ALPHA_THRESHOLD || isMasked(mask, i)) continue;

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

    // Helper to read streams without using Response (Fix for Edge/Chromium file:// issue)
    async function streamToArrayBuffer(stream) {
        const reader = stream.getReader();
        const chunks = [];
        let totalLen = 0;
        try {
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                if (value) {
                    chunks.push(value);
                    totalLen += value.length;
                }
            }
        } catch (e) {
            debugLog(`Stream Read Error: ${e.message}`);
            throw e;
        } finally {
            reader.releaseLock();
        }

        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result.buffer;
    }

    async function compressString(str) {
        const encoder = new TextEncoder();
        const input = encoder.encode(str);
        // Use Blob stream to source data
        const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
        return new Uint8Array(await streamToArrayBuffer(stream));
    }

    async function decompressString(compressedBytes) {
        // Use Blob stream to source data
        const stream = new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const buffer = await streamToArrayBuffer(stream);
        const decoder = new TextDecoder();
        return decoder.decode(buffer);
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
