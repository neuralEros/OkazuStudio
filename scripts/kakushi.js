const kakushi = (() => {
    const MAGIC = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"
    const HEADER_BYTES = 8; // 4 bytes Magic + 4 bytes Length

    /**
     * Checks if the image contains the Kakushi signature.
     * Only reads the first few pixels (Header) for O(1) performance.
     * @param {CanvasImageSource} source
     * @returns {boolean}
     */
    function peek(source) {
        try {
            // We need 64 bits (8 bytes) for the header.
            // 3 channels (RGB) per pixel = 21.33 pixels.
            // Reading 24 pixels is safe (covers 72 bits).
            const ctx = getContextForReading(source, 24, 1);
            if (!ctx) return false;

            const imageData = ctx.getImageData(0, 0, 24, 1);
            const headerBytes = extractBytes(imageData.data, HEADER_BYTES);
            return hasMagic(headerBytes);
        } catch (e) {
            console.error("Kakushi peek failed:", e);
            return false;
        }
    }

    /**
     * Embeds a secret string into the source image.
     * Uses GZIP compression and dynamic resizing.
     * @param {CanvasImageSource} source
     * @param {string} secret
     * @returns {Promise<HTMLCanvasElement>} The laced canvas.
     */
    async function seal(source, secret) {
        // 1. Compress the secret
        const compressed = await compressString(secret);

        // 2. Prepare Header
        const header = new Uint8Array(HEADER_BYTES);
        header.set(MAGIC, 0);
        const view = new DataView(header.buffer);
        view.setUint32(4, compressed.length, false); // Big Endian length

        // 3. Combine Header + Data
        const payload = new Uint8Array(header.length + compressed.length);
        payload.set(header, 0);
        payload.set(compressed, header.length);

        // 4. Create output canvas (clone of source)
        const canvas = document.createElement('canvas');
        const w = source.naturalWidth || source.width;
        const h = source.naturalHeight || source.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0);

        // 5. Calculate required region
        const channels = 3; // RGB only
        const bitsNeeded = payload.length * 8;
        const pixelsNeeded = Math.ceil(bitsNeeded / channels);

        if (pixelsNeeded > w * h) {
            throw new Error(`Payload too large: need ${pixelsNeeded} pixels, have ${w * h}`);
        }

        // Optimize: Only read the rows we need
        const rowsNeeded = Math.ceil(pixelsNeeded / w);

        // 6. Embed Data
        const imageData = ctx.getImageData(0, 0, w, rowsNeeded);
        embedBytes(imageData.data, payload);
        ctx.putImageData(imageData, 0, 0);

        return canvas;
    }

    /**
     * Extracts the secret string and returns a sanitized image.
     * @param {CanvasImageSource} source
     * @returns {Promise<{ cleanImage: HTMLCanvasElement, secret: string|null }>}
     */
    async function reveal(source) {
        // 1. Create a working copy (which will become the clean image)
        const canvas = document.createElement('canvas');
        const w = source.naturalWidth || source.width;
        const h = source.naturalHeight || source.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0);

        // 2. Read Header (First 24 pixels)
        const headerRegion = ctx.getImageData(0, 0, 24, 1);
        const headerBytes = extractBytes(headerRegion.data, HEADER_BYTES);

        if (!hasMagic(headerBytes)) {
            return { cleanImage: canvas, secret: null };
        }

        // 3. Get Payload Length
        const view = new DataView(headerBytes.buffer);
        const payloadLength = view.getUint32(4, false);

        if (payloadLength === 0) {
             // Wipe just the header and return
             sanitizeRegion(headerRegion.data, HEADER_BYTES * 8);
             ctx.putImageData(headerRegion, 0, 0);
             return { cleanImage: canvas, secret: "" };
        }

        // 4. Calculate Full Region
        const totalBytes = HEADER_BYTES + payloadLength;
        const bitsNeeded = totalBytes * 8;
        const pixelsNeeded = Math.ceil(bitsNeeded / 3);
        const rowsNeeded = Math.ceil(pixelsNeeded / w);

        // 5. Read Full Data Region
        const imageData = ctx.getImageData(0, 0, w, rowsNeeded);
        const fullBytes = extractBytes(imageData.data, totalBytes);
        const compressedPayload = fullBytes.slice(HEADER_BYTES);

        // 6. Sanitize (Wipe LSBs)
        // We wipe exactly as many bits as we read, plus padding to the next pixel?
        // Simpler: We wipe the LSBs of every pixel involved in the transaction.
        sanitizeRegion(imageData.data, bitsNeeded);
        ctx.putImageData(imageData, 0, 0);

        // 7. Decompress
        try {
            const secret = await decompressString(compressedPayload);
            return { cleanImage: canvas, secret };
        } catch (e) {
            console.error("Decompression failed:", e);
            return { cleanImage: canvas, secret: null }; // Should we fail hard?
        }
    }

    // --- Helpers ---

    function getContextForReading(source, w, h) {
        // If it's already a context or canvas, use it.
        // If image, draw to small canvas.
        if (source instanceof HTMLCanvasElement) {
            return source.getContext('2d');
        }
        if (source instanceof CanvasRenderingContext2D) {
            return source;
        }
        // HTMLImageElement or others
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(source, 0, 0, w, h, 0, 0, w, h);
        return ctx;
    }

    function embedBytes(data, bytes) {
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
            // R, G, B only
            for (let c = 0; c < 3; c++) {
                if (byteIndex >= bytes.length) return;

                const bit = (bytes[byteIndex] >> (7 - bitIndex)) & 1;
                // Clear LSB then set it
                data[i + c] = (data[i + c] & 0xFE) | bit;

                bitIndex++;
                if (bitIndex === 8) {
                    bitIndex = 0;
                    byteIndex++;
                }
            }
        }
    }

    function extractBytes(data, byteCount) {
        const bytes = new Uint8Array(byteCount);
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
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

    function sanitizeRegion(data, bitsToWipe) {
        let bitsWiped = 0;
        for (let i = 0; i < data.length; i += 4) {
             for (let c = 0; c < 3; c++) {
                 if (bitsWiped >= bitsToWipe) return;
                 // Set LSB to 0
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
