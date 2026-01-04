
// ------------------------------------------------------------------------------------------------
// Watermark Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping watermark tests.');
        return;
    }

    const { register, assert, assertEqual, assertApprox, assertDeepEqual, spyOn } = window.TestRunner;

    // --- 1. Harness & Mocking ---

    function makeCanvas(w, h, fill = [0,0,0,0]) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = `rgba(${fill[0]},${fill[1]},${fill[2]},${fill[3]/255})`;
        ctx.fillRect(0, 0, w, h);
        return { canvas: c, ctx };
    }

    const W = window.OkazuTestables && window.OkazuTestables.watermark;
    const Watermark = window.Watermark;
    if (!W || !Watermark) {
        console.warn('Watermark testables missing');
        return;
    }
    const { rotatePoint, buildMaskCanvas } = W;

    // --- 3. rotatePoint ---

    register('Watermark: 3.1 Deterministic Rounding (0 deg)', () => {
        const p = rotatePoint(10, 15, 0, 0, 0, 1);
        assertEqual(p.x, 10);
        assertEqual(p.y, 15);
    });

    register('Watermark: 3.2 90 deg rotation', () => {
        // around 5,5. 6,5 -> 5,6
        const p = rotatePoint(6, 5, 5, 5, 1, 0); // sin 1, cos 0
        assertEqual(p.x, 5);
        assertEqual(p.y, 6);
    });

    // --- 4. buildMaskCanvas ---

    register('Watermark: 4.1 Output Size', () => {
        const c = buildMaskCanvas(100, 60);
        assertEqual(c.width, 100);
        assertEqual(c.height, 60);
    });

    register('Watermark: 4.3 Binary Alpha', () => {
        const c = buildMaskCanvas(100, 60);
        const data = c.getContext('2d').getImageData(0,0,100,60).data;
        let valid = true;
        for(let i=3; i<data.length; i+=4) {
            if (data[i] !== 0 && data[i] !== 255) {
                valid = false;
                break;
            }
        }
        assert(valid, 'Alpha should be 0 or 255');
    });

    // --- 5. Apply/Remove ---

    register('Watermark: 5.1 Apply is Reversible (XOR)', () => {
        const w=20, h=20;
        const { canvas, ctx } = makeCanvas(w, h, [10, 10, 10, 255]);
        const before = ctx.getImageData(0,0,w,h);

        // Apply twice
        Watermark.apply(ctx, w, h);
        Watermark.apply(ctx, w, h);

        const after = ctx.getImageData(0,0,w,h);
        assertDeepEqual(Array.from(after.data), Array.from(before.data), 'Double apply should revert');
    });

    register('Watermark: 5.2 checkAndRemove Idempotency', () => {
        const w=20, h=20;
        const { canvas, ctx } = makeCanvas(w, h, [10, 10, 10, 255]);
        const originalData = Array.from(ctx.getImageData(0,0,w,h).data);

        // Apply once
        Watermark.apply(ctx, w, h);

        // Remove
        Watermark.checkAndRemove(canvas);
        const firstRemove = Array.from(ctx.getImageData(0,0,w,h).data);
        assertDeepEqual(firstRemove, originalData, 'Should restore original');

        // Remove again (should do nothing)
        Watermark.checkAndRemove(canvas);
        const secondRemove = Array.from(ctx.getImageData(0,0,w,h).data);
        assertDeepEqual(secondRemove, originalData, 'Second removal no-op');
    });

    // --- 6. buildMask ---

    register('Watermark: 6.1 buildMask returns ImageData', () => {
        const id = Watermark.buildMask(100, 60);
        assertEqual(id.width, 100);
        assertEqual(id.height, 60);

        const data = id.data;
        let hasOpaque = false;
        for(let i=3; i<data.length; i+=4) {
            if (data[i] === 255) hasOpaque = true;
        }
        assert(hasOpaque, 'Mask should have some opaque pixels');
    });

})();
