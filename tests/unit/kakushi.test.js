(function() {
    const { register, assert, assertEqual, assertDeepEqual, spyOn } = window.TestRunner;

    // 1. Helpers
    function makeCanvas(w, h, fillRGBA) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (fillRGBA) {
            ctx.fillStyle = `rgba(${fillRGBA.join(',')})`;
            ctx.fillRect(0,0,w,h);
        }
        return c;
    }

    function setPixel(ctx, x, y, rgba) {
        const img = ctx.createImageData(1,1);
        img.data.set(rgba);
        ctx.putImageData(img, x, y);
    }

    function getPixel(ctx, x, y) {
        return ctx.getImageData(x,y,1,1).data;
    }

    const MAGIC = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]);

    // 3. peek Tests
    register('Kakushi: peek detects header', () => {
        const { embedBytes } = window.OkazuTestables.kakushi;
        const c = makeCanvas(2, 2, [10, 20, 30, 255]);
        const ctx = c.getContext('2d');
        const imgData = ctx.getImageData(0, 0, 2, 2);

        // Embed Header: Magic + Length 0 (4 bytes 0)
        const header = new Uint8Array(8);
        header.set(MAGIC, 0);
        embedBytes(imgData.data, header, null);
        ctx.putImageData(imgData, 0, 0);

        const result = window.kakushi.peek(c);
        assertEqual(result, true);
    });

    register('Kakushi: peek header absent', () => {
        const c = makeCanvas(2, 2, [0, 0, 0, 255]); // All LSBs 0
        const result = window.kakushi.peek(c);
        assertEqual(result, false);
    });

    register('Kakushi: peek mask filtering', () => {
        const { embedBytes } = window.OkazuTestables.kakushi;
        const c = makeCanvas(2, 2, [10, 20, 30, 255]);
        const ctx = c.getContext('2d');
        const imgData = ctx.getImageData(0, 0, 2, 2);
        const mask = new Uint8ClampedArray(imgData.data.length);

        // Mask (0,0) - alpha 255
        mask[3] = 255;

        // Write header to (0,0) which is masked?
        // No, `embedBytes` respects mask. So writing with mask prevents writing to (0,0).
        // BUT here we manually write WITHOUT mask to simulate data being there but hidden by mask?
        // Spec 3.3: "Embed magic into pixels that are masked... Inputs: peek(canvas, {mask}) -> false"
        // So we write header into (0,0), then peek with mask covering (0,0).

        const header = new Uint8Array(8);
        header.set(MAGIC, 0);
        // Write blindly (no mask arg)
        embedBytes(imgData.data, header, null);
        ctx.putImageData(imgData, 0, 0);

        // Peek with mask
        const result = window.kakushi.peek(c, { mask });
        assertEqual(result, false, 'Should skip masked pixels and fail to find header');
    });

    // 4. seal Tests
    register('Kakushi: seal capacity check', async () => {
        // 4x1 canvas. Px 0,1,2 opaque. Px 3 transparent.
        const c = makeCanvas(4, 1, [0,0,0,255]);
        const ctx = c.getContext('2d');
        setPixel(ctx, 3, 0, [0,0,0,0]); // Transparent

        // Mask Px 1
        const maskData = new Uint8ClampedArray(4*4);
        maskData[1*4 + 3] = 255; // Px 1 alpha

        // Opaque capacity: Px 0 (valid), Px 1 (masked), Px 2 (valid), Px 3 (trans).
        // Valid: 0 and 2. Count = 2.

        // Payload: "A". Header 8 + Payload ~1 = 9 bytes. 72 bits. 24 pixels needed.
        // Even empty payload needs 8 bytes header (64 bits / 3 = 22 pixels).
        // 2 pixels << 22 pixels.

        let error = null;
        try {
            await window.kakushi.seal(c, "A", { mask: maskData });
        } catch(e) {
            error = e;
        }
        assert(error !== null, 'Should throw');
        assert(error.message.includes("Payload too large"), 'Error message check');
    });

    register('Kakushi: seal final output', async () => {
        const c = makeCanvas(20, 20, [10, 20, 30, 255]);
        const sealed = await window.kakushi.seal(c, "X");

        const ctx = sealed.getContext('2d');
        const data = ctx.getImageData(0,0,20,20).data;

        // Check for modifications
        let changed = false;
        // Original was 10,20,30.
        // Check first few pixels
        for(let i=0; i<32; i++) {
            if (data[i] !== 10 && data[i] !== 20 && data[i] !== 30 && data[i] !== 255) {
                changed = true;
                break;
            }
        }
        assert(changed, 'Should modify pixels');

        // Verify peek
        assert(window.kakushi.peek(sealed), 'Peek should find header');
    });

    // 5. reveal Tests
    register('Kakushi: reveal missing header', async () => {
        const c = makeCanvas(20, 20, [0,0,0,255]); // Zeros
        const res = await window.kakushi.reveal(c);
        assertEqual(res.headerFound, false);
        assertEqual(res.secret, null);
    });

    register('Kakushi: reveal successful', async () => {
        const c = makeCanvas(20, 20, [10, 20, 30, 255]);
        const secret = "Hello World";
        const sealed = await window.kakushi.seal(c, secret);

        const res = await window.kakushi.reveal(sealed);
        assertEqual(res.headerFound, true);
        assertEqual(res.secret, secret);
        assertEqual(res.error, null);
    });

    // 6. Helpers
    register('Kakushi: embed/extract bytes round-trip', () => {
        const { embedBytes, extractBytes } = window.OkazuTestables.kakushi;
        const data = new Uint8ClampedArray(4 * 4); // 4 pixels
        for(let i=0; i<4; i++) data[i*4+3] = 255; // Opaque

        const payload = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
        embedBytes(data, payload, null);
        const extracted = extractBytes(data, payload.length, null);

        assertDeepEqual(Array.from(extracted), Array.from(payload));
    });

    register('Kakushi: isMasked', () => {
        const { isMasked } = window.OkazuTestables.kakushi;
        const mask = new Uint8ClampedArray(8);
        mask[3] = 255; // Px 0 masked
        mask[7] = 0;   // Px 1 unmasked

        assert(isMasked(mask, 0), 'Px 0 masked');
        assert(!isMasked(mask, 4), 'Px 1 unmasked');
    });

    register('Kakushi: toHex', () => {
        const { toHex } = window.OkazuTestables.kakushi;
        const bytes = new Uint8Array([0, 15, 255]);
        assertEqual(toHex(bytes), "0x00 0x0F 0xFF");
    });

})();
