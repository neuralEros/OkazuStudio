(function() {
    const { register, assert, assertEqual, assertDeepEqual } = window.TestRunner;
    const {
        getMaskActions, getAdjustmentsPacket, getCropPacket, assemblePayload, DEFAULTS
    } = window.OkazuTestables.stego;

    // 1. Fixtures
    function makeHistory(actions, cursor) {
        return { actions, cursor: cursor !== undefined ? cursor : actions.length - 1 };
    }

    function makeState(overrides = {}) {
        const state = {
            adjustments: JSON.parse(JSON.stringify(DEFAULTS)),
            // Fill nested levels object as stringify/parse doesn't handle prototypes/references but simple object is fine
            // Ensure tuning is present
            // Adjustments structure:
            // gamma: 1.0
            // levels: {black:0, mid:1.0, white:255}
            // colorBal: {r:0,g:0,b:0}
            // colorTuning: { ... bands ... } (mock as needed)
            fullDims: { w: 400, h: 300 },
            cropRect: null,
            cropRotation: 0,
            nameB: "",
            ...overrides
        };
        const tuningBands = ['reds', 'oranges', 'yellows', 'greens', 'cyans', 'blues', 'purples', 'magentas'];
        const baseBand = { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };

        if (!state.adjustments.colorTuning || typeof state.adjustments.colorTuning !== 'object') {
            state.adjustments.colorTuning = {};
        }

        tuningBands.forEach((band) => {
            state.adjustments.colorTuning[band] = {
                ...baseBand,
                ...(state.adjustments.colorTuning[band] || {})
            };
        });

        return state;
    }

    // 2. getMaskActions Tests
    register('Stego: getMaskActions', () => {
        // 1.4.1 Stops at barrier
        const h1 = makeHistory([
            {type:'STROKE'}, {type:'POLYLINE'},
            {type:'LOAD_IMAGE'}, // Barrier
            {type:'STROKE'}      // Target
        ]); // Cursor 3
        const res1 = getMaskActions(h1);
        assertEqual(res1.length, 1);
        assertEqual(res1[0].type, 'STROKE');

        // 1.4.2 Includes STROKE/POLYLINE after barrier
        const h2 = makeHistory([
            {type:'MERGE_LAYERS'}, // Barrier
            {type:'STROKE'},
            {type:'UNDO'},
            {type:'POLYLINE'},
            {type:'REDO'}
        ]);
        // Cursor 4. Should get STROKE and POLYLINE.
        const res2 = getMaskActions(h2);
        assertEqual(res2.length, 2);
        assertEqual(res2[0].type, 'STROKE');
        assertEqual(res2[1].type, 'POLYLINE');

        // 1.4.5 No barrier
        const h3 = makeHistory([{type:'STROKE'}]);
        const res3 = getMaskActions(h3);
        assertEqual(res3.length, 1);
    });

    // 3. getAdjustmentsPacket Tests
    register('Stego: getAdjustmentsPacket', () => {
        // 1.5.1 Detects changes
        const s1 = makeState();
        s1.adjustments.gamma = 1.2;
        const p1 = getAdjustmentsPacket(s1);
        assert(p1 !== null, 'Detected gamma');
        assertEqual(p1.gamma, 1.2);

        // 1.5.2 Tolerance
        const s2 = makeState();
        s2.adjustments.gamma = 1.0005; // Diff 0.0005 <= 0.001
        const p2 = getAdjustmentsPacket(s2);
        assertEqual(p2, null, 'Ignored within tolerance');

        // 1.5.4 Color Tuning
        const s3 = makeState();
        s3.adjustments.colorTuning.blues.hue = 1;
        const p3 = getAdjustmentsPacket(s3);
        assert(p3 !== null, 'Detected tuning');
    });

    // 4. getCropPacket Tests
    register('Stego: getCropPacket', () => {
        // 1.6.1 Full Image Crop
        const s1 = makeState({
            fullDims: { w: 400, h: 200 },
            cropRect: { x: 0, y: 0, w: 2.0, h: 1.0 }, // Aspect 2.0
            cropRotation: 0
        });
        const p1 = getCropPacket(s1);
        assertEqual(p1, null, 'Ignored full crop');

        // 1.6.2 Rotation
        const s2 = makeState({
            cropRect: { x:0, y:0, w:2.0, h:1.0 },
            cropRotation: 90
        });
        const p2 = getCropPacket(s2);
        assert(p2 !== null, 'Detected rotation');
        assertEqual(p2.rotation, 90);
    });

    // 5. assemblePayload Tests
    register('Stego: assemblePayload', () => {
        const state = makeState({ nameB: 'Censored Layer' });
        const hist = makeHistory([{type:'STROKE'}]);

        // 1.7.4 Export Save + Censor
        const p1 = assemblePayload(state, hist, 'save');
        assert(p1.censor === true, 'Censor flag');
        assert(p1.mask, 'Mask included for save');
        assert(!p1.adjustments, 'Adjustments clean');

        // 1.7.3 Export Mask
        const p2 = assemblePayload(state, hist, 'mask');
        assert(p2.mask, 'Mask included');
        assert(!p2.censor, 'Censor flag excluded');
        assert(!p2.adjustments, 'Adjustments excluded');
    });

})();
