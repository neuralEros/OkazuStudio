(function() {
    const { register, assert, assertEqual, assertDeepEqual, spyOn } = window.TestRunner;

    // 2. Test Fixtures & Helpers
    function createMockState() {
        return {
            adjustments: { gamma: 1.0, levels: {black:0,mid:1,white:255}, colorTuning: {}, colorBal: {r:0,g:0,b:0} },
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
            settings: { keyframeInterval: 3, keyframeBuffer: 2 }
        };
    }

    function createMockCtx(width, height) {
        return {
            getImageData: spyOn({ getImageData: () => ({ width, height, data: new Uint8ClampedArray(width*height*4) }) }, 'getImageData'),
            putImageData: spyOn({}, 'putImageData'),
            clearRect: spyOn({}, 'clearRect'),
            drawImage: spyOn({}, 'drawImage')
        };
    }

    const mockRender = spyOn({}, 'render');
    const mockUpdateUI = spyOn({}, 'updateUI');
    const mockRebuild = spyOn({}, 'rebuild');

    // 3. ActionHistoryLog Tests
    register('Replay: LogAction truncates future', () => {
        const { ActionHistoryLog } = window.OkazuTestables.replay;
        const log = new ActionHistoryLog();
        log.actions = [{type:'A'}, {type:'B'}, {type:'C'}];
        log.cursor = 1;

        log.logAction({ type: 'D', payload: {} });

        // Should truncate index 2 ('C'), then push 'D' at index 2
        assertEqual(log.actions.length, 3);
        assertEqual(log.actions[0].type, 'A');
        assertEqual(log.actions[1].type, 'B');
        assertEqual(log.actions[2].type, 'D');
        assertEqual(log.cursor, 2);
    });

    register('Replay: LogAction cursor updates', () => {
        const { ActionHistoryLog } = window.OkazuTestables.replay;
        const log = new ActionHistoryLog();
        log.logAction({ type: 'A' });
        log.logAction({ type: 'B' });
        log.logAction({ type: 'C' });

        assertEqual(log.cursor, 2);
    });

    // 4. KeyframeManager Tests
    register('Replay: createSnapshot contents', () => {
        const { KeyframeManager } = window.OkazuTestables.replay;
        const state = createMockState();
        const maskCanvas = { width: 800, height: 600 };
        const maskCtx = createMockCtx(800, 600);

        const km = new KeyframeManager(state, maskCtx, maskCanvas);
        const snapshot = km.createSnapshot();

        assertEqual(snapshot.opacity, 0.75);
        assertDeepEqual(snapshot.fullDims, { w: 800, h: 600 });
        // Check deep copy of adjustments
        state.adjustments.gamma = 2.0;
        assertEqual(snapshot.adjustments.gamma, 1.0);
    });

    register('Replay: saveKeyframe buffer policy', () => {
        const { KeyframeManager } = window.OkazuTestables.replay;
        const state = createMockState();
        state.settings.keyframeBuffer = 2;
        const km = new KeyframeManager(state, createMockCtx(10,10), {width:10,height:10});

        // Base
        km.saveKeyframe(-1);
        km.saveKeyframe(0);
        km.saveKeyframe(1);
        km.saveKeyframe(2);
        km.saveKeyframe(3);

        // Keep -1 (base) + last 2 (2, 3)
        // Should prune 0 and 1
        assert(km.keyframes.has(-1));
        assert(km.keyframes.has(2));
        assert(km.keyframes.has(3));
        assert(!km.keyframes.has(0));
        assert(!km.keyframes.has(1));
    });

    // 5. ReplayEngine Tests
    register('Replay: logAction keyframe interval', () => {
        const { ReplayEngine } = window.OkazuTestables.replay;
        const state = createMockState();
        state.settings.keyframeInterval = 2;
        const engine = new ReplayEngine(state, createMockCtx(10,10), {width:10,height:10}, mockRender, mockUpdateUI, mockRebuild);

        // saveKeyframe is internal to keyframeManager. We check side effects or spy if we can access km.
        // We can spy on engine.keyframeManager.saveKeyframe
        const saveSpy = spyOn(engine.keyframeManager, 'saveKeyframe');

        engine.logAction({ type: 'A' }); // 0. Interval 2. 0%2==0 -> Save.
        engine.logAction({ type: 'B' }); // 1. Skip.
        engine.logAction({ type: 'C' }); // 2. Save.

        // Counts:
        // -1 (Base) was saved in constructor.
        // 0 saved.
        // 2 saved.

        // The spy wasn't on the instance created in constructor... wait.
        // engine.keyframeManager IS the instance.
        // But constructor runs before we spy. So -1 call is missed.

        // check calls
        // saveKeyframe(0)
        // saveKeyframe(2)

        const calls = saveSpy.calls.map(c => c[0]);
        assert(calls.includes(0), 'Should save at 0');
        assert(calls.includes(2), 'Should save at 2');
        assert(!calls.includes(1), 'Should skip 1');

        saveSpy.restore();
    });

    register('Replay: undo/redo constraints', () => {
        const { ReplayEngine } = window.OkazuTestables.replay;
        const state = createMockState();
        const engine = new ReplayEngine(state, createMockCtx(10,10), {width:10,height:10}, mockRender, mockUpdateUI, mockRebuild);

        engine.logAction({type:'A'}); // 0
        engine.logAction({type:'B'}); // 1
        engine.logAction({type:'C'}); // 2

        // Mock replayTo
        const replaySpy = spyOn(engine, 'replayTo');
        replaySpy.mockImplementation(() => Promise.resolve());

        engine.setUndoFloor(1);

        // Current cursor 2.
        engine.undo(); // -> 1. Valid (> floor 1? No, floor is inclusive limit? Implementation: > undoFloor)
        // Implementation: cursor > undoFloor. 2 > 1. OK.

        assertEqual(engine.history.cursor, 1);
        replaySpy.expectCalledWith(1);

        // Undo again
        engine.undo(); // Cursor 1. 1 is not > 1. Blocked.
        assertEqual(engine.history.cursor, 1);
        // Should not call replayTo again?
        // Spy calls count
        if(replaySpy.calls.length !== 1) throw new Error('Should not replay blocked undo');

        replaySpy.restore();
    });

    register('Replay: performBakeRotation', () => {
        const { ReplayEngine } = window.OkazuTestables.replay;
        const state = createMockState();
        state.rotation = 90;
        state.fullDims = { w: 800, h: 600 };
        state.imgA = { width: 400, height: 600 }; // Mock canvas
        // Need to mock rotateCanvas/rotateRect/cloneCanvas/getUnionDims globally or locally?
        // They are exported in OkazuTestables.replay but used internally in class via closure or window?
        // In `scripts/replay.js`, they are standalone functions in closure.
        // We cannot spy on them directly unless we monkeypatch them if they were attached to window or something.
        // But they are not.

        // However, rotateCanvas creates a new canvas.
        // performBakeRotation uses `rotateCanvas` from closure.
        // We rely on state changes.

        const engine = new ReplayEngine(state, createMockCtx(800,600), {width:800,height:600}, mockRender, mockUpdateUI, mockRebuild);

        // Mock rotateCanvas logic by verifying `state.imgA` changed reference/dims?
        // Real `rotateCanvas` will run. It requires `document.createElement('canvas')`.

        engine.performBakeRotation();

        assertEqual(state.rotation, 0);
        assertEqual(state.fullDims.w, 600); // Swapped
        assertEqual(state.fullDims.h, 800);
    });

    register('Replay: applyAction MERGE_LAYERS', () => {
        const { ReplayEngine } = window.OkazuTestables.replay;
        const state = createMockState();
        const engine = new ReplayEngine(state, createMockCtx(10,10), {width:10,height:10}, mockRender, mockUpdateUI, mockRebuild);

        // Setup payload with an asset that exists
        const asset = { source: { width: 100, height: 100 }, width: 100, height: 100 };
        window.AssetManager = { getAsset: () => asset };

        state.cropRect = null; // force default calc

        engine.applyAction('MERGE_LAYERS', { assetId: 'merged-id' });

        assertEqual(state.nameA, 'Merged Layer');
        assertEqual(state.imgB, null);
        assertEqual(state.fullDims.w, 100);
        assertEqual(state.cropRect.w, 1.0); // 100/100

        // Cleanup global mock
        delete window.AssetManager;
    });

})();
