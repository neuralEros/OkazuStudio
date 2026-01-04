# Adjustments Unit-Test Blueprint (scripts/adjustments.js)

# 1. Overview & Test Harness Assumptions

[ ] 1.1 Minimal Harness/Fixture Shape
    # Scenario: Baseline fixture to initialize createAdjustmentSystem and expose OkazuTestables.
    [ ] 1.1.1 Setup: Initialize createAdjustmentSystem(state, els, ctx, renderToContext, render, scheduleHeavyTask)
        [ ] Provide smallest functional state
        [ ] Provide els and supporting callbacks
        [ ] Mock ctx as minimal CanvasRenderingContext2D (getImageData, putImageData, drawImage, clearRect)
        [ ] Ensure returned API and window.OkazuTestables.adjustments are available
    [ ] 1.1.2 Inputs: Define state, els, and render doubles
        [ ] state: adjustment defaults (levels, gamma, color tuning arrays, toggles, flags for adjustment preview, etc.)
        [ ] els: references to every slider/button element used by initAdjustments() and initColorTuning()
        [ ] test doubles: renderToContext, render, scheduleHeavyTask
    [ ] 1.1.3 Expected outputs and state changes:
        # System initializes without throwing and registers handlers.
        # window.OkazuTestables.adjustments exposes testable helpers.
    [ ] 1.1.4 Exact assertions:
        [ ] typeof createAdjustmentSystem === 'function'
        [ ] typeof system.initAdjustments === 'function'
        [ ] typeof window.OkazuTestables.adjustments.getBandWeight === 'function'
        [ ] Verify render, renderToContext, scheduleHeavyTask are called only as specified by individual tests

[ ] 1.2 DOM Mocking Strategy
    # Scenario: Mock document.getElementById, document.querySelectorAll, and DOM elements with event listeners.
    [ ] 1.2.1 Setup: Replace document methods with stubs
        [ ] document.getElementById returns a map of fake elements by id
        [ ] document.querySelectorAll returns arrays of sliders for tuning bands
        [ ] Fake elements include: value, textContent, classList, disabled, addEventListener, dispatchEvent
    [ ] 1.2.2 Inputs: Define element registry
        [ ] Keyed by id: adj-gamma, adj-saturation, colorBandButtons, etc.
    [ ] 1.2.3 Expected outputs and state changes:
        # initAdjustments() and initColorTuning() attach listeners without errors.
    [ ] 1.2.4 Exact assertions:
        [ ] For each element, addEventListener called with 'input', 'change', 'pointerdown', 'focus'
        [ ] Missing element paths trigger warning/error logs

[ ] 1.3 Canvas & ImageData Mocking Strategy
    # Scenario: Provide ImageData and CanvasRenderingContext2D substitutes for LUT and pixel operations.
    [ ] 1.3.1 Setup: Create data shims
        [ ] Create ImageData shim: { width, height, data: Uint8ClampedArray }
        [ ] Create CanvasRenderingContext2D stub with getImageData (controlled buffer) and putImageData (captures output)
    [ ] 1.3.2 Inputs: Identify buffers
        [ ] Use 1x1, 2x2 buffers for exact numeric assertions
    [ ] 1.3.3 Expected outputs and state changes:
        # Color operations mutate ImageData.data in place.
    [ ] 1.3.4 Exact assertions:
        [ ] imageData.data values match expected post-adjustment values

[ ] 1.4 Mocking window.dispatchAction
    # Scenario: Capture dispatched actions from UI changes.
    [ ] 1.4.1 Setup: Stub window.dispatchAction
        [ ] Use jest.fn() or equivalent
    [ ] 1.4.2 Inputs: Trigger UI events
        [ ] Change events on sliders, reset buttons
    [ ] 1.4.3 Expected outputs and state changes:
        # Actions include type, payload.oldValue, payload.newValue.
    [ ] 1.4.4 Exact assertions:
        [ ] dispatchAction called with type: 'adjustment-change', 'adjustment-reset', 'color-tuning-reset'
        [ ] payload.oldValue matches value captured on pointerdown/focus

[ ] 1.5 Deterministic Time Control
    # Scenario: Throttle logic in updateAdjustmentPreview() is time-based.
    [ ] 1.5.1 Setup: Stub Date.now()
        [ ] Return deterministic timestamps
    [ ] 1.5.2 Inputs: Sequence of calls
        [ ] Call 1: Time T
        [ ] Call 2: Time T + <100ms
        [ ] Call 3: Time T + >=100ms
    [ ] 1.5.3 Expected outputs and state changes:
        # Throttled calls skip render; later call proceeds.
    [ ] 1.5.4 Exact assertions:
        [ ] renderToContext NOT called on throttled invocation
        [ ] renderToContext called on allowed invocation

[ ] 1.6 Console/Logger Safety
    # Scenario: Missing elements or invalid calls log warnings/errors without breaking tests.
    [ ] 1.6.1 Setup: Stub logging methods
        [ ] stub console.warn, console.error, Logger.warn, Logger.error
    [ ] 1.6.2 Inputs: Trigger error path
        [ ] Remove specific slider elements from the registry
    [ ] 1.6.3 Expected outputs and state changes:
        # Error paths exercised without throwing.
    [ ] 1.6.4 Exact assertions:
        [ ] console.warn called with message containing missing id
        [ ] Test continues without uncaught exception

# 2. Pure Helper Functions (OkazuTestables.adjustments)

[ ] 2.1 getBandWeight(hue, centerHue)
    [ ] 2.1.1 Width Selection
        # Scenario: Width is 25 for centerHue 30/60, else 45.
        [ ] Setup: Access getBandWeight from window.OkazuTestables.adjustments
        [ ] Inputs: centerHue = 30; centerHue = 60; centerHue = 120 (non-30/60)
        [ ] Expected outputs: band width is 25 for 30/60; 45 otherwise
        [ ] Exact assertions:
            [ ] At diff = width, output is exactly 0
            [ ] At diff = width - 1e-6, output > 0 for both width types
    [ ] 2.1.2 Exact-Value Assertions at Key Diffs
        # Scenario: Verify cubic smoothstep shape and zeroing.
        [ ] Setup: centerHue = 120 (width 45)
        [ ] Inputs: hue = 120 (diff 0); hue = 165 (diff width); hue = 165.000001 (diff width+e); hue = 164.999 (diff width-e)
        [ ] Expected outputs: weight 1 at center, 0 at boundary
        [ ] Exact assertions:
            [ ] getBandWeight(centerHue, centerHue) === 1
            [ ] getBandWeight(centerHue + 45, centerHue) === 0
            [ ] getBandWeight(centerHue + 45 + 1e-6, centerHue) === 0
            [ ] getBandWeight(centerHue + 44.999, centerHue) > 0
    [ ] 2.1.3 Wraparound Behavior (>180)
        # Scenario: Diff uses wraparound (e.g., hue 350 vs center 10).
        [ ] Setup: centerHue = 10
        [ ] Inputs: hue = 350 (equivalent to diff 20)
        [ ] Expected outputs: Weight equals value for diff=20
        [ ] Exact assertions:
            [ ] getBandWeight(350, 10) === getBandWeight(30, 10)
    [ ] 2.1.4 Monotonic Falloff and Symmetry
        # Scenario: Weights decrease as diff increases; symmetric about center.
        [ ] Setup: centerHue = 200
        [ ] Inputs: Diffs 0, 10, 20, 30, 40; Compare hue = centerHue + d vs hue = centerHue - d
        [ ] Expected outputs: Weight monotonic non-increasing; symmetric for +/- diff
        [ ] Exact assertions:
            [ ] w0 >= w10 >= w20 >= w30 >= w40
            [ ] getBandWeight(center+20, center) === getBandWeight(center-20, center)

[ ] 2.2 getLuminanceWeight(lum, band)
    [ ] 2.2.1 Boundary Checks
        # Scenario: Confirm outputs at 0, 0.5, 1.0 and near boundaries.
        [ ] Setup: band = 'darks', 'mids', 'lights'
        [ ] Inputs: lum = 0, 0.5, 1.0, 0.5 - 1e-6
        [ ] Expected outputs: Return 0 outside range
        [ ] Exact assertions:
            [ ] getLuminanceWeight(1.0, 'darks') === 0
            [ ] getLuminanceWeight(0, 'lights') === 0
            [ ] getLuminanceWeight(0.5, 'mids') equals peak (see 2.2.2)
            [ ] getLuminanceWeight(0.5 - 1e-6, 'lights') === 0
    [ ] 2.2.2 Peak Values
        # Scenario: Max weight at expected centers.
        [ ] Setup: Define band centers as per implementation
        [ ] Inputs: lum = center for darks/mids/lights
        [ ] Expected outputs: Weight is 1 at band center
        [ ] Exact assertions:
            [ ] getLuminanceWeight(centerDarks, 'darks') === 1
            [ ] getLuminanceWeight(centerMids, 'mids') === 1
            [ ] getLuminanceWeight(centerLights, 'lights') === 1

[ ] 2.3 rgbToHsl and hslToRgb
    [ ] 2.3.1 Round-Trip Fidelity
        # Scenario: Converting RGB -> HSL -> RGB yields original values.
        [ ] Setup: Access helpers from OkazuTestables.adjustments
        [ ] Inputs:
            [ ] Primaries: (255,0,0), (0,255,0), (0,0,255)
            [ ] Secondaries: (255,255,0), (0,255,255), (255,0,255)
            [ ] Grayscale: (0,0,0), (128,128,128), (255,255,255)
            [ ] Random: (12, 200, 77), (150, 10, 220)
        [ ] Expected outputs: Round-trip RGB values equal original (+/- 1)
        [ ] Exact assertions: abs(r2 - r) <= 1, same for g/b
    [ ] 2.3.2 Hue Edge Cases
        # Scenario: Hue values for pure colors are correct.
        [ ] Setup: Convert RGB to HSL
        [ ] Inputs: Red (255,0,0), Green (0,255,0), Blue (0,0,255)
        [ ] Expected outputs: Hue approx 0, 120, 240
        [ ] Exact assertions:
            [ ] abs(h - 0) <= 0.5 (red)
            [ ] abs(h - 120) <= 0.5 (green)
            [ ] abs(h - 240) <= 0.5 (blue)
    [ ] 2.3.3 Saturation/Lightness Boundaries
        # Scenario: Check grayscale outputs and extremes.
        [ ] Setup: Convert HSL to RGB
        [ ] Inputs: s=0 with various h/l; l=0 and l=1 with arbitrary h/s
        [ ] Expected outputs: s=0 is grayscale; l=0 is black; l=1 is white
        [ ] Exact assertions:
            [ ] hslToRgb(h, 0, l) yields r=g=b
            [ ] hslToRgb(h, s, 0) yields r=g=b=0
            [ ] hslToRgb(h, s, 1) yields r=g=b=255

[ ] 2.4 getCurvedValue(sliderVal)
    [ ] 2.4.1 Threshold Behavior
        # Scenario: Validate slope change around |val|=80 and clamps at +/- 100.
        [ ] Setup: Access helper
        [ ] Inputs: sliderVal = -100, -99, -81, -80, 0, 80, 81, 99, 100
        [ ] Expected outputs: Curve in [-100, 100]; slope increases after |80|
        [ ] Exact assertions:
            [ ] abs(getCurvedValue(80)) < abs(getCurvedValue(81))
            [ ] getCurvedValue(100) === 100
            [ ] getCurvedValue(-100) === -100
            [ ] getCurvedValue(0) === 0

# 3. Color Tuning LUT Generation

[ ] 3.1 updateColorTuningLUT Activation
    # Scenario: hasActiveColorTuning false when all bands zero, true if any nonzero.
    [ ] Setup: State with color tuning bands zeroed
    [ ] Inputs: Set all bands to 0; set reds.sat = 10
    [ ] Expected outputs: state.hasActiveColorTuning toggles false -> true
    [ ] Exact assertions:
        [ ] Zeroed bands: state.hasActiveColorTuning === false
        [ ] One nonzero: state.hasActiveColorTuning === true

[ ] 3.2 Hue LUT Accumulation
    # Scenario: LUT entries accumulate hue/sat/vib/lum/shadows/highlights weights.
    [ ] Setup: Single band (reds) with known values; call updateColorTuningLUT
    [ ] Inputs: reds = { hue: 10, sat: 20, vib: 5, lum: -5, shadows: 15, highlights: -10 }
    [ ] Expected outputs: LUT values near red reflect weighted contributions
    [ ] Exact assertions:
        [ ] state.colorTuningLUT.hue[0] (center) equals expected sum
        [ ] state.colorTuningLUT.sat[0] matches expected for weight 1
        [ ] LUT channel values exist only within band width

[ ] 3.3 Luminance LUT Weighting
    # Scenario: Darks/mids/lights weighting and shadow/highlight exclusions.
    [ ] Setup: Set lumBand = 'darks' adjustments with shadows/highlights
    [ ] Inputs: darks: { lum: 10, shadows: 10, highlights: 10 }
    [ ] Expected outputs: Shadow/highlight contributions excluded for lum bands
    [ ] Exact assertions:
        [ ] state.colorTuningLUT.shadows[lumIndex] === 0 for lum bands
        [ ] state.colorTuningLUT.highlights[lumIndex] === 0 for lum bands

[ ] 3.4 Numeric Assertion with Controlled Config
    # Scenario: Single band with deterministic values for a known hue/lum.
    [ ] Setup: Reds band config; freeze LUT update
    [ ] Inputs: reds: { hue: 20, sat: 0, vib: 0, lum: 0, shadows: 0, highlights: 0 }; sample hue 0, lum index 128
    [ ] Expected outputs: Hue LUT adds known amount (weight * 20)
    [ ] Exact assertions:
        [ ] state.colorTuningLUT.hue[0] === 20
        [ ] state.colorTuningLUT.hue[10] < 20 (demonstrate falloff)

# 4. Master LUT (Levels + Gamma)

[ ] 4.1 updateMasterLUT Hashing
    # Scenario: No recomputation when unchanged.
    [ ] Setup: Spy on LUT creation or recompute steps
    [ ] Inputs: Call updateMasterLUT twice with same levels/gamma
    [ ] Expected outputs: Second call skipped
    [ ] Exact assertions: recomputeCount === 1

[ ] 4.2 Range <= 0.001 Behavior
    # Scenario: When white <= black, output becomes binary.
    [ ] Setup: black = 0.5, white = 0.5
    [ ] Inputs: Apply LUT to imageData mid-values
    [ ] Expected outputs: Values <= black map to 0, > black map to 255
    [ ] Exact assertions: LUT[0] === 0; LUT[255] === 255

[ ] 4.3 Clamping After Mid/Gamma
    # Scenario: Ensure values stay in [0,1] after adjustments.
    [ ] Setup: Extreme mid/gamma values
    [ ] Inputs: Values near 0 and 1
    [ ] Expected outputs: LUT entries clamp to [0, 255]
    [ ] Exact assertions: min(LUT) === 0; max(LUT) === 255

[ ] 4.4 applyMasterLUT(imageData)
    [ ] 4.4.1 Early Return
        # Scenario: Defaults active => no mutation.
        [ ] Setup: Default levels/gamma; imageData with known values
        [ ] Inputs: Apply applyMasterLUT
        [ ] Expected outputs: Data unchanged
        [ ] Exact assertions: data buffer before equals after
    [ ] 4.4.2 Exact Pixel Mapping
        # Scenario: Known LUT mapping.
        [ ] Setup: black=0.2, white=0.8, mid=1.0, gamma=1.0
        [ ] Inputs: Pixel values: 0, 51, 128, 204, 255
        [ ] Expected outputs: Map linearly into [0,255] after clamp
        [ ] Exact assertions: data[0] === 0; data[2] maps to approx mid
    [ ] 4.4.3 Alpha Unchanged
        # Scenario: Alpha channel passes through.
        [ ] Setup: imageData with alpha 10, 200, 255
        [ ] Inputs: Apply applyMasterLUT
        [ ] Expected outputs: Alpha unchanged
        [ ] Exact assertions: data[3] equals original alpha

# 5. Color Operations (applyColorOps)

[ ] 5.1 Early Return When All Zero
    # Scenario: No adjustments applied when all knobs zero.
    [ ] Setup: All adjustment values = 0
    [ ] Inputs: 1x1 pixel buffer, arbitrary RGB
    [ ] Expected outputs: No changes to RGB or Alpha
    [ ] Exact assertions: data before equals after

[ ] 5.2 Shadows/Highlights Weighting
    # Scenario: Shadows affect darks more; highlights affect lights more.
    [ ] Setup: shadows = +50, highlights = +50
    [ ] Inputs: Pixel A (10,10,10); Pixel B (245,245,245)
    [ ] Expected outputs: Pixel A increases more from shadows; Pixel B from highlights
    [ ] Exact assertions:
        [ ] deltaA > deltaB (shadows on dark)
        [ ] deltaB > deltaA (highlights on light)
        [ ] Verify formula uses lum^2 and (1-lum)^2

[ ] 5.3 Saturation
    # Scenario: Saturation changes do not affect grayscale; non-grayscale adjusts.
    [ ] Setup: saturation = +50 then -50
    [ ] Inputs: Gray pixel (128,128,128); colored pixel (128,64,32)
    [ ] Expected outputs: Gray unchanged; colored pixel chroma adjusts
    [ ] Exact assertions:
        [ ] Gray RGB stays 128
        [ ] Colored channel spread increases for +50, decreases for -50

[ ] 5.4 Vibrance
    # Scenario: Stronger effect at low saturation.
    [ ] Setup: vibrance = +50
    [ ] Inputs: Low-sat (128,120,110); high-sat (200,50,50)
    [ ] Expected outputs: Low-sat pixel changes more
    [ ] Exact assertions: deltaLow > deltaHigh for saturation distance

[ ] 5.5 White Balance
    # Scenario: Lum-preserving scale and channel scaling/clamping.
    [ ] Setup: whiteBalance = +20 then -20
    [ ] Inputs: Pixels (100,150,200) and (10,10,10)
    [ ] Expected outputs: Scale applied; lum preserved; clamped to 0..255
    [ ] Exact assertions:
        [ ] Luminance before approx equals after
        [ ] Channels in [0, 255]

[ ] 5.6 Color Balance
    # Scenario: Curved values and lum-preserving scale with clamp.
    [ ] Setup: Non-zero RGB colorBalance
    [ ] Inputs: Pixel (120,140,160)
    [ ] Expected outputs: Curved values applied; lum preserved
    [ ] Exact assertions:
        [ ] Luminance before approx equals after
        [ ] Channels in [0, 255]

[ ] 5.7 Alpha Unchanged
    # Scenario: Alpha channel is untouched.
    [ ] Setup: Non-zero adjustments
    [ ] Inputs: Alpha values 0, 128, 255
    [ ] Expected outputs: Alpha unchanged
    [ ] Exact assertions: data[i+3] matches original

# 6. Selective Color Application (applySelectiveColor)

[ ] 6.1 No-Op When Inactive
    # Scenario: hasActiveColorTuning false => no change.
    [ ] Setup: state.hasActiveColorTuning = false
    [ ] Inputs: 1x1 buffer
    [ ] Expected outputs: No mutation
    [ ] Exact assertions: data before equals after

[ ] 6.2 Single Pixel Adjustment
    # Scenario: Known hue/sat/lum adjustments applied.
    [ ] Setup: Reds band active: hue=20, sat=10, lum=-10
    [ ] Inputs: Pixel (255,0,0)
    [ ] Expected outputs: RGB adjusted by HSL changes
    [ ] Exact assertions:
        [ ] Hue shift: G increases
        [ ] Saturation adjusted
        [ ] Luminance decreases
        [ ] Tolerance +/- 1

[ ] 6.3 Hue Wrap and Clamp
    # Scenario: Hue wrap and sat/lum clamping boundaries.
    [ ] Setup: LUT yields hue shift +30, -40
    [ ] Inputs: Pixel hue 350 (+30 -> 20 wrap); large negative sat/lum adj
    [ ] Expected outputs: Hue wraps 0..360; sat/lum clamp to [0,1]
    [ ] Exact assertions:
        [ ] Hue used in conversion within [0, 360)
        [ ] Sat/Lum in [0, 1]

[ ] 6.4 Shadow/Highlight Impact
    # Scenario: Shadow/highlight adjustments affect luminance as designed.
    [ ] Setup: Tuning active: shadows=20, highlights=-20
    [ ] Inputs: Dark (10,10,10); light (245,245,245)
    [ ] Expected outputs: Dark brightens; light darkens
    [ ] Exact assertions:
        [ ] lumDarkAfter > lumDarkBefore
        [ ] lumLightAfter < lumLightBefore

[ ] 6.5 LUT Indexing
    # Scenario: Hue uses rounded index and lum uses floor index.
    [ ] Setup: Create LUT arrays with sentinel values
    [ ] Inputs: Pixel hue 10.6 (index 11); lum 0.49 (index 124)
    [ ] Expected outputs: Sentinel values used
    [ ] Exact assertions:
        [ ] Adjustment equals sentinel at rounded hue index
        [ ] Adjustment equals sentinel at floored lum index

# 7. Preview Pipeline

[ ] 7.1 updateAdjustmentPreview() Throttling
    # Scenario: Calls within 100ms are ignored.
    [ ] Setup: Stub Date.now() (0, 50, 120); state.adjustmentsVisible = true
    [ ] Inputs: Call updateAdjustmentPreview() 3 times
    [ ] Expected outputs: 1st and 3rd calls render; 2nd skipped
    [ ] Exact assertions: renderToContext called exactly 2 times

[ ] 7.2 Full-Resolution vs Downscaled Preview
    # Scenario: Use full resolution when preference is 'Full'.
    [ ] Setup: state.adjustmentPreviewResolution = 'Full' then 1080
    [ ] Inputs: Call updateAdjustmentPreview()
    [ ] Expected outputs: Full mode uses main canvas; numeric uses scaled buffer
    [ ] Exact assertions:
        [ ] Preview dims equal main canvas when 'Full'
        [ ] Preview dims equal scaled values when numeric

[ ] 7.3 Visibility Toggles
    # Scenario: Switch between main and preview canvas.
    [ ] Setup: state.adjustmentsVisible = true
    [ ] Inputs: Call updateAdjustmentPreview()
    [ ] Expected outputs: mainCanvas hidden; previewCanvas shown
    [ ] Exact assertions:
        [ ] mainCanvas.style.display === 'none'
        [ ] previewCanvas.style.display === 'block'

[ ] 7.4 Respect adjustmentsVisible
    # Scenario: No preview render when adjustments hidden.
    [ ] Setup: state.adjustmentsVisible = false
    [ ] Inputs: Call updateAdjustmentPreview()
    [ ] Expected outputs: No render; No canvas toggle
    [ ] Exact assertions:
        [ ] renderToContext NOT called
        [ ] mainCanvas.style.display unchanged

[ ] 7.5 Canvas Resizing & Scale
    # Scenario: Preview buffer sizes and scale calculation are correct.
    [ ] Setup: Image 4000x2000; previewResolution 1080
    [ ] Inputs: Call updateAdjustmentPreview()
    [ ] Expected outputs: Buffer respects aspect ratio; correct scale factor
    [ ] Exact assertions:
        [ ] previewWidth 2160, previewHeight 1080 (2:1 aspect)
        [ ] scale === previewHeight / fullHeight

# 8. Reset & UI Wiring

[ ] 8.1 resetAllAdjustments()
    # Scenario: Full reset restores defaults and triggers updates.
    [ ] Setup: Modify state values; spy on UI/system update functions
    [ ] Inputs: Call resetAllAdjustments()
    [ ] Expected outputs: State defaults restored; all UI synced
    [ ] Exact assertions:
        [ ] Each adj value equals default
        [ ] updateSlider called for every control id
        [ ] refreshTuningSliders called once
        [ ] updateColorTuningLUT called once
        [ ] updateWorkingCopies called once

[ ] 8.2 updateSlider(id, val)
    # Scenario: Value and label formatting by slider type.
    [ ] Setup: Provide slider/label; define formatting rules
    [ ] Inputs: id 'adj-temperature' (K); 'adj-gamma' (float); 'adj-contrast' (int); missing label
    [ ] Expected outputs: Slider value set; text formatted; warning on missing label
    [ ] Exact assertions:
        [ ] slider.value === val
        [ ] label.textContent matches format (e.g., '6500K', '1.20')
        [ ] console.warn called if label missing

[ ] 8.3 initAdjustments() Event Wiring
    [ ] Scenario: Pointerdown/focus capture start value
        [ ] Setup: Sliders with capturing handlers
        [ ] Inputs: Trigger pointerdown/focus
        [ ] Expected outputs: Internal startValue equals slider value
    [ ] Scenario: input updates state and preview
        [ ] Setup: state.adjustmentsVisible = true
        [ ] Inputs: Trigger input event
        [ ] Expected outputs: State/Label/isAdjusting updated; preview called
        [ ] Exact assertions: state field updated; label updated; updateAdjustmentPreview called
    [ ] Scenario: change dispatches action and commit flags
        [ ] Setup: window.dispatchAction stub
        [ ] Inputs: Trigger change event
        [ ] Expected outputs: Dispatch includes old/new; pending commit toggled
        [ ] Exact assertions: dispatchAction called with type: 'adjustment-change', payload: {oldValue, newValue}

[ ] 8.4 Reset Buttons
    [ ] Scenario: Adjustments reset button restores defaults
        # Setup: Non-default state; button element.
        [ ] Inputs: Click adj-reset
        [ ] Expected outputs: State reset; preview update; dispatchAction called
        [ ] Exact assertions: state.adjustments matches defaults; dispatchAction 'adjustment-reset'
    [ ] Scenario: Color tuning band reset
        # Setup: Select non-zero band.
        [ ] Inputs: Click reset-band
        [ ] Expected outputs: Selected band zeroed; preview updated
        [ ] Exact assertions: state.colorTuning[band] all 0; dispatchAction 'color-tuning-band-reset'
    [ ] Scenario: Color tuning reset-all
        # Setup: Multiple bands non-zero.
        [ ] Inputs: Click reset-all
        [ ] Expected outputs: All bands zeroed
        [ ] Exact assertions: Every band value is 0; dispatchAction 'color-tuning-reset'

[ ] 8.5 Error/Warning Paths
    # Scenario: Missing slider element logs error.
    [ ] Setup: Remove known slider id from registry
    [ ] Inputs: Call initAdjustments()
    [ ] Expected outputs: Warning logged; init continues
    [ ] Exact assertions: console.error called with missing id; other sliders initialized

[ ] 8.6 Tuning UI Synchronization
    [ ] Scenario: updateTuningSliderUI disables shadow/highlight for lum bands
        # Setup: Active band = 'darks'/'mids'/'lights'.
        [ ] Inputs: Call updateTuningSliderUI()
        [ ] Expected outputs: sliders disabled
        [ ] Exact assertions: shadowSlider.disabled === true; highlightSlider.disabled === true
    [ ] Scenario: Active band class toggle
        # Setup: Band buttons with classList methods.
        [ ] Inputs: Switch active band (reds -> greens)
        [ ] Expected outputs: Only active band has active class
        [ ] Exact assertions: redsButton inactive; greensButton active
    [ ] Scenario: refreshTuningSliders and refreshColorTuningUI sync values
        # Setup: Change tuning state values.
        [ ] Inputs: Call refresh methods
        [ ] Expected outputs: Sliders/labels reflect state
        [ ] Exact assertions: Each tuning slider value equals state; labels match format
    [ ] Scenario: updateAllAdjustmentUI syncs full set
        # Setup: Alter all adjustment state.
        [ ] Inputs: Call updateAllAdjustmentUI()
        [ ] Expected outputs: All elements match state
        [ ] Exact assertions: Every slider value equals state.adjustments fields

# 9. Integration Expectations

[ ] 9.1 Handler Setters
    # Scenario: setSaveSnapshotHandler and setUpdateWorkingCopiesHandler accept functions only.
    [ ] Setup: Create system via createAdjustmentSystem
    [ ] Inputs: Pass valid function; then invalid (null)
    [ ] Expected outputs: Valid stored; invalid ignored/warned
    [ ] Exact assertions:
        [ ] typeof system.setSaveSnapshotHandler === 'function'
        [ ] Invoking internal handler calls provided function
        [ ] Invalid input logs warning/does not override

[ ] 9.2 API Object Surface
    # Scenario: Returned API has all expected functions and can be called without side effects.
    [ ] Setup: Create system with minimal state/els/ctx
    [ ] Inputs: Call each API method with safe defaults
    [ ] Expected outputs: Methods exist; do not throw
    [ ] Exact assertions:
        [ ] typeof system.updateAdjustmentPreview === 'function'
        [ ] Verify system.updateAdjustmentPreview() does not throw
        [ ] Verify initAdjustments, initColorTuning, resetAllAdjustments exist and are callable

