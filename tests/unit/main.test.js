
// ------------------------------------------------------------------------------------------------
// Main Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping main tests.');
        return;
    }

    const { register, assert, assertEqual, spyOn } = window.TestRunner;

    // --- 1. Harness & Mocking ---

    // We rely on window.OkazuTestables.main exposing createDefaultState and createDefaultEls

    register('Main: 2.1 createDefaultState', () => {
        const state = window.OkazuTestables.main.createDefaultState();

        assertEqual(state.imgA, null);
        assertEqual(state.imgB, null);
        assertEqual(state.isAFront, true);
        assertEqual(state.opacity, 0.8);
        assertEqual(state.brushSize, 0.1);
        assertEqual(state.feather, 1);
        // Ensure defaults are populated as expected
        assertEqual(state.mode, 'master');
        assertEqual(state.maskVisible, true);
    });

    register('Main: 2.2 createDefaultEls', () => {
        // Stub DOM
        const mockDoc = {
            getElementById: (id) => ({ id })
        };
        const els = window.OkazuTestables.main.createDefaultEls(mockDoc);

        assertEqual(els.mainCanvas.id, 'mainCanvas');
        assertEqual(els.previewCanvas.id, 'previewCanvas');
        assertEqual(els.viewport.id, 'viewport');
    });

    // --- 4. Canvas Utilities ---

    register('Main: 4.1 cloneToCanvas', () => {
        const main = window.OkazuTestables.main;
        const src = document.createElement('canvas');
        src.width = 10; src.height = 20;

        const clone = main.cloneToCanvas(src);

        assertEqual(clone.width, 10);
        assertEqual(clone.height, 20);
    });

    register('Main: 4.2 generateThumbnail', () => {
        const main = window.OkazuTestables.main;
        const src = document.createElement('canvas');
        src.width = 200; src.height = 100;

        // Target height 50
        const thumb = main.generateThumbnail(src, 50);

        assertEqual(thumb.height, 50);
        assertEqual(thumb.width, 100);
    });

    register('Main: 4.3 rotateCanvas', () => {
        const main = window.OkazuTestables.main;
        const src = document.createElement('canvas');
        src.width = 100; src.height = 50;

        // 90 deg -> 50x100
        const r90 = main.rotateCanvas(src, 90);
        assertEqual(r90.width, 50);
        assertEqual(r90.height, 100);

        // 180 deg -> 100x50
        const r180 = main.rotateCanvas(src, 180);
        assertEqual(r180.width, 100);
        assertEqual(r180.height, 50);
    });

    register('Main: 4.4 rotateRect', () => {
        const main = window.OkazuTestables.main;
        const rect = { x: 2, y: 3, w: 4, h: 5 };
        const pW = 100, pH = 50;

        // 90 deg
        const r90 = main.rotateRect(rect, pW, pH, 90);
        // x' = pH - (y+h) = 50 - (3+5) = 42
        // y' = x = 2
        // w' = h = 5
        // h' = w = 4
        assertEqual(r90.x, 42);
        assertEqual(r90.y, 2);
        assertEqual(r90.w, 5);
        assertEqual(r90.h, 4);
    });

    // --- 7. Crop Workflows ---

    register('Main: 7.4 trimCropRectToImageBounds', () => {
        const main = window.OkazuTestables.main;
        // Mock state
        const state = {
            cropRect: { x: -0.1, y: -0.1, w: 1.5, h: 1.2 },
            fullDims: { w: 1000, h: 500 },
            rotation: 0,
            cropRotation: 0
        };
        // Inject state into main
        const originalState = main.state;
        Object.assign(main.state, state);

        main.trimCropRectToImageBounds();

        const r = main.state.cropRect;
        assert(r.x >= 0, 'x clamped');
        assert(r.y >= 0, 'y clamped');
        // Check clamping logic
        assert(r.w <= 1000/500 * 1.0, 'w clamped');

        // Restore
        Object.assign(main.state, originalState);
    });

})();
