(function() {
    const { register, assert, assertEqual, assertDeepEqual, spyOn } = window.TestRunner;

    // 1.3. Shared Fixtures
    const DEFAULTS = window.OkazuTestables.stego.DEFAULTS;

    function makeState(overrides = {}) {
        return {
            adjustments: JSON.parse(JSON.stringify({ // Deep clone defaults
                gamma: 1.0,
                levels: { black: 0, mid: 1.0, white: 255 },
                shadows: 0, highlights: 0, saturation: 0, vibrance: 0, wb: 0,
                colorBal: { r: 0, g: 0, b: 0 },
                colorTuning: {
                    red: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    // ... minimal map for testing logic
                }
            })),
            cropRect: null,
            cropRotation: 0,
            fullDims: { w: 400, h: 300 },
            nameB: "",
            ...overrides
        };
    }

    function makeHistory(actions, cursor) {
        return { actions, cursor: cursor !== undefined ? cursor : actions.length - 1 };
    }

    const { getMaskActions, getAdjustmentsPacket, getCropPacket, assemblePayload } = window.OkazuTestables.stego;

    // 1.4. getMaskActions Tests
    register('Stego: getMaskActions barrier logic', () => {
        const history = makeHistory([
            { type: 'STROKE' }, // 0
            { type: 'POLYLINE' }, // 1
            { type: 'LOAD_IMAGE' }, // 2 (Barrier)
            { type: 'STROKE' } // 3
        ], 3);

        const result = getMaskActions(history);
        assert(result !== null);
        assertEqual(result.length, 1);
        assertEqual(result[0].type, 'STROKE');
    });

    register('Stego: getMaskActions barrier validation', () => {
        const history = makeHistory([
            { type: 'MERGE_LAYERS' }, // Barrier
            { type: 'STROKE' },
            { type: 'UNDO' }, // Ignored by filter but loop iterates it
            { type: 'POLYLINE' },
            { type: 'REDO' } // Ignored
        ], 4);

        const result = getMaskActions(history);
        // Only STROKE and POLYLINE returned
        const types = result.map(a => a.type);
        assertDeepEqual(types, ['STROKE', 'POLYLINE']);
    });

    register('Stego: getMaskActions no barrier', () => {
        const history = makeHistory([
            { type: 'STROKE' },
            { type: 'POLYLINE' }
        ], 1);
        const result = getMaskActions(history);
        assertEqual(result.length, 2);
    });

    register('Stego: getMaskActions empty', () => {
        const history = makeHistory([], -1);
        assertEqual(getMaskActions(history), null);
    });

    // 1.5. getAdjustmentsPacket Tests
    register('Stego: getAdjustmentsPacket detection', () => {
        const state = makeState();
        // Clean
        assertEqual(getAdjustmentsPacket(state), null);

        // Dirty Gamma
        state.adjustments.gamma = 1.2;
        const res = getAdjustmentsPacket(state);
        assert(res === state.adjustments);
    });

    register('Stego: getAdjustmentsPacket tolerance', () => {
        const state = makeState();
        state.adjustments.gamma = 1.0005; // Below 0.001 thresh
        assertEqual(getAdjustmentsPacket(state), null);
    });

    register('Stego: getAdjustmentsPacket color tuning', () => {
        const state = makeState();
        state.adjustments.colorTuning.red = { hue: 1, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
        assert(getAdjustmentsPacket(state) !== null);
    });

    // 1.6. getCropPacket Tests
    register('Stego: getCropPacket full crop check', () => {
        const state = makeState({
            fullDims: { w: 400, h: 200 },
            cropRect: { x: 0.005, y: 0.005, w: 2.005, h: 0.995 }, // Aspect 2.0.
            cropRotation: 0
        });
        assertEqual(getCropPacket(state), null);
    });

    register('Stego: getCropPacket includes rotation', () => {
        const state = makeState({
            cropRect: { x: 0.1, y: 0.1, w: 1.5, h: 0.8 },
            cropRotation: 90
        });
        const res = getCropPacket(state);
        assertEqual(res.rotation, 90);
    });

    register('Stego: getCropPacket partial crop', () => {
        const state = makeState({
            cropRect: { x: 0.2, y: 0, w: 1.0, h: 1.0 }, // Clearly partial
            cropRotation: 0
        });
        const res = getCropPacket(state);
        assertEqual(res.x, 0.2);
        assertEqual(res.rotation, undefined);
    });

    // 1.7. assemblePayload Tests
    register('Stego: assemblePayload merged export', () => {
        // Needs mask, adj, crop.
        const state = makeState({
            cropRect: { x: 0.1, y:0, w:1, h:1 }
        });
        state.adjustments.gamma = 1.2;
        const history = makeHistory([{type: 'STROKE'}]);

        const payload = assemblePayload(state, history, 'merged');
        assert(payload.mask !== undefined);
        assert(payload.adjustments !== undefined);
        assert(payload.crop !== undefined);
        assert(payload.censor === undefined);
    });

    register('Stego: assemblePayload front export', () => {
        // Excludes mask. Includes adj/crop.
        const state = makeState();
        state.adjustments.gamma = 1.2;
        const history = makeHistory([{type:'STROKE'}]);

        const payload = assemblePayload(state, history, 'front');
        assert(payload.mask === undefined);
        assert(payload.adjustments !== undefined);
    });

    register('Stego: assemblePayload save with censor', () => {
        const state = makeState({ nameB: 'Censored Layer' });
        const history = makeHistory([]);

        const payload = assemblePayload(state, history, 'save');
        assertEqual(payload.censor, true);
    });

    register('Stego: assemblePayload save without censor', () => {
        const state = makeState({ nameB: 'Normal Layer' });
        const history = makeHistory([]);

        const payload = assemblePayload(state, history, 'save');
        assertEqual(payload.censor, undefined);
    });

    register('Stego: assemblePayload defaults', () => {
        const state = makeState();
        const history = makeHistory([]);
        const payload = assemblePayload(state, history, 'merged');

        assert(payload.info !== undefined);
        assert(payload.adjustments === undefined);
        assert(payload.crop === undefined);
        assert(payload.mask === undefined);
    });

})();
