(function() {
    const { register, assert, assertEqual, assertDeepEqual, spyOn } = window.TestRunner;
    const {
        ActionHistoryLog, KeyframeManager, ReplayEngine,
        getUnionDims, cloneCanvas, rotateCanvas, rotateRect
    } = window.OkazuTestables.replay;

    // 2. Fixtures & Helpers
    const COLOR_BANDS = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta', 'lights', 'mids', 'darks'];

    function createColorTuning(seed = 0) {
        const tuning = {};
        COLOR_BANDS.forEach((band, idx) => {
            tuning[band] = {
                hue: seed + idx,
                saturation: seed + idx + 1,
                vibrance: seed + idx + 2,
                luminance: seed + idx + 3,
                shadows: seed + idx + 4,
                highlights: seed + idx + 5
            };
        });
        return tuning;
    }

    function createAdjustments(seed = 0) {
        return {
            gamma: 1.1 + seed,
            levels: { black: 5 + seed, mid: 1.2 + seed, white: 250 - seed },
            shadows: 10 + seed,
            highlights: 20 + seed,
            saturation: 15 + seed,
            vibrance: 12 + seed,
            wb: 3 + seed,
            colorBal: { r: 1 + seed, g: 2 + seed, b: 3 + seed },
            colorTuning: createColorTuning(seed)
        };
    }

    function createMockState() {
        return {
            adjustments: createAdjustments(),
            cropRect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
            fullDims: { w: 800, h: 600 },
            rotation: 0,
            brushSettings: { erase: { size: 0.1, hardness: 0.5 }, repair: { size: 0.05, hardness: 0.7 } },
            opacity: 0.75,
            isAFront: true,
            assetIdA: 'asset-a', assetIdB: 'asset-b',
            nameA: 'Front', nameB: 'Back',
            maskVisible: true, backVisible: true, adjustmentsVisible: true,
            brushMode: 'erase',
            feather: 0.1,
            featherSize: 0.05,
            featherMode: true,
            brushSize: 0.1,
            settings: { keyframeInterval: 3, keyframeBuffer: 2 },
            imgA: { width: 400, height: 600 }, imgB: { width: 900, height: 300 },
            sourceA: { width: 400, height: 600 }, sourceB: { width: 900, height: 300 }
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
            restore: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            fill: () => {},
            fillStyle: '',
            globalCompositeOperation: ''
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
            if (id === 'asset-c') return { source: makeCanvas(600, 800), width: 600, height: 800 };
            return null;
        }
    };

    function withMockedGlobals(fn, { assetManager, logger, brushKernel, nowSequence, perfSequence } = {}) {
        const originalAssetManager = window.AssetManager;
        const originalLogger = window.Logger;
        const originalBrushKernel = window.BrushKernel;
        const originalDateNow = Date.now;
        const originalPerfNow = performance.now.bind(performance);
        if (assetManager) window.AssetManager = assetManager;
        if (logger) window.Logger = logger;
        if (brushKernel) window.BrushKernel = brushKernel;

        if (nowSequence) {
            let idx = 0;
            Date.now = () => nowSequence[Math.min(idx++, nowSequence.length - 1)];
        }

        if (perfSequence) {
            let idx = 0;
            performance.now = () => perfSequence[Math.min(idx++, perfSequence.length - 1)];
        }

        const restore = () => {
            window.AssetManager = originalAssetManager;
            window.Logger = originalLogger;
            window.BrushKernel = originalBrushKernel;
            Date.now = originalDateNow;
            performance.now = originalPerfNow;
        };

        try {
            const result = fn();
            if (result && typeof result.then === 'function') {
                return result.finally(restore);
            }
            restore();
            return result;
        } catch (error) {
            restore();
            throw error;
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

    register('Replay: ActionHistoryLog logging side effects', () => {
        withMockedGlobals(() => {
            const history = new ActionHistoryLog();
            const logger = { info: () => {} };
            const logSpy = spyOn(console, 'log');
            const loggerSpy = spyOn(logger, 'info');

            try {
                window.Logger = logger;
                history.logAction({ type: 'STROKE', payload: { mode: 'erase', brushSize: 0.1, feather: 0.05, featherMode: true, points: [{ x: 0.1, y: 0.2 }] } });
                history.logAction({ type: 'ADJUST', payload: { key: 'gamma', value: 1.1, oldValue: 1.0 } });
                history.logAction({ type: 'RESET_ALL', payload: {} });

                assert(loggerSpy.calls.length >= 3, 'Logger.info called for action summaries');
                assert(loggerSpy.calls.some(call => String(call[0]).includes('Point 0')), 'Stroke points logged');
                assert(logSpy.calls.some(call => String(call[0]).includes('[ActionHistory] Logged: STROKE')), 'Console log includes action prefix');
            } finally {
                logSpy.restore();
                loggerSpy.restore();
            }
        });
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

    register('Replay: KeyframeManager restoreKeyframe hydrates full state', () => {
        withMockedGlobals(() => {
            const state = createMockState();
            state.adjustments = createAdjustments(3);
            state.opacity = 0.1;
            state.brushMode = 'repair';
            state.maskVisible = false;
            state.backVisible = false;
            state.adjustmentsVisible = false;
            state.rotation = 180;

            const maskCanvas = makeCanvas(100, 100);
            const maskCtx = createMockCtx();
            const putSpy = spyOn(maskCtx, 'putImageData');

            const snapshotState = createMockState();
            snapshotState.adjustments = createAdjustments(7);
            snapshotState.opacity = 0.55;
            snapshotState.rotation = 90;
            snapshotState.brushMode = 'erase';
            snapshotState.feather = 0.2;
            snapshotState.featherSize = 0.15;
            snapshotState.featherMode = false;
            snapshotState.brushSize = 0.08;
            snapshotState.maskVisible = true;
            snapshotState.backVisible = true;
            snapshotState.adjustmentsVisible = true;

            const snapshot = {
                timestamp: 123,
                maskData: { width: 800, height: 600, data: new Uint8ClampedArray(8) },
                adjustments: JSON.parse(JSON.stringify(snapshotState.adjustments)),
                cropRect: { ...snapshotState.cropRect },
                fullDims: { ...snapshotState.fullDims },
                rotation: snapshotState.rotation,
                brushSettings: JSON.parse(JSON.stringify(snapshotState.brushSettings)),
                opacity: snapshotState.opacity,
                isAFront: snapshotState.isAFront,
                assetIdA: snapshotState.assetIdA,
                assetIdB: snapshotState.assetIdB,
                nameA: snapshotState.nameA,
                nameB: snapshotState.nameB,
                maskVisible: snapshotState.maskVisible,
                backVisible: snapshotState.backVisible,
                adjustmentsVisible: snapshotState.adjustmentsVisible,
                brushMode: snapshotState.brushMode,
                feather: snapshotState.feather,
                featherSize: snapshotState.featherSize,
                featherMode: snapshotState.featherMode,
                brushSize: snapshotState.brushSize
            };

            const km = new KeyframeManager(state, maskCtx, maskCanvas);
            km.restoreKeyframe(snapshot);

            assertDeepEqual(state.adjustments, snapshot.adjustments, 'Adjustments restored');
            assertDeepEqual(state.cropRect, snapshot.cropRect, 'Crop restored');
            assertDeepEqual(state.fullDims, snapshot.fullDims, 'Full dims restored');
            assertDeepEqual(state.brushSettings, snapshot.brushSettings, 'Brush settings restored');
            assertEqual(state.opacity, snapshot.opacity, 'Opacity restored');
            assertEqual(state.isAFront, snapshot.isAFront, 'Front/back restored');
            assertEqual(state.assetIdA, snapshot.assetIdA, 'Asset IDs restored');
            assertEqual(state.assetIdB, snapshot.assetIdB, 'Asset IDs restored');
            assertEqual(state.nameA, snapshot.nameA, 'Name A restored');
            assertEqual(state.nameB, snapshot.nameB, 'Name B restored');
            assertEqual(state.maskVisible, snapshot.maskVisible, 'Mask visibility restored');
            assertEqual(state.backVisible, snapshot.backVisible, 'Back visibility restored');
            assertEqual(state.adjustmentsVisible, snapshot.adjustmentsVisible, 'Adjustments visibility restored');
            assertEqual(state.brushMode, snapshot.brushMode, 'Brush mode restored');
            assertEqual(state.feather, snapshot.feather, 'Feather restored');
            assertEqual(state.featherSize, snapshot.featherSize, 'Feather size restored');
            assertEqual(state.featherMode, snapshot.featherMode, 'Feather mode restored');
            assertEqual(state.brushSize, snapshot.brushSize, 'Brush size restored');

            assert(state.imgA !== null && state.imgA !== window.AssetManager.getAsset('asset-a').source, 'ImgA cloned');
            assert(state.imgB !== null && state.imgB !== window.AssetManager.getAsset('asset-b').source, 'ImgB cloned');
            assertEqual(maskCanvas.width, 800, 'Mask canvas resized width');
            assertEqual(maskCanvas.height, 600, 'Mask canvas resized height');
            assertEqual(putSpy.calls.length, 1, 'Mask putImageData called');
            assertEqual(putSpy.calls[0][0], snapshot.maskData, 'Mask data restored');

            putSpy.restore();
        }, { assetManager: mockAssetManager });
    });

    register('Replay: KeyframeManager restoreKeyframe handles missing assets', () => {
        withMockedGlobals(() => {
            const state = createMockState();
            state.imgA = null;
            state.sourceA = null;
            const maskCanvas = makeCanvas(100, 100);
            const maskCtx = createMockCtx();
            const warnSpy = spyOn(console, 'warn');

            const snapshot = {
                timestamp: 123,
                maskData: { width: 100, height: 100, data: new Uint8ClampedArray(4) },
                adjustments: createAdjustments(),
                cropRect: { x: 0, y: 0, w: 1, h: 1 },
                fullDims: { w: 100, h: 100 },
                rotation: 0,
                brushSettings: { erase: { size: 0.1 } },
                opacity: 1,
                isAFront: true,
                assetIdA: 'missing-asset',
                assetIdB: null,
                nameA: 'Missing',
                nameB: '',
                maskVisible: true,
                backVisible: true,
                adjustmentsVisible: true,
                brushMode: 'erase',
                feather: 0.1,
                featherSize: 0.05,
                featherMode: true,
                brushSize: 0.1
            };

            const km = new KeyframeManager(state, maskCtx, maskCanvas);
            km.restoreKeyframe(snapshot);

            assertEqual(state.imgA, null, 'Missing asset leaves imgA null');
            assertEqual(state.sourceA, null, 'Missing asset leaves sourceA null');
            assert(warnSpy.calls.length >= 1, 'Warns on missing asset');

            warnSpy.restore();
        }, { assetManager: { getAsset: () => null } });
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

    register('Replay: ReplayEngine replayTo ordering + timing log', async () => {
        await withMockedGlobals(async () => {
            const state = createMockState();
            const ctx = createMockCtx();
            const cvs = { width: 800, height: 600 };
            const order = [];

            const engine = new ReplayEngine(state, ctx, cvs, () => order.push('render'), () => order.push('updateUI'), () => order.push('rebuildWorkingCopies'));
            engine.history.actions = [
                { type: 'A0', payload: { value: 0 } },
                { type: 'A1', payload: { value: 1 } },
                { type: 'A2', payload: { value: 2 } }
            ];
            engine.history.cursor = 2;

            engine.keyframeManager.keyframes.set(0, { mock: true });

            const restoreSpy = spyOn(engine.keyframeManager, 'restoreKeyframe');
            restoreSpy.mockImplementation(() => order.push('restore'));

            const applySpy = spyOn(engine, 'applyAction');
            applySpy.mockImplementation((type, payload) => order.push(`apply:${payload.value}`));

            engine.setUpdateCanvasDimensionsFn(() => order.push('updateCanvasDimensions'));

            const logSpy = spyOn(console, 'log');

            try {
                await engine.replayTo(2);
                assertDeepEqual(order, ['restore', 'apply:1', 'apply:2', 'rebuildWorkingCopies', 'updateCanvasDimensions', 'updateUI', 'render'], 'Replay ordering');
                assert(logSpy.calls.some(call => String(call[0]).includes('Replay to 2')), 'Timing log emitted');
            } finally {
                restoreSpy.restore();
                applySpy.restore();
                logSpy.restore();
            }
        }, { perfSequence: [100, 125] });
    });

    register('Replay: ReplayEngine rotation bake during actions', () => {
        withMockedGlobals(() => {
            const state = createMockState();
            state.rotation = 90;
            state.fullDims = { w: 800, h: 600 };
            state.cropRect = { x: 10, y: 20, w: 30, h: 40 };
            state.imgA = makeCanvas(800, 600);
            state.sourceA = state.imgA;

            const maskCanvas = makeCanvas(800, 600);
            const engine = new ReplayEngine(state, createMockCtx(), maskCanvas, () => {}, () => {}, () => {});
            const bakeSpy = spyOn(engine, 'performBakeRotation');

            engine.applyAction('APPLY_CENSOR', { assetId: 'asset-c' });

            assertEqual(bakeSpy.calls.length, 1, 'Bake rotation triggered');
            assertEqual(state.rotation, 0, 'Rotation reset after bake');
            assertEqual(maskCanvas.width, 600, 'Mask rotated width');
            assertEqual(maskCanvas.height, 800, 'Mask rotated height');
            assertDeepEqual(state.cropRect, rotateRect({ x: 10, y: 20, w: 30, h: 40 }, 800, 600, 90), 'Crop rect rotated');

            bakeSpy.restore();
        }, { assetManager: mockAssetManager });
    });

    register('Replay: ReplayEngine applyAction adjustments/toggles/crop', () => {
        const state = createMockState();
        const engine = new ReplayEngine(state, createMockCtx(), { width: 100, height: 100 }, () => {}, () => {}, () => {});

        engine.applyAction('ADJUST', { key: 'levels', subkey: 'mid', value: 2.5 });
        assertEqual(state.adjustments.levels.mid, 2.5, 'Nested adjustments updated');

        engine.applyAction('ADJUST', { key: 'gamma', value: 1.8 });
        assertEqual(state.adjustments.gamma, 1.8, 'Top-level adjustments updated');

        engine.applyAction('TUNE_COLOR', { band: 'red', key: 'hue', value: 25 });
        assertEqual(state.adjustments.colorTuning.red.hue, 25, 'Color tuning updated');

        engine.applyAction('SET_OPACITY', { value: 0.4 });
        assertEqual(state.opacity, 0.4, 'Opacity updated');

        engine.applyAction('TOGGLE_MASK', { visible: false });
        engine.applyAction('TOGGLE_BACK', { visible: false });
        engine.applyAction('TOGGLE_ADJUSTMENTS', { visible: false });
        assertEqual(state.maskVisible, false, 'Mask toggle updated');
        assertEqual(state.backVisible, false, 'Back toggle updated');
        assertEqual(state.adjustmentsVisible, false, 'Adjustments toggle updated');

        engine.applyAction('CROP', { rect: { x: 0.2, y: 0.3, w: 0.4, h: 0.5 } });
        assertDeepEqual(state.cropRect, { x: 0.2, y: 0.3, w: 0.4, h: 0.5 }, 'Crop rect updated');
    });

    register('Replay: ReplayEngine applyAction merge/censor', () => {
        withMockedGlobals(() => {
            const state = createMockState();
            state.cropRect = null;
            state.opacity = 0.2;
            state.isAFront = false;
            state.imgB = makeCanvas(50, 50);
            state.sourceB = state.imgB;

            const engine = new ReplayEngine(state, createMockCtx(), { width: 100, height: 100 }, () => {}, () => {}, () => {});

            engine.applyAction('APPLY_CENSOR', { assetId: 'asset-b' });
            assertEqual(state.assetIdB, 'asset-b', 'Censor asset set');
            assertEqual(state.nameB, 'Censored Layer', 'Censor default name');
            assertDeepEqual(state.fullDims, { w: 900, h: 300 }, 'Censor dims');
            assertDeepEqual(state.cropRect, { x: 0, y: 0, w: 3, h: 1.0 }, 'Censor crop default');
            assertEqual(state.opacity, 1.0, 'Censor resets opacity');
            assertEqual(state.isAFront, true, 'Censor resets front');

            engine.applyAction('MERGE_LAYERS', { assetId: 'asset-a' });
            assertEqual(state.nameA, 'Merged Layer', 'Merge default name');
            assertEqual(state.assetIdB, null, 'Merge clears back asset');
            assertEqual(state.imgB, null, 'Merge clears back image');
            assertEqual(state.sourceB, null, 'Merge clears back source');
            assertDeepEqual(state.fullDims, { w: 400, h: 600 }, 'Merge dims');
            assertDeepEqual(state.cropRect, { x: 0, y: 0, w: 400 / 600, h: 1.0 }, 'Merge default crop');
        }, { assetManager: mockAssetManager });
    });

    register('Replay: ReplayEngine applyAction strokes', () => {
        withMockedGlobals(() => {
            const state = createMockState();
            state.fullDims = { w: 1000, h: 1000 };
            const maskCtx = createMockCtx();
            const maskCanvas = { width: 1000, height: 1000 };
            const brushKernel = {
                drawStroke: () => {},
                paintStampAt: () => {},
                paintStrokeSegment: () => {}
            };

            const drawSpy = spyOn(brushKernel, 'drawStroke');
            const stampSpy = spyOn(brushKernel, 'paintStampAt');
            const segSpy = spyOn(brushKernel, 'paintStrokeSegment');

            window.BrushKernel = brushKernel;
            const engine = new ReplayEngine(state, maskCtx, maskCanvas, () => {}, () => {}, () => {});

            engine.applyAction('STROKE', { points: [{ x: 0.1, y: 0.2 }], brushSize: 0.01, feather: 0.02, featherMode: true, isErasing: true });
            assertEqual(drawSpy.calls.length, 1, 'DrawStroke called');
            assertDeepEqual(drawSpy.calls[0][2], { size: 10, feather: 20, featherMode: true, isErasing: true }, 'Stroke params in pixels');
            assertDeepEqual(drawSpy.calls[0][1], [{ x: 100, y: 200 }], 'Stroke points converted');

            engine.applyAction('POLYLINE', { points: [{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 }], brushSize: 0.01, feather: 2, featherMode: false, mode: 'erase' });
            assertEqual(stampSpy.calls.length, 2, 'Stamp called for polyline');
            assertEqual(segSpy.calls.length, 1, 'Stroke segment called for polyline');
            assertDeepEqual(stampSpy.calls[0], [maskCtx, 100, 200, 10, 2, false, true], 'Polyline stamp args');
            assertDeepEqual(segSpy.calls[0], [maskCtx, { x: 100, y: 200 }, { x: 200, y: 300 }, 10, 2, false, true], 'Polyline segment args');

            drawSpy.restore();
            stampSpy.restore();
            segSpy.restore();
        }, { brushKernel: {} });
    });

    // 5.8 ApplyAction: LOAD_IMAGE (Logic check)
    register('Replay: ApplyAction LOAD_IMAGE', () => {
        withMockedGlobals(() => {
            const state = createMockState();
            state.imgA = { width: 100, height: 100 }; // Existing
            state.imgB = null;

            const engine = new ReplayEngine(state, createMockCtx(), { width: 100, height: 100 }, () => {}, () => {}, () => {});

            // Mock drawImage to prevent strict type errors in test environment or canvas tainting issues
            const drawSpy = spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
            drawSpy.mockImplementation(() => {});

            try {
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
            } finally {
                drawSpy.restore();
            }
        }, { assetManager: mockAssetManager });
    });

})();
