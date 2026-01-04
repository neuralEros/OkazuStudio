1. 1. Test harness + DOM mocks
    1.1. 1.1 Minimal state and els scaffolding
        [x] 1.1.1. Construct minimal state object
            # Goal: Provide just enough state/element wiring to exercise scripts/input.js
            # state.view = { scale: 1, translateX: 0, translateY: 0 }
            # state.canvasSize = { width: 1000, height: 800 }
            # state.cropped = false
            # state.crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5, rotation: 0 }
            # state.cropView = { scale: 1, translateX: 0, translateY: 0, rotation: 0 }
            # state.mode = 'erase'
            # state.brushSize = 0.1
            # state.featherMode = false
            # state.brushSettings = { erase: { size: 0.1, hardness: 0.8, featherPx: 12 }, repair: { size: 0.05, hardness: 0.8, featherPx: 12 }, censor: { size: 0.2, hardness: 0.5, featherPx: 18 } }
            # state.cursor = { canDraw: true }
            # state.pointer = { isDown: false, isDrawing: false, isPanning: false }
            # state.polyline = { active: false, points: [] }
            # state.preview = { active: false }
        [x] 1.1.2. Construct minimal els object
            # els.viewport = { clientWidth: 1200, clientHeight: 800, style: {}, getBoundingClientRect: () => ({ left: 10, top: 20, width: 1200, height: 800 }) }
            # els.canvasWrapper = { style: {}, getBoundingClientRect: () => ({ left: 10, top: 20, width: 1000, height: 800 }) }
            # els.mainCanvas = { width: 1000, height: 800 }
            # els.previewCanvas = { width: 1000, height: 800 }
            # els.cursor = { style: {} }
            # els.brushSizeSlider = { value: '10' }
            # els.brushSizeLabel = { textContent: '' }
            # els.hardnessSlider = { value: '80', min: '0', max: '100', step: '1' }
            # els.hardnessLabel = { textContent: '' }
            # els.cropBox = { style: {}, classList: { add: () => {}, remove: () => {} } }
            # els.cropHandles = { topLeft: { style: {} }, topRight: { style: {} }, bottomLeft: { style: {} }, bottomRight: { style: {} }, rotation: { style: {} } }
        [x] 1.1.3. Assert initial state and element scaffolding
            # state.view.scale === 1 and translate values are 0
            # els.viewport.getBoundingClientRect() returns expected static values
            # Sliders/labels are present with string values
            # els.cropBox.style and els.cropHandles.*.style exist for CSS variable assignment
        [x] 1.1.4. Test Edge Case: state.canvasSize.height = 0
            # Should not cause errors for helpers relying on height proportions
        [x] 1.1.5. Test Edge Case: els.viewport.clientWidth = 0
            # Should be handled gracefully in view reset logic
    1.2. 1.2 Event-mock helpers
        [x] 1.2.1. Implement mockPointerEvent helper
            # Args: { type, clientX, clientY, button = 0, buttons = 1, pointerId = 1, ctrlKey = false, metaKey = false, shiftKey = false }
            # Must include preventDefault = jest.fn() and stopPropagation = jest.fn()
        [x] 1.2.2. Implement mockWheelEvent helper
            # Args: { deltaY, clientX, clientY }
            # Must include preventDefault = jest.fn() and stopPropagation = jest.fn()
        [x] 1.2.3. Implement mockKeyEvent helper
            # Args: { key, ctrlKey = false, metaKey = false, shiftKey = false, code }
            # Must include preventDefault = jest.fn() and stopPropagation = jest.fn()
        [x] 1.2.4. Assert event helper behavior
            # event.preventDefault is called by handlers suppressing native behavior (draw, pan)
            # event.stopPropagation is called when input should not bubble
        [x] 1.2.5. Test Edge Case: Pointer with buttons = 0 on move
            # Should not trigger drawing
        [x] 1.2.6. Test Edge Case: metaKey true (Mac behavior)
            # Should behave like ctrlKey in shortcut tests

2. 2. Pure math/coordinate helpers (OkazuTestables.input)
    2.1. 2.1 toProportion / toPixels
        [x] 2.1.1. Test toProportion(50, 200)
            # Expected assertion: returns 0.25
        [x] 2.1.2. Test toPixels(0.25, 200)
            # Expected assertion: returns 50
        [x] 2.1.3. Test Edge Case: toProportion(50, 0)
            # Expected assertion: returns 0 or fallback
        [x] 2.1.4. Test Edge Case: toPixels(0.25, 0)
            # Expected assertion: returns 0
        [x] 2.1.5. Test Edge Case: Negative values
            # Assert they are clamped or returned consistently
    2.2. 2.2 rotatePoint
        [x] 2.2.1. Test rotatePoint({ x: 10, y: 20 }, 0)
            # Expected assertion: returns { x: 10, y: 20 }
        [x] 2.2.2. Test rotatePoint({ x: 10, y: 20 }, 90)
            # Expected assertion: returns { x: -20, y: 10 }
        [x] 2.2.3. Test rotatePoint({ x: 10, y: 20 }, 180)
            # Expected assertion: returns { x: -10, y: -20 }
        [x] 2.2.4. Test rotatePoint({ x: 10, y: 20 }, 270)
            # Expected assertion: returns { x: 20, y: -10 }
        [x] 2.2.5. Test Edge Case: rotatePoint({ x: 0, y: 0 }, 90)
            # Expected assertion: returns { x: 0, y: 0 }
    2.3. 2.3 getRotatedAABB
        # Setup: Rectangle centered at origin with width 100, height 50
        [x] 2.3.1. Test getRotatedAABB({ x: 0, y: 0, w: 100, h: 50 }, 0)
            # Expected assertion: { minX: -50, maxX: 50, minY: -25, maxY: 25, w: 100, h: 50 }
        [x] 2.3.2. Test getRotatedAABB({ x: 0, y: 0, w: 100, h: 50 }, 90)
            # Expected assertion: { minX: -25, maxX: 25, minY: -50, maxY: 50, w: 50, h: 100 }
        [x] 2.3.3. Test getRotatedAABB({ x: 0, y: 0, w: 100, h: 50 }, 180)
            # Expected assertion: identical to rotation 0
        [x] 2.3.4. Test getRotatedAABB({ x: 0, y: 0, w: 100, h: 50 }, 270)
            # Expected assertion: identical to rotation 90
        [x] 2.3.5. Test Edge Case: Zero-width or zero-height rectangle
            # Expected assertion: w or h is 0; min/max match single line or point
    2.4. 2.4 truthToVisualCoordsRaw / visualToTruthCoordsRaw
        # Setup: truth = { x: 250, y: 120 }, fullDims = { width: 1000, height: 800 }
        # Setup: crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5, rotation: rot }
        [x] 2.4.1. For each rot (0, 90, 180, 270), assert round-trip invariants
            # logic: visual = truthToVisualCoordsRaw(truth, fullDims, crop)
            # logic: roundTrip = visualToTruthCoordsRaw(visual, fullDims, crop)
            # Expected assertion: roundTrip matches original truth within 1e-6 tolerance
        [x] 2.4.2. Assert visual coords within crop bounds when rotation is 0
        [x] 2.4.3. Test Edge Case: Crop width or height is 0
            # Expected assertion: returns safe fallback; no NaN
        [x] 2.4.4. Test Edge Case: Truth points outside crop
            # Expected assertion: points round-trip even if visual is outside viewport
    2.5. 2.5 getVisualFullDimsRaw
        # Setup: fullDims = { width: 1000, height: 800 }
        [x] 2.5.1. Assert rotation 0/180
            # Expected assertion: returns { width: 1000, height: 800 }
        [x] 2.5.2. Assert rotation 90/270
            # Expected assertion: returns { width: 800, height: 1000 }
        [x] 2.5.3. Test Edge Case: fullDims.height = 0
            # Expected assertion: yields height 0 in all rotations

3. 3. Brush size / feather mapping
    3.1. 3.1 clampBrushSize, sliderToBrushSize, brushSizeToSliderValue
        [x] 3.1.1. Assert clampBrushSize(-1) returns min (e.g., 0.005)
        [x] 3.1.2. Assert clampBrushSize(10) returns max (e.g., 1.0)
        [x] 3.1.3. Assert round-trip: sliderToBrushSize(0) and brushSizeToSliderValue(min)
        [x] 3.1.4. Assert round-trip: sliderToBrushSize(100) and brushSizeToSliderValue(max)
        [x] 3.1.5. Assert round-trip tolerance for values 0, 25, 50, 75, 100
        [x] 3.1.6. Test Edge Case: sliderToBrushSize('not-a-number')
            # Assert returns min or default
    3.2. 3.2 setBrushPercent
        # Setup: state.mode = 'erase', brushSettings.erase.size = 0.1, slider.value = '10'
        [x] 3.2.1. Input: setBrushPercent(25)
        [x] 3.2.2. Assert state.brushSize updated to 0.25
        [x] 3.2.3. Assert state.brushSettings.erase.size updated to 0.25
        [x] 3.2.4. Assert els.brushSizeSlider.value === '25'
        [x] 3.2.5. Assert els.brushSizeLabel.textContent contains '25%'
        [x] 3.2.6. Test Edge Case: setBrushPercent(-5) clamps to min
        [x] 3.2.7. Test Edge Case: setBrushPercent(200) clamps to max
    3.3. 3.3 setBrushPercentFromSlider
        [x] 3.3.1. Test with els.brushSizeSlider.value = '0' (Expect min)
        [x] 3.3.2. Test with els.brushSizeSlider.value = '100' (Expect max)
        [x] 3.3.3. Test with els.brushSizeSlider.value = '999' (Expect max clamp)
        [x] 3.3.4. Test with els.brushSizeSlider.value = 'foo' (Expect min or previous value)
    3.4. 3.4 sliderToFeatherSize / featherSizeToSliderValue
        [x] 3.4.1. Assert sliderToFeatherSize(0) returns min feather
        [x] 3.4.2. Assert sliderToFeatherSize(100) returns max feather
        [x] 3.4.3. Assert round-trip mapping within tolerance
        [x] 3.4.4. Test Edge Case: Invalid slider value returns min or default
    3.5. 3.5 setFeatherFromSlider
        # Setup: els.hardnessSlider.value = '25'
        [x] 3.5.1. Test in featherMode === true
            # Assert state.brushSettings[mode].featherPx updates from slider mapping
            # Assert label updates with 'px'
        [x] 3.5.2. Test in featherMode === false
            # Assert state.brushSettings[mode].hardness updates (check for inverted mapping per implementation)
            # Assert label updates with '%'
        [x] 3.5.3. Test Edge Case: Slider values outside bounds clamp correctly
    3.6. 3.6 setFeather
        [x] 3.6.1. Test setFeather(12) in featherMode === true
            # Assert state.brushSettings[mode].featherPx updated to 12
            # Assert UI slider value syncs
        [x] 3.6.2. Test setFeather(0.6) in featherMode === false
            # Assert state.brushSettings[mode].hardness updated to 0.6
            # Assert UI slider value syncs
        [x] 3.6.3. Test Edge Case: Values outside range are clamped
    3.7. 3.7 updateFeatherUI
        [x] 3.7.1. Test in featherMode === true
            # Assert els.hardnessSlider.min/max/step set to feather ranges
            # Assert els.hardnessLabel.textContent includes 'px'
        [x] 3.7.2. Test in featherMode === false
            # Assert els.hardnessSlider.min/max/step set to hardness ranges
            # Assert els.hardnessLabel.textContent includes '%'
        [x] 3.7.3. Test Edge Case: Out of bounds settings are clamped and reflected in slider

4. 4. Feather mode toggle
    4.1. 4.1 setFeatherMode
        # Setup: brushSettings.erase = { size: 0.1, hardness: 0.8, featherPx: 12 }
        # Setup: brushSettings.repair = { size: 0.05, hardness: 0.7, featherPx: 8 }
        # Setup: state.mode = 'erase'
        [x] 4.1.1. Input: setFeatherMode(true, { applyToAll: false })
            # Assert only current mode updates slider/label
            # Assert state.featherMode is true
        [x] 4.1.2. Input: setFeatherMode(false, { applyToAll: true })
            # Assert current mode's value propagates to erase, repair, censor
            # Assert UI toggles (classes/checked state) reflect mode
            # Assert state.featherMode is false
        [x] 4.1.3. Test Edge Case: Missing applyToAll defaults to false

5. 5. View/cursor logic
    5.1. 5.1 resetView
        [x] 5.1.1. Test Non-crop (state.cropped = false)
            # Expected assertion: scale fits canvas to viewport; translateX/Y centers image
            # Expected assertion: updateViewTransform called once
        [x] 5.1.2. Test Crop (state.cropped = true)
            # Expected assertion: uses state.cropView scale/translate
            # Expected assertion: updateViewTransform called once
        [x] 5.1.3. Test Edge Case: viewport clientWidth/Height = 0
            # Expected assertion: scale = 1; no NaN translations
    5.2. 5.2 updateViewTransform
        # Setup: state.view = { scale: 1.5, translateX: 20, translateY: -10 }
        [x] 5.2.1. Assert els.canvasWrapper.style.transform matches "translate(20px, -10px) scale(1.5)"
        [x] 5.2.2. Assert updateCursorSize and crop handle updates are invoked
        [x] 5.2.3. Test Edge Case: Negative scale or NaN inputs
            # Assert values are clamped or sanitized
    5.3. 5.3 updateCursorSize
        # Setup: canDraw = true, brushSize = 0.1, canvasHeight = 800, scale = 2
        [x] 5.3.1. Assert cursor width/height equals 160px (brushPx * scale = 0.1 * 800 * 2)
        [x] 5.3.2. Test Edge Case: state.cursor.canDraw = false
            # Assert cursor size remains unchanged

6. 6. Coordinate mapping
    6.1. 6.1 getCanvasCoordinates
        # Setup: view scale 1, trans 0, rect {L: 10, T: 20, W: 1000, H: 800}, canvasSize {1000, 800}
        [x] 6.1.1. Test Uncropped with clientX: 510, clientY: 420
            # Expected assertion: returns { x: 0.5, y: 0.5 } (normalized)
        [x] 6.1.2. Test Cropped (rot: 90)
            # Expected assertion: returns proportions mapped through crop/rotation logic
        [x] 6.1.3. Test Edge Case: Pointer outside canvas bounds
            # Expected assertion: returns values < 0 or > 1 without throwing
        [x] 6.1.4. Test Edge Case: view.scale = 0.5
            # Expected assertion: adjusts mapping correctly for zoomed view
    6.2. 6.2 getCropPivot
        # Setup: crop = { x: 0.2, y: 0.1, w: 0.4, h: 0.3, rotation: 90 }, canvasHeight: 800
        [x] 6.2.1. Assert pivot equals center of crop box in truth space
        [x] 6.2.2. Test Edge Case: Zero-width/height crop
            # Expected assertion: pivot at crop origin; no NaN

7. 7. Crop interactions
    7.1. 7.1 startCropDrag
        [x] 7.1.1. Assert state.cropDrag.type set via getCropHandleType (scale/rotate/pan)
        [x] 7.1.2. Assert state.cropDrag.start stores initial pointer position
        [x] 7.1.3. Assert state.cropDrag.startCrop clones current crop values
        [x] 7.1.4. Test Edge Case: No handle match
            # Expected assertion: defaults to 'pan'
    7.2. 7.2 attachCropHandlers and enforceCropView
        [x] 7.2.1. Assert document pointermove/pointerup listeners attached once
        [x] 7.2.2. Assert state.cropView.scale >= minScale (e.g., 1.2) after enforcement
        [x] 7.2.3. Assert state.cropView.translateX/Y clamped to keep crop in view
        [x] 7.2.4. Test Edge Case: getCropMinScale returns 0
            # Expected assertion: scale stays unchanged
    7.3. 7.3 forceCropHandleUpdate
        # Setup: crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5, rotation: 90 }
        [x] 7.3.1. Assert els.cropBox.style contains CSS variables: --crop-x, --crop-y, --crop-w, --crop-h, --crop-rotation
        [x] 7.3.2. Assert rotation handle has correct transform/position values
        [x] 7.3.3. Test Edge Case: Crop outside bounds
            # Expected assertion: clamps or writes variables without exception

8. 8. Pointer and keyboard handling
    8.1. 8.1 handlePointerDown/Move/Up (Drawing vs Panning)
        # Setup: canDraw = true, mode = 'erase', pointer = { isDown: false... }
        [x] 8.1.1. Assert state.pointer.isDown lifecycle: true on down, false on up
        [x] 8.1.2. Assert startStroke called on pointerdown (when not panning)
        [x] 8.1.3. Assert appendStroke called on pointermove (when not panning)
        [x] 8.1.4. Assert endStroke and dispatchSnapshot called on pointerup
        [x] 8.1.5. Test Edge Case: Spacebar held (Pan mode)
            # Expected assertion: isPanning is true; no stroke calls made
        [x] 8.1.6. Test Edge Case: pointermove with buttons = 0
            # Expected assertion: does not append stroke
    8.2. 8.2 Polyline flow
        [x] 8.2.1. Assert first ctrl-click activates polyline mode and adds point
        [x] 8.2.2. Assert subsequent ctrl-clicks add points to state.polyline.points
        [x] 8.2.3. Assert clicking close to first point commits polyline (calls endStroke/dispatchSnapshot)
        [x] 8.2.4. Test Edge Case: metaKey (Mac) behavior
            # Expected assertion: behaves identically to ctrlKey
    8.3. 8.3 Preview loop toggles
        [x] 8.3.1. Assert state.preview.active is true during stroke
        [x] 8.3.2. Assert state.preview.active is false after stroke ends
        [x] 8.3.3. Assert startPreviewLoop / stopPreviewLoop called exactly once per lifecycle
        [x] 8.3.4. Test Edge Case: Double pointerdown without up
            # Expected assertion: prevents multiple active loops
    8.4. 8.4 handleWheel
        [x] 8.4.1. Assert scale increases/decreases within min/max bounds
        [x] 8.4.2. Assert translation changes preserve visual focus point under cursor
        [x] 8.4.3. Test Edge Case: state.cropped = true
            # Expected assertion: zoom follows crop-specific min/max scales
    8.5. 8.5 Keyboard shortcuts
        [x] 8.5.1. Test Space key: Assert pan mode toggled and preventDefault called
        [x] 8.5.2. Test Ctrl+Z: Assert undo invoked once
        [x] 8.5.3. Test Ctrl+Shift+Z or Ctrl+Y: Assert redo invoked once
        [x] 8.5.4. Test Enter (Crop mode): Assert applyCrop invoked
        [x] 8.5.5. Test Escape (Crop mode): Assert cancelCrop invoked
        [x] 8.5.6. Test Edge Case: Shortcut while focus is in INPUT
            # Expected assertion: shortcuts are ignored
        [x] 8.5.7. Test Edge Case: Mac Command (metaKey) behavior
            # Expected assertion: triggers same behavior as Ctrl

