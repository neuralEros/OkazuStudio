# Adjustments Unit-Test Blueprint (scripts/adjustments.js)

## 1. Overview & Test Harness Assumptions

### 1.1 Minimal Harness/Fixture Shape
*   **Scenario**: Baseline fixture to initialize createAdjustmentSystem and expose OkazuTestables.
*   **Setup**: Initialize `createAdjustmentSystem(state, els, ctx, renderToContext, render, scheduleHeavyTask)`
    *   Provide smallest functional state (defaults).
    *   Provide `els` mock object.
    *   Mock `ctx` as minimal object with `getImageData` (returns buffer) and `putImageData` (no-op).
    *   Mock `renderToContext`, `render`, `scheduleHeavyTask` using `TestRunner.spyOn`.
*   **Inputs**: Define state, els, and render doubles.
    *   `state`: Adjustment defaults (levels, gamma, color tuning arrays, toggles).
    *   `els`: References to every slider/button element ID.
*   **Expected outputs**: System initializes without throwing. `window.OkazuTestables.adjustments` exposed.
*   **Exact assertions**:
    *   `TestRunner.assertEqual(typeof createAdjustmentSystem, 'function')`
    *   `TestRunner.assertEqual(typeof system.initAdjustments, 'function')`
    *   `TestRunner.assertEqual(typeof window.OkazuTestables.adjustments.getBandWeight, 'function')`
    *   Verify spies `render`, `renderToContext`, `scheduleHeavyTask` are called only as specified.

### 1.2 DOM Mocking Strategy
*   **Scenario**: Mock `document.getElementById` and `document.querySelectorAll`.
*   **Setup**: Replace document methods with spies via `TestRunner.spyOn`.
    *   `getElementById` returns map of fake elements by ID.
    *   `querySelectorAll` returns arrays of fake sliders.
    *   Fake elements: `{ value, textContent, classList: { add, remove }, disabled, addEventListener, dispatchEvent, dataset: {} }`.
*   **Inputs**: Define element registry keyed by ID (adj-gamma, adj-saturation, etc.).
*   **Expected outputs**: `initAdjustments()` and `initColorTuning()` attach listeners without errors.
*   **Exact assertions**:
    *   For each element, spy on `addEventListener` is called with 'input', 'change', 'pointerdown', 'focus'.
    *   Missing element paths trigger `console.warn` (spy on console).

### 1.3 Canvas & ImageData Mocking Strategy
*   **Scenario**: Provide `ImageData` and `CanvasRenderingContext2D` substitutes.
*   **Setup**: Create data shims.
    *   `ImageData` shim: `{ width, height, data: new Uint8ClampedArray(...) }`.
    *   `ctx` stub with `getImageData` (controlled buffer) and `putImageData` (capture output).
*   **Inputs**: Use 1x1, 2x2 buffers for exact numeric assertions.
*   **Expected outputs**: Color operations mutate `ImageData.data` in place.
*   **Exact assertions**: `imageData.data` values match expected post-adjustment values.

### 1.4 Mocking window.dispatchAction
*   **Scenario**: Capture dispatched actions.
*   **Setup**: Stub `window.dispatchAction` using `TestRunner.spyOn(window, 'dispatchAction')`.
*   **Inputs**: Trigger UI events (change on sliders).
*   **Expected outputs**: Actions include type, payload.oldValue, payload.newValue.
*   **Exact assertions**:
    *   `dispatchAction` spy called with type: 'adjustment-change', 'adjustment-reset', 'color-tuning-reset'.
    *   `payload.oldValue` matches value captured on pointerdown/focus.

### 1.5 Deterministic Time Control
*   **Scenario**: Throttle logic in `updateAdjustmentPreview()`.
*   **Setup**: Stub `Date.now()` using `TestRunner.spyOn(Date, 'now')`.
*   **Inputs**: Sequence of calls:
    *   Call 1: Time T
    *   Call 2: Time T + <100ms
    *   Call 3: Time T + >=100ms
*   **Expected outputs**: Throttled calls skip render; later call proceeds.
*   **Exact assertions**:
    *   `renderToContext` spy NOT called on throttled invocation.
    *   `renderToContext` spy called on allowed invocation.

### 1.6 Console/Logger Safety
*   **Scenario**: Missing elements logs warnings without breaking.
*   **Setup**: Stub logging methods: `TestRunner.spyOn(console, 'warn')`, `TestRunner.spyOn(console, 'error')`.
*   **Inputs**: Remove specific slider elements from the registry.
*   **Expected outputs**: Error paths exercised without throwing.
*   **Exact assertions**:
    *   `console.warn` called with message containing missing ID.
    *   Test continues without uncaught exception.

## 2. Pure Helper Functions (OkazuTestables.adjustments)

### 2.1 getBandWeight(hue, centerHue)
*   **2.1.1 Width Selection**
    *   **Scenario**: Width is 25 for centerHue 30/60, else 45.
    *   **Inputs**: `centerHue = 30`; `centerHue = 60`; `centerHue = 120`.
    *   **Exact assertions**:
        *   At `diff = width`, output is exactly 0.
        *   At `diff = width - 1e-6`, output > 0.
*   **2.1.2 Exact-Value Assertions at Key Diffs**
    *   **Scenario**: Verify cubic smoothstep shape.
    *   **Setup**: `centerHue = 120` (width 45).
    *   **Inputs**: `hue = 120` (diff 0); `hue = 165` (diff width); `hue = 165.000001`; `hue = 164.999`.
    *   **Exact assertions**:
        *   `getBandWeight(120, 120) === 1`
        *   `getBandWeight(165, 120) === 0`
        *   `getBandWeight(165.000001, 120) === 0`
        *   `getBandWeight(164.999, 120) > 0`
*   **2.1.3 Wraparound Behavior (>180)**
    *   **Scenario**: Diff uses wraparound.
    *   **Setup**: `centerHue = 10`.
    *   **Inputs**: `hue = 350` (diff 20).
    *   **Exact assertions**: `getBandWeight(350, 10) === getBandWeight(30, 10)`.
*   **2.1.4 Monotonic Falloff and Symmetry**
    *   **Scenario**: Weights decrease as diff increases; symmetric.
    *   **Setup**: `centerHue = 200`.
    *   **Inputs**: Diffs 0, 10, 20, 30, 40.
    *   **Exact assertions**: `w0 >= w10 >= w20 >= w30 >= w40`. `getBandWeight(220, 200) === getBandWeight(180, 200)`.

### 2.2 getLuminanceWeight(lum, band)
*   **2.2.1 Boundary Checks**
    *   **Scenario**: Confirm outputs at 0, 0.5, 1.0.
    *   **Inputs**: `lum = 0, 0.5, 1.0, 0.5 - 1e-6`.
    *   **Exact assertions**:
        *   `getLuminanceWeight(1.0, 'darks') === 0`
        *   `getLuminanceWeight(0, 'lights') === 0`
        *   `getLuminanceWeight(0.5, 'mids')` equals peak.
        *   `getLuminanceWeight(0.5 - 1e-6, 'lights') === 0`
*   **2.2.2 Peak Values**
    *   **Scenario**: Max weight at expected centers.
    *   **Exact assertions**:
        *   `getLuminanceWeight(0, 'darks') === 1`
        *   `getLuminanceWeight(0.5, 'mids') === 1`
        *   `getLuminanceWeight(1, 'lights') === 1`

### 2.3 rgbToHsl and hslToRgb
*   **2.3.1 Round-Trip Fidelity**
    *   **Scenario**: RGB -> HSL -> RGB yields original.
    *   **Inputs**: Primaries, Secondaries, Grayscale, Random (12, 200, 77).
    *   **Exact assertions**: `abs(r2 - r) <= 1`, same for g/b.
*   **2.3.2 Hue Edge Cases**
    *   **Inputs**: Red (255,0,0), Green (0,255,0), Blue (0,0,255).
    *   **Exact assertions**:
        *   `abs(h - 0) <= 0.5` (red)
        *   `abs(h - 120) <= 0.5` (green)
        *   `abs(h - 240) <= 0.5` (blue)
*   **2.3.3 Saturation/Lightness Boundaries**
    *   **Exact assertions**:
        *   `hslToRgb(h, 0, l)` yields `r=g=b`.
        *   `hslToRgb(h, s, 0)` yields `r=g=b=0`.
        *   `hslToRgb(h, s, 1)` yields `r=g=b=255`.

### 2.4 getCurvedValue(sliderVal)
*   **2.4.1 Threshold Behavior**
    *   **Scenario**: Validate slope change around |val|=80.
    *   **Inputs**: -100, -99, -81, -80, 0, 80, 81, 99, 100.
    *   **Exact assertions**:
        *   `abs(getCurvedValue(80)) < abs(getCurvedValue(81))`
        *   `getCurvedValue(100) === 100`
        *   `getCurvedValue(-100) === -100`
        *   `getCurvedValue(0) === 0`

## 3. Color Tuning LUT Generation

### 3.1 updateColorTuningLUT Activation
*   **Scenario**: `hasActiveColorTuning` flag logic.
*   **Setup**: State with color tuning bands zeroed.
*   **Inputs**: Set all bands 0; Set `reds.sat = 10`.
*   **Exact assertions**:
    *   Zeroed bands: `state.hasActiveColorTuning === false`
    *   One nonzero: `state.hasActiveColorTuning === true`

### 3.2 Hue LUT Accumulation
*   **Scenario**: LUT entries accumulate weights.
*   **Setup**: Single band (reds) with known values.
*   **Inputs**: `reds = { hue: 10, sat: 20, vib: 5, lum: -5, shadows: 15, highlights: -10 }`.
*   **Exact assertions**:
    *   `state.colorTuningLUT.hue[0]` (center) equals expected sum.
    *   `state.colorTuningLUT.sat[0]` matches expected.
    *   LUT channel values exist only within band width.

### 3.3 Luminance LUT Weighting
*   **Scenario**: Shadow/Highlight exclusions for lum bands.
*   **Inputs**: `darks: { lum: 10, shadows: 10, highlights: 10 }`.
*   **Exact assertions**:
    *   `state.colorTuningLUT.shadows[lumIndex] === 0` for lum bands.
    *   `state.colorTuningLUT.highlights[lumIndex] === 0` for lum bands.

### 3.4 Numeric Assertion with Controlled Config
*   **Scenario**: Deterministic value check.
*   **Inputs**: `reds: { hue: 20 }`. Sample hue 0.
*   **Exact assertions**:
    *   `state.colorTuningLUT.hue[0] === 20`
    *   `state.colorTuningLUT.hue[10] < 20` (falloff).

## 4. Master LUT (Levels + Gamma)

### 4.1 updateMasterLUT Hashing
*   **Scenario**: No recomputation when unchanged.
*   **Setup**: Spy on LUT creation (if accessible) or check internal hash.
*   **Inputs**: Call `updateMasterLUT` twice with same levels/gamma.
*   **Exact assertions**: Recomputation occurs only once.

### 4.2 Range <= 0.001 Behavior
*   **Scenario**: Binary output when white <= black.
*   **Setup**: `black = 0.5, white = 0.5`.
*   **Exact assertions**: `LUT[0] === 0`; `LUT[255] === 255`.

### 4.3 Clamping After Mid/Gamma
*   **Scenario**: Values stay in [0, 255].
*   **Exact assertions**: `min(LUT) === 0`; `max(LUT) === 255`.

### 4.4 applyMasterLUT(imageData)
*   **4.4.1 Early Return**
    *   **Scenario**: Defaults active => no mutation.
    *   **Exact assertions**: Data buffer before equals after.
*   **4.4.2 Exact Pixel Mapping**
    *   **Setup**: `black=0.2, white=0.8, mid=1.0, gamma=1.0`.
    *   **Inputs**: Values 0, 51, 128, 204, 255.
    *   **Exact assertions**: `data[0] === 0`. `data[2]` maps to approx mid (128).
*   **4.4.3 Alpha Unchanged**
    *   **Exact assertions**: `data[3]` equals original alpha.

## 5. Color Operations (applyColorOps)

### 5.1 Early Return When All Zero
*   **Setup**: All adjustment values = 0.
*   **Exact assertions**: Data before equals after.

### 5.2 Shadows/Highlights Weighting
*   **Setup**: `shadows = +50, highlights = +50`.
*   **Inputs**: Pixel A (10,10,10); Pixel B (245,245,245).
*   **Exact assertions**:
    *   `deltaA > deltaB` (shadows affects darks more).
    *   `deltaB > deltaA` (highlights affects lights more).

### 5.3 Saturation
*   **Setup**: `saturation = +50` then `-50`.
*   **Inputs**: Gray pixel (128,128,128); Colored (128,64,32).
*   **Exact assertions**:
    *   Gray RGB stays 128.
    *   Colored spread increases for +50, decreases for -50.

### 5.4 Vibrance
*   **Setup**: `vibrance = +50`.
*   **Inputs**: Low-sat vs High-sat pixels.
*   **Exact assertions**: `deltaLow > deltaHigh`.

### 5.5 White Balance
*   **Setup**: `wb = +20` then `-20`.
*   **Exact assertions**:
    *   Luminance before approx equals after.
    *   Channels clamped `0..255`.

### 5.6 Color Balance
*   **Setup**: Non-zero RGB `colorBal`.
*   **Exact assertions**:
    *   Luminance preserved.
    *   Channels clamped `0..255`.

### 5.7 Alpha Unchanged
*   **Exact assertions**: `data[i+3]` matches original.

## 6. Selective Color Application (applySelectiveColor)

### 6.1 No-Op When Inactive
*   **Setup**: `state.hasActiveColorTuning = false`.
*   **Exact assertions**: Data before equals after.

### 6.2 Single Pixel Adjustment
*   **Setup**: Reds band active: `hue=20, sat=10, lum=-10`.
*   **Inputs**: Pixel (255,0,0).
*   **Exact assertions**:
    *   Hue shift: G increases.
    *   Saturation: Adjusted.
    *   Luminance: Decreases.
    *   Tolerance +/- 1.

### 6.3 Hue Wrap and Clamp
*   **Setup**: LUT yields hue shift +30, -40.
*   **Inputs**: Pixel hue 350.
*   **Exact assertions**:
    *   Hue wraps (350+30 -> 20).
    *   Sat/Lum clamped [0, 1].

### 6.4 Shadow/Highlight Impact
*   **Setup**: `shadows=20, highlights=-20`.
*   **Inputs**: Dark and Light pixels.
*   **Exact assertions**: Dark brightens; Light darkens.

### 6.5 LUT Indexing
*   **Setup**: Create LUT arrays with sentinel values at index 11 and 124.
*   **Inputs**: Pixel hue 10.6; lum 0.49.
*   **Exact assertions**:
    *   Adjustment equals sentinel at rounded hue index (11).
    *   Adjustment equals sentinel at floored lum index (124).

## 7. Preview Pipeline

### 7.1 updateAdjustmentPreview() Throttling
*   **Setup**: Stub `Date.now` (0, 50, 120). `state.adjustmentsVisible = true`.
*   **Inputs**: Call `updateAdjustmentPreview()` 3 times.
*   **Exact assertions**: `renderToContext` spy called exactly 2 times (1st and 3rd).

### 7.2 Full-Resolution vs Downscaled Preview
*   **Setup**: `state.adjustmentPreviewResolution` = 'Full' then 1080.
*   **Exact assertions**:
    *   Full: Preview dims equal main canvas.
    *   Numeric: Preview dims equal scaled values.

### 7.3 Visibility Toggles
*   **Setup**: `state.adjustmentsVisible = true`.
*   **Exact assertions**:
    *   `mainCanvas.style.display === 'none'`.
    *   `previewCanvas.style.display === 'block'` (or class removed).

### 7.4 Respect adjustmentsVisible
*   **Setup**: `state.adjustmentsVisible = false`.
*   **Exact assertions**:
    *   `renderToContext` NOT called.
    *   Canvas styles unchanged.

### 7.5 Canvas Resizing & Scale
*   **Setup**: Image 4000x2000; previewResolution 1080.
*   **Exact assertions**:
    *   `previewWidth` 2160, `previewHeight` 1080.
    *   `scale` === previewHeight / fullHeight.

## 8. Reset & UI Wiring

### 8.1 resetAllAdjustments()
*   **Setup**: Modify state values. Spy on `updateSlider`, `refreshTuningSliders`.
*   **Action**: Call `resetAllAdjustments()`.
*   **Exact assertions**:
    *   State values equal defaults.
    *   `updateSlider` called for every control ID.
    *   `refreshTuningSliders` called.
    *   `updateColorTuningLUT` called.

### 8.2 updateSlider(id, val)
*   **Setup**: Provide slider/label.
*   **Inputs**: IDs for K, float, int, curve types.
*   **Exact assertions**:
    *   `slider.value === val`.
    *   `label.textContent` matches format (e.g., '6500K', '1.20').
    *   `console.warn` called if label missing.

### 8.3 initAdjustments() Event Wiring
*   **Scenario**: Pointerdown/focus.
    *   **Exact assertions**: Internal startValue equals slider value.
*   **Scenario**: input updates state and preview.
    *   **Exact assertions**: state field updated; label updated; `updateAdjustmentPreview` called.
*   **Scenario**: change dispatches action.
    *   **Exact assertions**: `dispatchAction` spy called with type 'adjustment-change', `oldValue`, `newValue`.

### 8.4 Reset Buttons
*   **Scenario**: Adjustments reset.
    *   **Exact assertions**: State reset; `dispatchAction` 'adjustment-reset'.
*   **Scenario**: Color tuning band reset.
    *   **Exact assertions**: Band zeroed; `dispatchAction` 'color-tuning-band-reset'.
*   **Scenario**: Color tuning reset-all.
    *   **Exact assertions**: All bands zeroed; `dispatchAction` 'color-tuning-reset'.

### 8.5 Error/Warning Paths
*   **Setup**: Remove known slider ID. Call `initAdjustments()`.
*   **Exact assertions**: `console.error` (or warn) called with missing ID.

### 8.6 Tuning UI Synchronization
*   **Scenario**: `updateTuningSliderUI` disables shadow/highlight.
    *   **Setup**: Active band 'darks'.
    *   **Exact assertions**: `shadowSlider.disabled === true`.
*   **Scenario**: Active band class toggle.
    *   **Exact assertions**: Only active band has active class.
*   **Scenario**: `refreshTuningSliders` syncs values.
    *   **Exact assertions**: Slider values equal state.
*   **Scenario**: `updateAllAdjustmentUI` syncs full set.
    *   **Exact assertions**: Every slider value equals state fields.

## 9. Integration Expectations

### 9.1 Handler Setters
*   **Scenario**: `setSaveSnapshotHandler`, `setUpdateWorkingCopiesHandler`.
*   **Inputs**: Pass valid function; then invalid.
*   **Exact assertions**:
    *   Invoking internal handler calls provided function.
    *   Invalid input logs warning/does not override.

### 9.2 API Object Surface
*   **Exact assertions**:
    *   `typeof system.updateAdjustmentPreview === 'function'`.
    *   Verify `initAdjustments`, `initColorTuning`, `resetAllAdjustments` exist.
    *   Calls do not throw.
