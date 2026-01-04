(function() {
    const { register, assert, assertEqual, assertDeepEqual } = window.TestRunner;
    const {
        embedBytes, extractBytes, getContextForReading, hasMagic,
        normalizeMask, isMasked, sanitizeRegion, toHex
    } = window.OkazuTestables.kakushi;

    // 1. Test Harness + Helpers
    function makeCanvas(w, h, fillRGBA = [0,0,0,0]) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = `rgba(${fillRGBA[0]},${fillRGBA[1]},${fillRGBA[2]},${fillRGBA[3]/255})`;
        ctx.fillRect(0, 0, w, h);
        return canvas;
    }

    function setPixel(ctx, x, y, rgba) {
        const id = ctx.createImageData(1, 1);
        id.data[0] = rgba[0]; id.data[1] = rgba[1]; id.data[2] = rgba[2]; id.data[3] = rgba[3];
        ctx.putImageData(id, x, y);
    }

    function getPixel(ctx, x, y) {
        return ctx.getImageData(x, y, 1, 1).data;
    }

    function asImageData(canvas) {
        return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    }

    const MAGIC = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"

    // 6. Helper Tests
    register('Kakushi: Helpers', async () => {
        // 6.1 getContextForReading
        const cvs = makeCanvas(10, 10, [255, 0, 0, 255]);
        const ctx = getContextForReading(cvs, 10, 10);
        assert(ctx instanceof CanvasRenderingContext2D, 'Returns Context');
        const p = getPixel(ctx, 0, 0);
        assertEqual(p[0], 255, 'Reads Red');

        // 6.2 normalizeMask/isMasked
        const maskData = new Uint8ClampedArray(8); // 2 pixels
        maskData[3] = 255; // First pixel opaque (masked)
        maskData[7] = 0;   // Second pixel transparent (not masked)
        const opts = { mask: maskData };
        const norm = normalizeMask(opts, 8);
        assert(norm === maskData, 'Returns mask');
        assert(isMasked(norm, 0), 'Pixel 0 is masked');
        assert(!isMasked(norm, 4), 'Pixel 1 is not masked');

        // 6.5 hasMagic
        assert(hasMagic(MAGIC), 'Detects magic');
        assert(!hasMagic(new Uint8Array([0,0,0,0])), 'Rejects zero');

        // 6.6 toHex
        assertEqual(toHex(new Uint8Array([0, 255, 16])), '0x00 0xFF 0x10', 'Hex formatting');
    });

    // 3. peek Tests (Logic check via extractBytes/hasMagic manual integration)
    register('Kakushi: Header Detection Logic', async () => {
        // 3.1 Header present
        // Create 4x1 opaque canvas.
        // We need 8 bytes (64 bits) for header. 3 bits per pixel -> 22 pixels.
        // Let's use a 10x10 canvas (100 pixels).
        const cvs = makeCanvas(10, 10, [10, 10, 10, 255]);
        const id = asImageData(cvs);

        // Manually embed magic
        // Fake a header: Magic + 4 bytes length (0)
        const header = new Uint8Array(8);
        header.set(MAGIC, 0);
        // Length 0 at bytes 4-7
        embedBytes(id.data, header, null);

        // Extract
        const extracted = extractBytes(id.data, 8, null);
        assert(hasMagic(extracted), 'Extracted matches magic');

        // 3.2 Header absent
        const cvs2 = makeCanvas(10, 10, [10, 10, 10, 255]); // Clean LSBs (all even/zeroish)
        const id2 = asImageData(cvs2);
        const ex2 = extractBytes(id2.data, 8, null);
        assert(!hasMagic(ex2), 'Clean canvas has no magic');
    });

    // 4. seal/embedBytes Tests
    register('Kakushi: Embedding Logic', async () => {
        // 4.4 embedBytes bit order
        const data = new Uint8ClampedArray([0,0,0,255]); // 1 pixel opaque
        // Embed 1 byte: 0b10100000 (0xA0)
        // Order: R(7), G(6), B(5).
        // 1, 0, 1.
        // Result: R=1, G=0, B=1.
        const payload = new Uint8Array([0xA0]);
        embedBytes(data, payload, null);
        assertEqual(data[0], 1, 'Bit 7 -> R');
        assertEqual(data[1], 0, 'Bit 6 -> G');
        assertEqual(data[2], 1, 'Bit 5 -> B');

        // 4.1 Capacity Check Logic (Simulated)
        // 4 opaque pixels. 4*3 = 12 bits capacity.
        // Payload 2 bytes = 16 bits.
        // embedBytes should stop or be safe? The function 'embedBytes' just returns if out of data.
        // But 'seal' throws. We are testing units here.
        const smallData = new Uint8ClampedArray(4 * 4); // 4 pixels
        smallData.fill(255); // All opaque white
        // Try to embed 2 bytes (16 bits).
        // Px0: 3 bits. Px1: 3 bits. Px2: 3 bits. Px3: 3 bits. Total 12.
        // Should write first 12 bits.
        const largePayload = new Uint8Array([0xFF, 0xFF]); // 11111111 11111111
        embedBytes(smallData, largePayload, null);
        // Expect all LSBs to be 1.
        // 255 is 11111111. LSB is 1.
        // Let's use 254 (11111110) to see changes.
        smallData.fill(254); smallData[3]=255; smallData[7]=255; smallData[11]=255; smallData[15]=255;
        embedBytes(smallData, largePayload, null);
        // Check LSBs.
        assert((smallData[0] & 1) === 1, 'Px0 R set');
        // Check last available bit (Px3 B). Index 14.
        assert((smallData[14] & 1) === 1, 'Px3 B set');
    });

    // 5. reveal/sanitize Tests
    register('Kakushi: Reveal/Sanitize Logic', async () => {
        // 5.4 Sanitize
        // 2 pixels. All 255 (LSB 1).
        const data = new Uint8ClampedArray(8);
        data.fill(255);
        // Wipe 4 bits.
        // Px0 R(0), G(1), B(2). Px1 R(0).
        sanitizeRegion(data, 4, null);
        assertEqual(data[0], 254, 'Px0 R wiped');
        assertEqual(data[1], 254, 'Px0 G wiped');
        assertEqual(data[2], 254, 'Px0 B wiped');
        assertEqual(data[4], 254, 'Px1 R wiped'); // Index 4 is R of 2nd pixel
        assertEqual(data[5], 255, 'Px1 G untouched');
    });

})();
