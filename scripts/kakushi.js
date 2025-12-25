const kakushi = (() => {
    const MAGIC = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"
    const HEADER_BYTES = 8;

    function encodeStringToCanvas(source, message, options = {}) {
        const { includeAlpha = false } = options;
        const { canvas, ctx, imageData } = getImageDataFromSource(source);
        const encoder = new TextEncoder();
        const payload = encoder.encode(message);
        const header = new Uint8Array(HEADER_BYTES);
        header.set(MAGIC, 0);
        const view = new DataView(header.buffer);
        view.setUint32(4, payload.length, false);
        const bytes = new Uint8Array(header.length + payload.length);
        bytes.set(header, 0);
        bytes.set(payload, header.length);

        const channels = includeAlpha ? 4 : 3;
        const capacityBits = Math.floor(imageData.data.length / 4) * channels;
        const neededBits = bytes.length * 8;
        if (neededBits > capacityBits) {
            throw new Error(`Payload too large: need ${neededBits} bits, have ${capacityBits} bits`);
        }

        embedBytes(imageData.data, bytes, { includeAlpha });
        ctx.putImageData(imageData, 0, 0);

        return {
            canvas,
            bytesWritten: bytes.length,
            capacityBits,
            usedBits: neededBits,
        };
    }

    function decodeStringFromCanvas(source, options = {}) {
        const { includeAlpha = false } = options;
        const { imageData } = getImageDataFromSource(source);
        const headerBytes = extractBytes(imageData.data, HEADER_BYTES, { includeAlpha });
        if (!hasMagic(headerBytes)) {
            return null;
        }
        const view = new DataView(headerBytes.buffer);
        const length = view.getUint32(4, false);
        if (length === 0) {
            return "";
        }
        const payloadBytes = extractBytes(imageData.data, HEADER_BYTES + length, { includeAlpha });
        const payload = payloadBytes.slice(HEADER_BYTES);
        const decoder = new TextDecoder();
        return decoder.decode(payload);
    }

    function getImageDataFromSource(source) {
        if (source instanceof ImageData) {
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(source, 0, 0);
            return { canvas, ctx, imageData: source };
        }
        if (source instanceof HTMLCanvasElement) {
            const ctx = source.getContext('2d');
            const imageData = ctx.getImageData(0, 0, source.width, source.height);
            return { canvas: source, ctx, imageData };
        }
        if (source instanceof HTMLImageElement) {
            const canvas = document.createElement('canvas');
            const w = source.naturalWidth || source.width;
            const h = source.naturalHeight || source.height;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0);
            const imageData = ctx.getImageData(0, 0, w, h);
            return { canvas, ctx, imageData };
        }
        throw new Error('Unsupported source type for kakushi encoding.');
    }

    function embedBytes(data, bytes, { includeAlpha }) {
        const channels = includeAlpha ? 4 : 3;
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < channels; c++) {
                if (byteIndex >= bytes.length) {
                    return;
                }
                const bit = (bytes[byteIndex] >> (7 - bitIndex)) & 1;
                data[i + c] = (data[i + c] & 0xfe) | bit;
                bitIndex++;
                if (bitIndex === 8) {
                    bitIndex = 0;
                    byteIndex++;
                }
            }
        }
    }

    function extractBytes(data, byteCount, { includeAlpha }) {
        const channels = includeAlpha ? 4 : 3;
        const bytes = new Uint8Array(byteCount);
        let byteIndex = 0;
        let bitIndex = 0;

        for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < channels; c++) {
                const bit = data[i + c] & 1;
                bytes[byteIndex] = (bytes[byteIndex] << 1) | bit;
                bitIndex++;
                if (bitIndex === 8) {
                    bitIndex = 0;
                    byteIndex++;
                    if (byteIndex >= byteCount) {
                        return bytes;
                    }
                }
            }
        }
        return bytes;
    }

    function hasMagic(header) {
        if (header.length < MAGIC.length) return false;
        for (let i = 0; i < MAGIC.length; i++) {
            if (header[i] !== MAGIC[i]) return false;
        }
        return true;
    }

    return {
        encodeStringToCanvas,
        decodeStringFromCanvas,
    };
})();

window.kakushi = kakushi;
