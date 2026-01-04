# Adjustments Unit-Test Blueprint (scripts/adjustments.js)

## 1. Overview & Test Harness Assumptions

### 1.1 Minimal Harness/Fixture Shape
**Scenario:** Baseline fixture to initialize `createAdjustmentSystem` and expose OkazuTestables.

**Setup**
- Provide the smallest functional `state`, `els`, and supporting callbacks to call `createAdjustmentSystem(state, els, ctx, renderToContext, render, scheduleHeavyTask)`.
- Mock `ctx` as a minimal `CanvasRenderingContext2D`-like object with `getImageData`, `putImageData`, `drawImage`, and `clearRect`.
- Ensure the returned API and `window.OkazuTestables.adjustments` are available.

**Inputs**
- `state` with adjustment defaults (levels, gamma, color tuning arrays, toggles, flags for adjustment preview, etc.).
- `els` with references to every slider/button element used by `initAdjustments()` and `initColorTuning()`.
- `renderToContext`, `render`, `scheduleHeavyTask` as test doubles.

**Expected outputs and state changes**
- The system initializes without throwing and registers handlers.
- `window.OkazuTestables.adjustments` exposes testable helpers.

**Exact assertions**
- `typeof createAdjustmentSystem === 'function'`.
- `typeof system.initAdjustments === 'function'`.
- `typeof window.OkazuTestables.adjustments.getBandWeight === 'function'`.
- `render`, `renderToContext`, `scheduleHeavyTask` are called only as specified by individual tests.

### 1.2 DOM Mocking Strategy
**Scenario:** Mock `document.getElementById`, `document.querySelectorAll`, and DOM elements with event listeners.

**Setup**
- Replace `document.getElementById` with a stub that returns a map of fake elements by id.
- Replace `document.querySelectorAll` with a stub that returns arrays of sliders for tuning bands.
- Fake elements include properties: `value`, `textContent`, `classList`, `disabled`, `addEventListener`, `dispatchEvent`.

**Inputs**
- Element registry keyed by id (e.g., `adj-gamma`, `adj-saturation`, `colorBandButtons`).

**Expected outputs and state changes**
- `initAdjustments()` and `initColorTuning()` attach listeners without errors.

**Exact assertions**
- For each element, `addEventListener` called with expected event types (`input`, `change`, `pointerdown`, `focus`).
- Missing element paths trigger warning/error logs (see Section 8).

### 1.3 Canvas & ImageData Mocking Strategy
**Scenario:** Provide `ImageData` and `CanvasRenderingContext2D` substitutes for LUT and pixel operations.

**Setup**
- Create a minimal `ImageData` shim: `{ width, height, data: Uint8ClampedArray }`.
- Create a `CanvasRenderingContext2D` stub with `getImageData` returning a controlled buffer and `putImageData` capturing output.

**Inputs**
- 1x1, 2x2 buffers for exact numeric assertions.

**Expected outputs and state changes**
- Color operations mutate `ImageData.data` in place.

**Exact assertions**
- `imageData.data` values match expected post-adjustment values.

### 1.4 Mocking `window.dispatchAction`
**Scenario:** Capture dispatched actions from UI changes.

**Setup**
- Stub `window.dispatchAction = jest.fn()` (or equivalent test double).

**Inputs**
- Change events triggered on sliders, reset buttons.

**Expected outputs and state changes**
- Actions include `type`, `payload.oldValue`, `payload.newValue`.

**Exact assertions**
- `dispatchAction` called with exact action types (e.g., `adjustment-change`, `adjustment-reset`, `color-tuning-reset`).
- `payload.oldValue` matches the value captured on pointerdown/focus.

### 1.5 Deterministic Time Control
**Scenario:** Throttle logic in `updateAdjustmentPreview()` is time-based.

**Setup**
- Stub `Date.now()` to return deterministic timestamps.

**Inputs**
- Two calls within `<100ms` and one call after `>=100ms`.

**Expected outputs and state changes**
- Throttled calls skip render; later call proceeds.

**Exact assertions**
- `renderToContext` is not called on throttled invocation; called on allowed invocation.

### 1.6 Console/Logger Safety
**Scenario:** Missing elements or invalid calls log warnings/errors without breaking tests.

**Setup**
- Stub `console.warn`, `console.error` and/or `Logger.warn`, `Logger.error`.

**Inputs**
- Remove specific slider elements from the registry.

**Expected outputs and state changes**
- Error paths are exercised without throwing.

**Exact assertions**
- `console.warn` called with a message containing the missing id.
- Test continues without uncaught exception.

---

## 2. Pure Helper Functions (`OkazuTestables.adjustments`)

### 2.1 `getBandWeight(hue, centerHue)`

#### 2.1.1 Width Selection
**Scenario:** Width is 25 for centerHue 30/60, else 45.

**Setup**
- Access `getBandWeight` from `window.OkazuTestables.adjustments`.

**Inputs**
- `centerHue = 30` and `centerHue = 60`; sample `hue = centerHue`.
- `centerHue = 120` (or another non-30/60).

**Expected outputs and state changes**
- The internal band width is 25 for 30/60; 45 otherwise.

**Exact assertions**
- At `diff = width`, output is exactly `0`.
- At `diff = width - 1e-6`, output > `0` for both width types.

#### 2.1.2 Exact-Value Assertions at Key Diffs
**Scenario:** Verify cubic smoothstep shape and zeroing.

**Setup**
- `centerHue = 120` (width 45).

**Inputs**
- `hue = centerHue` (diff 0)
- `hue = centerHue + 45` (diff width)
- `hue = centerHue + 45 + 1e-6` (diff width+ε)
- `hue = centerHue + 44.999` (diff width-ε)

**Expected outputs and state changes**
- Weight at diff 0 is 1.
- Weight at diff >= width is 0.
- Just inside width is > 0.

**Exact assertions**
- `getBandWeight(centerHue, centerHue) === 1`.
- `getBandWeight(centerHue + 45, centerHue) === 0`.
- `getBandWeight(centerHue + 45 + 1e-6, centerHue) === 0`.
- `getBandWeight(centerHue + 44.999, centerHue) > 0`.

#### 2.1.3 Wraparound Behavior (>180)
**Scenario:** Diff uses wraparound (e.g., hue 350 vs center 10).

**Setup**
- `centerHue = 10`.

**Inputs**
- `hue = 350` (diff should be 20).

**Expected outputs and state changes**
- Weight equals value for diff=20 within width 45.

**Exact assertions**
- `getBandWeight(350, 10) === getBandWeight(30, 10)` (diff=20).

#### 2.1.4 Monotonic Falloff and Symmetry
**Scenario:** Weights decrease as diff increases; symmetric about center.

**Setup**
- `centerHue = 200`.

**Inputs**
- Diffs: 0, 10, 20, 30, 40.
- Compare `hue = centerHue + d` vs `hue = centerHue - d`.

**Expected outputs and state changes**
- Weight is monotonic non-increasing with diff.
- Weight is symmetric for +/- diff.

**Exact assertions**
- `w0 >= w10 >= w20 >= w30 >= w40`.
- `getBandWeight(center+20, center) === getBandWeight(center-20, center)`.

### 2.2 `getLuminanceWeight(lum, band)`

#### 2.2.1 Boundary Checks
**Scenario:** Confirm outputs at 0, 0.5, 1.0 and near boundaries.

**Setup**
- `band = 'darks'`, `band = 'mids'`, `band = 'lights'`.

**Inputs**
- `lum = 0`, `0.5`, `1.0`, `0.5 - 1e-6`.

**Expected outputs and state changes**
- Each band returns 0 outside its range.

**Exact assertions**
- `getLuminanceWeight(1.0, 'darks') === 0`.
- `getLuminanceWeight(0, 'lights') === 0`.
- `getLuminanceWeight(0.5, 'mids')` equals peak (see 2.2.2).
- `getLuminanceWeight(0.5 - 1e-6, 'lights') === 0`.

#### 2.2.2 Peak Values
**Scenario:** Max weight at expected centers.

**Setup**
- Use band centers as defined by the implementation.

**Inputs**
- `lum = center` for darks/mids/lights.

**Expected outputs and state changes**
- Weight is 1 at band center.

**Exact assertions**
- `getLuminanceWeight(centerDarks, 'darks') === 1`.
- `getLuminanceWeight(centerMids, 'mids') === 1`.
- `getLuminanceWeight(centerLights, 'lights') === 1`.

### 2.3 `rgbToHsl` and `hslToRgb`

#### 2.3.1 Round-Trip Fidelity
**Scenario:** Converting RGB -> HSL -> RGB yields original values.

**Setup**
- Access helpers from `OkazuTestables.adjustments`.

**Inputs**
- Primaries: (255,0,0), (0,255,0), (0,0,255)
- Secondaries: (255,255,0), (0,255,255), (255,0,255)
- Grayscale: (0,0,0), (128,128,128), (255,255,255)
- Random: (12, 200, 77), (150, 10, 220)

**Expected outputs and state changes**
- Round-trip RGB values equal original (±1 for rounding).

**Exact assertions**
- `abs(r2 - r) <= 1`, same for g/b on each sample.

#### 2.3.2 Hue Edge Cases
**Scenario:** Hue values for pure colors are correct.

**Setup**
- Convert RGB to HSL.

**Inputs**
- Red (255,0,0), Green (0,255,0), Blue (0,0,255).

**Expected outputs and state changes**
- Hue approx 0, 120, 240 respectively.

**Exact assertions**
- `abs(h - 0) <= 0.5` for red.
- `abs(h - 120) <= 0.5` for green.
- `abs(h - 240) <= 0.5` for blue.

#### 2.3.3 Saturation/Lightness Boundaries
**Scenario:** Check grayscale outputs and extremes.

**Setup**
- Convert HSL to RGB.

**Inputs**
- `s=0` with various `h` and `l`.
- `l=0` and `l=1` with arbitrary `h`/`s`.

**Expected outputs and state changes**
- `s=0` yields grayscale; `l=0` yields black; `l=1` yields white.

**Exact assertions**
- `hslToRgb(h, 0, l)` yields `r=g=b`.
- `hslToRgb(h, s, 0)` yields `r=g=b=0`.
- `hslToRgb(h, s, 1)` yields `r=g=b=255`.

### 2.4 `getCurvedValue(sliderVal)`

#### 2.4.1 Threshold Behavior
**Scenario:** Validate slope change around |val|=80 and clamps at ±100.

**Setup**
- Access helper function.

**Inputs**
- `sliderVal = -100, -99, -81, -80, 0, 80, 81, 99, 100`.

**Expected outputs and state changes**
- Curve stays within [-100, 100], with slope change after |80|.

**Exact assertions**
- `abs(getCurvedValue(80)) < abs(getCurvedValue(81))` (post-threshold increase).
- `getCurvedValue(100) === 100` and `getCurvedValue(-100) === -100`.
- `getCurvedValue(0) === 0`.

---

## 3. Color Tuning LUT Generation

### 3.1 `updateColorTuningLUT` Activation
**Scenario:** `hasActiveColorTuning` false when all bands zero, true if any nonzero.

**Setup**
- State with color tuning bands (reds/yellows/greens/cyans/blues/magentas) set to 0.

**Inputs**
- All tuning values = 0; then set `reds.sat = 10`.

**Expected outputs and state changes**
- `hasActiveColorTuning` toggles false -> true.

**Exact assertions**
- After zeroed bands: `state.hasActiveColorTuning === false`.
- After one nonzero: `state.hasActiveColorTuning === true`.

### 3.2 Hue LUT Accumulation
**Scenario:** LUT entries accumulate hue/sat/vib/lum/shadows/highlights weights.

**Setup**
- Configure a single band (e.g., reds) with known values.
- Force `updateColorTuningLUT` to run (via `applySelectiveColor` or direct test hook).

**Inputs**
- `reds = { hue: 10, sat: 20, vib: 5, lum: -5, shadows: 15, highlights: -10 }`.

**Expected outputs and state changes**
- LUT values for hues near red reflect combined weighted contributions.

**Exact assertions**
- `state.colorTuningLUT.hue[0]` equals expected sum at exact hue center.
- `state.colorTuningLUT.sat[0]` matches expected for weight 1.
- Each LUT channel has values only within band width.

### 3.3 Luminance LUT Weighting
**Scenario:** Darks/mids/lights weighting and shadow/highlight exclusions.

**Setup**
- Set `lumBand = 'darks'` adjustments with `shadows/highlights`.

**Inputs**
- `darks: { lum: 10, shadows: 10, highlights: 10 }`.

**Expected outputs and state changes**
- Shadow/highlight contributions are excluded for luminance bands.

**Exact assertions**
- `state.colorTuningLUT.shadows[lumIndex] === 0` for lum bands.
- `state.colorTuningLUT.highlights[lumIndex] === 0` for lum bands.

### 3.4 Numeric Assertion with Controlled Config
**Scenario:** Single band with deterministic values for a known hue/lum.

**Setup**
- Configure `reds` with values and freeze LUT update.

**Inputs**
- `reds: { hue: 20, sat: 0, vib: 0, lum: 0, shadows: 0, highlights: 0 }`.
- Sample hue = 0 (center), lum index = 128 (mid).

**Expected outputs and state changes**
- Hue LUT adds a known amount equal to weight * 20.

**Exact assertions**
- `state.colorTuningLUT.hue[0] === 20`.
- `state.colorTuningLUT.hue[10] < 20` (falloff).

---

## 4. Master LUT (Levels + Gamma)

### 4.1 `updateMasterLUT` Hashing
**Scenario:** No recomputation when unchanged.

**Setup**
- Spy on LUT creation or count of `updateMasterLUT` internal recompute steps.

**Inputs**
- Call `updateMasterLUT` twice with identical levels/gamma.

**Expected outputs and state changes**
- Second call does not rebuild LUT.

**Exact assertions**
- `recomputeCount === 1` after two identical calls.

### 4.2 Range <= 0.001 Behavior
**Scenario:** When `white <= black`, output becomes binary.

**Setup**
- `black = 0.5`, `white = 0.5`.

**Inputs**
- Apply LUT to `imageData` with mid values.

**Expected outputs and state changes**
- Values <= black map to 0, > black map to 255.

**Exact assertions**
- `LUT[0] === 0`.
- `LUT[255] === 255`.

### 4.3 Clamping After Mid/Gamma
**Scenario:** Ensure values stay in [0,1] after adjustments.

**Setup**
- Set `mid` or `gamma` to extreme values.

**Inputs**
- Values near 0 and 1.

**Expected outputs and state changes**
- LUT entries clamp to [0,255].

**Exact assertions**
- `min(LUT) === 0` and `max(LUT) === 255`.

### 4.4 `applyMasterLUT(imageData)`

#### 4.4.1 Early Return
**Scenario:** Defaults active => no mutation.

**Setup**
- Default levels/gamma.
- `imageData` with known values.

**Inputs**
- Apply `applyMasterLUT`.

**Expected outputs and state changes**
- Data unchanged.

**Exact assertions**
- `data` buffer before equals after.

#### 4.4.2 Exact Pixel Mapping
**Scenario:** Known LUT mapping.

**Setup**
- Levels: `black=0.2`, `white=0.8`, `mid=1.0`, `gamma=1.0`.

**Inputs**
- Pixel values: 0, 51, 128, 204, 255.

**Expected outputs and state changes**
- Map values linearly into [0,255] after clamp.

**Exact assertions**
- `data[0] === 0` (below black).
- `data[2] === expected` (e.g., 128 maps to approx mid).

#### 4.4.3 Alpha Unchanged
**Scenario:** Alpha channel passes through.

**Setup**
- `imageData` with alpha values 10, 200, 255.

**Inputs**
- Apply `applyMasterLUT`.

**Expected outputs and state changes**
- Alpha unchanged.

**Exact assertions**
- `data[3]` equals original alpha for each pixel.

---

## 5. Color Operations (`applyColorOps`)

### 5.1 Early Return When All Zero
**Scenario:** No adjustments applied when all knobs zero.

**Setup**
- All adjustment values = 0.

**Inputs**
- 1x1 pixel buffer with arbitrary RGB.

**Expected outputs and state changes**
- No changes to RGB or alpha.

**Exact assertions**
- `data` before equals after.

### 5.2 Shadows/Highlights Weighting
**Scenario:** Shadows affect darks more; highlights affect lights more.

**Setup**
- `shadows = +50`, `highlights = +50`.

**Inputs**
- Pixel A: (10,10,10) (dark)
- Pixel B: (245,245,245) (light)

**Expected outputs and state changes**
- Pixel A increases more from shadows than highlights; Pixel B increases more from highlights.

**Exact assertions**
- `deltaA > deltaB` for shadows effect on dark pixel.
- `deltaB > deltaA` for highlights effect on light pixel.
- Confirm formula uses `lum^2` and `(1-lum)^2` via computed deltas matching expected weights.

### 5.3 Saturation
**Scenario:** Saturation changes do not affect grayscale; non-grayscale adjusts.

**Setup**
- `saturation = +50` and then `-50`.

**Inputs**
- Gray pixel (128,128,128) and colored pixel (128,64,32).

**Expected outputs and state changes**
- Gray unchanged; colored pixel increases/decreases chroma.

**Exact assertions**
- Gray RGB stays 128.
- Colored pixel channel spread increases for +50, decreases for -50.

### 5.4 Vibrance
**Scenario:** Stronger effect at low saturation.

**Setup**
- `vibrance = +50`.

**Inputs**
- Low-sat pixel (128,120,110)
- High-sat pixel (200,50,50)

**Expected outputs and state changes**
- Low-sat pixel changes more than high-sat pixel.

**Exact assertions**
- `deltaLow > deltaHigh` for saturation distance.

### 5.5 White Balance
**Scenario:** Lum-preserving scale and channel scaling/clamping.

**Setup**
- `whiteBalance = +20` then `-20`.

**Inputs**
- Pixel (100,150,200) and (10,10,10).

**Expected outputs and state changes**
- Channels scale appropriately; luminance preserved after scale; clamped to 0..255.

**Exact assertions**
- Luminance before approx equals luminance after (within tolerance).
- Channels do not exceed 255 or drop below 0.

### 5.6 Color Balance
**Scenario:** Curved values and lum-preserving scale with clamp.

**Setup**
- `colorBalance` adjustments non-zero on R/G/B.

**Inputs**
- Pixel (120,140,160).

**Expected outputs and state changes**
- Curved values applied and luminance preserved.

**Exact assertions**
- Luminance before ~ luminance after.
- Channels are clamped to [0,255].

### 5.7 Alpha Unchanged
**Scenario:** Alpha channel is untouched.

**Setup**
- Any non-zero adjustments.

**Inputs**
- Alpha values 0, 128, 255.

**Expected outputs and state changes**
- Alpha unchanged.

**Exact assertions**
- `data[i+3]` equals original alpha for each pixel.

---

## 6. Selective Color Application (`applySelectiveColor`)

### 6.1 No-Op When Inactive
**Scenario:** `hasActiveColorTuning` false => no change.

**Setup**
- `state.hasActiveColorTuning = false`.

**Inputs**
- 1x1 pixel buffer.

**Expected outputs and state changes**
- No mutation of RGB.

**Exact assertions**
- `data` before equals after.

### 6.2 Single Pixel Adjustment
**Scenario:** Known hue/sat/lum adjustments applied.

**Setup**
- Single band active (reds) with `hue=20`, `sat=10`, `lum=-10`.

**Inputs**
- Pixel (255,0,0).

**Expected outputs and state changes**
- RGB adjusted according to HSL adjustments.

**Exact assertions**
- Hue shift moves red towards orange (G increases).
- Saturation reduces/increases accordingly.
- Luminance decreases with `lum=-10`.
- Use tolerance ±1 per channel.

### 6.3 Hue Wrap and Clamp
**Scenario:** Hue wrap and sat/lum clamping boundaries.

**Setup**
- LUT yields hue adjustment +30 and -40 at relevant indices.

**Inputs**
- Pixel with hue near 350; apply +30 -> wrap to 20.
- Large negative sat/lum adjustments.

**Expected outputs and state changes**
- Hue wraps to 0..360; sat/lum clamped to [0,1].

**Exact assertions**
- `hue` used in conversion is within [0,360).
- Saturation/luminance not below 0 or above 1.

### 6.4 Shadow/Highlight Impact
**Scenario:** Shadow/highlight adjustments affect luminance as designed.

**Setup**
- Active tuning with `shadows=20`, `highlights=-20`.

**Inputs**
- Dark pixel (10,10,10) and light pixel (245,245,245).

**Expected outputs and state changes**
- Dark pixel brightens; light pixel darkens.

**Exact assertions**
- `lumDarkAfter > lumDarkBefore`.
- `lumLightAfter < lumLightBefore`.

### 6.5 LUT Indexing
**Scenario:** Hue uses rounded index and lum uses floor index.

**Setup**
- Create LUT arrays with sentinel values at specific indices.

**Inputs**
- Pixel with hue ~10.6 -> rounded index 11.
- Pixel with lum 0.49 -> floor index 124 (when scaled to 0..255).

**Expected outputs and state changes**
- The sentinel values at those indices are used.

**Exact assertions**
- Observed adjustment equals sentinel at rounded hue index.
- Observed adjustment equals sentinel at floored lum index.

---

## 7. Preview Pipeline

### 7.1 `updateAdjustmentPreview()` Throttling
**Scenario:** Calls within 100ms are ignored.

**Setup**
- Stub `Date.now()` to return 0, 50, 120.
- `state.adjustmentsVisible = true`.

**Inputs**
- Call `updateAdjustmentPreview()` three times.

**Expected outputs and state changes**
- First call renders; second does not; third renders.

**Exact assertions**
- `renderToContext` called exactly 2 times.

### 7.2 Full-Resolution vs Downscaled Preview
**Scenario:** Use full resolution when preference is 'Full'.

**Setup**
- `state.adjustmentPreviewResolution = 'Full'` then numeric (e.g., 1080).

**Inputs**
- Call `updateAdjustmentPreview()`.

**Expected outputs and state changes**
- Full mode uses main canvas dimensions; numeric uses scaled preview buffer.

**Exact assertions**
- Preview buffer width/height equals main canvas when 'Full'.
- Preview buffer width/height equals scaled values when numeric.

### 7.3 Visibility Toggles
**Scenario:** Switch between main and preview canvas.

**Setup**
- `state.adjustmentsVisible = true`.

**Inputs**
- Call `updateAdjustmentPreview()`.

**Expected outputs and state changes**
- `mainCanvas` hidden, `previewCanvas` shown.

**Exact assertions**
- `mainCanvas.style.display === 'none'`.
- `previewCanvas.style.display === 'block'` (or expected style value).

### 7.4 Respect `adjustmentsVisible`
**Scenario:** No preview render when adjustments hidden.

**Setup**
- `state.adjustmentsVisible = false`.

**Inputs**
- Call `updateAdjustmentPreview()`.

**Expected outputs and state changes**
- No render and no canvas toggle.

**Exact assertions**
- `renderToContext` not called.
- `mainCanvas.style.display` unchanged.

### 7.5 Canvas Resizing & Scale
**Scenario:** Preview buffer sizes and scale calculation are correct.

**Setup**
- Main image dimensions known (e.g., 4000x2000).
- Preview resolution set to 1080.

**Inputs**
- Call `updateAdjustmentPreview()`.

**Expected outputs and state changes**
- Preview buffer respects aspect ratio; scale factor computed correctly.

**Exact assertions**
- `previewWidth === 2160`, `previewHeight === 1080` for 2:1 aspect.
- `scale === previewHeight / fullHeight`.

---

## 8. Reset & UI Wiring

### 8.1 `resetAllAdjustments()`

**Scenario:** Full reset restores defaults and triggers updates.

**Setup**
- Non-default adjustment values set throughout `state`.
- Spies on `updateSlider`, `refreshTuningSliders`, `updateColorTuningLUT`, `updateWorkingCopies`.

**Inputs**
- Call `resetAllAdjustments()`.

**Expected outputs and state changes**
- State reset to defaults; all UI updated.

**Exact assertions**
- Each adjustment value equals default.
- `updateSlider` called for every control id.
- `refreshTuningSliders` called once.
- `updateColorTuningLUT` called once.
- `updateWorkingCopies` called once.

### 8.2 `updateSlider(id, val)`

**Scenario:** Value and label formatting by slider type.

**Setup**
- Provide slider and label elements; define per-id formatting rules.

**Inputs**
- `id = 'adj-temperature'` with K formatting.
- `id = 'adj-gamma'` with float.
- `id = 'adj-contrast'` with int.
- Missing label element.

**Expected outputs and state changes**
- Slider value set; label text reflects formatting; missing label logs warning.

**Exact assertions**
- `slider.value === val`.
- `label.textContent === '6500K'` for K-format.
- `label.textContent === '1.20'` for float.
- `console.warn` called when label missing.

### 8.3 `initAdjustments()` Event Wiring

**Scenario:** Pointerdown/focus capture start value.

**Setup**
- Sliders with `addEventListener` capturing handlers.

**Inputs**
- Trigger `pointerdown` and `focus` on slider.

**Expected outputs and state changes**
- Start value captured for change dispatch.

**Exact assertions**
- Internal `startValue` equals current slider value after pointerdown/focus.

**Scenario:** `input` updates state and preview.

**Setup**
- `state.isAdjusting = false`, `state.adjustmentsVisible = true`.

**Inputs**
- Trigger `input` with new value.

**Expected outputs and state changes**
- State updated; label updated; `isAdjusting = true` if adjusting.
- `updateAdjustmentPreview` called.

**Exact assertions**
- `state.adjustments.<field> === newValue`.
- `label.textContent` updated.
- `updateAdjustmentPreview` called once.

**Scenario:** `change` dispatches action and commit flags.

**Setup**
- `window.dispatchAction` stub.

**Inputs**
- Trigger `change` with new value.

**Expected outputs and state changes**
- Dispatch includes old/new values; `pendingAdjustmentCommit` toggled.

**Exact assertions**
- `dispatchAction` called with `{ type: 'adjustment-change', payload: { oldValue, newValue } }`.
- `state.pendingAdjustmentCommit === true` (or expected toggle).

### 8.4 Reset Buttons

**Scenario:** Adjustments reset button restores defaults.

**Setup**
- Non-default state; reset button element.

**Inputs**
- Click reset button.

**Expected outputs and state changes**
- State reset; preview update; dispatchAction called.

**Exact assertions**
- `state.adjustments` matches defaults.
- `dispatchAction` called with `adjustment-reset`.

**Scenario:** Color tuning band reset.

**Setup**
- Select a band with nonzero values.

**Inputs**
- Click `reset-band` button.

**Expected outputs and state changes**
- Selected band zeroed; preview updated.

**Exact assertions**
- `state.colorTuning[band]` values all 0.
- `dispatchAction` called with `color-tuning-band-reset`.

**Scenario:** Color tuning reset-all.

**Setup**
- Multiple bands with non-zero values.

**Inputs**
- Click `reset-all` button.

**Expected outputs and state changes**
- All bands zeroed.

**Exact assertions**
- Every band value equals 0.
- `dispatchAction` called with `color-tuning-reset`.

### 8.5 Error/Warning Paths
**Scenario:** Missing slider element logs error.

**Setup**
- Remove a known slider id from DOM registry.

**Inputs**
- Call `initAdjustments()`.

**Expected outputs and state changes**
- Warning logged; rest of init continues.

**Exact assertions**
- `console.error` called with missing id.
- Other sliders still initialized.

### 8.6 Tuning UI Synchronization

**Scenario:** `updateTuningSliderUI` disables shadow/highlight for lum bands.

**Setup**
- Active band = 'darks'/'mids'/'lights'.

**Inputs**
- Call `updateTuningSliderUI()`.

**Expected outputs and state changes**
- Shadow/highlight sliders disabled for lum bands.

**Exact assertions**
- `shadowSlider.disabled === true`.
- `highlightSlider.disabled === true`.

**Scenario:** Active band class toggle.

**Setup**
- Band buttons with `classList` methods.

**Inputs**
- Set active band to `reds` then `greens`.

**Expected outputs and state changes**
- Only active band has active class.

**Exact assertions**
- `redsButton.classList.contains('active') === false` after switching.
- `greensButton.classList.contains('active') === true`.

**Scenario:** `refreshTuningSliders` and `refreshColorTuningUI` sync values.

**Setup**
- Change state values for tuning sliders.

**Inputs**
- Call `refreshTuningSliders()` and `refreshColorTuningUI()`.

**Expected outputs and state changes**
- Slider values and labels reflect state.

**Exact assertions**
- Each tuning slider `value` equals state value.
- Each label text matches formatted value.

**Scenario:** `updateAllAdjustmentUI` syncs full set.

**Setup**
- Alter all adjustment state values.

**Inputs**
- Call `updateAllAdjustmentUI()`.

**Expected outputs and state changes**
- All sliders/labels match state.

**Exact assertions**
- Every slider value equals `state.adjustments` fields.

---

## 9. Integration Expectations

### 9.1 Handler Setters
**Scenario:** `setSaveSnapshotHandler` and `setUpdateWorkingCopiesHandler` accept functions only.

**Setup**
- Create system via `createAdjustmentSystem`.

**Inputs**
- Pass valid function, then invalid (e.g., `null`).

**Expected outputs and state changes**
- Valid functions stored; invalid inputs ignored or log warnings (per implementation).

**Exact assertions**
- `typeof system.setSaveSnapshotHandler === 'function'`.
- After valid input, invoking internal handler calls the provided function.
- Invalid input logs warning and does not override.

### 9.2 API Object Surface
**Scenario:** Returned API has all expected functions and can be called without side effects.

**Setup**
- Create system with minimal state/els/ctx.

**Inputs**
- Call each API method with safe defaults.

**Expected outputs and state changes**
- Methods exist and do not throw in isolation.

**Exact assertions**
- `typeof system.updateAdjustmentPreview === 'function'`.
- `expect(() => system.updateAdjustmentPreview()).not.toThrow()`.
- Similar assertions for `initAdjustments`, `initColorTuning`, `resetAllAdjustments`, etc.
