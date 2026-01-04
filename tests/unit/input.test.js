(function() {
    const { register, assert, assertEqual, assertApprox, spyOn } = window.TestRunner;

    // 1. Test harness + DOM mocks
    function createMockEls() {
        return {
            viewport: {
                clientWidth: 1200, clientHeight: 800,
                style: {},
                classList: { add: () => {}, remove: () => {} },
                getBoundingClientRect: () => ({ left: 10, top: 20, width: 1200, height: 800 }),
                addEventListener: spyOn({}, 'addEventListener')
            },
            canvasWrapper: { style: {}, getBoundingClientRect: () => ({ left: 10, top: 20, width: 1000, height: 800 }) },
            mainCanvas: { width: 1000, height: 800 },
            previewCanvas: { width: 1000, height: 800, classList: { add: () => {}, remove: () => {} } },
            cursor: { style: {} },
            brushSize: { value: '10', addEventListener: () => {} },
            brushSizeVal: { textContent: '' },
            feather: { value: '80', min: '0', max: '100', step: '1', addEventListener: () => {} },
            featherVal: { textContent: '' },
            featherLabel: { textContent: '' },
            featherModeBtn: { classList: { add: () => {}, remove: () => {} }, querySelector: () => ({}) },
            cropBox: { style: { setProperty: () => {} }, classList: { add: () => {}, remove: () => {} }, addEventListener: () => {} },
            cropOverlayDom: { style: {} },
            cropHandles: [], // Mock querySelectorAll in setup
            eraseMode: { classList: { toggle: () => {} } },
            repairMode: { classList: { toggle: () => {} } },
            patchMode: { classList: { toggle: () => {} } }
        };
    }

    function createMockState() {
        return {
            view: { scale: 1, x: 0, y: 0 },
            fullDims: { w: 1000, h: 800 },
            isCropping: false,
            cropRect: { x: 0.1, y: 0.2, w: 0.6, h: 0.5 },
            rotation: 0,
            cropRotation: 0,
            brushMode: 'erase',
            brushSize: 0.1,
            featherMode: false,
            feather: 10,
            featherSize: 0.005,
            brushSettings: {
                erase: { brushSize: 0.1, feather: 12, featherSize: 0.005 },
                repair: { brushSize: 0.05, feather: 12, featherSize: 0.005 },
                patch: { brushSize: 0.2, feather: 18, featherSize: 0.005 }
            },
            imgA: {}, imgB: {}, // Mock loaded images
            pointer: { isDown: false },
            polylinePoints: []
        };
    }

    // 2. Pure Math Helpers
    register('Input: toProportion / toPixels', () => {
        const { toProportion, toPixels } = window.OkazuTestables.input;
        assertApprox(toProportion(50, 200), 0.25);
        assertApprox(toPixels(0.25, 200), 50);
        assertEqual(toProportion(50, 0), 0); // Edge case
        assertEqual(toPixels(0.25, 0), 0);
    });

    register('Input: rotatePoint', () => {
        const { rotatePoint } = window.OkazuTestables.input;
        const p = { x: 10, y: 20 };
        const origin = { x: 0, y: 0 }; // Rotate around origin for simplicity

        let res = rotatePoint(p, 0, 0, 0);
        assertApprox(res.x, 10); assertApprox(res.y, 20);

        res = rotatePoint(p, 0, 0, 90);
        assertApprox(res.x, -20); assertApprox(res.y, 10);

        res = rotatePoint(p, 0, 0, 180);
        assertApprox(res.x, -10); assertApprox(res.y, -20);

        res = rotatePoint(p, 0, 0, 270);
        assertApprox(res.x, 20); assertApprox(res.y, -10);
    });

    register('Input: getRotatedAABB', () => {
        const { getRotatedAABB } = window.OkazuTestables.input;
        const rect = { x: 0, y: 0, w: 100, h: 50 };

        let res = getRotatedAABB(rect.w, rect.h, 0);
        // Center is 50, 25.
        // 0: MinX 0, MaxX 100. MinY 0, MaxY 50.
        // Wait, function implementation:
        // Rotates corners (0,0), (100,0), (100,50), (0,50) around CENTER (50,25).
        // 0 deg: No change.
        // minX 0, maxX 100.
        assertApprox(res.minX, 0); assertApprox(res.maxX, 100);
        assertApprox(res.w, 100); assertApprox(res.h, 50);

        res = getRotatedAABB(rect.w, rect.h, 90);
        // 90 deg: Width becomes Height.
        // Center stays at 50, 25.
        // New width 50, New height 100.
        // minX = 50 - 25 = 25. maxX = 50 + 25 = 75.
        // minY = 25 - 50 = -25. maxY = 25 + 50 = 75.
        assertApprox(res.w, 50); assertApprox(res.h, 100);
    });

    register('Input: truthToVisualCoordsRaw / visualToTruthCoordsRaw round-trip', () => {
        const { truthToVisualCoordsRaw, visualToTruthCoordsRaw } = window.OkazuTestables.input;
        const truth = { x: 250, y: 120 };
        const fullW = 1000, fullH = 800;

        [0, 90, 180, 270].forEach(rot => {
            const visual = truthToVisualCoordsRaw(truth.x, truth.y, fullW, fullH, rot);
            const roundTrip = visualToTruthCoordsRaw(visual.x, visual.y, fullW, fullH, rot);
            assertApprox(roundTrip.x, truth.x);
            assertApprox(roundTrip.y, truth.y);
        });
    });

    register('Input: getVisualFullDimsRaw', () => {
        const { getVisualFullDimsRaw } = window.OkazuTestables.input;
        const fullW = 1000, fullH = 800;

        let res = getVisualFullDimsRaw(fullW, fullH, 0);
        assertEqual(res.visualW, 1000); assertEqual(res.visualH, 800);

        res = getVisualFullDimsRaw(fullW, fullH, 90);
        assertEqual(res.visualW, 800); assertEqual(res.visualH, 1000);
    });

    // 3. Brush Size / Feather Mapping
    register('Input: clampBrushSize', () => {
        const { clampBrushSize } = window.OkazuTestables.input;
        assert(clampBrushSize(-1) >= 0.002);
        assert(clampBrushSize(10) <= 0.3);
    });

    register('Input: slider mapping round-trip', () => {
        const { sliderToBrushSize, brushSizeToSliderValue } = window.OkazuTestables.input;
        const min = sliderToBrushSize(0);
        const max = sliderToBrushSize(1000);

        const val0 = brushSizeToSliderValue(min);
        assertApprox(val0, 0);

        const val100 = brushSizeToSliderValue(max);
        assertApprox(val100, 1000);
    });

    register('Input: setBrushPercent', () => {
        const state = createMockState();
        const els = createMockEls();
        const inputSys = window.createInputSystem({ state, els, maskCtx: {}, maskCanvas: {}, render: () => {}, saveSnapshot: () => {}, undo: () => {}, redo: () => {}, showHints: () => {}, scheduleHeavyTask: () => {} });

        inputSys.setBrushPercent(0.25);
        assertApprox(state.brushSize, 0.25);
        assertApprox(state.brushSettings.erase.brushSize, 0.25);
        // Slider value check (approx)
        // range 0.002 to 0.3. 0.25 is near max.
        assert(parseInt(els.brushSize.value) > 800);
    });

    // 4. Feather Mode
    register('Input: setFeatherMode', () => {
        const state = createMockState();
        const els = createMockEls();
        const inputSys = window.createInputSystem({ state, els, maskCtx: {}, maskCanvas: {}, render: () => {}, saveSnapshot: () => {}, undo: () => {}, redo: () => {}, showHints: () => {}, scheduleHeavyTask: () => {} });

        inputSys.setFeatherMode(true, { applyToAll: false });
        assertEqual(state.featherMode, true);

        inputSys.setFeatherMode(false, { applyToAll: true });
        assertEqual(state.featherMode, false);
        assertEqual(state.brushSettings.repair.featherMode, undefined); // It sets global featherMode, but updates values in settings?
        // Implementation: Object.values(state.brushSettings).forEach... settings.featherSize = clamped
        // It updates the VALUES, not the mode per brush (mode is global state).
    });

    // 5. View Logic
    register('Input: resetView', () => {
        const state = createMockState();
        const els = createMockEls();
        // Mock els for layout
        els.viewport.clientWidth = 1000; els.viewport.clientHeight = 1000;
        els.mainCanvas.width = 1000; els.mainCanvas.height = 1000;

        const inputSys = window.createInputSystem({ state, els, maskCtx: {}, maskCanvas: {}, render: () => {}, saveSnapshot: () => {}, undo: () => {}, redo: () => {}, showHints: () => {}, scheduleHeavyTask: () => {} });

        // Non-crop
        state.isCropping = false;
        inputSys.resetView();
        // 1000x1000 in 1000x1000 viewport with 40px padding.
        // Scale should be (960/1000) = 0.96
        assertApprox(state.view.scale, 0.96);
        // Centered
        // x = (1000 - 1000*0.96)/2 = 20
        assertApprox(state.view.x, 20);
    });

    // 6. Coordinate Mapping
    register('Input: getCanvasCoordinates', () => {
        const state = createMockState();
        const els = createMockEls();
        const inputSys = window.createInputSystem({ state, els, maskCtx: {}, maskCanvas: {}, render: () => {}, saveSnapshot: () => {}, undo: () => {}, redo: () => {}, showHints: () => {}, scheduleHeavyTask: () => {} });

        // Setup: Uncropped, scale 1, origin 0
        // Viewport Rect: 10, 20.
        // Mouse: 110, 120. -> Relative: 100, 100.
        // Canvas Coord: 100, 100.
        // Normalized (fullH=800): 100/800 = 0.125

        const mockEvent = { clientX: 110, clientY: 120 };
        state.isCropping = true; // Use simple visual logic for test first (or fix logic)
        // If isCropping is true, it returns absP / fullH.
        // absP is (100, 100).
        const coords = inputSys.getCanvasCoordinates(mockEvent);
        assertApprox(coords.x, 0.125);
        assertApprox(coords.y, 0.125);
    });

    // 8. Pointer Handling
    register('Input: handlePointerDown starts stroke', () => {
        const state = createMockState();
        const els = createMockEls();
        const mockCtx = {
            clearRect: () => {},
            save: () => {}, restore: () => {},
            scale: () => {}, drawImage: () => {},
            getContext: () => ({})
        };

        // Mock BrushKernel calls? Or just check state changes.
        // We'll check state.isDrawing.
        const inputSys = window.createInputSystem({ state, els, maskCtx: mockCtx, maskCanvas: {width:100, height:100}, render: () => {}, saveSnapshot: () => {}, undo: () => {}, redo: () => {}, showHints: () => {}, scheduleHeavyTask: () => {} });

        // Mock getCanvasCoordinates via viewport rect
        // 10, 20 rect. Click 30, 40.
        const e = { clientX: 30, clientY: 40, button: 0, preventDefault: () => {} };

        inputSys.handlePointerDown(e);
        assert(state.isDrawing, 'Should be drawing');
    });

})();
