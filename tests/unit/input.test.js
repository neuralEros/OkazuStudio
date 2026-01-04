(function() {
    const { register, assert, assertEqual, assertApprox, assertDeepEqual } = window.TestRunner;

    // 1. Test Harness + DOM Mocks
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
            featherMode: false,
            brushSettings: {
                erase: { brushSize: 0.1, feather: 10, featherSize: 0.05 },
                repair: { brushSize: 0.05, feather: 15, featherSize: 0.05 },
                patch: { brushSize: 0.05, feather: 15, featherSize: 0.05 }
            },
            cursor: { canDraw: true },
            pointer: { isDown: false },
            polylinePoints: [],
            isCropping: false,
            isPanning: false,
            isZooming: false,
            isSpacePressed: false,
            imgA: {}, // Just to make canDraw true
            imgB: {}
        };
    }

    function createMockEls() {
        return {
            viewport: {
                clientWidth: 1200, clientHeight: 800,
                getBoundingClientRect: () => ({ left: 10, top: 20, width: 1200, height: 800, right: 1210, bottom: 820 }),
                addEventListener: () => {},
                classList: { add: () => {}, remove: () => {} },
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
            featherModeBtn: { classList: { add: () => {}, remove: () => {} }, querySelector: () => ({}) },
            cropBox: { style: { setProperty: () => {} }, addEventListener: () => {} }
        };
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
        const sys = createInputSystem({ state, els, maskCtx: {}, maskCanvas: {}, render: () => {}, scheduleHeavyTask: () => {} });

        // 4.1 setFeatherMode
        sys.setFeatherMode(true);
        assert(state.featherMode === true, 'State updated to true');
        assert(els.feather.max > 20, 'Slider max updated for fine grain');

        sys.setFeatherMode(false);
        assert(state.featherMode === false, 'State updated to false');
        assert(els.feather.max === 20, 'Slider max reset to hardness scale');
    });

    // 5. View Logic (resetView)
    register('Input: View Reset', () => {
        const state = createMockState();
        const els = createMockEls();
        const sys = createInputSystem({ state, els, maskCtx: {}, maskCanvas: {}, render: () => {}, scheduleHeavyTask: () => {} });

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

        const sys = createInputSystem({ state, els, maskCtx: {}, maskCanvas: {}, render: () => {}, scheduleHeavyTask: () => {} });

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

})();
