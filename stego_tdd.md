1. # Stego Unit-Test Blueprint (stego_tdd.md)
[x] 1.1. Set up Unit tests for scripts/stego.js
    [x] 1.1.1. Test getMaskActions
    [x] 1.1.2. Test getAdjustmentsPacket
    [x] 1.1.3. Test getCropPacket
    [x] 1.1.4. Test assemblePayload

[x] 1.2. Configure Test Harness & Conventions
    [x] 1.2.1. Environment: Set up Node + Jest (or in-app runner using window.OkazuTestables.stego)
    [x] 1.2.2. Implement Fixture Helpers
        [x] 1.2.2.1. Implement makeHistory(actions, cursor): returns { actions, cursor }
        [x] 1.2.2.2. Implement makeState(overrides): returns default state merged with overrides
    [x] 1.2.3. Use OkazuTestables.stego.DEFAULTS for verification

[x] 1.3. Define Shared Fixtures
    [x] 1.3.1. Default adjustments (DEFAULTS): Must match scripts/stego.js
    [x] 1.3.2. Default state object (baseState)
        # const baseState = {
        #   adjustments: {
        #     gamma: 1.0,
        #     levels: { black: 0, mid: 1.0, white: 255 },
        #     shadows: 0,
        #     highlights: 0,
        #     saturation: 0,
        #     vibrance: 0,
        #     wb: 0,
        #     colorBal: { r: 0, g: 0, b: 0 },
        #     colorTuning: {
        #       reds: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        #       oranges: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        #       yellows: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        #       greens: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        #       cyans: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        #       blues: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        #       purples: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        #       magentas: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 }
        #     }
        #   },
        #   cropRect: null,
        #   cropRotation: 0,
        #   fullDims: { w: 400, h: 300 },
        #   nameB: ""
        # };
    [x] 1.3.3. Action types categorization
        [x] 1.3.3.1. Barriers: LOAD_IMAGE, MERGE_LAYERS, APPLY_CENSOR, RESET_ALL, CLEAR_LAYER
        [x] 1.3.3.2. Mask edits: STROKE, POLYLINE
        [x] 1.3.3.3. Other (ignored): UNDO, REDO

[x] 1.4. Implement getMaskActions Tests
    [x] 1.4.1. Test 1: Stops scanning at barrier
        [x] 1.4.1.1. Setup: Actions [STROKE, POLYLINE, LOAD_IMAGE, STROKE], cursor = 3
        [x] 1.4.1.2. Input: getMaskActions(history)
        [x] 1.4.1.3. Assertion: result.length is 1
        [x] 1.4.1.4. Assertion: result[0].type is 'STROKE'
    [x] 1.4.2. Test 2: Includes only STROKE/POLYLINE after barrier
        [x] 1.4.2.1. Setup: Actions [MERGE_LAYERS, STROKE, UNDO, POLYLINE, REDO], cursor = 4
        [x] 1.4.2.2. Input: getMaskActions(history)
        [x] 1.4.2.3. Assertion: expect(result.map(a => a.type)).toEqual(['STROKE','POLYLINE'])
    [x] 1.4.3. Test 3: Barrier types validation
        [x] 1.4.3.1. Setup: Build parameterized test for LOAD_IMAGE, MERGE_LAYERS, APPLY_CENSOR, RESET_ALL, and CLEAR_LAYER
        [x] 1.4.3.2. Input: getMaskActions(history) with preceding strokes
        [x] 1.4.3.3. Assertion: Result ignores strokes before the barrier
    [x] 1.4.4. Test 4: Cursor edge cases
        [x] 1.4.4.1. Setup: history = { actions: [], cursor: -1 }
        [x] 1.4.4.2. Input: getMaskActions(history)
        [x] 1.4.4.3. Assertion: result is null
    [x] 1.4.5. Test 5: No barrier present
        [x] 1.4.5.1. Setup: history = [STROKE, POLYLINE], cursor = 1
        [x] 1.4.5.2. Input: getMaskActions(history)
        [x] 1.4.5.3. Assertion: result.length is 2 (scans from beginning)

[x] 1.5. Implement getAdjustmentsPacket Tests
    [x] 1.5.1. Test 1: Detects any deviation from defaults
        [x] 1.5.1.1. Setup: For each field, clone adjustments and set one value to default + 0.01
        [x] 1.5.1.2. Input: getAdjustmentsPacket(state)
        [x] 1.5.1.3. Assertion: result is state.adjustments
    [x] 1.5.2. Test 2: Tolerance thresholds keep defaults clean
        [x] 1.5.2.1. Setup: gamma = 1.0005, shadows = 0.0005, levels.mid = 1.0005
        [x] 1.5.2.2. Input: getAdjustmentsPacket(state)
        [x] 1.5.2.3. Assertion: result is null
    [x] 1.5.3. Test 3: Color balance detection
        [x] 1.5.3.1. Setup: colorBal.r = 1
        [x] 1.5.3.2. Input: getAdjustmentsPacket(state)
        [x] 1.5.3.3. Assertion: result is state.adjustments
    [x] 1.5.4. Test 4: Color tuning bands detection
        [x] 1.5.4.1. Setup: colorTuning.blues.hue = 1
        [x] 1.5.4.2. Input: getAdjustmentsPacket(state)
        [x] 1.5.4.3. Assertion: result is state.adjustments

[x] 1.6. Implement getCropPacket Tests
    [x] 1.6.1. Test 1: Full-image crop with tolerances returns null
        [x] 1.6.1.1. Setup: fullDims { w: 400, h: 200 } (aspect=2.0)
        [x] 1.6.1.2. Setup: cropRect { x: 0.005, y: 0.005, w: 2.005, h: 0.995 } (within tolerance)
        [x] 1.6.1.3. Setup: cropRotation = 0
        [x] 1.6.1.4. Input: getCropPacket(state)
        [x] 1.6.1.5. Assertion: result is null
    [x] 1.6.2. Test 2: Includes rotation when non-zero
        [x] 1.6.2.1. Setup: cropRect { x: 0.1, y: 0.1, w: 1.5, h: 0.8 }, cropRotation = 90
        [x] 1.6.2.2. Input: getCropPacket(state)
        [x] 1.6.2.3. Assertion: result.rotation is 90
    [x] 1.6.3. Test 3: Non-full crop returns packet
        [x] 1.6.3.1. Setup: cropRect { x: 0.2, y: 0, w: 2.0, h: 1.0 }, cropRotation = 0
        [x] 1.6.3.2. Input: getCropPacket(state)
        [x] 1.6.3.3. Assertion: expect(result).toMatchObject({ x:0.2, y:0, w:2.0, h:1.0 })
        [x] 1.6.3.4. Assertion: result.rotation is undefined

[x] 1.7. Implement assemblePayload Tests
    [x] 1.7.1. Test 1: ExportType merged includes adjustments/crop/mask
        [x] 1.7.1.1. Setup: exportType = 'merged', Mask actions exist, Adjustments differ, Crop differs
        [x] 1.7.1.2. Input: assemblePayload(state, history, 'merged')
        [x] 1.7.1.3. Assertion: payload.mask is defined
        [x] 1.7.1.4. Assertion: payload.adjustments is defined
        [x] 1.7.1.5. Assertion: payload.crop is defined
        [x] 1.7.1.6. Assertion: payload.censor is undefined
    [x] 1.7.2. Test 2: ExportType front/back include adjustments/crop, exclude mask
        [x] 1.7.2.1. Setup: exportType = 'front' (and 'back'), Mask actions exist
        [x] 1.7.2.2. Input: assemblePayload(...)
        [x] 1.7.2.3. Assertion: payload.mask is undefined
        [x] 1.7.2.4. Assertion: payload.adjustments is defined
    [x] 1.7.3. Test 3: ExportType mask includes mask only
        [x] 1.7.3.1. Setup: exportType = 'mask', Adjustments exist
        [x] 1.7.3.2. Input: assemblePayload(...)
        [x] 1.7.3.3. Assertion: payload.mask is defined
        [x] 1.7.3.4. Assertion: payload.adjustments is undefined
        [x] 1.7.3.5. Assertion: payload.censor is undefined
    [x] 1.7.4. Test 4: ExportType save includes censor flag if nameB is "Censored Layer"
        [x] 1.7.4.1. Setup: exportType = 'save', state.nameB = 'Censored Layer'
        [x] 1.7.4.2. Input: assemblePayload(...)
        [x] 1.7.4.3. Assertion: payload.censor is true (plus other segments if present)
    [x] 1.7.5. Test 5: ExportType save without censor flag
        [x] 1.7.5.1. Setup: exportType = 'save', state.nameB = 'Slot B'
        [x] 1.7.5.2. Input: assemblePayload(...)
        [x] 1.7.5.3. Assertion: payload.censor is undefined
    [x] 1.7.6. Test 6: Packet inclusion rules with empty content
        [x] 1.7.6.1. Setup: Default state, history with no actions
        [x] 1.7.6.2. Input: assemblePayload(state, history, 'merged')
        [x] 1.7.6.3. Assertion: payload.info is defined
        [x] 1.7.6.4. Assertion: payload.adjustments is undefined
        [x] 1.7.6.5. Assertion: payload.crop is undefined
        [x] 1.7.6.6. Assertion: payload.mask is undefined

