# Adjustments Unit-Test Blueprint (scripts/adjustments.js)

# 1. Overview & Test Harness Assumptions

[x] 1.1 Minimal Harness/Fixture Shape
    # Scenario: Baseline fixture to initialize createAdjustmentSystem and expose OkazuTestables.
    [x] 1.1.1 Setup: Initialize createAdjustmentSystem(state, els, ctx, renderToContext, render, scheduleHeavyTask)
        [x] Provide smallest functional state
        [x] Provide els and supporting callbacks
        [x] Mock ctx as minimal CanvasRenderingContext2D (getImageData, putImageData, drawImage, clearRect)
        [x] Ensure returned API and window.OkazuTestables.adjustments are available
    [x] 1.1.2 Inputs: Define state, els, and render doubles
        [x] state: adjustment defaults (levels, gamma, color tuning arrays, toggles, flags for adjustment preview, etc.)
        [x] els: references to every slider/button element used by initAdjustments() and initColorTuning()
        [x] test doubles: renderToContext, render, scheduleHeavyTask
    [x] 1.1.3 Expected outputs and state changes:
        # System initializes without throwing and registers handlers.
        # window.OkazuTestables.adjustments exposes testable helpers.
    [x] 1.1.4 Exact assertions:
        [x] typeof createAdjustmentSystem === 'function'
        [x] typeof system.initAdjustments === 'function'
        [x] typeof window.OkazuTestables.adjustments.getBandWeight === 'function'
        [x] Verify render, renderToContext, scheduleHeavyTask are called only as specified by individual tests

[x] 1.2 DOM Mocking Strategy
    # Scenario: Mock document.getElementById, document.querySelectorAll, and DOM elements with event listeners.
    [x] 1.2.1 Setup: Replace document methods with stubs
        [x] document.getElementById returns a map of fake elements by id
        [x] document.querySelectorAll returns arrays of sliders for tuning bands
        [x] Fake elements include: value, textContent, classList, disabled, addEventListener, dispatchEvent
    [x] 1.2.2 Inputs: Define element registry
        [x] Keyed by id: adj-gamma, adj-saturation, colorBandButtons, etc.
    [x] 1.2.3 Expected outputs and state changes:
        # initAdjustments() and initColorTuning() attach listeners without errors.
    [x] 1.2.4 Exact assertions:
        [x] For each element, addEventListener called with 'input', 'change', 'pointerdown', 'focus'
        [x] Missing element paths trigger warning/error logs

[x] 1.3 Canvas & ImageData Mocking Strategy
    # Scenario: Provide ImageData and CanvasRenderingContext2D substitutes for LUT and pixel operations.
    [x] 1.3.1 Setup: Create data shims
        [x] Create ImageData shim: { width, height, data: Uint8ClampedArray }
        [x] Create CanvasRenderingContext2D stub with getImageData (controlled buffer) and putImageData (captures output)
    [x] 1.3.2 Inputs: Identify buffers
        [x] Use 1x1, 2x2 buffers for exact numeric assertions
    [x] 1.3.3 Expected outputs and state changes:
        # Color operations mutate ImageData.data in place.
    [x] 1.3.4 Exact assertions:
        [x] imageData.data values match expected post-adjustment values

[x] 1.4 Mocking window.dispatchAction
    # Scenario: Capture dispatched actions from UI changes.
    [x] 1.4.1 Setup: Stub window.dispatchAction
        [x] Use jest.fn() or equivalent
    [x] 1.4.2 Inputs: Trigger UI events
        [x] Change events on sliders, reset buttons
    [x] 1.4.3 Expected outputs and state changes:
        # Actions include type, payload.oldValue, payload.newValue.
    [x] 1.4.4 Exact assertions:
        [x] dispatchAction called with type: 'adjustment-change', 'adjustment-reset', 'color-tuning-reset'
        [x] payload.oldValue matches value captured on pointerdown/focus

[x] 1.5 Deterministic Time Control
    # Scenario: Throttle logic in updateAdjustmentPreview() is time-based.
    [x] 1.5.1 Setup: Stub Date.now()
        [x] Return deterministic timestamps
    [x] 1.5.2 Inputs: Sequence of calls
        [x] Call 1: Time T
        [x] Call 2: Time T + <100ms
        [x] Call 3: Time T + >=100ms
    [x] 1.5.3 Expected outputs and state changes:
        # Throttled calls skip render; later call proceeds.
    [x] 1.5.4 Exact assertions:
        [x] renderToContext NOT called on throttled invocation
        [x] renderToContext called on allowed invocation

[x] 1.6 Console/Logger Safety
    # Scenario: Missing elements or invalid calls log warnings/errors without breaking tests.
    [x] 1.6.1 Setup: Stub logging methods
        [x] stub console.warn, console.error, Logger.warn, Logger.error
    [x] 1.6.2 Inputs: Trigger error path
        [x] Remove specific slider elements from the registry
    [x] 1.6.3 Expected outputs and state changes:
        # Error paths exercised without throwing.
    [x] 1.6.4 Exact assertions:
        [x] console.warn called with message containing missing id
        [x] Test continues without uncaught exception

# 2. Pure Helper Functions (OkazuTestables.adjustments)

[x] 2.1 getBandWeight(hue, centerHue)
    [x] 2.1.1 Width Selection
        # Scenario: Width is 25 for centerHue 30/60, else 45.
        [x] Setup: Access getBandWeight from window.OkazuTestables.adjustments
        [x] Inputs: centerHue = 30; centerHue = 60; centerHue = 120 (non-30/60)
        [x] Expected outputs: band width is 25 for 30/60; 45 otherwise
        [x] Exact assertions:
            [x] At diff = width, output is exactly 0
            [x] At diff = width - 1e-6, output > 0 for both width types
    [x] 2.1.2 Exact-Value Assertions at Key Diffs
        # Scenario: Verify cubic smoothstep shape and zeroing.
        [x] Setup: centerHue = 120 (width 45)
        [x] Inputs: hue = 120 (diff 0); hue = 165 (diff width); hue = 165.000001 (diff width+e); hue = 164.999 (diff width-e)
        [x] Expected outputs: weight 1 at center, 0 at boundary
        [x] Exact assertions:
            [x] getBandWeight(centerHue, centerHue) === 1
            [x] getBandWeight(centerHue + 45, centerHue) === 0
            [x] getBandWeight(centerHue + 45 + 1e-6, centerHue) === 0
            [x] getBandWeight(centerHue + 44.999, centerHue) > 0
    [x] 2.1.3 Wraparound Behavior (>180)
        # Scenario: Diff uses wraparound (e.g., hue 350 vs center 10).
        [x] Setup: centerHue = 10
        [x] Inputs: hue = 350 (equivalent to diff 20)
        [x] Expected outputs: Weight equals value for diff=20
        [x] Exact assertions:
            [x] getBandWeight(350, 10) === getBandWeight(30, 10)
    [x] 2.1.4 Monotonic Falloff and Symmetry
        # Scenario: Weights decrease as diff increases; symmetric about center.
        [x] Setup: centerHue = 200
        [x] Inputs: Diffs 0, 10, 20, 30, 40; Compare hue = centerHue + d vs hue = centerHue - d
        [x] Expected outputs: Weight monotonic non-increasing; symmetric for +/- diff
        [x] Exact assertions:
            [x] w0 >= w10 >= w20 >= w30 >= w40
            [x] getBandWeight(center+20, center) === getBandWeight(center-20, center)

[x] 2.2 getLuminanceWeight(lum, band)
    [x] 2.2.1 Boundary Checks
        # Scenario: Confirm outputs at 0, 0.5, 1.0 and near boundaries.
        [x] Setup: band = 'darks', 'mids', 'lights'
        [x] Inputs: lum = 0, 0.5, 1.0, 0.5 - 1e-6
        [x] Expected outputs: Return 0 outside range
        [x] Exact assertions:
            [x] getLuminanceWeight(1.0, 'darks') === 0
            [x] getLuminanceWeight(0, 'lights') === 0
            [x] getLuminanceWeight(0.5, 'mids') equals peak (see 2.2.2)
            [x] getLuminanceWeight(0.5 - 1e-6, 'lights') === 0
    [x] 2.2.2 Peak Values
        # Scenario: Max weight at expected centers.
        [x] Setup: Define band centers as per implementation
        [x] Inputs: lum = center for darks/mids/lights
        [x] Expected outputs: Weight is 1 at band center
        [x] Exact assertions:
            [x] getLuminanceWeight(centerDarks, 'darks') === 1
            [x] getLuminanceWeight(centerMids, 'mids') === 1
            [x] getLuminanceWeight(centerLights, 'lights') === 1

[x] 2.3 rgbToHsl and hslToRgb
    [x] 2.3.1 Round-Trip Fidelity
        # Scenario: Converting RGB -> HSL -> RGB yields original values.
        [x] Setup: Access helpers from OkazuTestables.adjustments
        [x] Inputs:
            [x] Primaries: (255,0,0), (0,255,0), (0,0,255)
            [x] Secondaries: (255,255,0), (0,255,255), (255,0,255)
            [x] Grayscale: (0,0,0), (128,128,128), (255,255,255)
            [x] Random: (12, 200, 77), (150, 10, 220)
        [x] Expected outputs: Round-trip RGB values equal original (+/- 1)
        [x] Exact assertions: abs(r2 - r) <= 1, same for g/b
    [x] 2.3.2 Hue Edge Cases
        # Scenario: Hue values for pure colors are correct.
        [x] Setup: Convert RGB to HSL
        [x] Inputs: Red (255,0,0), Green (0,255,0), Blue (0,0,255)
        [x] Expected outputs: Hue approx 0, 120, 240
        [x] Exact assertions:
            [x] abs(h - 0) <= 0.5 (red)
            [x] abs(h - 120) <= 0.5 (green)
            [x] abs(h - 240) <= 0.5 (blue)
    [x] 2.3.3 Saturation/Lightness Boundaries
        # Scenario: Check grayscale outputs and extremes.
        [x] Setup: Convert HSL to RGB
        [x] Inputs: s=0 with various h/l; l=0 and l=1 with arbitrary h/s
        [x] Expected outputs: s=0 is grayscale; l=0 is black; l=1 is white
        [x] Exact assertions:
            [x] hslToRgb(h, 0, l) yields r=g=b
            [x] hslToRgb(h, s, 0) yields r=g=b=0
            [x] hslToRgb(h, s, 1) yields r=g=b=255

[x] 2.4 getCurvedValue(sliderVal)
    [x] 2.4.1 Threshold Behavior
        # Scenario: Validate slope change around |val|=80 and clamps at +/- 100.
        [x] Setup: Access helper
        [x] Inputs: sliderVal = -100, -99, -81, -80, 0, 80, 81, 99, 100
        [x] Expected outputs: Curve in [-100, 100]; slope increases after |80|
        [x] Exact assertions:
            [x] abs(getCurvedValue(80)) < abs(getCurvedValue(81))
            [x] getCurvedValue(100) === 100
            [x] getCurvedValue(-100) === -100
            [x] getCurvedValue(0) === 0

# 3. Color Tuning LUT Generation

[x] 3.1 updateColorTuningLUT Activation
    # Scenario: hasActiveColorTuning false when all bands zero, true if any nonzero.
    [x] Setup: State with color tuning bands zeroed
    [x] Inputs: Set all bands to 0; set reds.sat = 10
    [x] Expected outputs: state.hasActiveColorTuning toggles false -> true
    [x] Exact assertions:
        [x] Zeroed bands: state.hasActiveColorTuning === false
        [x] One nonzero: state.hasActiveColorTuning === true

[x] 3.2 Hue LUT Accumulation
    # Scenario: LUT entries accumulate hue/sat/vib/lum/shadows/highlights weights.
    [x] Setup: Single band (reds) with known values; call updateColorTuningLUT
    [x] Inputs: reds = { hue: 10, sat: 20, vib: 5, lum: -5, shadows: 15, highlights: -10 }
    [x] Expected outputs: LUT values near red reflect weighted contributions
    [x] Exact assertions:
        [x] state.colorTuningLUT.hue[0] (center) equals expected sum
        [x] state.colorTuningLUT.sat[0] matches expected for weight 1
        [x] LUT channel values exist only within band width

[x] 3.3 Luminance LUT Weighting
    # Scenario: Darks/mids/lights weighting and shadow/highlight exclusions.
    [x] Setup: Set lumBand = 'darks' adjustments with shadows/highlights
    [x] Inputs: darks: { lum: 10, shadows: 10, highlights: 10 }
    [x] Expected outputs: Shadow/highlight contributions excluded for lum bands
    [x] Exact assertions:
        [x] state.colorTuningLUT.shadows[lumIndex] === 0 for lum bands
        [x] state.colorTuningLUT.highlights[lumIndex] === 0 for lum bands

[x] 3.4 Numeric Assertion with Controlled Config
    # Scenario: Single band with deterministic values for a known hue/lum.
    [x] Setup: Reds band config; freeze LUT update
    [x] Inputs: reds: { hue: 20, sat: 0, vib: 0, lum: 0, shadows: 0, highlights: 0 }; sample hue 0, lum index 128
    [x] Expected outputs: Hue LUT adds known amount (weight * 20)
    [x] Exact assertions:
        [x] state.colorTuningLUT.hue[0] === 20
        [x] state.colorTuningLUT.hue[10] < 20 (demonstrate falloff)

# 4. Master LUT (Levels + Gamma)

[x] 4.1 updateMasterLUT Hashing
    # Scenario: No recomputation when unchanged.
    [x] Setup: Spy on LUT creation or recompute steps
    [x] Inputs: Call updateMasterLUT twice with same levels/gamma
    [x] Expected outputs: Second call skipped
    [x] Exact assertions: recomputeCount === 1

[x] 4.2 Range <= 0.001 Behavior
    # Scenario: When white <= black, output becomes binary.
    [x] Setup: black = 0.5, white = 0.5
    [x] Inputs: Apply LUT to imageData mid-values
    [x] Expected outputs: Values <= black map to 0, > black map to 255
    [x] Exact assertions: LUT[0] === 0; LUT[255] === 255

[x] 4.3 Clamping After Mid/Gamma
    # Scenario: Ensure values stay in [0,1] after adjustments.
    [x] Setup: Extreme mid/gamma values
    [x] Inputs: Values near 0 and 1
    [x] Expected outputs: LUT entries clamp to [0, 255]
    [x] Exact assertions: min(LUT) === 0; max(LUT) === 255

[x] 4.4 applyMasterLUT(imageData)
    [x] 4.4.1 Early Return
        # Scenario: Defaults active => no mutation.
        [x] Setup: Default levels/gamma; imageData with known values
        [x] Inputs: Apply applyMasterLUT
        [x] Expected outputs: Data unchanged
        [x] Exact assertions: data buffer before equals after
    [x] 4.4.2 Exact Pixel Mapping
        # Scenario: Known LUT mapping.
        [x] Setup: black=0.2, white=0.8, mid=1.0, gamma=1.0
        [x] Inputs: Pixel values: 0, 51, 128, 204, 255
        [x] Expected outputs: Map linearly into [0,255] after clamp
        [x] Exact assertions: data[0] === 0; data[2] maps to approx mid
    [x] 4.4.3 Alpha Unchanged
        # Scenario: Alpha channel passes through.
        [x] Setup: imageData with alpha 10, 200, 255
        [x] Inputs: Apply applyMasterLUT
        [x] Expected outputs: Alpha unchanged
        [x] Exact assertions: data[3] equals original alpha

# 5. Color Operations (applyColorOps)

[x] 5.1 Early Return When All Zero
    # Scenario: No adjustments applied when all knobs zero.
    [x] Setup: All adjustment values = 0
    [x] Inputs: 1x1 pixel buffer, arbitrary RGB
    [x] Expected outputs: No changes to RGB or Alpha
    [x] Exact assertions: data before equals after

[x] 5.2 Shadows/Highlights Weighting
    # Scenario: Shadows affect darks more; highlights affect lights more.
    [x] Setup: shadows = +50, highlights = +50
    [x] Inputs: Pixel A (10,10,10); Pixel B (245,245,245)
    [x] Expected outputs: Pixel A increases more from shadows; Pixel B from highlights
    [x] Exact assertions:
        [x] deltaA > deltaB (shadows on dark)
        [x] deltaB > deltaA (highlights on light)
        [x] Verify formula uses lum^2 and (1-lum)^2

[x] 5.3 Saturation
    # Scenario: Saturation changes do not affect grayscale; non-grayscale adjusts.
    [x] Setup: saturation = +50 then -50
    [x] Inputs: Gray pixel (128,128,128); colored pixel (128,64,32)
    [x] Expected outputs: Gray unchanged; colored pixel chroma adjusts
    [x] Exact assertions:
        [x] Gray RGB stays 128
        [x] Colored channel spread increases for +50, decreases for -50

[x] 5.4 Vibrance
    # Scenario: Stronger effect at low saturation.
    [x] Setup: vibrance = +50
    [x] Inputs: Low-sat (128,120,110); high-sat (200,50,50)
    [x] Expected outputs: Low-sat pixel changes more
    [x] Exact assertions: deltaLow > deltaHigh for saturation distance

[x] 5.5 White Balance
    # Scenario: Lum-preserving scale and channel scaling/clamping.
    [x] Setup: whiteBalance = +20 then -20
    [x] Inputs: Pixels (100,150,200) and (10,10,10)
    [x] Expected outputs: Scale applied; lum preserved; clamped to 0..255
    [x] Exact assertions:
        [x] Luminance before approx equals after
        [x] Channels in [0, 255]

[x] 5.6 Color Balance
    # Scenario: Curved values and lum-preserving scale with clamp.
    [x] Setup: Non-zero RGB colorBalance
    [x] Inputs: Pixel (120,140,160)
    [x] Expected outputs: Curved values applied; lum preserved
    [x] Exact assertions:
        [x] Luminance before approx equals after
        [x] Channels in [0, 255]

[x] 5.7 Alpha Unchanged
    # Scenario: Alpha channel is untouched.
    [x] Setup: Non-zero adjustments
    [x] Inputs: Alpha values 0, 128, 255
    [x] Expected outputs: Alpha unchanged
    [x] Exact assertions: data[i+3] matches original

# 6. Selective Color Application (applySelectiveColor)

[x] 6.1 No-Op When Inactive
    # Scenario: hasActiveColorTuning false => no change.
    [x] Setup: state.hasActiveColorTuning = false
    [x] Inputs: 1x1 buffer
    [x] Expected outputs: No mutation
    [x] Exact assertions: data before equals after

[x] 6.2 Single Pixel Adjustment
    # Scenario: Known hue/sat/lum adjustments applied.
    [x] Setup: Reds band active: hue=20, sat=10, lum=-10
    [x] Inputs: Pixel (255,0,0)
    [x] Expected outputs: RGB adjusted by HSL changes
    [x] Exact assertions:
        [x] Hue shift: G increases
        [x] Saturation adjusted
        [x] Luminance decreases
        [x] Tolerance +/- 1

[x] 6.3 Hue Wrap and Clamp
    # Scenario: Hue wrap and sat/lum clamping boundaries.
    [x] Setup: LUT yields hue shift +30, -40
    [x] Inputs: Pixel hue 350 (+30 -> 20 wrap); large negative sat/lum adj
    [x] Expected outputs: Hue wraps 0..360; sat/lum clamp to [0,1]
    [x] Exact assertions:
        [x] Hue used in conversion within [0, 360)
        [x] Sat/Lum in [0, 1]

[x] 6.4 Shadow/Highlight Impact
    # Scenario: Shadow/highlight adjustments affect luminance as designed.
    [x] Setup: Tuning active: shadows=20, highlights=-20
    [x] Inputs: Dark (10,10,10); light (245,245,245)
    [x] Expected outputs: Dark brightens; light darkens
    [x] Exact assertions:
        [x] lumDarkAfter > lumDarkBefore
        [x] lumLightAfter < lumLightBefore

[x] 6.5 LUT Indexing
    # Scenario: Hue uses rounded index and lum uses floor index.
    [x] Setup: Create LUT arrays with sentinel values
    [x] Inputs: Pixel hue 10.6 (index 11); lum 0.49 (index 124)
    [x] Expected outputs: Sentinel values used
    [x] Exact assertions:
        [x] Adjustment equals sentinel at rounded hue index
        [x] Adjustment equals sentinel at floored lum index

# 7. Preview Pipeline

[x] 7.1 updateAdjustmentPreview() Throttling
    # Scenario: Calls within 100ms are ignored.
    [x] Setup: Stub Date.now() (0, 50, 120); state.adjustmentsVisible = true
    [x] Inputs: Call updateAdjustmentPreview() 3 times
    [x] Expected outputs: 1st and 3rd calls render; 2nd skipped
    [x] Exact assertions: renderToContext called exactly 2 times

[x] 7.2 Full-Resolution vs Downscaled Preview
    # Scenario: Use full resolution when preference is 'Full'.
    [x] Setup: state.adjustmentPreviewResolution = 'Full' then 1080
    [x] Inputs: Call updateAdjustmentPreview()
    [x] Expected outputs: Full mode uses main canvas; numeric uses scaled buffer
    [x] Exact assertions:
        [x] Preview dims equal main canvas when 'Full'
        [x] Preview dims equal scaled values when numeric

[x] 7.3 Visibility Toggles
    # Scenario: Switch between main and preview canvas.
    [x] Setup: state.adjustmentsVisible = true
    [x] Inputs: Call updateAdjustmentPreview()
    [x] Expected outputs: mainCanvas hidden; previewCanvas shown
    [x] Exact assertions:
        [x] mainCanvas.style.display === 'none'
        [x] previewCanvas.style.display === 'block'

[x] 7.4 Respect adjustmentsVisible
    # Scenario: No preview render when adjustments hidden.
    [x] Setup: state.adjustmentsVisible = false
    [x] Inputs: Call updateAdjustmentPreview()
    [x] Expected outputs: No render; No canvas toggle
    [x] Exact assertions:
        [x] renderToContext NOT called
        [x] mainCanvas.style.display unchanged

[x] 7.5 Canvas Resizing & Scale
    # Scenario: Preview buffer sizes and scale calculation are correct.
    [x] Setup: Image 4000x2000; previewResolution 1080
    [x] Inputs: Call updateAdjustmentPreview()
    [x] Expected outputs: Buffer respects aspect ratio; correct scale factor
    [x] Exact assertions:
        [x] previewWidth 2160, previewHeight 1080 (2:1 aspect)
        [x] scale === previewHeight / fullHeight

# 8. Reset & UI Wiring

[x] 8.1 resetAllAdjustments()
    # Scenario: Full reset restores defaults and triggers updates.
    [x] Setup: Modify state values; spy on UI/system update functions
    [x] Inputs: Call resetAllAdjustments()
    [x] Expected outputs: State defaults restored; all UI synced
    [x] Exact assertions:
        [x] Each adj value equals default
        [x] updateSlider called for every control id
        [x] refreshTuningSliders called once
        [x] updateColorTuningLUT called once
        [x] updateWorkingCopies called once

[x] 8.2 updateSlider(id, val)
    # Scenario: Value and label formatting by slider type.
    [x] Setup: Provide slider/label; define formatting rules
    [x] Inputs: id 'adj-temperature' (K); 'adj-gamma' (float); 'adj-contrast' (int); missing label
    [x] Expected outputs: Slider value set; text formatted; warning on missing label
    [x] Exact assertions:
        [x] slider.value === val
        [x] label.textContent matches format (e.g., '6500K', '1.20')
        [x] console.warn called if label missing

[x] 8.3 initAdjustments() Event Wiring
    [x] Scenario: Pointerdown/focus capture start value
        [x] Setup: Sliders with capturing handlers
        [x] Inputs: Trigger pointerdown/focus
        [x] Expected outputs: Internal startValue equals slider value
    [x] Scenario: input updates state and preview
        [x] Setup: state.adjustmentsVisible = true
        [x] Inputs: Trigger input event
        [x] Expected outputs: State/Label/isAdjusting updated; preview called
        [x] Exact assertions: state field updated; label updated; updateAdjustmentPreview called
    [x] Scenario: change dispatches action and commit flags
        [x] Setup: window.dispatchAction stub
        [x] Inputs: Trigger change event
        [x] Expected outputs: Dispatch includes old/new; pending commit toggled
        [x] Exact assertions: dispatchAction called with type: 'adjustment-change', payload: {oldValue, newValue}

[x] 8.4 Reset Buttons
    [x] Scenario: Adjustments reset button restores defaults
        # Setup: Non-default state; button element.
        [x] Inputs: Click adj-reset
        [x] Expected outputs: State reset; preview update; dispatchAction called
        [x] Exact assertions: state.adjustments matches defaults; dispatchAction 'adjustment-reset'
    [x] Scenario: Color tuning band reset
        # Setup: Select non-zero band.
        [x] Inputs: Click reset-band
        [x] Expected outputs: Selected band zeroed; preview updated
        [x] Exact assertions: state.colorTuning[band] all 0; dispatchAction 'color-tuning-band-reset'
    [x] Scenario: Color tuning reset-all
        # Setup: Multiple bands non-zero.
        [x] Inputs: Click reset-all
        [x] Expected outputs: All bands zeroed
        [x] Exact assertions: Every band value is 0; dispatchAction 'color-tuning-reset'

[x] 8.5 Error/Warning Paths
    # Scenario: Missing slider element logs error.
    [x] Setup: Remove known slider id from registry
    [x] Inputs: Call initAdjustments()
    [x] Expected outputs: Warning logged; init continues
    [x] Exact assertions: console.error called with missing id; other sliders initialized

[x] 8.6 Tuning UI Synchronization
    [x] Scenario: updateTuningSliderUI disables shadow/highlight for lum bands
        # Setup: Active band = 'darks'/'mids'/'lights'.
        [x] Inputs: Call updateTuningSliderUI()
        [x] Expected outputs: sliders disabled
        [x] Exact assertions: shadowSlider.disabled === true; highlightSlider.disabled === true
    [x] Scenario: Active band class toggle
        # Setup: Band buttons with classList methods.
        [x] Inputs: Switch active band (reds -> greens)
        [x] Expected outputs: Only active band has active class
        [x] Exact assertions: redsButton inactive; greensButton active
    [x] Scenario: refreshTuningSliders and refreshColorTuningUI sync values
        # Setup: Change tuning state values.
        [x] Inputs: Call refresh methods
        [x] Expected outputs: Sliders/labels reflect state
        [x] Exact assertions: Each tuning slider value equals state; labels match format
    [x] Scenario: updateAllAdjustmentUI syncs full set
        # Setup: Alter all adjustment state.
        [x] Inputs: Call updateAllAdjustmentUI()
        [x] Expected outputs: All elements match state
        [x] Exact assertions: Every slider value equals state.adjustments fields

# 9. Integration Expectations

[x] 9.1 Handler Setters
    # Scenario: setSaveSnapshotHandler and setUpdateWorkingCopiesHandler accept functions only.
    [x] Setup: Create system via createAdjustmentSystem
    [x] Inputs: Pass valid function; then invalid (null)
    [x] Expected outputs: Valid stored; invalid ignored/warned
    [x] Exact assertions:
        [x] typeof system.setSaveSnapshotHandler === 'function'
        [x] Invoking internal handler calls provided function
        [x] Invalid input logs warning/does not override

[x] 9.2 API Object Surface
    # Scenario: Returned API has all expected functions and can be called without side effects.
    [x] Setup: Create system with minimal state/els/ctx
    [x] Inputs: Call each API method with safe defaults
    [x] Expected outputs: Methods exist; do not throw
    [x] Exact assertions:
        [x] typeof system.updateAdjustmentPreview === 'function'
        [x] Verify system.updateAdjustmentPreview() does not throw
        [x] Verify initAdjustments, initColorTuning, resetAllAdjustments exist and are callable

