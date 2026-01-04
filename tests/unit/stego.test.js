
// ------------------------------------------------------------------------------------------------
// Stego Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping stego tests.');
        return;
    }

    const { register, assert, assertEqual, assertApprox, assertDeepEqual, spyOn } = window.TestRunner;

    // --- 1. Harness & Mocking ---

    // Testables exposed by scripts/stego.js
    const stego = window.OkazuTestables && window.OkazuTestables.stego;
    if (!stego) {
        console.warn('Stego testables missing');
        return;
    }
    const { getMaskActions, getAdjustmentsPacket, getCropPacket, DEFAULTS } = stego;
    // assemblePayload is usually attached to window.Stego
    const Stego = window.Stego;

    function makeState(overrides) {
        const base = {
            adjustments: JSON.parse(JSON.stringify(DEFAULTS)),
            cropRect: null,
            cropRotation: 0,
            fullDims: { w: 400, h: 300 },
            nameB: ""
        };
        // Merge overrides
        if (overrides) {
            if (overrides.adjustments) Object.assign(base.adjustments, overrides.adjustments);
            if (overrides.cropRect) base.cropRect = overrides.cropRect;
            if (overrides.cropRotation !== undefined) base.cropRotation = overrides.cropRotation;
            if (overrides.fullDims) base.fullDims = overrides.fullDims;
            if (overrides.nameB !== undefined) base.nameB = overrides.nameB;
        }
        return base;
    }

    // --- 1.4 getMaskActions ---

    register('Stego: 1.4.1 Stops scanning at barrier', () => {
        const history = {
            actions: [
                { type: 'STROKE' },
                { type: 'POLYLINE' },
                { type: 'LOAD_IMAGE' }, // Barrier
                { type: 'STROKE' }      // Should be included (scanning backwards from cursor)
            ],
            cursor: 3
        };
        const result = getMaskActions(history);
        assertEqual(result.length, 1);
        assertEqual(result[0].type, 'STROKE');
    });

    register('Stego: 1.4.2 Includes only STROKE/POLYLINE', () => {
        const history = {
            actions: [
                { type: 'MERGE_LAYERS' }, // Barrier
                { type: 'STROKE' },
                { type: 'UNDO' },
                { type: 'POLYLINE' },
                { type: 'REDO' }
            ],
            cursor: 4
        };
        const result = getMaskActions(history);
        // Should find POLYLINE then STROKE (reversed order in scan, but result order matters?)
        // Implementation typically returns oldest-to-newest.
        // Scan backwards: REDO(skip), POLYLINE(keep), UNDO(skip), STROKE(keep), MERGE(stop).
        // Result: [STROKE, POLYLINE].

        assertEqual(result.length, 2);
        assertEqual(result[0].type, 'STROKE');
        assertEqual(result[1].type, 'POLYLINE');
    });

    register('Stego: 1.4.3 Barrier types validation', () => {
        const barriers = ['LOAD_IMAGE', 'MERGE_LAYERS', 'APPLY_CENSOR', 'RESET_ALL', 'CLEAR_LAYER'];
        barriers.forEach(b => {
            const h = {
                actions: [{ type: 'STROKE' }, { type: b }, { type: 'STROKE' }],
                cursor: 2
            };
            const r = getMaskActions(h);
            assertEqual(r.length, 1, `Barrier ${b} failed`);
        });
    });

    register('Stego: 1.4.4 Cursor edge cases', () => {
        const h = { actions: [], cursor: -1 };
        const r = getMaskActions(h);
        assertEqual(r, null, 'Should return null for empty/invalid history');
    });

    // --- 1.5 getAdjustmentsPacket ---

    register('Stego: 1.5.1 Detects deviation', () => {
        const state = makeState();
        state.adjustments.gamma = 1.2;
        const packet = getAdjustmentsPacket(state);
        assert(packet !== null, 'Should detect change');
        assertEqual(packet.gamma, 1.2);
    });

    register('Stego: 1.5.2 Tolerance thresholds', () => {
        const state = makeState();
        state.adjustments.gamma = 1.0005; // < 0.001 diff
        state.adjustments.shadows = 0.0005;
        state.adjustments.levels.mid = 1.0005;

        const packet = getAdjustmentsPacket(state);
        assertEqual(packet, null, 'Should ignore micro-deviations');
    });

    // --- 1.6 getCropPacket ---

    register('Stego: 1.6.1 Full-image crop tolerance', () => {
        const state = makeState();
        state.fullDims = { w: 400, h: 200 }; // aspect 2.0
        state.cropRect = { x: 0.005, y: 0.005, w: 2.005, h: 0.995 };

        const packet = getCropPacket(state);
        assertEqual(packet, null, 'Should ignore full crop within tolerance');
    });

    register('Stego: 1.6.2 Includes rotation', () => {
        const state = makeState();
        state.cropRect = { x:0.1, y:0.1, w:1.5, h:0.8 };
        state.cropRotation = 90;

        const packet = getCropPacket(state);
        assertEqual(packet.rotation, 90);
    });

    // --- 1.7 assemblePayload ---

    register('Stego: 1.7.1 ExportType merged', () => {
        const state = makeState();
        state.adjustments.gamma = 1.5; // Dirty adjustments

        const history = {
            actions: [{ type: 'STROKE' }],
            cursor: 0
        };
        // Mock getMaskActions behavior or ensure state allows it.
        // Actually we need to ensure getMaskActions sees the stroke.

        const payload = Stego.assemblePayload(state, history, 'merged');

        assert(payload.mask !== undefined, 'Mask included');
        assert(payload.adjustments !== undefined, 'Adjustments included');
        // crop is null in state, so undefined in payload
        assertEqual(payload.crop, undefined);
        assertEqual(payload.censor, undefined);
    });

    register('Stego: 1.7.2 ExportType front', () => {
        const state = makeState();
        state.adjustments.gamma = 1.5;
        const history = { actions: [{ type: 'STROKE' }], cursor: 0 };

        const payload = Stego.assemblePayload(state, history, 'front');

        assertEqual(payload.mask, undefined, 'Mask excluded for front');
        assert(payload.adjustments !== undefined, 'Adjustments included');
    });

    register('Stego: 1.7.4 Censor Flag', () => {
        const state = makeState();
        state.nameB = 'Censored Layer';

        const payload = Stego.assemblePayload(state, { actions: [], cursor: -1 }, 'save');

        assert(payload.censor === true, 'Censor flag present');
    });

})();
