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
    window.AssetManager = mockAssetManager;

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

        // Mock cloneCanvas to avoid real canvas ops in unit test
        const originalClone = window.OkazuTestables.replay.cloneCanvas;
        window.OkazuTestables.replay.cloneCanvas = (src) => ({ width: src.width, height: src.height, fake: true });

        // We also need to override the method on the prototype or bind?
        // ReplayEngine uses `cloneCanvas` from the closure scope, but `window.OkazuTestables.replay` exposes the *reference*.
        // Modifying the exposed reference won't change the internal usage in `replay.js`.
        // However, `replay.js` is inside an IIFE. We cannot monkeypatch internal functions.
        // But `ReplayEngine` logic calls `cloneCanvas(asset.source)`.

        // Solution: Since we can't mock internal `cloneCanvas`, we must ensure `asset.source` is a valid CanvasImageSource.
        // In JSDOM/Headless, `document.createElement('canvas')` creates a valid source.
        // The error `The provided value is not of type...` suggests `makeCanvas` failed or returned a plain object.
        // In the previous patch, `makeCanvas` returns `{ width, height, getContext }` if document is undefined.
        // `cloneCanvas` calls `c.getContext('2d').drawImage(source, 0, 0)`.
        // `drawImage` requires a valid Canvas/Image. A plain object with `getContext` is NOT valid.
        // Ensure `document` exists or mock `ReplayEngine.prototype.applyAction`? No.

        // If we are in a browser environment (TestRunner runs in browser), `document` exists.
        // `makeCanvas` returns a real canvas.
        // `cloneCanvas` creates a real canvas and draws.
        // The error implies `mockAssetManager` returned a plain object source?
        // Ah, `AssetManager` is mocked globally. `ReplayEngine` calls `window.AssetManager.getAsset`.
        // The mock returns: `{ source: makeCanvas(...) }`.

        // Wait, if `makeCanvas` returns a real canvas, it should work.
        // Maybe the error comes from `cloneCanvas` creating `document.createElement('canvas')` and failing?
        // Or `c.getContext('2d')`?
        // Let's assume the issue is strict type checking in `drawImage`.
        // I will Mock `performBakeRotation` and `applyAction` parts if possible? No.

        // Best approach: If we can't rely on canvas ops, we should skip the drawing part.
        // But we can't inject logic into `replay.js`.

        // Let's try to pass a real ImageBitmap or Canvas if possible?
        // Or, assume that `makeCanvas` logic in previous patch was flawed?
        // `if (typeof document !== 'undefined')` -> it IS defined in browser.

        // Let's debug by simplifying: Just ensure the mock returns a simplistic object that passes check?
        // No, `drawImage` checks internal slots.
        // Okay, let's try to mock `window.createReplayEngine` or methods?
        // No, we are testing `ReplayEngine`.

        // Critical: In `scripts/replay.js`, `cloneCanvas` is NOT exposed for reassignment.
        // It is an internal function.

        // Workaround: Mock `CanvasRenderingContext2D.prototype.drawImage` to be a no-op spy?
        // This is global, but valid for this test session.
        const origDraw = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = () => {};

        try {
            // Load Asset B (900x300) into Slot B
            engine.applyAction('LOAD_IMAGE', { assetId: 'asset-b', slot: 'B' });

            assertEqual(state.assetIdB, 'asset-b');
            assertEqual(state.fullDims.w, 900, 'Union Width');
            assertEqual(state.fullDims.h, 300, 'Union Height');
        } finally {
            CanvasRenderingContext2D.prototype.drawImage = origDraw;
        }
    });

})();
