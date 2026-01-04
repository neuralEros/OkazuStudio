(function() {
    const { register, assert, assertEqual, assertDeepEqual } = window.TestRunner;
    const {
        buildMaskCanvas, rotatePoint, apply, buildMask, checkAndRemove
    } = window.OkazuTestables.watermark;

    // 1. Helpers
    function makeCanvas(w, h, fill = [0,0,0,0]) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = `rgba(${fill[0]},${fill[1]},${fill[2]},${fill[3]/255})`;
        ctx.fillRect(0,0,w,h);
        return c;
    }

    function getPixel(ctx, x, y) {
        return ctx.getImageData(x, y, 1, 1).data;
    }

    // 3. rotatePoint Tests
    register('Watermark: rotatePoint', () => {
        // 3.1 0 deg
        const p0 = rotatePoint(10, 15, 0, 0, 0, 1);
        assertDeepEqual(p0, { x: 10, y: 15 });

        // 3.2 90 deg around (5,5)
        // Point (6,5). dx=1, dy=0.
        // sin=1, cos=0.
        // rx = 1*0 - 0*1 = 0.
        // ry = 1*1 + 0*0 = 1.
        // x = 0+5=5. y=1+5=6.
        const p90 = rotatePoint(6, 5, 5, 5, 1, 0);
        assertDeepEqual(p90, { x: 5, y: 6 });
    });

    // 4. buildMaskCanvas Tests
    register('Watermark: buildMaskCanvas', () => {
        // 4.1 Size
        const cvs = buildMaskCanvas(100, 60);
        assertEqual(cvs.width, 100);
        assertEqual(cvs.height, 60);

        // 4.3 Binary Alpha
        const ctx = cvs.getContext('2d');
        const data = ctx.getImageData(0, 0, 100, 60).data;
        let hasOpaque = false;
        let hasTransparent = false;
        for (let i=3; i<data.length; i+=4) {
            if (data[i] === 255) hasOpaque = true;
            else if (data[i] === 0) hasTransparent = true;
            else throw new Error(`Non-binary alpha: ${data[i]}`);
        }
        assert(hasOpaque, 'Has content');
        assert(hasTransparent, 'Has holes');
    });

    // 5. Apply / Remove Tests
    register('Watermark: Application Logic', () => {
        const w = 20, h = 20;
        const cvs = makeCanvas(w, h, [10, 10, 10, 255]);
        const ctx = cvs.getContext('2d');

        // Capture original
        const orig = ctx.getImageData(0,0,w,h).data;
        const origCopy = new Uint8ClampedArray(orig);

        // 5.1 Apply
        apply(ctx, w, h);
        const watermarked = ctx.getImageData(0,0,w,h).data;

        // Should differ
        let diff = false;
        for(let i=0; i<orig.length; i++) if (watermarked[i] !== orig[i]) diff = true;
        assert(diff, 'Watermark applied changes');

        // 5.2 Remove (Idempotent / XOR)
        // checkAndRemove applies it again (XOR)
        checkAndRemove(cvs);
        const restored = ctx.getImageData(0,0,w,h).data;

        // Verify byte-for-byte equality
        for(let i=0; i<orig.length; i++) {
            if (restored[i] !== origCopy[i]) {
                throw new Error(`Mismatch at ${i}: ${restored[i]} vs ${origCopy[i]}`);
            }
        }
        assert(true, 'Restored perfectly');
    });

})();
