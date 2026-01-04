(function() {
    const { register, assert, assertEqual, assertDeepEqual } = window.TestRunner;
    const {
        getMaskActions, getAdjustmentsPacket, getCropPacket, assemblePayload, DEFAULTS
    } = window.OkazuTestables.stego;

    // 1. Fixtures
    function makeHistory(actions, cursor) {
        return { actions, cursor: cursor !== undefined ? cursor : actions.length - 1 };
    }

    function createColorTuningDefaults() {
        const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta', 'lights', 'mids', 'darks'];
        return bands.reduce((acc, band) => {
            acc[band] = { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
            return acc;
        }, {});
    }

    function makeState(overrides = {}) {
        const base = {
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
            nameB: ""
        };

        base.adjustments.colorTuning = createColorTuningDefaults();

        const merged = { ...base, ...overrides };
        if (overrides.adjustments) {
            merged.adjustments = { ...base.adjustments, ...overrides.adjustments };
            if (overrides.adjustments.colorTuning) {
                merged.adjustments.colorTuning = { ...base.adjustments.colorTuning, ...overrides.adjustments.colorTuning };
            }
        }

        return merged;
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

        // 1.4.6 Cursor before barrier
        const h4 = makeHistory([
            {type:'STROKE'},
            {type:'LOAD_IMAGE'},
            {type:'STROKE'}
        ], 0);
        const res4 = getMaskActions(h4);
        assertEqual(res4.length, 1);
        assertEqual(res4[0].type, 'STROKE');

        // 1.4.7 Cursor at barrier
        const h5 = makeHistory([
            {type:'STROKE'},
            {type:'LOAD_IMAGE'},
            {type:'STROKE'}
        ], 1);
        const res5 = getMaskActions(h5);
        assertEqual(res5, null);

        // 1.4.8 Empty cursor
        const h6 = makeHistory([{type:'STROKE'}], -1);
        const res6 = getMaskActions(h6);
        assertEqual(res6, null);
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

        // 1.5.3 Tolerance threshold boundary
        const s2b = makeState();
        s2b.adjustments.gamma = 1.001; // Diff 0.001 == tolerance
        const p2b = getAdjustmentsPacket(s2b);
        assertEqual(p2b, null, 'Ignored at tolerance threshold');

        const s2c = makeState();
        s2c.adjustments.gamma = 1.0011; // Diff > tolerance
        const p2c = getAdjustmentsPacket(s2c);
        assert(p2c !== null, 'Detected above tolerance');

        // 1.5.4 Color Tuning
        const s3 = makeState();
        // We need to ensure tuning structure exists in fixture
        s3.adjustments.colorTuning = {
            red: { hue: 1, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 }
        };
        const p3 = getAdjustmentsPacket(s3);
        assert(p3 !== null, 'Detected tuning');

        // 1.5.5 Levels tolerance boundaries
        const s4 = makeState();
        s4.adjustments.levels.mid = 1.001;
        const p4 = getAdjustmentsPacket(s4);
        assertEqual(p4, null, 'Ignored levels mid at tolerance');

        const s5 = makeState();
        s5.adjustments.levels.mid = 1.002;
        const p5 = getAdjustmentsPacket(s5);
        assert(p5 !== null, 'Detected levels mid above tolerance');
    });

    // 4. getCropPacket Tests
    register('Stego: getCropPacket', () => {
        // 1.6.0 Empty crop
        const s0 = makeState({ cropRect: null });
        const p0 = getCropPacket(s0);
        assertEqual(p0, null, 'Ignored empty crop');

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

        // 1.6.3 Boundary tolerance (within)
        const s3 = makeState({
            fullDims: { w: 400, h: 200 },
            cropRect: { x: 0.009, y: 0.009, w: 2.009, h: 1.009 },
            cropRotation: 0
        });
        const p3 = getCropPacket(s3);
        assertEqual(p3, null, 'Ignored crop within tolerance');

        // 1.6.4 Boundary tolerance (beyond)
        const s4 = makeState({
            fullDims: { w: 400, h: 200 },
            cropRect: { x: 0.02, y: 0, w: 2.0, h: 1.0 },
            cropRotation: 0
        });
        const p4 = getCropPacket(s4);
        assert(p4 !== null, 'Detected crop beyond tolerance');
        assertEqual(p4.x, 0.02);
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

        // 1.7.5 Export variants: front/back/merged
        const adjustedState = makeState({
            adjustments: { gamma: 1.2 }
        });
        const frontPayload = assemblePayload(adjustedState, hist, 'front');
        assert(frontPayload.adjustments, 'Front includes adjustments');
        assert(!frontPayload.mask, 'Front excludes mask');

        const backPayload = assemblePayload(adjustedState, hist, 'back');
        assert(backPayload.adjustments, 'Back includes adjustments');
        assert(!backPayload.mask, 'Back excludes mask');

        const mergedPayload = assemblePayload(adjustedState, hist, 'merged');
        assert(mergedPayload.adjustments, 'Merged includes adjustments');
        assert(mergedPayload.mask, 'Merged includes mask');

        // 1.7.6 Empty payload rules
        const cleanState = makeState();
        const emptyMaskHistory = makeHistory([], -1);
        const emptyPayload = assemblePayload(cleanState, emptyMaskHistory, 'mask');
        assert(!emptyPayload.mask, 'Mask omitted when no actions');
        assert(!emptyPayload.adjustments, 'Adjustments omitted when clean');
        assert(!emptyPayload.crop, 'Crop omitted when empty');

        // 1.7.7 Partial packets: crop only
        const cropOnly = makeState({
            fullDims: { w: 400, h: 200 },
            cropRect: { x: 0.1, y: 0.1, w: 1.8, h: 0.9 }
        });
        const cropPayload = assemblePayload(cropOnly, emptyMaskHistory, 'front');
        assert(cropPayload.crop, 'Crop included without mask');
        assert(!cropPayload.mask, 'Mask excluded for front');
    });

})();
