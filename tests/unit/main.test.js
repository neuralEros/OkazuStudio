(function() {
    const { register, assert, assertEqual, assertApprox, assertDeepEqual } = window.TestRunner;

    // We need to access the module internals exposed via OkazuTestables.main
    // Since main.js runs immediately on load, we must ensure it's ready.

    // 1. Test Harness
    register('Main: Initialization', () => {
        const main = window.OkazuTestables.main;
        assert(main, 'Main module exposed');
        assert(main.state, 'State initialized');
        assert(main.els, 'Elements initialized');
    });

    // 2. State/Element Construction
    register('Main: createDefaultState', () => {
        const { createDefaultState } = window.OkazuTestables.main;
        const state = createDefaultState();

        // 2.1.1 Primitives
        assertEqual(state.imgA, null);
        assertEqual(state.imgB, null);

        // 2.1.10 Brush Mode
        assertEqual(state.brushMode, 'erase');

        // 2.1.18 Settings
        assertEqual(state.brushSettings.erase.brushSize, 0.1);

        // 2.1.28 Preview settings
        assertEqual(state.settings.brushPreviewResolution, 1080);
    });

    // 4. Canvas Utilities
    register('Main: Canvas Utils', () => {
        const { cloneToCanvas, rotateCanvas, rotateRect } = window.OkazuTestables.main;

        // 4.1 cloneToCanvas
        const src = document.createElement('canvas');
        src.width = 10; src.height = 10;
        const cloned = cloneToCanvas(src);
        assertEqual(cloned.width, 10);
        assert(cloned !== src);

        // 4.3 rotateCanvas
        // 10x20 -> 90 deg -> 20x10
        const rCanvas = document.createElement('canvas');
        rCanvas.width = 10; rCanvas.height = 20;
        const rotated = rotateCanvas(rCanvas, 90);
        assertEqual(rotated.width, 20);
        assertEqual(rotated.height, 10);

        // 4.4 rotateRect
        // {x:0, y:0, w:10, h:20} in 100x100 space rotated 90 deg
        // 90 CW: x' = H - (y+h) = 100 - (0+20) = 80. y' = x = 0. w' = h = 20. h' = w = 10.
        const rect = { x:0, y:0, w:10, h:20 };
        const rotRect = rotateRect(rect, 100, 100, 90);
        assertEqual(rotRect.x, 80);
        assertEqual(rotRect.y, 0);
        assertEqual(rotRect.w, 20);
        assertEqual(rotRect.h, 10);
    });

    // 6. Rendering Pipeline
    register('Main: renderToContext', () => {
        const { renderToContext, createDefaultState } = window.OkazuTestables.main;

        // Mock state for render
        const state = createDefaultState();
        state.cropRect = { x:0, y:0, w:1, h:1 };
        state.fullDims = { w: 100, h: 100 };

        const ctx = document.createElement('canvas').getContext('2d');
        const spy = window.TestRunner.spyOn(ctx, 'drawImage'); // Requires spy capability, assume simple
        // If spyOn not available in this minimal runner, we can mock the context method manually
        let calls = 0;
        ctx.drawImage = () => calls++;

        // 6.1.1 Returns early without crop (if not cropping)
        state.cropRect = null;
        state.isCropping = false;
        renderToContext(ctx, 100, 100);
        assertEqual(calls, 0, 'No draw without crop');

        // Restore
        state.cropRect = { x:0, y:0, w:1, h:1 };
    });

    // 8. Layer Management (Stubbed to verify existence)
    register('Main: assignLayer existence', () => {
        const { assignLayer } = window.OkazuTestables.main;
        assert(typeof assignLayer === 'function', 'assignLayer is a function');
        // Full testing requires complex DOM/Async setup covered by e2e or more advanced harnesses.
    });

})();
