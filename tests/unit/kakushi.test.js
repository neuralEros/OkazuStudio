
// ------------------------------------------------------------------------------------------------
// Kakushi Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping kakushi tests.');
        return;
    }

    const { register, assert, assertEqual, assertApprox, assertDeepEqual, spyOn } = window.TestRunner;

    // --- 1. Harness & Mocking ---

    // Stub global compression utils if pako/etc are not available in test env
    // Assuming scripts/kakushi.js handles compression.
    // We will spy on internal helper methods if exposed or global window methods if used.
    // Kakushi usually uses pako. If pako is missing, it might fail or fallback.
    // Let's stub window.pako if needed.

    window.pako = window.pako || {
        deflate: (str) => new TextEncoder().encode(str), // Fake deflate
        inflate: (bytes) => new TextDecoder().decode(bytes) // Fake inflate
    };

    // Helper: Create 2D context with data
    function makeCtx(w, h, fill = [0,0,0,0]) {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = fill[0]; data[i+1] = fill[1]; data[i+2] = fill[2]; data[i+3] = fill[3];
        }

        return {
            canvas: { width: w, height: h },
            getImageData: () => ({ width: w, height: h, data }),
            putImageData: (imgData) => { data.set(imgData.data); },
            clearRect: () => {},
            drawImage: () => {}
        };
    }

    const Kakushi = window.OkazuTestables && window.OkazuTestables.kakushi;
    if (!Kakushi) {
        console.warn('Kakushi testables missing');
        return;
    }

    const { embedBytes, extractBytes, hasMagic, sanitizeRegion, normalizeMask, isMasked, getContextForReading } = Kakushi;

    // --- 3. peek Tests ---

    register('Kakushi: 3.1 Header Detection (Present)', () => {
        const w = 4, h = 4;
        const ctx = makeCtx(w, h, [10, 20, 30, 255]); // Opaque
        const data = ctx.getImageData(0,0,w,h).data;

        // Embed Header: Magic + Length 0
        // Magic: 0x4F, 0x4B, 0x5A, 0x31 (4 bytes)
        // Length: 0 (4 bytes)
        const header = new Uint8Array([0x4F, 0x4B, 0x5A, 0x31, 0, 0, 0, 0]);
        embedBytes(data, header, null);
        ctx.putImageData({ data, width: w, height: h });

        const result = window.kakushi.peek(ctx.canvas);
        assert(result, 'Should detect header');
    });

    register('Kakushi: 3.2 Header Detection (Absent)', () => {
        const w = 4, h = 4;
        const ctx = makeCtx(w, h, [10, 20, 30, 255]); // Opaque, LSBs 0 (even numbers)
        // Ensure LSBs are 0
        const data = ctx.getImageData(0,0,w,h).data;
        for(let i=0; i<data.length; i++) data[i] &= 0xFE;
        ctx.putImageData({data, width:w, height:h});

        const result = window.kakushi.peek(ctx.canvas);
        assert(!result, 'Should not detect header');
    });

    // --- 4. seal Tests ---

    register('Kakushi: 4.1 Capacity Calculation', async () => {
        const w = 4, h = 1;
        const ctx = makeCtx(w, h, [255, 255, 255, 255]);
        const data = ctx.getImageData(0,0,w,h).data;

        // Pixel 3 Transparent
        data[3*4 + 3] = 0;

        // Mask Pixel 1
        const mask = new Uint8Array(data.length);
        mask[1*4 + 3] = 255;

        // Effective pixels: Index 0 (Opaque, Unmasked), Index 2 (Opaque, Unmasked).
        // Total 2 pixels * 3 channels = 6 bits.
        // Header requires 8 bytes (64 bits).
        // Should throw.

        try {
            await window.kakushi.seal(ctx.canvas, "A", { mask: { data: mask } });
            assert(false, 'Should have thrown Payload too large');
        } catch (e) {
            assert(e.message.includes('Payload too large'), `Unexpected error: ${e.message}`);
        }
    });

    register('Kakushi: 4.3 Proper Header Writing', async () => {
        const w = 20, h = 20;
        const ctx = makeCtx(w, h, [255, 255, 255, 255]);

        const sealedCanvas = await window.kakushi.seal(ctx.canvas, "hello");
        const sealedCtx = sealedCanvas.getContext('2d');
        const data = sealedCtx.getImageData(0, 0, w, h).data;

        const header = extractBytes(data, 8, null); // Extract first 8 bytes

        assertEqual(header[0], 0x4F, 'Magic 0');
        assertEqual(header[1], 0x4B, 'Magic 1');
        assertEqual(header[2], 0x5A, 'Magic 2');
        assertEqual(header[3], 0x31, 'Magic 3');
    });

    register('Kakushi: 4.4 MSB-first bit order', () => {
        const w = 1, h = 1;
        const data = new Uint8ClampedArray(4); // 1 pixel
        data[0] = 0; data[1] = 0; data[2] = 0; data[3] = 255; // All 0

        // 0xA0 = 10100000
        // Bits: 1, 0, 1, ...
        // RGB indices: 0, 1, 2.
        // Expect: R=1, G=0, B=1.

        embedBytes(data, new Uint8Array([0xA0]), null);

        assertEqual(data[0] & 1, 1, 'Bit 0 (1)');
        assertEqual(data[1] & 1, 0, 'Bit 1 (0)');
        assertEqual(data[2] & 1, 1, 'Bit 2 (1)');
    });

    // --- 5. reveal Tests ---

    register('Kakushi: 5.1 Header Missing', async () => {
        const w = 4, h = 4;
        const ctx = makeCtx(w, h, [0, 0, 0, 255]);

        const result = await window.kakushi.reveal(ctx.canvas);
        assert(!result.headerFound, 'Header should not be found');
        assertEqual(result.secret, null, 'Secret should be null');
    });

    register('Kakushi: 5.3 Payload Extraction', async () => {
        const w = 10, h = 10;
        const ctx = makeCtx(w, h, [128, 128, 128, 255]);
        const data = ctx.getImageData(0,0,w,h).data;

        // Header: Magic + Length 2
        const header = new Uint8Array([0x4F, 0x4B, 0x5A, 0x31, 0, 0, 0, 2]);
        // Payload: AA 55
        // Total embed order: Header then Payload
        const combined = new Uint8Array(10);
        combined.set(header);
        combined.set([0xAA, 0x55], 8);

        embedBytes(data, combined, null);
        ctx.putImageData({ data, width: w, height: h });

        // reveal uses inflate. AA 55 is raw.
        // We mocked pako to be text encoder/decoder.
        // AA 55 is invalid utf-8 likely?
        // Let's use a payload that survives our mock pako.
        // Mock pako.inflate(bytes) -> returns string.
        // For test 5.3 we want to check extraction logic.
        // Let's just spy on pako.inflate and check what it received.

        const inflateSpy = spyOn(window.pako, 'inflate');
        inflateSpy.mockImplementation((bytes) => {
            // bytes should be AA 55
            if (bytes.length === 2 && bytes[0] === 0xAA && bytes[1] === 0x55) return "OK";
            return "FAIL";
        });

        const result = await window.kakushi.reveal(ctx.canvas);

        assertEqual(result.secret, "OK");

        inflateSpy.restore();
    });

    register('Kakushi: 5.4 Sanitize Region', async () => {
         const w = 10, h = 10;
         const ctx = makeCtx(w, h, [128, 128, 128, 255]);
         const data = ctx.getImageData(0,0,w,h).data;

         // Embed Header + Length 1 + 1 byte
         const header = new Uint8Array([0x4F, 0x4B, 0x5A, 0x31, 0, 0, 0, 1]);
         const payload = new Uint8Array([0xFF]);
         const combined = new Uint8Array(9);
         combined.set(header);
         combined[8] = 0xFF;

         embedBytes(data, combined, null);

         // Verify LSBs set
         // 9 bytes * 8 bits = 72 bits.
         // 72 / 3 channels per pixel = 24 pixels needed. 10x10=100. OK.

         ctx.putImageData({data, width:w, height:h});

         const result = await window.kakushi.reveal(ctx.canvas);

         // result.cleanImage should have LSBs zeroed in used region
         const cleanCtx = result.cleanImage.getContext('2d');
         const cleanData = cleanCtx.getImageData(0,0,w,h).data;

         // Check first few bits (header area)
         assertEqual(cleanData[0] & 1, 0, 'First pixel R cleaned');
         assertEqual(cleanData[1] & 1, 0, 'First pixel G cleaned');
    });

    // --- 6. Helper Tests ---

    register('Kakushi: 6.3 Embed/Extract Round Trip', () => {
        const w = 4, h = 4;
        const data = new Uint8ClampedArray(w*h*4);
        data.fill(128);
        for(let i=3; i<data.length; i+=4) data[i]=255;

        const payload = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
        embedBytes(data, payload, null);
        const extracted = extractBytes(data, payload.length, null);

        assertDeepEqual(Array.from(extracted), Array.from(payload));
    });

    register('Kakushi: 6.5 hasMagic', () => {
        assert(hasMagic(new Uint8Array([0x4F, 0x4B, 0x5A, 0x31])), 'Magic match');
        assert(!hasMagic(new Uint8Array([0, 1, 2, 3])), 'Magic mismatch');
    });

})();
