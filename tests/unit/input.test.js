
// ------------------------------------------------------------------------------------------------
// Input Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping input tests.');
        return;
    }

    const { register, assert, assertEqual, assertApprox, assertDeepEqual, spyOn } = window.TestRunner;

    // --- 1.1 Minimal Scaffolding ---
    register('Input: 1.1 Minimal Scaffolding', () => {
        const state = window.OkazuTestables.main.createDefaultState();
        state.fullDims = { w: 1000, h: 800 };
        state.view = { scale: 1, x: 0, y: 0 };
        state.cropRect = null;
        state.mode = 'erase';
        state.brushSize = 0.1;
        state.featherMode = false;
        state.brushSettings = { erase: { brushSize: 0.1, feather: 1, featherSize: 0.012 }, repair: { brushSize: 0.05, feather: 1, featherSize: 0.012 } };

        const els = window.OkazuTestables.main.createDefaultEls();
        els.viewport = { clientWidth: 1200, clientHeight: 800, style: {}, getBoundingClientRect: () => ({ left: 10, top: 20, width: 1200, height: 800 }), classList: { add: ()=>{}, remove: ()=>{} } };
        els.canvasWrapper = { style: {}, getBoundingClientRect: () => ({ left: 10, top: 20, width: 1000, height: 800 }) };
        els.mainCanvas = { width: 1000, height: 800, style: {}, getContext: () => ({}) };
        els.previewCanvas = { width: 1000, height: 800, style: {}, classList: { add: ()=>{}, remove: ()=>{} }, getContext: () => ({}) };
        els.cursor = { style: {} };
        els.brushSize = { value: '10', disabled: false };
        els.brushSizeVal = { textContent: '' };
        els.feather = { value: '80', min: '0', max: '100', step: '1', disabled: false };
        els.featherVal = { textContent: '' };
        els.featherLabel = { textContent: '' };
        els.cropBox = { style: { setProperty: ()=>{} }, classList: { add: () => {}, remove: () => {} } };

        assertEqual(state.view.scale, 1, 'Initial view scale');
        assertEqual(els.viewport.getBoundingClientRect().width, 1200, 'Viewport width');

        const sys = window.createInputSystem({
            state, els,
            maskCtx: {}, maskCanvas: {},
            render: () => {},
            saveSnapshot: () => {},
            undo: () => {},
            redo: () => {},
            showHints: () => {},
            scheduleHeavyTask: async (fn) => fn(),
            acceptCrop: () => {},
            cancelCrop: () => {},
            setBrushMode: () => {}
        });

        assert(sys, 'Input system created');
    });

    // --- 2. Pure Math Helpers ---

    register('Input: 2.2 rotatePoint', () => {
        const input = window.OkazuTestables.input;
        if (!input) return;
        const { rotatePoint } = input;

        const p = { x: 10, y: 20 };
        // 0 deg
        const p0 = rotatePoint(p, 0, 0, 0);
        assertApprox(p0.x, 10, 1e-6); assertApprox(p0.y, 20, 1e-6);

        // 90 deg around 0,0: (x,y) -> (-y, x)
        const p90 = rotatePoint(p, 0, 0, 90);
        assertApprox(p90.x, -20, 1e-6); assertApprox(p90.y, 10, 1e-6);

        // 180 deg: (-x, -y)
        const p180 = rotatePoint(p, 0, 0, 180);
        assertApprox(p180.x, -10, 1e-6); assertApprox(p180.y, -20, 1e-6);

        // 270 deg: (y, -x)
        const p270 = rotatePoint(p, 0, 0, 270);
        assertApprox(p270.x, 20, 1e-6); assertApprox(p270.y, -10, 1e-6);
    });

    register('Input: 2.4 truthToVisualCoordsRaw Round Trip', () => {
        const input = window.OkazuTestables.input;
        if (!input) return;
        const { truthToVisualCoordsRaw, visualToTruthCoordsRaw } = input;

        const truth = { x: 250, y: 120 };
        const fullDims = { w: 1000, h: 800 };
        const crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5 };

        [0, 90, 180, 270].forEach(rot => {
            const visual = truthToVisualCoordsRaw(truth.x, truth.y, fullDims.w, fullDims.h, rot);
            const rt = visualToTruthCoordsRaw(visual.x, visual.y, fullDims.w, fullDims.h, rot);
            assertApprox(rt.x, truth.x, 1e-6, `Rot ${rot} X`);
            assertApprox(rt.y, truth.y, 1e-6, `Rot ${rot} Y`);
        });
    });

    // --- 3. Brush Size / Feather ---

    register('Input: 3.1 sliderToBrushSize Round Trip', () => {
        const input = window.OkazuTestables.input;
        if (!input) return;
        const { sliderToBrushSize, brushSizeToSliderValue } = input;

        const s0 = sliderToBrushSize(0);
        const v0 = brushSizeToSliderValue(s0);
        assertApprox(v0, 0, 1, '0 round trip');

        const s100 = sliderToBrushSize(100);
        const v100 = brushSizeToSliderValue(s100);
        assertApprox(v100, 100, 1, '100 round trip');
    });

    register('Input: 3.2 setBrushPercent', () => {
         const state = window.OkazuTestables.main.createDefaultState();
         state.brushSettings = { erase: { brushSize: 0.1 }, repair: {}, patch: {} };
         state.mode = 'erase';
         state.fullDims = { w: 1000, h: 1000 };
         const els = window.OkazuTestables.main.createDefaultEls();
         els.brushSize = { value: '10' };
         els.brushSizeVal = { textContent: '' };

         const sys = window.createInputSystem({
             state, els,
             maskCtx: {}, maskCanvas: {},
             render: () => {},
             saveSnapshot: () => {}, undo: () => {}, redo: () => {}, showHints: () => {}, scheduleHeavyTask: async (fn)=>fn(), acceptCrop: ()=>{}, cancelCrop: ()=>{}, setBrushMode: ()=>{}
         });

         sys.setBrushPercent(0.25);
         assertEqual(state.brushSize, 0.25);
         assertEqual(state.brushSettings.erase.brushSize, 0.25);
    });

    // --- 5. View Logic ---
    register('Input: 5.1 resetView', () => {
         const state = window.OkazuTestables.main.createDefaultState();
         state.fullDims = { w: 1000, h: 800 };
         state.view = { scale: 5, x: 100, y: 100 };
         state.imgA = {}; // Mock loaded
         const els = window.OkazuTestables.main.createDefaultEls();
         els.viewport = { clientWidth: 1200, clientHeight: 800, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }), classList: { add: ()=>{}, remove: ()=>{} } };
         els.mainCanvas = { width: 1000, height: 800, style: {}, getContext: () => ({}) };
         els.canvasWrapper = { style: {} };
         els.cropBox = { style: { setProperty: ()=>{} }, classList: { add:()=>{}, remove:()=>{} } };

         const sys = window.createInputSystem({
             state, els,
             maskCtx: {}, maskCanvas: {}, render: () => {}, saveSnapshot: () => {}, undo: () => {}, redo: () => {}, showHints: () => {}, scheduleHeavyTask: async (fn)=>fn(), acceptCrop: ()=>{}, cancelCrop: ()=>{}, setBrushMode: ()=>{}
         });

         sys.resetView();

         // 1000x800 fits into 1200x800 with padding.
         // Scale should be approx 1 (slightly less due to padding).
         assert(state.view.scale <= 1, 'Scale reset to fit');
    });

})();
