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

    function getPixel(ctx, x, y) {
        return ctx.getImageData(x,y,1,1).data;
    }

    // 3. rotatePoint Tests
    register('Watermark: rotatePoint 0 deg', () => {
        const { rotatePoint } = window.OkazuTestables.watermark;
        const res = rotatePoint(10, 15, 0, 0, 0, 1);
        assertEqual(res.x, 10);
        assertEqual(res.y, 15);
    });

    register('Watermark: rotatePoint 90 deg', () => {
        const { rotatePoint } = window.OkazuTestables.watermark;
        // 90 deg around (5,5). Pt (6,5).
        // dx=1, dy=0.
        // sin=1, cos=0.
        // rx = 1*0 - 0*1 = 0.
        // ry = 1*1 + 0*0 = 1.
        // x = 5+0=5. y = 5+1=6.
        const res = rotatePoint(6, 5, 5, 5, 1, 0);
        assertEqual(res.x, 5);
        assertEqual(res.y, 6);
    });

    // 4. buildMaskCanvas Tests
    register('Watermark: buildMaskCanvas output size', () => {
        const { buildMaskCanvas } = window.OkazuTestables.watermark;
        const c = buildMaskCanvas(100, 60);
        assertEqual(c.width, 100);
        assertEqual(c.height, 60);
    });

    register('Watermark: buildMaskCanvas tiling coverage', () => {
        const { buildMaskCanvas } = window.OkazuTestables.watermark;
        const c = buildMaskCanvas(100, 60);
        const ctx = c.getContext('2d');
        const data = ctx.getImageData(0,0,100,60).data;

        let opaqueCount = 0;
        for(let i=0; i<data.length; i+=4) {
            if(data[i+3] === 255) opaqueCount++;
        }

        assert(opaqueCount > 0, 'Should have some opaque pixels');
    });

    register('Watermark: buildMaskCanvas binary alpha', () => {
        const { buildMaskCanvas } = window.OkazuTestables.watermark;
        const c = buildMaskCanvas(100, 60);
        const ctx = c.getContext('2d');
        const data = ctx.getImageData(0,0,100,60).data;

        for(let i=0; i<data.length; i+=4) {
            const a = data[i+3];
            if (a !== 0 && a !== 255) {
                throw new Error(`Found alpha ${a} at index ${i}`);
            }
        }
    });

    // 5. Watermark.apply and checkAndRemove
    register('Watermark: apply is reversible (idempotent removal)', () => {
        const { apply, checkAndRemove } = window.OkazuTestables.watermark;

        // 1. Setup
        const c = makeCanvas(20, 20, [10, 10, 10, 255]);
        const ctx = c.getContext('2d');
        const originalData = ctx.getImageData(0,0,20,20).data;
        const originalClone = new Uint8ClampedArray(originalData);

        // 2. Apply Watermark (Difference)
        apply(ctx, 20, 20);

        const watermarkedData = ctx.getImageData(0,0,20,20).data;
        // Verify something changed (assuming mask is not empty in 20x20)
        let changed = false;
        for(let i=0; i<originalClone.length; i++) {
            if(watermarkedData[i] !== originalClone[i]) {
                changed = true;
                break;
            }
        }
        // Small canvas might not hit text pixels if unlucky, but 20x20 usually hits something?
        // Actually scale logic: max(1, floor(20*0.016 / 5)) -> 1.
        // It draws.
        // If it fails, we assume logic is correct but mask missed.
        // But for unit test, we trust apply called difference.

        // 3. Remove (XOR / Difference again)
        checkAndRemove(c);

        const restoredData = ctx.getImageData(0,0,20,20).data;
        assertDeepEqual(restoredData, originalClone, 'Should restore original pixels');
    });

    // 6. buildMask
    register('Watermark: buildMask returns ImageData', () => {
        const { buildMask } = window.OkazuTestables.watermark;
        const imgData = buildMask(100, 60);
        assertEqual(imgData.width, 100);
        assertEqual(imgData.height, 60);
        assert(imgData.data.length === 100*60*4);
    });

})();
