# Stego Unit-Test Blueprint (stego_tdd.md)

## Scope
Unit tests for `scripts/stego.js` covering `getMaskActions`, `getAdjustmentsPacket`, `getCropPacket`, and `assemblePayload`.

## Test Harness & Conventions
- **Environment**: Node + Jest (or in-app test runner using `window.OkazuTestables.stego`).
- **Fixture Helpers**:
  - `makeHistory(actions, cursor)` returns `{ actions, cursor }`.
  - `makeState(overrides)` returns a default state with `adjustments`, `cropRect`, `cropRotation`, and `fullDims` merged with overrides.
- **Defaults**: Use `OkazuTestables.stego.DEFAULTS` for verification.

## Shared Fixtures
- **Default adjustments** (`DEFAULTS`): matches `scripts/stego.js`.
- **Default state**:
  ```js
  const baseState = {
    adjustments: {
      gamma: 1.0,
      levels: { black: 0, mid: 1.0, white: 255 },
      shadows: 0,
      highlights: 0,
      saturation: 0,
      vibrance: 0,
      wb: 0,
      colorBal: { r: 0, g: 0, b: 0 },
      colorTuning: {
        reds: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        oranges: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        yellows: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        greens: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        cyans: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        blues: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        purples: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
        magentas: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 }
      }
    },
    cropRect: null,
    cropRotation: 0,
    fullDims: { w: 400, h: 300 },
    nameB: ""
  };
  ```
- **Action types**:
  - Barriers: `LOAD_IMAGE`, `MERGE_LAYERS`, `APPLY_CENSOR`, `RESET_ALL`, `CLEAR_LAYER`
  - Mask edits: `STROKE`, `POLYLINE`
  - Other: `UNDO`, `REDO` (ignored)

## `getMaskActions` Tests
### 1. Stops scanning at barrier
- **Scenario**: Earlier strokes before barrier are excluded.
- **Setup**:
  - Actions: `[STROKE, POLYLINE, LOAD_IMAGE, STROKE]`, cursor = 3.
- **Inputs**: `getMaskActions(history)`.
- **Expected**: returns only actions after last barrier: `[STROKE]` (the one after LOAD_IMAGE).
- **Assertions**:
  - `expect(result.length).toBe(1)`
  - `expect(result[0].type).toBe('STROKE')`.

### 2. Includes only STROKE/POLYLINE after barrier
- **Scenario**: Non-mask actions are ignored.
- **Setup**:
  - Actions: `[MERGE_LAYERS, STROKE, UNDO, POLYLINE, REDO]`, cursor=4.
- **Inputs**: `getMaskActions(history)`.
- **Expected**: `[STROKE, POLYLINE]` only.
- **Assertions**:
  - `expect(result.map(a => a.type)).toEqual(['STROKE','POLYLINE'])`.

### 3. Barrier types (LOAD_IMAGE/MERGE_LAYERS/APPLY_CENSOR/RESET_ALL/CLEAR_LAYER)
- **Scenario**: Each barrier stops scanning.
- **Setup**: Build a parameterized test for each barrier type with preceding strokes.
- **Inputs**: `getMaskActions(history)`.
- **Expected**: ignores strokes before the barrier.
- **Assertions**:
  - `expect(result).toEqual([actionsAfterBarrierOnly])`.

### 4. Cursor edge cases
- **Scenario**: cursor < 0 or empty actions list.
- **Setup**: `history = { actions: [], cursor: -1 }`.
- **Inputs**: `getMaskActions(history)`.
- **Expected**: returns null.
- **Assertions**:
  - `expect(result).toBeNull()`.

### 5. No barrier present
- **Scenario**: Should scan from beginning.
- **Setup**: `[STROKE, POLYLINE]`, cursor=1.
- **Inputs**: `getMaskActions(history)`.
- **Expected**: both actions returned.
- **Assertions**:
  - `expect(result.length).toBe(2)`.

## `getAdjustmentsPacket` Tests
### 1. Detects any deviation from defaults
- **Scenario**: Each adjustable parameter deviates by > tolerance.
- **Setup**: For each field, clone `baseState.adjustments` and set one value to default + 0.01.
- **Inputs**: `getAdjustmentsPacket(state)`.
- **Expected**: returns the adjustments object.
- **Assertions**:
  - `expect(result).toBe(state.adjustments)`.

### 2. Tolerance thresholds keep defaults clean
- **Scenario**: Differences below tolerance do not trigger packet.
- **Setup**:
  - `gamma = 1.0005`, `shadows = 0.0005`, `levels.mid = 1.0005`.
- **Inputs**: `getAdjustmentsPacket(state)`.
- **Expected**: returns null.
- **Assertions**:
  - `expect(result).toBeNull()`.

### 3. Color balance detection
- **Scenario**: Any non-zero `colorBal` triggers packet.
- **Setup**: `colorBal.r = 1`.
- **Inputs**: `getAdjustmentsPacket(state)`.
- **Expected**: returns adjustments object.
- **Assertions**:
  - `expect(result).toBe(state.adjustments)`.

### 4. Color tuning bands detection
- **Scenario**: Any band property non-zero triggers packet.
- **Setup**: `colorTuning.blues.hue = 1`.
- **Inputs**: `getAdjustmentsPacket(state)`.
- **Expected**: returns adjustments object.
- **Assertions**:
  - `expect(result).toBe(state.adjustments)`.

## `getCropPacket` Tests
### 1. Full-image crop with tolerances returns null
- **Scenario**: Crop equals full image (x=0, y=0, h=1.0, w=aspect) and rotation=0.
- **Setup**:
  - `fullDims: { w: 400, h: 200 }` (aspect=2.0).
  - `cropRect: { x: 0.005, y: 0.005, w: 2.005, h: 0.995 }` within tolerance.
  - `cropRotation: 0`.
- **Inputs**: `getCropPacket(state)`.
- **Expected**: returns null.
- **Assertions**:
  - `expect(result).toBeNull()`.

### 2. Includes rotation when non-zero
- **Scenario**: rotation set to 90 and crop differs.
- **Setup**: `cropRect: { x: 0.1, y: 0.1, w: 1.5, h: 0.8 }`, `cropRotation: 90`.
- **Inputs**: `getCropPacket(state)`.
- **Expected**: packet includes `rotation: 90`.
- **Assertions**:
  - `expect(result.rotation).toBe(90)`.

### 3. Non-full crop returns packet
- **Scenario**: Crop differs from full image even when rotation is 0.
- **Setup**: `cropRect: { x: 0.2, y: 0, w: 2.0, h: 1.0 }`, `cropRotation: 0`.
- **Inputs**: `getCropPacket(state)`.
- **Expected**: returns cropRect as packet without rotation.
- **Assertions**:
  - `expect(result).toMatchObject({ x:0.2, y:0, w:2.0, h:1.0 })`
  - `expect(result.rotation).toBeUndefined()`.

## `assemblePayload` Tests
### 1. ExportType: merged includes adjustments/crop/mask
- **Scenario**: mask actions exist, adjustments differ, crop differs.
- **Setup**:
  - `exportType = 'merged'`.
  - `getMaskActions` returns `[STROKE]`.
  - `getAdjustmentsPacket` returns adjustments.
  - `getCropPacket` returns crop.
- **Inputs**: `assemblePayload(state, history, 'merged')`.
- **Expected**: payload has `adjustments`, `crop`, `mask`; no `censor`.
- **Assertions**:
  - `expect(payload.mask).toBeDefined()`
  - `expect(payload.adjustments).toBeDefined()`
  - `expect(payload.crop).toBeDefined()`
  - `expect(payload.censor).toBeUndefined()`.

### 2. ExportType: front/back include adjustments/crop, exclude mask
- **Scenario**: mask actions exist but exportType front/back.
- **Setup**: `exportType = 'front'` and `exportType = 'back'`.
- **Inputs**: `assemblePayload(...)`.
- **Expected**: `mask` absent, `adjustments` and `crop` present if non-default.
- **Assertions**:
  - `expect(payload.mask).toBeUndefined()`
  - `expect(payload.adjustments).toBeDefined()`.

### 3. ExportType: mask includes mask only
- **Scenario**: adjustments exist but should be excluded for mask exports.
- **Setup**: `exportType = 'mask'`.
- **Inputs**: `assemblePayload(...)`.
- **Expected**: includes `mask`, excludes `adjustments` and `censor`.
- **Assertions**:
  - `expect(payload.mask).toBeDefined()`
  - `expect(payload.adjustments).toBeUndefined()`
  - `expect(payload.censor).toBeUndefined()`.

### 4. ExportType: save includes censor flag if nameB is Censored Layer
- **Scenario**: state indicates censor project.
- **Setup**: `exportType = 'save'`, `state.nameB = 'Censored Layer'`.
- **Inputs**: `assemblePayload(...)`.
- **Expected**: `censor: true` plus mask/adjustments/crop if present.
- **Assertions**:
  - `expect(payload.censor).toBe(true)`.

### 5. ExportType: save without censor flag
- **Scenario**: nameB is not censored layer.
- **Setup**: `exportType = 'save'`, `state.nameB = 'Slot B'`.
- **Inputs**: `assemblePayload(...)`.
- **Expected**: no `censor` field.
- **Assertions**:
  - `expect(payload.censor).toBeUndefined()`.

### 6. Packet inclusion rules with empty content
- **Scenario**: No adjustments, no crop, no mask.
- **Setup**: default state, history has no actions.
- **Inputs**: `assemblePayload(state, history, 'merged')`.
- **Expected**: payload includes only `info` (but still returns object).
- **Assertions**:
  - `expect(payload.info).toBeDefined()`
  - `expect(payload.adjustments).toBeUndefined()`
  - `expect(payload.crop).toBeUndefined()`
  - `expect(payload.mask).toBeUndefined()`.
