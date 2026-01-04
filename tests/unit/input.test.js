(function() {
    const { register, assert, assertEqual, assertApprox, assertDeepEqual } = window.TestRunner;

    // 1. Test Harness + DOM Mocks
    function createSpy() {
        const spy = (...args) => {
            spy.calls.push(args);
        };
        spy.calls = [];
        return spy;
    }

    function mockPointerEvent({
        type = 'pointerdown',
        clientX = 0,
        clientY = 0,
        button = 0,
        buttons = 1,
        pointerId = 1,
        ctrlKey = false,
        metaKey = false,
        shiftKey = false
    } = {}) {
        return {
            type,
            clientX,
            clientY,
            button,
            buttons,
            pointerId,
            ctrlKey,
            metaKey,
            shiftKey,
            preventDefault: createSpy(),
            stopPropagation: createSpy()
        };
    }

    function mockWheelEvent({
        deltaY = 0,
        clientX = 0,
        clientY = 0,
        ctrlKey = false,
        metaKey = false,
        shiftKey = false
    } = {}) {
        return {
            deltaY,
            clientX,
            clientY,
            ctrlKey,
            metaKey,
            shiftKey,
            preventDefault: createSpy(),
            stopPropagation: createSpy()
        };
    }

    function mockKeyEvent({
        key = '',
        code = '',
        ctrlKey = false,
        metaKey = false,
        shiftKey = false,
        repeat = false
    } = {}) {
        return {
            key,
            code,
            ctrlKey,
            metaKey,
            shiftKey,
            repeat,
            preventDefault: createSpy(),
            stopPropagation: createSpy()
        };
    }

    function createMockState() {
        return {
            view: { scale: 1, x: 0, y: 0 },
            canvasSize: { width: 1000, height: 800 },
            fullDims: { w: 1000, h: 800 },
            cropped: false,
            cropRect: { x: 0.1, y: 0.2, w: 0.6, h: 0.5 },
            cropRotation: 0,
            rotation: 0,
            mode: 'erase',
            brushMode: 'erase',
            brushSize: 0.1,
            feather: 10,
            featherSize: 0.02,
            featherMode: false,
            brushSettings: {
                erase: { brushSize: 0.1, feather: 10, featherSize: 0.05 },
                repair: { brushSize: 0.05, feather: 15, featherSize: 0.05 },
                patch: { brushSize: 0.05, feather: 15, featherSize: 0.05 }
            },
            cursor: { canDraw: true },
            pointer: { isDown: false },
            polylinePoints: [],
            polylineDirty: false,
            polylineSessionId: 0,
            currentPolylineAction: null,
            isCropping: false,
            isPanning: false,
            isZooming: false,
            isSpacePressed: false,
            isCtrlPressed: false,
            isPolylineStart: false,
            imgA: {}, // Just to make canDraw true
            imgB: {},
            settings: {
                brushPreviewResolution: 1920
            }
        };
    }

    function createMockEls() {
        const classList = () => ({
            values: new Set(),
            add: function(name) { this.values.add(name); },
            remove: function(name) { this.values.delete(name); }
        });
        const featherIcon = { src: '', alt: '' };
        return {
            viewport: {
                clientWidth: 1200, clientHeight: 800,
                getBoundingClientRect: () => ({ left: 10, top: 20, width: 1200, height: 800, right: 1210, bottom: 820 }),
                addEventListener: () => {},
                classList: classList(),
                style: {}
            },
            canvasWrapper: { style: { transform: '' } },
            mainCanvas: { width: 1000, height: 800, style: {} },
            cursor: { style: { display: '', width: '', height: '', left: '', top: '' } },
            brushSizeSlider: { value: '10' }, // Assuming these match IDs or refs
            brushSize: { value: '10' }, // Correct ref name from source
            brushSizeVal: { textContent: '' },
            feather: { value: '80', min: '0', max: '20' },
            featherLabel: { textContent: '' },
            featherVal: { textContent: '' },
            featherModeBtn: { classList: classList(), querySelector: () => featherIcon },
            cropBox: { style: { setProperty: () => {} }, addEventListener: () => {} }
        };
    }

    function createMockMask() {
        const canvas = document.createElement('canvas');
        canvas.width = 1000;
        canvas.height = 800;
        return { canvas, ctx: canvas.getContext('2d') };
    }

    // 2. Pure Math Helpers
    register('Input: Coordinate Math Helpers', () => {
        const {
            toProportion, toPixels, rotatePoint, getRotatedAABB,
            truthToVisualCoordsRaw, visualToTruthCoordsRaw, getVisualFullDimsRaw
        } = window.OkazuTestables.input;

        // 2.1 toProportion / toPixels
        assertEqual(toProportion(50, 200), 0.25, 'toProportion 50/200');
        assertEqual(toPixels(0.25, 200), 50, 'toPixels 0.25*200');

        // 2.2 rotatePoint
        const p0 = rotatePoint({x:10, y:20}, 0, 0, 0);
        assertDeepEqual(p0, {x:10, y:20}, 'Rot 0');
        const p90 = rotatePoint({x:10, y:0}, 0, 0, 90);
        assertApprox(p90.x, 0, 1e-6); assertApprox(p90.y, 10, 1e-6, 'Rot 90');

        // 2.3 getRotatedAABB
        const box = { w: 100, h: 50 };
        const aabb0 = getRotatedAABB(box.w, box.h, 0);
        assertEqual(aabb0.w, 100); assertEqual(aabb0.h, 50);
        const aabb90 = getRotatedAABB(box.w, box.h, 90);
        assertApprox(aabb90.w, 50, 1e-6); assertApprox(aabb90.h, 100, 1e-6);

        // 2.4 Truth/Visual Coords
        // Truth (250, 120), Dims 1000x800
        // Rot 90 -> Visual X = 800 - 120 = 680, Visual Y = 250
        const vis90 = truthToVisualCoordsRaw(250, 120, 1000, 800, 90);
        assertEqual(vis90.x, 680); assertEqual(vis90.y, 250);
        const truth90 = visualToTruthCoordsRaw(680, 250, 1000, 800, 90);
        assertEqual(truth90.x, 250); assertEqual(truth90.y, 120);

        const vis180 = truthToVisualCoordsRaw(250, 120, 1000, 800, 180);
        assertEqual(vis180.x, 750); assertEqual(vis180.y, 680);
        const truth180 = visualToTruthCoordsRaw(750, 680, 1000, 800, 180);
        assertEqual(truth180.x, 250); assertEqual(truth180.y, 120);

        const vis270 = truthToVisualCoordsRaw(250, 120, 1000, 800, 270);
        assertEqual(vis270.x, 120); assertEqual(vis270.y, 750);
        const truth270 = visualToTruthCoordsRaw(120, 750, 1000, 800, 270);
        assertEqual(truth270.x, 250); assertEqual(truth270.y, 120);

        // 2.5 getVisualFullDimsRaw
        const vDim90 = getVisualFullDimsRaw(1000, 800, 90);
        assertEqual(vDim90.visualW, 800); assertEqual(vDim90.visualH, 1000);
    });

    // 3. Brush Mapping
    register('Input: Brush Size Mapping', () => {
        const { clampBrushSize, sliderToBrushSize, brushSizeToSliderValue } = window.OkazuTestables.input;

        assertEqual(clampBrushSize(-1), 0.002, 'Clamp min'); // BRUSH_MIN
        assertEqual(clampBrushSize(10), 0.3, 'Clamp max'); // BRUSH_MAX

        const sliderVal = brushSizeToSliderValue(0.151); // Mid range approx
        const roundTrip = sliderToBrushSize(sliderVal);
        assertApprox(roundTrip, 0.151, 0.001, 'Round trip precision');
    });

    // 4. Feather Mode Toggle (via System)
    register('Input: Feather Mode Logic', () => {
        const state = createMockState();
        const els = createMockEls();
        const { canvas, ctx } = createMockMask();
        const sys = createInputSystem({ state, els, maskCtx: ctx, maskCanvas: canvas, render: () => {}, scheduleHeavyTask: () => {} });

        // 4.1 setFeatherMode
        sys.setFeatherMode(true);
        assert(state.featherMode === true, 'State updated to true');
        assert(els.feather.max > 20, 'Slider max updated for fine grain');

        sys.setFeatherMode(false);
        assert(state.featherMode === false, 'State updated to false');
        assert(els.feather.max === 20, 'Slider max reset to hardness scale');
    });

    // 4b. Feather/Brush UI Synchronization
    register('Input: Feather/Brush UI Sync', () => {
        const state = createMockState();
        const els = createMockEls();
        const { canvas, ctx } = createMockMask();
        const sys = createInputSystem({ state, els, maskCtx: ctx, maskCanvas: canvas, render: () => {}, scheduleHeavyTask: () => {} });

        state.view.scale = 2;
        state.brushSize = 0.1;
        sys.updateCursorSize();
        assertEqual(els.cursor.style.width, '160px', 'Cursor width from brush size');
        assertEqual(els.cursor.style.height, '160px', 'Cursor height from brush size');

        state.brushMode = 'erase';
        state.brushSettings.erase = { brushSize: 0.12, feather: 12, featherSize: 0.03 };
        state.brushSettings.repair = { brushSize: 0.05, feather: 6, featherSize: 0.01 };
        sys.syncBrushUIToActive();
        assertApprox(state.brushSize, 0.12, 1e-6, 'Active brush size loaded');
        assertApprox(state.feather, 12, 1e-6, 'Active feather loaded');

        state.brushMode = 'repair';
        state.featherMode = true;
        sys.syncBrushUIToActive();
        assertApprox(state.brushSize, 0.05, 1e-6, 'Repair size restored');
        assertApprox(state.featherSize, 0.01, 1e-6, 'Repair feather size restored');
    });

    // 5. View Logic (resetView)
    register('Input: View Reset', () => {
        const state = createMockState();
        const els = createMockEls();
        const { canvas, ctx } = createMockMask();
        const sys = createInputSystem({ state, els, maskCtx: ctx, maskCanvas: canvas, render: () => {}, scheduleHeavyTask: () => {} });

        // 5.1 Reset View (Uncropped)
        // VP 1200x800, Canvas 1000x800. Scale fit: min( (1200-40)/1000, (800-40)/800 ) = min(1.16, 0.95) = 0.95.
        sys.resetView();
        assertApprox(state.view.scale, 0.95, 0.01, 'Scale fits to viewport');
        // Center X: (1200 - 1000*0.95)/2 = (1200 - 950)/2 = 125
        assertApprox(state.view.x, 125, 1, 'Centered X');
    });

    // 6. Coordinate Mapping (getCanvasCoordinates)
    register('Input: Mouse to Canvas Coordinates', () => {
        const state = createMockState();
        const els = createMockEls();
        // Setup view: scale 1, trans 0
        state.view = { scale: 1, x: 0, y: 0 };
        // Setup cropRect: full image 0,0,1,1 for simplicity first
        state.cropRect = { x: 0, y: 0, w: 1, h: 1 };

        const { canvas, ctx } = createMockMask();
        const sys = createInputSystem({ state, els, maskCtx: ctx, maskCanvas: canvas, render: () => {}, scheduleHeavyTask: () => {} });

        // 6.1 Uncropped (Logic uses cropRect to map to truth, so full cropRect acts as full image)
        // Viewport rect left=10, top=20.
        // Client (110, 120) -> Local (100, 100).
        // Canvas (100, 100).
        // Prop: 100/800 = 0.125 Y. 100/1000 X? Wait, normalization is usually by Height?
        // getCanvasCoordinates returns x/fullH, y/fullH.
        // 100/800 = 0.125.
        const evt = { clientX: 110, clientY: 120 };
        const coords = sys.getCanvasCoordinates(evt);
        assertApprox(coords.y, 0.125, 1e-6, 'Y Coord');
        assertApprox(coords.x, 0.125, 1e-6, 'X Coord (100/800)');
    });

    // 7. Event Helper Sanity
    register('Input: Event Mock Helpers', () => {
        const pointer = mockPointerEvent({ clientX: 5, clientY: 10, ctrlKey: true });
        assertEqual(pointer.clientX, 5, 'Pointer event clientX');
        assertEqual(pointer.ctrlKey, true, 'Pointer event ctrlKey');

        const wheel = mockWheelEvent({ deltaY: 100, metaKey: true });
        assertEqual(wheel.deltaY, 100, 'Wheel deltaY');
        assertEqual(wheel.metaKey, true, 'Wheel metaKey');

        const key = mockKeyEvent({ key: 'z', code: 'KeyZ', ctrlKey: true });
        assertEqual(key.key, 'z', 'Key event key');
        assertEqual(key.ctrlKey, true, 'Key event ctrlKey');
    });

    // 8. Pointer Flows (Brush, Pan, Crop Handles)
    register('Input: Pointer Flows', () => {
        const state = createMockState();
        const els = createMockEls();
        const { canvas, ctx } = createMockMask();
        const renderSpy = createSpy();
        const sys = createInputSystem({ state, els, maskCtx: ctx, maskCanvas: canvas, render: renderSpy, scheduleHeavyTask: () => {} });
        const actions = [];

        window.dispatchAction = (action) => actions.push(action);
        window.Logger = window.Logger || { interaction: () => {} };

        // 8.1 Brush stroke flow
        const down = mockPointerEvent({ clientX: 110, clientY: 120 });
        sys.handlePointerDown(down);
        assert(state.isDrawing === true, 'Brush pointer down starts drawing');
        assert(state.activeStroke && state.activeStroke.points.length === 1, 'Active stroke starts with one point');

        const move = mockPointerEvent({ type: 'pointermove', clientX: 130, clientY: 140 });
        sys.handlePointerMove(move);
        assert(state.activeStroke.points.length === 2, 'Pointer move adds stroke point');

        const up = mockPointerEvent({ type: 'pointerup', clientX: 130, clientY: 140 });
        sys.handlePointerUp(up);
        assert(state.isDrawing === false, 'Brush pointer up ends drawing');
        assertEqual(actions[0].type, 'STROKE', 'Dispatches stroke action');
        assertEqual(actions[0].payload.points.length, 2, 'Stroke payload includes points');

        // 8.2 Space pan flow
        state.isSpacePressed = true;
        const panDown = mockPointerEvent({ clientX: 200, clientY: 200 });
        sys.handlePointerDown(panDown);
        assert(state.isPanning === true, 'Space drag starts pan');

        const panMove = mockPointerEvent({ type: 'pointermove', clientX: 250, clientY: 210 });
        sys.handlePointerMove(panMove);
        assert(state.view.x !== 0, 'Pan updates view X');
        assert(state.view.y !== 0, 'Pan updates view Y');

        sys.handlePointerUp(mockPointerEvent({ type: 'pointerup', clientX: 250, clientY: 210 }));
        assert(state.isPanning === false, 'Pan ends on pointer up');

        // 8.3 Crop handle drag flow
        state.isCropping = true;
        state.isSpacePressed = false;
        const cropDown = mockPointerEvent({ clientX: 300, clientY: 300 });
        sys.startCropDrag(cropDown, 'handle', { h: 'se' });
        const originalCrop = { ...state.cropRect };

        const cropMove = mockPointerEvent({ type: 'pointermove', clientX: 340, clientY: 340 });
        sys.handlePointerMove(cropMove);
        assert(state.cropRect.w > originalCrop.w, 'Crop handle increases width');
        assert(state.cropRect.h > originalCrop.h, 'Crop handle increases height');

        sys.handlePointerUp(mockPointerEvent({ type: 'pointerup', clientX: 340, clientY: 340 }));
        assert(state.cropDrag === null, 'Crop drag cleared on pointer up');
    });

    // 9. Crop Rotation + Truth-Space Conversions
    register('Input: Crop Rotation Truth-Space', () => {
        const { truthToVisualRect, visualToTruthRect, truthToVisualCoordsRaw, visualToTruthCoordsRaw } = window.OkazuTestables.input;
        const fullW = 1000;
        const fullH = 800;
        const truthRect = { x: 100, y: 200, w: 300, h: 150 };

        [0, 90, 180, 270].forEach((rot) => {
            const visual = truthToVisualRect(truthRect, rot, fullW, fullH);
            const roundTrip = visualToTruthRect(visual, rot, fullW, fullH);
            assertApprox(roundTrip.x, truthRect.x, 1e-6, `Rect round-trip x @${rot}`);
            assertApprox(roundTrip.y, truthRect.y, 1e-6, `Rect round-trip y @${rot}`);
            assertApprox(roundTrip.w, truthRect.w, 1e-6, `Rect round-trip w @${rot}`);
            assertApprox(roundTrip.h, truthRect.h, 1e-6, `Rect round-trip h @${rot}`);
        });

        const zeroRect = { x: 10, y: 10, w: 0, h: 0 };
        const zeroVisual = truthToVisualRect(zeroRect, 90, fullW, fullH);
        assert(Number.isFinite(zeroVisual.x), 'Zero-size rect x is finite');
        assertEqual(zeroVisual.w, 0, 'Zero-size rect width preserved');

        const outTruth = { x: 1200, y: -200 };
        const outVisual = truthToVisualCoordsRaw(outTruth.x, outTruth.y, fullW, fullH, 270);
        const outRound = visualToTruthCoordsRaw(outVisual.x, outVisual.y, fullW, fullH, 270);
        assertApprox(outRound.x, outTruth.x, 1e-6, 'Out-of-bounds round-trip x');
        assertApprox(outRound.y, outTruth.y, 1e-6, 'Out-of-bounds round-trip y');
    });

    // 10. Modifier Key Behaviors
    register('Input: Modifier Key Behaviors', () => {
        const state = createMockState();
        const els = createMockEls();
        const { canvas, ctx } = createMockMask();
        const sys = createInputSystem({ state, els, maskCtx: ctx, maskCanvas: canvas, render: () => {}, scheduleHeavyTask: () => {} });

        const wheelCtrl = mockWheelEvent({ deltaY: 100, ctrlKey: true, clientX: 200, clientY: 200 });
        const beforeCtrl = state.brushSize;
        sys.handleWheel(wheelCtrl);
        assert(wheelCtrl.preventDefault.calls.length === 1, 'Wheel preventDefault called');
        assert(state.brushSize < beforeCtrl, 'Ctrl wheel reduces brush size');

        const wheelMeta = mockWheelEvent({ deltaY: -100, metaKey: true, clientX: 200, clientY: 200 });
        const beforeMeta = state.brushSize;
        sys.handleWheel(wheelMeta);
        assert(state.brushSize > beforeMeta, 'Meta wheel increases brush size');

        state.isCropping = true;
        const cropMeta = mockPointerEvent({ clientX: 100, clientY: 100, metaKey: true });
        sys.handlePointerDown(cropMeta);
        assert(state.cropDrag && state.cropDrag.type === 'rotate', 'Meta key starts rotate crop drag');
    });

    // 11. Pointer Move Edge Case
    register('Input: Pointer Move Edge Cases', () => {
        const state = createMockState();
        const els = createMockEls();
        const { canvas, ctx } = createMockMask();
        const sys = createInputSystem({ state, els, maskCtx: ctx, maskCanvas: canvas, render: () => {}, scheduleHeavyTask: () => {} });

        const move = mockPointerEvent({ type: 'pointermove', clientX: 100, clientY: 100, buttons: 0 });
        sys.handlePointerMove(move);
        assert(state.isDrawing === false, 'No drawing triggered on move without buttons');
    });

})();
