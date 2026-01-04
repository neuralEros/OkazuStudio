(function() {
    const { register, assert, assertEqual, assertDeepEqual, spyOn } = window.TestRunner;
    const {
        ActionHistoryLog, KeyframeManager, ReplayEngine,
        getUnionDims, cloneCanvas, rotateCanvas, rotateRect
    } = window.OkazuTestables.replay;

    // 2. Fixtures & Helpers
    function createMockState() {
        return {
            adjustments: { gamma: 1.0, colorTuning: {} },
            cropRect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
            fullDims: { w: 800, h: 600 },
            rotation: 0,
            brushSettings: { erase: { size: 0.1 } },
            opacity: 0.75,
            isAFront: true,
            assetIdA: 'asset-a', assetIdB: 'asset-b',
            nameA: 'Front', nameB: 'Back',
            maskVisible: true, backVisible: true, adjustmentsVisible: true,
            settings: { keyframeInterval: 3, keyframeBuffer: 2 },
            imgA: { width: 400, height: 600 }, imgB: { width: 900, height: 300 }
        };
    }

    function createMockCtx() {
        return {
            getImageData: () => ({ width: 800, height: 600, data: new Uint8ClampedArray(4) }),
            putImageData: () => {},
            clearRect: () => {},
            drawImage: () => {},
            translate: () => {},
            rotate: () => {},
            save: () => {},
            restore: () => {}
        };
    }

    // Helpers for canvas creation
    function makeCanvas(w, h) {
        if (typeof document !== 'undefined') {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            return c;
        }
        return { width: w, height: h, getContext: () => createMockCtx() };
    }

    const mockAssetManager = {
        getAsset: (id) => {
            if (id === 'asset-a') return { source: makeCanvas(400, 600), width: 400, height: 600 };
            if (id === 'asset-b') return { source: makeCanvas(900, 300), width: 900, height: 300 };
            return null;
        }
    };

    function withMockAssetManager(fn) {
        const original = window.AssetManager;
        window.AssetManager = mockAssetManager;
        try {
            return fn();
        } finally {
            window.AssetManager = original;
        }
    }

    // 3. ActionHistoryLog Tests
    register('Replay: ActionHistoryLog', () => {
        const history = new ActionHistoryLog();

        // 3.1 Truncate Future
        // Pre-fill
        history.actions = [{type:'A'}, {type:'B'}, {type:'C'}];
        history.cursor = 1; // At 'B'
        history.logAction({ type: 'D' });

        assertEqual(history.actions.length, 3, 'Truncated and appended (A, B, D)');
        assertEqual(history.actions[2].type, 'D', 'New action is D');
        assertEqual(history.cursor, 2, 'Cursor at end');

        // 3.3 Entry Shape
        const entry = history.actions[2];
        assert(entry.id, 'Has ID');
        assert(entry.timestamp, 'Has timestamp');
        assertEqual(entry.type, 'D');
    });

    // 4. KeyframeManager Tests
    register('Replay: KeyframeManager', () => {
        const state = createMockState();
        const ctx = createMockCtx();
        const cvs = { width: 800, height: 600 };
        const km = new KeyframeManager(state, ctx, cvs);

        // 4.1 Create Snapshot
        const snap = km.createSnapshot();
        assertEqual(snap.opacity, 0.75, 'Captures simple state');
        assertDeepEqual(snap.cropRect, state.cropRect, 'Captures objects');
        assert(snap.maskData, 'Captures mask data');

        // 4.2 Save/Prune
        // Buffer is 2. Keep -1 (base) + 2 recent.
        km.saveKeyframe(-1);
        km.saveKeyframe(0);
        km.saveKeyframe(1);
        km.saveKeyframe(2); // Should prune 0. Keep -1, 1, 2.

        assert(km.keyframes.has(-1), 'Keeps base');
        assert(!km.keyframes.has(0), 'Prunes old');
        assert(km.keyframes.has(1), 'Keeps recent 1');
        assert(km.keyframes.has(2), 'Keeps recent 2');

        // 4.6 GetNearestKeyframe
        const { index } = km.getNearestKeyframe(1.5); // Should get 1
        assertEqual(index, 1, 'Nearest <= target');
    });

    // 5. ReplayEngine Tests
    register('Replay: ReplayEngine Flow', async () => {
        const state = createMockState();
        const ctx = createMockCtx();
        const cvs = { width: 800, height: 600 };

        const renderSpy = { call: () => {} };
        const uiSpy = { call: () => {} };

        const engine = new ReplayEngine(state, ctx, cvs, () => renderSpy.call(), () => uiSpy.call(), () => {});

        // 5.1 Log Action & Keyframe Interval
        // Interval is 3.
        engine.logAction({ type: 'A1' }); // 0 -> Keyframe
        assert(engine.keyframeManager.keyframes.has(0), 'Keyframe at 0');

        engine.logAction({ type: 'A2' }); // 1
        assert(!engine.keyframeManager.keyframes.has(1), 'No keyframe at 1');

        engine.logAction({ type: 'A3' }); // 2
        engine.logAction({ type: 'A4' }); // 3 -> Keyframe
        assert(engine.keyframeManager.keyframes.has(3), 'Keyframe at 3');

        // 5.2 Undo/Redo
        const replaySpy = window.TestRunner.spyOn(engine, 'replayTo');
        replaySpy.mockImplementation(() => {}); // No-op replay logic for unit test

        // Cursor is 3. Undo -> 2.
        engine.undo();
        assertEqual(engine.history.cursor, 2, 'Cursor moved back');

        // Undo -> 1.
        engine.undo();
        assertEqual(engine.history.cursor, 1, 'Cursor moved back again');

        // Redo -> 2.
        engine.redo();
        assertEqual(engine.history.cursor, 2, 'Cursor moved forward');

        replaySpy.restore();
    });

    // 5.8 ApplyAction: LOAD_IMAGE (Logic check)
    register('Replay: ApplyAction LOAD_IMAGE', () => {
        const state = createMockState();
        state.imgA = { width: 100, height: 100 }; // Existing
        state.imgB = null;

        const engine = new ReplayEngine(state, createMockCtx(), { width: 100, height: 100 }, () => {}, () => {}, () => {});

        // Mock drawImage to prevent strict type errors in test environment or canvas tainting issues
        const drawSpy = spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
        drawSpy.mockImplementation(() => {});

        try {
            withMockAssetManager(() => {
                // Load Asset B (900x300) into Slot B
                engine.applyAction('LOAD_IMAGE', { assetId: 'asset-b', slot: 'B' });

                assertEqual(state.assetIdB, 'asset-b');
                // Union Logic: A(100x100), B(900x300).
                // Max H = 300.
                // A scale = 300/100 = 3. A Vis W = 300.
                // B scale = 1. B Vis W = 900.
                // Union W = 900. H = 300.
                assertEqual(state.fullDims.w, 900, 'Union Width');
                assertEqual(state.fullDims.h, 300, 'Union Height');
            });
        } finally {
            drawSpy.restore();
        }
    });

})();
