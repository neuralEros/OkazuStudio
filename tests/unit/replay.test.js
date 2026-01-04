
// ------------------------------------------------------------------------------------------------
// Replay Engine Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping replay tests.');
        return;
    }

    const { register, assert, assertEqual, assertApprox, assertDeepEqual, spyOn } = window.TestRunner;

    // --- 1. Harness & Mocking ---

    function createBaseState() {
        return {
            adjustments: {
                gamma: 1.0, levels: { black:0, mid:1, white:255 }, shadows:0, highlights:0,
                saturation:0, vibrance:0, wb:0, colorBal:{r:0,g:0,b:0},
                colorTuning: {
                    red: {hue:0, sat:0, vib:0, lum:0, shad:0, high:0},
                    // ... (minimal mock sufficient)
                }
            },
            cropRect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
            fullDims: { w: 800, h: 600 },
            rotation: 90,
            brushSettings: { erase: { size: 0.1, hardness: 0.5 }, repair: { size: 0.05, hardness: 0.7 } },
            opacity: 0.75,
            isAFront: true,
            assetIdA: 'asset-a', assetIdB: 'asset-b',
            nameA: 'Front', nameB: 'Back',
            maskVisible: true, backVisible: true, adjustmentsVisible: true,
            brushMode: 'erase', feather: 0.1, featherSize: 0.05, featherMode: true, brushSize: 0.1,
            settings: { keyframeInterval: 3, keyframeBuffer: 2 },
            history: [], historyIndex: -1,
            imgA: null, imgB: null
        };
    }

    function createMaskCtx() {
        return {
            getImageData: spyOn({}, 'getImageData').mockReturnValue({ width: 800, height: 600, data: new Uint8ClampedArray(4) }),
            putImageData: spyOn({}, 'putImageData'),
            clearRect: spyOn({}, 'clearRect'),
            drawImage: spyOn({}, 'drawImage'),
            canvas: { width: 800, height: 600 }
        };
    }

    // --- 3. ActionHistoryLog Tests ---

    register('Replay: 3.1 LogAction Truncation', () => {
        const state = createBaseState();
        const maskCtx = createMaskCtx();
        const engine = window.createReplayEngine(state, maskCtx, maskCtx.canvas, ()=>{}, ()=>{}, ()=>{});
        const history = window.ActionHistory;

        history.actions = [ {type:'A'}, {type:'B'}, {type:'C'} ];
        history.cursor = 1; // Pointing at B

        engine.logAction({ type: 'ADJUST', payload: { key: 'gamma', value: 1.1 } });

        assertEqual(history.actions.length, 3);
        assertEqual(history.actions[2].type, 'ADJUST');
        assertEqual(history.cursor, 2);
    });

    register('Replay: 3.3 LogAction Entry Shape', () => {
        const state = createBaseState();
        const maskCtx = createMaskCtx();
        const engine = window.createReplayEngine(state, maskCtx, maskCtx.canvas, ()=>{}, ()=>{}, ()=>{});
        const history = window.ActionHistory;

        const nowSpy = spyOn(Date, 'now').mockReturnValue(1234567890);

        const payload = { points: [{ x: 0.1, y: 0.2 }] };
        engine.logAction({ type: 'STROKE', payload });

        const entry = history.actions[history.actions.length - 1];
        assert(typeof entry.id === 'string', 'ID should be string');
        assertEqual(entry.timestamp, 1234567890);
        assertEqual(entry.payload, payload);

        nowSpy.restore();
    });

    // --- 4. KeyframeManager Tests ---

    register('Replay: 4.1 CreateSnapshot Contents', () => {
        const state = createBaseState();
        const maskCtx = createMaskCtx();
        const stubData = new Uint8ClampedArray([1,2,3,4]);
        maskCtx.getImageData.mockReturnValue({ width: 800, height: 600, data: stubData });

        const engine = window.createReplayEngine(state, maskCtx, maskCtx.canvas, ()=>{}, ()=>{}, ()=>{});

        // Use internal KeyframeManager (exposed via OkazuTestables or assumption of engine structure)
        // Since we can't easily access the private KeyframeManager instance on the engine without exposing it,
        // we will verify behavior via saveKeyframeAtCursor which triggers it.
        // Or better, verify restoreKeyframe behavior which implies createSnapshot correctness.

        engine.saveKeyframeAtCursor(); // Save at cursor -1 (Base)

        // Mutate state
        state.opacity = 0.1;
        state.rotation = 0;

        // Restore
        engine.replayTo(-1);

        // Assert state restored
        assertEqual(state.opacity, 0.75);
        assertEqual(state.rotation, 90);
        maskCtx.putImageData.expectCalled(); // Ensure mask restored
    });

    // --- 5. ReplayEngine Tests ---

    register('Replay: 5.2 Undo/Redo Constraints', () => {
        const state = createBaseState();
        const maskCtx = createMaskCtx();
        const replayToSpy = spyOn({ replayTo: ()=>{} }, 'replayTo');

        const engine = window.createReplayEngine(state, maskCtx, maskCtx.canvas, ()=>{}, ()=>{}, ()=>{});
        engine.replayTo = replayToSpy;

        const history = window.ActionHistory;
        history.actions = [ {type:'A'}, {type:'B'}, {type:'C'} ];
        history.cursor = 2;
        engine.undoFloor = 1;

        // Undo 1: 2->1 (Allowed)
        engine.undo();
        assertEqual(history.cursor, 1);
        replayToSpy.expectCalledWith(1);

        // Undo 2: 1->0 (Blocked by floor 1)
        engine.undo();
        assertEqual(history.cursor, 1);
        assertEqual(replayToSpy.calls.length, 1); // No new call

        // Redo 1: 1->2 (Allowed)
        engine.redo();
        assertEqual(history.cursor, 2);
        replayToSpy.expectCalledWith(2);
    });

    register('Replay: 5.12 STROKE uses fullDims', () => {
        const state = createBaseState();
        state.fullDims = { w: 1000, h: 1000 };
        const maskCtx = createMaskCtx();
        const engine = window.createReplayEngine(state, maskCtx, maskCtx.canvas, ()=>{}, ()=>{}, ()=>{});

        const bkSpy = spyOn(window.BrushKernel, 'drawStroke');

        engine.applyAction('STROKE', {
            points: [{x:0.1, y:0.2}],
            brushSize: 0.01, feather: 0.02, featherMode: true, isErasing: true
        });

        bkSpy.expectCalled();
        const callArgs = bkSpy.calls[0];
        const points = callArgs[1];
        const settings = callArgs[2];

        // 0.1 * 1000 = 100
        assertApprox(points[0].x, 100, 1e-6);
        assertApprox(points[0].y, 200, 1e-6);
        assertApprox(settings.size, 10, 1e-6); // brushSize * fullH

        bkSpy.restore();
    });

})();
