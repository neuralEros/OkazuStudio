const kakushi = (() => {
    const MAGIC = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"
    const HEADER_BYTES = 8; // 4 bytes Magic + 4 bytes Length

    function log(msg) {
        if (window.Logger && window.Logger.info) {
            window.Logger.info(`[Kakushi] ${msg}`);
        } else {
            console.log(`[Kakushi] ${msg}`);
        }
    }

    function toHex(uint8arr) {
        return Array.from(uint8arr).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
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
            log(`Peek scanning image: ${w}x${h}`);

            const ctx = getContextForReading(source, w, h);
            if (!ctx) {
                log("Peek failed: Could not get context");
                return false;
            }

            const imageData = ctx.getImageData(0, 0, w, h);
            const mask = normalizeMask(options, imageData.data.length);
            const headerBytes = extractBytes(imageData.data, HEADER_BYTES, mask);

            log(`Peek read header bytes: ${toHex(headerBytes)}`);
            const found = hasMagic(headerBytes);
            log(`Peek result: ${found ? 'FOUND at offset 0' : 'NOT FOUND'}`);

            return found;
        } catch (e) {
            console.error("Kakushi peek failed:", e);
            log(`Peek error: ${e.message}`);
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
        log(`Seal started. Payload length: ${secret.length} chars`);
        const compressed = await compressString(secret);
        log(`Compressed payload: ${compressed.length} bytes`);

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
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i+=4) {
            // STRICT OPACITY CHECK: Alpha must be 255.
            if (data[i+3] === 255 && !isMasked(mask, i)) opaquePixels++;
        }

        const bitsNeeded = payload.length * 8;
        const pixelsNeeded = Math.ceil(bitsNeeded / 3);
        log(`Capacity check: Need ${pixelsNeeded} pixels, have ${opaquePixels} opaque pixels.`);

        if (pixelsNeeded > opaquePixels) {
            log(`Seal failed: Payload too large (Need ${pixelsNeeded}, Have ${opaquePixels})`);
            throw new Error(`Payload too large: need ${pixelsNeeded} opaque pixels, have ${opaquePixels}`);
        }

        embedBytes(data, payload, mask);
        ctx.putImageData(imageData, 0, 0);
        log("Seal complete: Payload embedded.");

        return canvas;
    }

    /**
     * Extracts the secret string and returns a sanitized image.
     * @param {CanvasImageSource} source
     * @returns {Promise<{ cleanImage: HTMLCanvasElement, secret: string|null, headerFound: boolean, error: string|null }>}
     */
    async function reveal(source, options = {}) {
        log("Reveal started.");
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

        // Extract Header
        const headerBytes = extractBytes(data, HEADER_BYTES, mask);

        if (!hasMagic(headerBytes)) {
            log(`Reveal: Header NOT found. First bytes: ${toHex(headerBytes)}`);
            return { cleanImage: canvas, secret: null, headerFound: false, error: null };
        }
        log("Reveal: Header found at offset 0.");

        const view = new DataView(headerBytes.buffer);
        const payloadLength = view.getUint32(4, false);
        log(`Reveal: Payload Length ${payloadLength} bytes.`);

        if (payloadLength === 0) {
             log("Reveal: Empty payload.");
             sanitizeRegion(data, HEADER_BYTES * 8, mask);
             ctx.putImageData(imageData, 0, 0);
             return { cleanImage: canvas, secret: "", headerFound: true, error: null };
        }

        const totalBytes = HEADER_BYTES + payloadLength;
        const bitsNeeded = totalBytes * 8;

        // Extract Full Payload
        const fullBytes = extractBytes(data, totalBytes, mask);
        log(`Reveal: Extracted ${fullBytes.length} bytes.`);

        const compressedPayload = fullBytes.slice(HEADER_BYTES);

        sanitizeRegion(data, bitsNeeded, mask);
        ctx.putImageData(imageData, 0, 0);

        try {
            const secret = await decompressString(compressedPayload);
            log(`Reveal: Decompression successful (${secret.length} chars).`);
            return { cleanImage: canvas, secret, headerFound: true, error: null };
        } catch (e) {
            console.error("Decompression failed:", e);
            log(`Reveal error: Decompression failed - ${e.message}`);
            // Log a sample of the compressed payload for debugging
            const sample = toHex(compressedPayload.slice(0, 16));
            log(`Reveal: Compressed payload sample (first 16 bytes): ${sample}`);
            return { cleanImage: canvas, secret: null, headerFound: true, error: e.message };
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

    function embedBytes(data, bytes, mask) {
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 255 || isMasked(mask, i)) continue;

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

    function extractBytes(data, byteCount, mask) {
        const bytes = new Uint8Array(byteCount);
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 255 || isMasked(mask, i)) continue;

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

    function sanitizeRegion(data, bitsToWipe, mask) {
        let bitsWiped = 0;
        for (let i = 0; i < data.length; i += 4) {
             if (data[i + 3] < 255 || isMasked(mask, i)) continue;

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

    async function streamToArrayBuffer(stream) {
        const reader = stream.getReader();
        const chunks = [];
        let totalLen = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLen += value.length;
        }
        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }

    async function compressString(str) {
        const encoder = new TextEncoder();
        const input = encoder.encode(str);
        // Create stream from input
        const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
        return await streamToArrayBuffer(stream);
    }

    async function decompressString(compressedBytes) {
        // Create stream from bytes
        const stream = new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const decompressed = await streamToArrayBuffer(stream);
        const decoder = new TextDecoder();
        return decoder.decode(decompressed);
    }

    const testables = {
        embedBytes,
        extractBytes,
        hasMagic,
        normalizeMask,
        isMasked,
        sanitizeRegion,
        toHex
    };

    return {
        peek,
        seal,
        reveal,
        _testables: testables
    };
})();

if (typeof module !== 'undefined') {
    module.exports = kakushi;
} else {
    window.kakushi = kakushi;
}

if (typeof window !== 'undefined') {
    window.OkazuTestables = window.OkazuTestables || {};
    window.OkazuTestables.kakushi = kakushi._testables;
}
