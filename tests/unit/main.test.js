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

        const realState = window.OkazuTestables.main.state;
        const backupState = { ...realState };
        const cleanState = createDefaultState();
        Object.assign(realState, cleanState);
        realState.cropRect = { x:0, y:0, w:1, h:1 };
        realState.fullDims = { w: 100, h: 100 };

        const ctx = document.createElement('canvas').getContext('2d');
        const spy = window.TestRunner.spyOn(ctx, 'drawImage'); // Requires spy capability, assume simple
        // If spyOn not available in this minimal runner, we can mock the context method manually
        let calls = 0;
        ctx.drawImage = () => calls++;

        try {
            // 6.1.1 Returns early without crop (if not cropping)
            realState.cropRect = null;
            realState.isCropping = false;
            renderToContext(ctx, 100, 100);
            assertEqual(calls, 0, 'No draw without crop');
        } finally {
            spy.restore();
            Object.assign(realState, backupState);
        }
    });

    // 8. Layer Management
    register('Main: assignLayer Logic', () => {
        const { assignLayer, createDefaultState } = window.OkazuTestables.main;

        // We cannot replace the state object itself because main.js uses a closure variable.
        // We must mutate the shared state object.
        const realState = window.OkazuTestables.main.state;
        const realEls = window.OkazuTestables.main.els;

        // Save backups to restore later
        const backupState = { ...realState }; // Shallow backup of props
        // els structure is deep, but we only strictly rely on specific props for this test.
        // We will try to patch the methods we need on the real objects or just accept some dirtying if harmless.
        // Better: Use Object.assign to inject mocks, then restore.

        // Mock AssetManager
        const mockAM = {
            addAsset: (img, name) => 'mock_asset_id_' + name
        };
        const origAM = window.AssetManager;
        window.AssetManager = mockAM;

        // Prepare State
        const cleanState = createDefaultState();
        Object.assign(realState, cleanState);

        // Prepare DOM Mocks (inject into realEls)
        // We need to preserve original references where possible or just overwrite properties.
        const mockViewport = { clientWidth: 1000, clientHeight: 800, style: {}, addEventListener: () => {} };
        const mockCanvas = { width: 100, height: 100, style: {}, getContext: () => ({ drawImage: ()=>{}, clearRect: ()=>{} }) };
        // We can't easily replace realEls properties if they are used by reference in event listeners,
        // but for assignLayer logic it accesses them properties directly.

        // Strategy: Mutate specific properties of realEls
        const backupViewportCW = realEls.viewport.clientWidth; // Read-only usually?
        // In JSDOM/Browser, clientWidth is read-only 0.
        // We need to define property?
        try {
            Object.defineProperty(realEls.viewport, 'clientWidth', { value: 1000, configurable: true });
            Object.defineProperty(realEls.viewport, 'clientHeight', { value: 800, configurable: true });
        } catch (e) {
            // If we can't redefine, we might be stuck.
            // But verify_tests runs in Headless Chrome. properties might be writable or defineProperty works.
        }

        // Mock buttons to prevent crash on classList
        if (!realEls.btnA.classList) realEls.btnA.classList = { add:()=>{}, remove:()=>{} };
        if (!realEls.btnB.classList) realEls.btnB.classList = { add:()=>{}, remove:()=>{} };
        realEls.btnA.appendChild = () => {};

        try {
            // Setup
            const imgStub = document.createElement('canvas');
            imgStub.width = 400; imgStub.height = 300;

            // Call
            assignLayer(imgStub, 'A', 'test_image.png');

            // Assertions against REAL state
            assertEqual(realState.assetIdA, 'mock_asset_id_test_image.png', 'Asset ID Assigned');
            assertEqual(realState.nameA, 'test_image.png', 'Name Assigned');
            assertEqual(realState.formatA, 'PNG', 'Format Derived');

            // Dims
            // Only A loaded. Union = A dims.
            assertEqual(realState.fullDims.w, 400, 'Full Dims Width');
            assertEqual(realState.fullDims.h, 300, 'Full Dims Height');

            // Crop Rect (Default is Full)
            // 400x300. Aspect 1.333.
            assertApprox(realState.cropRect.w, 1.333, 0.01, 'Crop Rect Aspect');

        } finally {
            // Restore
            window.AssetManager = origAM;
            // Restore State
            Object.assign(realState, backupState);
            // Restore Viewport? (Hard to undo defineProperty fully without original descriptor, but we can try delete)
            // Or just leave it, likely won't hurt subsequent tests if any.
        }
    });

})();
