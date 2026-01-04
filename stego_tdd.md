# Stego Unit-Test Blueprint (scripts/stego.js)

## 1. Overview & Test Harness Assumptions

### 1.1 Harness Setup
*   **Target**: `scripts/stego.js`.
*   **Harness**: `test.html` loading `window.TestRunner`.
*   **Dependencies**: `state` (mocked), `Kakushi` (mocked).

### 1.2 Fixtures & Helpers
*   **Helpers**:
    *   `makeHistory(actions, cursor)`: Returns object.
    *   `makeState(overrides)`: Returns state with defaults merged.
*   **Defaults**: Use `window.OkazuTestables.stego.DEFAULTS` (if exposed) or replicate them.
*   **Barrier Types**: `LOAD_IMAGE`, `MERGE_LAYERS`, `APPLY_CENSOR`, `RESET_ALL`, `CLEAR_LAYER`.

## 2. Mask Actions (`getMaskActions`)

### 2.1 Barrier Detection
*   **Scenario**: Stops scanning at barrier.
*   **Setup**: Actions `[STROKE, POLYLINE, LOAD_IMAGE, STROKE]`. Cursor 3.
*   **Action**: `getMaskActions(history)`.
*   **Exact assertions**:
    *   Result length is 1.
    *   Result[0].type is 'STROKE'.

### 2.2 Valid Types
*   **Scenario**: Includes only mask edits after barrier.
*   **Setup**: Actions `[MERGE_LAYERS, STROKE, UNDO, POLYLINE, REDO]`. Cursor 4.
*   **Action**: `getMaskActions(history)`.
*   **Exact assertions**: Result types are `['STROKE', 'POLYLINE']`.

### 2.3 Barrier Types Validation
*   **Scenario**: Test all barrier types.
*   **Setup**: Iterate `LOAD_IMAGE`, `MERGE_LAYERS`, `APPLY_CENSOR`, `RESET_ALL`, `CLEAR_LAYER`.
*   **Action**: `getMaskActions`.
*   **Exact assertions**: Ignores preceding strokes for each type.

### 2.4 Edge Cases
*   **Scenario**: Cursor -1.
*   **Assert**: Result is null (or empty).
*   **Scenario**: No barrier.
*   **Assert**: Scans from beginning.

## 3. Adjustments Packet (`getAdjustmentsPacket`)

### 3.1 Deviations
*   **Scenario**: Detects non-default values.
*   **Setup**: Set `gamma = 1.01`.
*   **Action**: `getAdjustmentsPacket`.
*   **Exact assertions**: Result contains adjustments object.

### 3.2 Tolerances
*   **Scenario**: Ignores tiny float errors.
*   **Setup**: `gamma = 1.0005`.
*   **Action**: `getAdjustmentsPacket`.
*   **Exact assertions**: Result is `null`.

### 3.3 Nested Objects
*   **Scenario**: Color Balance / Tuning.
*   **Setup**: `colorBal.r = 1`.
*   **Assert**: Packet generated.
*   **Setup**: `colorTuning.blues.hue = 1`.
*   **Assert**: Packet generated.

## 4. Crop Packet (`getCropPacket`)

### 4.1 Full Image Logic
*   **Scenario**: Full crop returns null.
*   **Setup**: `fullDims` {400, 200}. `cropRect` {0, 0, 2.0, 1.0}.
*   **Assert**: Result is `null`.
*   **Scenario**: Tolerance (0.005).
*   **Assert**: Still `null` if within tolerance.

### 4.2 Rotation
*   **Scenario**: Non-zero rotation forces packet.
*   **Setup**: `cropRect` full, but `cropRotation` 90.
*   **Assert**: Result `{ rotation: 90 }`.

### 4.3 Partial Crop
*   **Scenario**: Standard crop.
*   **Setup**: `cropRect` {0.2, 0, 2.0, 1.0}.
*   **Assert**: Result matches input rect.

## 5. Payload Assembly (`assemblePayload`)

### 5.1 Export Type: Merged
*   **Setup**: `exportType = 'merged'`. Mask actions, Adj, Crop exist.
*   **Action**: `assemblePayload`.
*   **Exact assertions**:
    *   `payload.mask` defined.
    *   `payload.adjustments` defined.
    *   `payload.crop` defined.
    *   `payload.censor` undefined.

### 5.2 Export Type: Front/Back
*   **Setup**: `exportType = 'front'`.
*   **Exact assertions**:
    *   `payload.mask` undefined (Mask baked into alpha).
    *   `payload.adjustments` defined.

### 5.3 Export Type: Mask
*   **Setup**: `exportType = 'mask'`.
*   **Exact assertions**:
    *   `payload.mask` defined.
    *   `payload.adjustments` undefined.

### 5.4 Export Type: Save (Censor)
*   **Setup**: `exportType = 'save'`, `nameB = 'Censored Layer'`.
*   **Exact assertions**: `payload.censor` is `true`.

### 5.5 Empty Content
*   **Setup**: Default state.
*   **Assert**:
    *   `payload.info` defined.
    *   `adjustments`, `crop`, `mask` undefined.
