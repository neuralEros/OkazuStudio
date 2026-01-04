(function() {
    const { register, assert, assertEqual, assertApprox, assertDeepEqual } = window.TestRunner;

    const { spyOn } = window.TestRunner;

    function createFixtureRoot(ids = []) {
        const map = new Map();
        ids.forEach(({ id, tag = 'div' }) => {
            const el = document.createElement(tag);
            el.id = id;
            map.set(id, el);
        });
        return {
            getElementById: (id) => map.get(id) || null,
            __map: map
        };
    }

    function createPixelCanvas(width, height, pixelFn) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const idx = (y * width + x) * 4;
                const [r, g, b, a] = pixelFn(x, y);
                imageData.data[idx] = r;
                imageData.data[idx + 1] = g;
                imageData.data[idx + 2] = b;
                imageData.data[idx + 3] = a;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function readPixel(canvas, x, y) {
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(x, y, 1, 1).data;
        return Array.from(data);
    }

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
        assertEqual(state.nameA, '');
        assertEqual(state.nameB, '');
        assertEqual(state.opacity, 0.8);
        assertEqual(state.featherMode, false);
        assertEqual(state.maskVisible, true);
        assertEqual(state.backVisible, true);
        assertEqual(state.adjustmentsVisible, true);

        // 2.1.10 Brush Mode
        assertEqual(state.brushMode, 'erase');

        // 2.1.18 Settings
        assertEqual(state.brushSettings.erase.brushSize, 0.1);
        assertEqual(state.brushSettings.repair.brushSize, 0.05);
        assertEqual(state.brushSettings.patch.feather, 10);

        assertEqual(state.adjustments.gamma, 1.0);
        assertEqual(state.adjustments.levels.black, 0);
        assertEqual(state.adjustments.levels.white, 255);

        // 2.1.28 Preview settings
        assertEqual(state.settings.brushPreviewResolution, 1080);
    });

    register('Main: createDefaultEls', () => {
        const { createDefaultEls } = window.OkazuTestables.main;
        const fixtureRoot = createFixtureRoot([
            { id: 'mainCanvas', tag: 'canvas' },
            { id: 'previewCanvas', tag: 'canvas' },
            { id: 'viewport' },
            { id: 'canvas-wrapper' },
            { id: 'empty-state' },
            { id: 'drawer-adj' },
            { id: 'modeMaster' },
            { id: 'modeCensor' },
            { id: 'modeComposite' },
            { id: 'loading-overlay' },
            { id: 'crop-overlay-dom' },
            { id: 'crop-box' },
            { id: 'toggleMaskBtn' },
            { id: 'maskEyeOpen' },
            { id: 'maskEyeClosed' },
            { id: 'toggleBackBtn' },
            { id: 'rearEyeOpen' },
            { id: 'rearEyeClosed' },
            { id: 'toggleAdjBtn' },
            { id: 'adjEyeOpen' },
            { id: 'adjEyeClosed' }
        ]);
        const els = createDefaultEls(fixtureRoot);
        assertEqual(els.mainCanvas, fixtureRoot.__map.get('mainCanvas'));
        assertEqual(els.previewCanvas, fixtureRoot.__map.get('previewCanvas'));
        assertEqual(els.viewport, fixtureRoot.__map.get('viewport'));
        assertEqual(els.canvasWrapper, fixtureRoot.__map.get('canvas-wrapper'));
        assertEqual(els.emptyState, fixtureRoot.__map.get('empty-state'));
        assertEqual(els.adjDrawer, fixtureRoot.__map.get('drawer-adj'));
        assertEqual(els.modeMaster, fixtureRoot.__map.get('modeMaster'));
        assertEqual(els.modeCensor, fixtureRoot.__map.get('modeCensor'));
        assertEqual(els.modeComposite, fixtureRoot.__map.get('modeComposite'));
        assertEqual(els.loadingOverlay, fixtureRoot.__map.get('loading-overlay'));
        assertEqual(els.cropOverlayDom, fixtureRoot.__map.get('crop-overlay-dom'));
        assertEqual(els.cropBox, fixtureRoot.__map.get('crop-box'));
        assertEqual(els.toggleMaskBtn, fixtureRoot.__map.get('toggleMaskBtn'));
        assertEqual(els.maskEyeOpen, fixtureRoot.__map.get('maskEyeOpen'));
        assertEqual(els.maskEyeClosed, fixtureRoot.__map.get('maskEyeClosed'));
        assertEqual(els.toggleBackBtn, fixtureRoot.__map.get('toggleBackBtn'));
        assertEqual(els.rearEyeOpen, fixtureRoot.__map.get('rearEyeOpen'));
        assertEqual(els.rearEyeClosed, fixtureRoot.__map.get('rearEyeClosed'));
        assertEqual(els.toggleAdjBtn, fixtureRoot.__map.get('toggleAdjBtn'));
        assertEqual(els.adjEyeOpen, fixtureRoot.__map.get('adjEyeOpen'));
        assertEqual(els.adjEyeClosed, fixtureRoot.__map.get('adjEyeClosed'));

        const emptyRoot = createFixtureRoot([{ id: 'mainCanvas', tag: 'canvas' }]);
        const emptyEls = createDefaultEls(emptyRoot);
        assertEqual(emptyEls.mainCanvas, emptyRoot.__map.get('mainCanvas'));
        assertEqual(emptyEls.previewCanvas, null);
        assertEqual(emptyEls.modeCensor, null);
    });

    // 3. Mode + UI Switching
    register('Main: setAppMode', () => {
        const { setAppMode, state, els } = window.OkazuTestables.main;
        const originalMode = state.mode;
        const bodyHasClass = document.body.classList.contains('mode-non-master');

        setAppMode('censor');
        assertEqual(state.mode, 'censor');
        assert(document.body.classList.contains('mode-non-master'));
        assert(state.featherMode === true, 'Censor enables feather mode');
        assert(els.modeCensor.classList.contains('active'), 'Censor button active');

        setAppMode('');
        assertEqual(state.mode, 'censor', 'Falsy mode is ignored');

        setAppMode(originalMode);
        document.body.classList.toggle('mode-non-master', bodyHasClass);
    });

    register('Main: bindModeSwitcher', () => {
        const { bindModeSwitcher, setAppMode, state, els } = window.OkazuTestables.main;
        setAppMode('composite');
        bindModeSwitcher();
        assert(els.modeComposite.classList.contains('active'), 'Composite is active on init');

        els.modeMaster.click();
        assertEqual(state.mode, 'master');
        assert(els.modeMaster.classList.contains('active'), 'Master toggled active');
    });

    // 4. Canvas Utilities
    register('Main: Canvas Utils', () => {
        const { cloneToCanvas, rotateCanvas, rotateRect } = window.OkazuTestables.main;

        // 4.1 cloneToCanvas
        const src = createPixelCanvas(2, 3, (x, y) => [x * 50, y * 60, 100, 255]);
        const cloned = cloneToCanvas(src);
        assertEqual(cloned.width, 2);
        assertEqual(cloned.height, 3);
        assert(cloned !== src);
        assertDeepEqual(readPixel(cloned, 0, 0), readPixel(src, 0, 0));
        assertDeepEqual(readPixel(cloned, 1, 2), readPixel(src, 1, 2));

        // 4.3 rotateCanvas
        const rotateSource = createPixelCanvas(2, 4, (x, y) => [x * 80, y * 50, 150, 255]);
        const rotated = rotateCanvas(rotateSource, 90);
        assertEqual(rotated.width, 4);
        assertEqual(rotated.height, 2);
        assertDeepEqual(readPixel(rotated, 3, 0), readPixel(rotateSource, 0, 0));

        // 4.4 rotateRect
        // {x:0, y:0, w:10, h:20} in 100x100 space rotated 90 deg
        // 90 CW: x' = H - (y+h) = 100 - (0+20) = 80. y' = x = 0. w' = h = 20. h' = w = 10.
        const rect = { x:0, y:0, w:10, h:20 };
        const rotRect = rotateRect(rect, 100, 100, 90);
        assertEqual(rotRect.x, 80);
        assertEqual(rotRect.y, 0);
        assertEqual(rotRect.w, 20);
        assertEqual(rotRect.h, 10);

        const rect180 = rotateRect(rect, 100, 100, 180);
        assertDeepEqual(rect180, { x: 90, y: 80, w: 10, h: 20 });
        const rect270 = rotateRect(rect, 100, 100, 270);
        assertDeepEqual(rect270, { x: 0, y: 90, w: 20, h: 10 });
    });

    register('Main: bakeRotation', () => {
        const { bakeRotation, state, maskCanvas } = window.OkazuTestables.main;
        const { createDefaultState } = window.OkazuTestables.main;
        Object.assign(state, createDefaultState());

        const baseA = createPixelCanvas(4, 2, () => [200, 0, 0, 255]);
        const baseB = createPixelCanvas(4, 2, () => [0, 200, 0, 255]);

        state.imgA = baseA;
        state.imgB = baseB;
        state.sourceA = baseA;
        state.sourceB = baseB;
        state.fullDims = { w: 200, h: 100 };
        state.cropRect = { x: 10, y: 20, w: 50, h: 30 };
        state.rotation = 90;
        state.history = [{ type: 'TEST' }];
        state.historyIndex = 0;

        maskCanvas.width = 200;
        maskCanvas.height = 100;

        bakeRotation();

        assertEqual(state.rotation, 0);
        assertDeepEqual(state.fullDims, { w: 100, h: 200 });
        assertDeepEqual(state.cropRect, { x: 50, y: 10, w: 30, h: 50 });
        assertEqual(maskCanvas.width, 100);
        assertEqual(maskCanvas.height, 200);
        assertEqual(state.history.length, 0);
        assertEqual(state.historyIndex, -1);
    });

    // 6. Rendering Pipeline
    register('Main: renderToContext', () => {
        const main = window.OkazuTestables.main;
        const { renderToContext, createDefaultState, state, maskCanvas } = main;
        Object.assign(state, createDefaultState());

        const ctx = document.createElement('canvas').getContext('2d');
        const drawSpy = spyOn(ctx, 'drawImage');
        const clearSpy = spyOn(ctx, 'clearRect');
        const fillSpy = spyOn(ctx, 'fillRect');

        // 6.1.1 Returns early without crop (if not cropping)
        state.cropRect = null;
        state.isCropping = false;
        renderToContext(ctx, 100, 100);
        assertEqual(clearSpy.calls.length, 1);
        assertDeepEqual(clearSpy.calls[0], [0, 0, 100, 100]);
        assertEqual(drawSpy.calls.length, 0, 'No draw without crop');

        // 6.1.3 Mask alpha render
        Object.assign(state, createDefaultState());
        state.cropRect = { x: 0, y: 0, w: 2, h: 1 };
        state.fullDims = { w: 100, h: 50 };
        state.isCropping = false;
        maskCanvas.width = 100;
        maskCanvas.height = 50;
        renderToContext(ctx, 100, 50, { renderMode: 'mask_alpha' });
        assertEqual(fillSpy.calls.length >= 1, true);
        assertDeepEqual(drawSpy.calls[0], [maskCanvas, 0, 0, 100, 50, 0, 0, 100, 50]);

        // 6.1.4 Mask grayscale render
        drawSpy.calls.length = 0;
        fillSpy.calls.length = 0;
        renderToContext(ctx, 100, 50, { renderMode: 'mask_grayscale' });
        assertEqual(fillSpy.calls.length, 2);
        assertDeepEqual(drawSpy.calls[0], [maskCanvas, 0, 0, 100, 50, 0, 0, 100, 50]);
        assertEqual(ctx.globalCompositeOperation, 'destination-over');

        // 6.1.5 Composite render with opacity
        drawSpy.calls.length = 0;
        fillSpy.calls.length = 0;
        state.cropRect = { x: 0, y: 0, w: 2, h: 1 };
        state.fullDims = { w: 4, h: 2 };
        state.imgA = createPixelCanvas(4, 2, () => [255, 0, 0, 255]);
        state.imgB = createPixelCanvas(4, 2, () => [0, 255, 0, 255]);
        state.isAFront = true;
        state.opacity = 0.5;
        state.maskVisible = false;
        state.previewFrontLayer = document.createElement('canvas');
        renderToContext(ctx, 4, 2, { useBakedLayers: false });
        assertEqual(drawSpy.calls.length, 2);
        assertDeepEqual(drawSpy.calls[0], [state.imgB, 0, 0, 4, 2, 0, 0, 4, 2]);
        assertDeepEqual(drawSpy.calls[1], [state.previewFrontLayer, 0, 0]);
        assertApprox(ctx.globalAlpha, 0.5, 1e-6, 'Opacity applied');
    });

    // 5. Working/Preview Layers
    register('Main: Working/Preview Layers', () => {
        const main = window.OkazuTestables.main;
        const { createDefaultState, rebuildWorkingCopyForSlot, rebuildPreviewLayerForSlot, rebuildWorkingCopies, getLayerForRender, state } = main;
        Object.assign(state, createDefaultState());

        rebuildWorkingCopyForSlot('A');
        assertEqual(state.workingA, null);
        assertEqual(state.workingVersionA, 0);

        state.sourceA = createPixelCanvas(2, 3, (x, y) => [x * 40, y * 40, 200, 255]);
        state.adjustmentsVersion = 3;
        rebuildWorkingCopyForSlot('A');
        assertEqual(state.workingVersionA, 3);
        assertDeepEqual(readPixel(state.workingA, 1, 2), readPixel(state.sourceA, 1, 2));
        assertEqual(state.previewWorkingVersionA, 3);
        assertEqual(state.previewWorkingA.width, 2);
        assertEqual(state.previewWorkingA.height, 3);

        state.workingA = createPixelCanvas(4000, 2000, () => [10, 20, 30, 255]);
        state.adjustmentsVersion = 5;
        state.settings.brushPreviewResolution = 1000;
        rebuildPreviewLayerForSlot('A');
        assertApprox(state.previewScaleA, 0.5, 1e-6);
        assertEqual(state.previewWorkingA.width, 2000);
        assertEqual(state.previewWorkingA.height, 1000);
        assertEqual(state.previewWorkingVersionA, 5);

        state.sourceA = createPixelCanvas(2, 2, () => [1, 2, 3, 255]);
        state.sourceB = createPixelCanvas(2, 2, () => [4, 5, 6, 255]);
        state.adjustmentsVersion = 0;
        rebuildWorkingCopies(true);
        assertEqual(state.adjustmentsVersion, 1);
        assertEqual(state.workingVersionA, 1);
        assertEqual(state.workingVersionB, 1);

        const previewSpy = spyOn(main, 'rebuildPreviewLayerForSlot');
        state.workingA = createPixelCanvas(2, 2, () => [5, 6, 7, 255]);
        state.previewWorkingA = createPixelCanvas(1, 1, () => [9, 9, 9, 255]);
        state.previewWorkingVersionA = 0;
        state.adjustmentsVersion = 2;
        getLayerForRender('A', { preferPreview: true, allowRebuild: true });
        assertEqual(previewSpy.calls.length, 1);
        previewSpy.restore();
    });

    // 7. Crop Workflows
    register('Main: Crop Workflow', () => {
        const main = window.OkazuTestables.main;
        const { createDefaultState, toggleCropMode, acceptCrop, cancelCrop, render, state, els } = main;
        Object.assign(state, createDefaultState());

        state.imgA = createPixelCanvas(100, 50, () => [100, 100, 100, 255]);
        state.cropRect = { x: 0.1, y: 0.2, w: 1.0, h: 0.5 };
        state.fullDims = { w: 100, h: 50 };
        els.mainCanvas.width = 100;
        els.mainCanvas.height = 50;

        toggleCropMode();
        assert(state.isCropping, 'Entered crop mode');
        assertDeepEqual(state.cropRectSnapshot, { x: 0.1, y: 0.2, w: 1.0, h: 0.5 });
        assert(els.cropBtn.classList.contains('active'));
        assert(els.viewport.classList.contains('cropping'));

        render();
        assertEqual(els.cropOverlayDom.style.display, 'block');
        assertApprox(parseFloat(els.cropBox.style.left), 5, 0.001);
        assertApprox(parseFloat(els.cropBox.style.top), 10, 0.001);
        assertApprox(parseFloat(els.cropBox.style.width), 50, 0.001);
        assertApprox(parseFloat(els.cropBox.style.height), 25, 0.001);

        const dispatchSpy = spyOn(window, 'dispatchAction');
        acceptCrop();
        assertEqual(dispatchSpy.calls.length, 1);
        assertEqual(dispatchSpy.calls[0][0].type, 'CROP');
        assertEqual(state.isCropping, false);
        dispatchSpy.restore();

        state.isCropping = true;
        state.cropRectSnapshot = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
        state.cropRect = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
        state.cropDrag = { type: 'move' };
        cancelCrop();
        assertDeepEqual(state.cropRect, { x: 0.2, y: 0.2, w: 0.5, h: 0.5 });
        assertEqual(state.cropDrag, null);
        assertEqual(state.isCropping, false);
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
