# input.js Unit-Test Blueprint

This document defines a production-quality unit-test plan for `scripts/input.js`. It is intended to be used with the `OkazuTestables.input` helpers and a minimal DOM/state harness. Each test case includes setup, event payloads, mocked element bounds, inputs, and explicit assertions (including edge cases).

---

## 1. Test harness + DOM mocks

### 1.1 Minimal `state` and `els` scaffolding

**Goal:** Provide just enough state/element wiring to exercise `scripts/input.js` without the full app.

**Scenario:** Construct a minimal `state` and `els` object that matches the shapes used by `input.js`.

**Setup:**
- `state`
  - `state.view = { scale: 1, translateX: 0, translateY: 0 }`
  - `state.canvasSize = { width: 1000, height: 800 }`
  - `state.cropped = false`
  - `state.crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5, rotation: 0 }`
  - `state.cropView = { scale: 1, translateX: 0, translateY: 0, rotation: 0 }`
  - `state.mode = 'erase'`
  - `state.brushSize = 0.1` (height-proportion)
  - `state.featherMode = false`
  - `state.brushSettings = {
      erase: { size: 0.1, hardness: 0.8, featherPx: 12 },
      repair: { size: 0.05, hardness: 0.8, featherPx: 12 },
      censor: { size: 0.2, hardness: 0.5, featherPx: 18 }
    }`
  - `state.cursor = { canDraw: true }`
  - `state.pointer = { isDown: false, isDrawing: false, isPanning: false }`
  - `state.polyline = { active: false, points: [] }`
  - `state.preview = { active: false }`
- `els`
  - `els.viewport = { clientWidth: 1200, clientHeight: 800, style: {}, getBoundingClientRect: () => ({ left: 10, top: 20, width: 1200, height: 800 }) }`
  - `els.canvasWrapper = { style: {}, getBoundingClientRect: () => ({ left: 10, top: 20, width: 1000, height: 800 }) }`
  - `els.mainCanvas = { width: 1000, height: 800 }`
  - `els.previewCanvas = { width: 1000, height: 800 }`
  - `els.cursor = { style: {} }`
  - `els.brushSizeSlider = { value: '10' }`
  - `els.brushSizeLabel = { textContent: '' }`
  - `els.hardnessSlider = { value: '80', min: '0', max: '100', step: '1' }`
  - `els.hardnessLabel = { textContent: '' }`
  - `els.cropBox = { style: {}, classList: { add: () => {}, remove: () => {} } }`
  - `els.cropHandles = { topLeft: { style: {} }, topRight: { style: {} }, bottomLeft: { style: {} }, bottomRight: { style: {} }, rotation: { style: {} } }`

**Inputs:** N/A

**Expected Assertions:**
- `state.view.scale === 1` and translate values are `0`.
- `els.viewport.getBoundingClientRect()` returns the expected static values.
- Sliders/labels are present with string values.
- `els.cropBox.style` and `els.cropHandles.*.style` exist so CSS variables can be assigned.

**Edge Cases:**
- `state.canvasSize.height = 0` should not cause errors for any helper relying on height proportions.
- `els.viewport.clientWidth = 0` should be handled gracefully in view reset logic.

---

### 1.2 Event-mock helpers

**Goal:** Provide consistent mocks for pointer/keyboard/wheel events.

**Scenario:** Fabricate event objects with required fields for handlers.

**Setup:**
- `mockPointerEvent({ type, clientX, clientY, button = 0, buttons = 1, pointerId = 1, ctrlKey = false, metaKey = false, shiftKey = false })`.
- `mockWheelEvent({ deltaY, clientX, clientY })`.
- `mockKeyEvent({ key, ctrlKey = false, metaKey = false, shiftKey = false, code })`.
- Each mock has `preventDefault = jest.fn()` and `stopPropagation = jest.fn()` spies.

**Inputs:**
- Pointer: `{ type: 'pointerdown', clientX: 110, clientY: 200 }`
- Wheel: `{ deltaY: -100, clientX: 500, clientY: 400 }`
- Key: `{ key: ' ', code: 'Space' }`

**Expected Assertions:**
- `event.preventDefault` is called by handlers that suppress native behavior (e.g., draw, pan).
- `event.stopPropagation` is called where input should not bubble.

**Edge Cases:**
- Pointer with `buttons = 0` on move should not trigger drawing.
- `metaKey` true on mac should behave like `ctrlKey` in shortcut tests.

---

## 2. Pure math/coordinate helpers (OkazuTestables.input)

### 2.1 `toProportion` / `toPixels`

**Scenario:** Convert between absolute pixel values and height-based proportions.

**Setup:** Use helpers from `OkazuTestables.input`.

**Inputs:**
- `toProportion(50, 200)` → expected `0.25`.
- `toPixels(0.25, 200)` → expected `50`.

**Expected Assertions:**
- `toProportion(50, 200) === 0.25`.
- `toPixels(0.25, 200) === 50`.

**Edge Cases:**
- `toProportion(50, 0)` returns `0` (or a safe fallback defined by implementation).
- `toPixels(0.25, 0) === 0`.
- Negative values are clamped or returned consistently (assert the actual behavior).

---

### 2.2 `rotatePoint`

**Scenario:** Rotate a point around origin for canonical angles.

**Setup:** `point = { x: 10, y: 20 }`.

**Inputs + Expected Assertions:**
- `rotatePoint(point, 0)` → `{ x: 10, y: 20 }`.
- `rotatePoint(point, 90)` → `{ x: -20, y: 10 }`.
- `rotatePoint(point, 180)` → `{ x: -10, y: -20 }`.
- `rotatePoint(point, 270)` → `{ x: 20, y: -10 }`.

**Edge Cases:**
- `rotatePoint({ x: 0, y: 0 }, 90)` returns `{0,0}`.

---

### 2.3 `getRotatedAABB`

**Scenario:** Compute bounding box for a rotated rectangle.

**Setup:** Rectangle centered at origin with width `100` and height `50`.

**Inputs:**
- `getRotatedAABB({ x: 0, y: 0, w: 100, h: 50 }, 0)`.
- Same with `90`, `180`, `270`.

**Expected Assertions:**
- Rotation `0`: `{ minX: -50, maxX: 50, minY: -25, maxY: 25, w: 100, h: 50 }`.
- Rotation `90`: `{ minX: -25, maxX: 25, minY: -50, maxY: 50, w: 50, h: 100 }`.
- Rotation `180`: identical to 0.
- Rotation `270`: identical to 90.

**Edge Cases:**
- Zero-width or zero-height rect yields `w` or `h` of `0` and min/max match the single line/point.

---

### 2.4 `truthToVisualCoordsRaw` / `visualToTruthCoordsRaw`

**Scenario:** Ensure round-trip invariants for all rotations.

**Setup:**
- `truth = { x: 250, y: 120 }`
- `fullDims = { width: 1000, height: 800 }`
- `crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5, rotation: rot }`

**Inputs:**
- For each `rot` in `{0,90,180,270}`: `visual = truthToVisualCoordsRaw(truth, fullDims, crop)` then `roundTrip = visualToTruthCoordsRaw(visual, fullDims, crop)`.

**Expected Assertions:**
- `roundTrip.x` and `roundTrip.y` match original `truth` within an epsilon (e.g., `1e-6`).
- With `rotation: 0`, `visual.x` and `visual.y` are within the crop bounds.

**Edge Cases:**
- Crop with `w=0` or `h=0` yields safe fallback (assert no `NaN`).
- Truth points outside crop still round-trip (even if visual is outside viewport bounds).

---

### 2.5 `getVisualFullDimsRaw`

**Scenario:** Compute visual dimensions after rotation.

**Setup:** `fullDims = { width: 1000, height: 800 }`.

**Inputs:**
- `getVisualFullDimsRaw(fullDims, 0)`.
- `getVisualFullDimsRaw(fullDims, 90)`.
- `getVisualFullDimsRaw(fullDims, 180)`.
- `getVisualFullDimsRaw(fullDims, 270)`.

**Expected Assertions:**
- Rotation `0/180`: `{ width: 1000, height: 800 }`.
- Rotation `90/270`: `{ width: 800, height: 1000 }`.

**Edge Cases:**
- `fullDims.height = 0` yields height `0` in all rotations.

---

## 3. Brush size / feather mapping

### 3.1 `clampBrushSize`, `sliderToBrushSize`, `brushSizeToSliderValue`

**Scenario:** Validate mapping and invertibility.

**Setup:** Use current min/max in `input.js` (from constants or default slider range).

**Inputs:**
- `clampBrushSize(-1)` → expected min (e.g., `0.005`).
- `clampBrushSize(10)` → expected max (e.g., `1.0`).
- `sliderToBrushSize(0)` and `brushSizeToSliderValue(min)` round-trip.
- `sliderToBrushSize(100)` and `brushSizeToSliderValue(max)` round-trip.

**Expected Assertions:**
- `brushSizeToSliderValue(sliderToBrushSize(x)) ≈ x` for `x = 0, 25, 50, 75, 100` (within tolerance).
- Inputs outside slider range clamp to min/max.

**Edge Cases:**
- `sliderToBrushSize('not-a-number')` → returns min or default (asserted behavior).

---

### 3.2 `setBrushPercent`

**Scenario:** Updates brush size state and UI.

**Setup:**
- `state.mode = 'erase'` and `state.brushSettings.erase.size = 0.1`.
- `els.brushSizeSlider.value = '10'`, `els.brushSizeLabel.textContent = ''`.

**Inputs:**
- `setBrushPercent(25)`.

**Expected Assertions:**
- `state.brushSize` updated to `0.25`.
- `state.brushSettings.erase.size` updated to `0.25`.
- `els.brushSizeSlider.value === '25'`.
- `els.brushSizeLabel.textContent` includes `25%` (or exact formatting expected by implementation).

**Edge Cases:**
- `setBrushPercent(-5)` clamps to min.
- `setBrushPercent(200)` clamps to max.

---

### 3.3 `setBrushPercentFromSlider`

**Scenario:** Read slider value and update state with clamping.

**Setup:**
- `els.brushSizeSlider.value = '0'` then `'100'` then `'999'` then `'foo'`.

**Inputs:**
- Call `setBrushPercentFromSlider()` for each slider value.

**Expected Assertions:**
- `state.brushSize` equals min for `'0'`.
- `state.brushSize` equals max for `'100'`.
- `'999'` clamps to max.
- `'foo'` clamps to min or falls back to previous value (assert actual behavior).

---

### 3.4 `sliderToFeatherSize` / `featherSizeToSliderValue`

**Scenario:** Validate mapping for feather (pixel) size.

**Setup:** Use slider min/max from `els.hardnessSlider` or constants.

**Inputs:**
- `sliderToFeatherSize(0)` → min feather.
- `sliderToFeatherSize(100)` → max feather.
- `featherSizeToSliderValue(min/max)` round-trip.

**Expected Assertions:**
- Round-trip tolerance similar to brush size mapping.

**Edge Cases:**
- Invalid slider value returns min or default (assert actual behavior).

---

### 3.5 `setFeatherFromSlider`

**Scenario:** Adjust feather vs hardness depending on `featherMode`.

**Setup:**
- `state.featherMode = true` then `false`.
- `els.hardnessSlider.value = '25'`.

**Inputs:**
- `setFeatherFromSlider()` in both modes.

**Expected Assertions:**
- When `featherMode === true`, `state.brushSettings[mode].featherPx` updates from slider value mapping.
- When `featherMode === false`, `state.brushSettings[mode].hardness` updates and uses inverse mapping if the UI is inverted (assert exact implementation).
- Label updates reflect mode (e.g., `%` for hardness vs `px` for feather).

**Edge Cases:**
- Slider values outside bounds clamp correctly.

---

### 3.6 `setFeather`

**Scenario:** Directly set feather/hardness values.

**Setup:**
- `state.featherMode = true` then `false`.

**Inputs:**
- `setFeather(12)` in feather mode.
- `setFeather(0.6)` in hardness mode.

**Expected Assertions:**
- Feather mode updates `state.brushSettings[mode].featherPx` to `12`.
- Hardness mode updates `state.brushSettings[mode].hardness` to `0.6`.
- UI slider value syncs to corresponding mapped value.

**Edge Cases:**
- Values outside allowable range are clamped.

---

### 3.7 `updateFeatherUI`

**Scenario:** Ensure correct UI min/max/step and label formatting.

**Setup:**
- `state.featherMode = true` then `false`.

**Inputs:**
- `updateFeatherUI()` for each mode.

**Expected Assertions:**
- Feather mode sets `els.hardnessSlider.min/max/step` to feather ranges.
- Hardness mode sets `els.hardnessSlider.min/max/step` to hardness ranges.
- `els.hardnessLabel.textContent` includes `px` (feather) or `%` (hardness).

**Edge Cases:**
- Current brush settings outside bounds are clamped and reflected in slider value.

---

## 4. Feather mode toggle

### 4.1 `setFeatherMode`

**Scenario:** Switching modes reloads and applies correct values.

**Setup:**
- `state.brushSettings.erase = { size: 0.1, hardness: 0.8, featherPx: 12 }`.
- `state.brushSettings.repair = { size: 0.05, hardness: 0.7, featherPx: 8 }`.
- `state.mode = 'erase'`.

**Inputs:**
- `setFeatherMode(true, { applyToAll: false })`.
- `setFeatherMode(false, { applyToAll: true })`.

**Expected Assertions:**
- When `applyToAll: false`, only current mode updates slider/label values.
- When `applyToAll: true`, propagate current mode’s value to all modes (`erase`, `repair`, `censor`).
- `state.featherMode` toggles accordingly.
- UI toggles (class names or checked state) reflect mode.

**Edge Cases:**
- Missing `applyToAll` defaults to `false` (assert default behavior).

---

## 5. View/cursor logic

### 5.1 `resetView`

**Scenario:** Reset view for crop vs non-crop.

**Setup:**
- Non-crop: `state.cropped = false`, `state.view.scale = 2`, `translateX = 50`, `translateY = -40`.
- Crop: `state.cropped = true`, `state.crop = { x: 0.1, y: 0.1, w: 0.5, h: 0.5, rotation: 90 }`.

**Inputs:**
- `resetView()` for both cases.

**Expected Assertions:**
- Non-crop: `state.view.scale` fits canvas into viewport; `translateX/Y` centers image; `updateViewTransform` called once.
- Crop: uses `state.cropView` scale/translate for cropped bounds; `updateViewTransform` called once.

**Edge Cases:**
- `els.viewport.clientWidth/Height = 0` results in `scale = 1` and no NaN translations.

---

### 5.2 `updateViewTransform`

**Scenario:** Applies CSS transforms and updates cursor/handles.

**Setup:**
- `state.view = { scale: 1.5, translateX: 20, translateY: -10 }`.

**Inputs:**
- `updateViewTransform()`.

**Expected Assertions:**
- `els.canvasWrapper.style.transform` matches `translate(20px, -10px) scale(1.5)` (exact string per implementation).
- `updateCursorSize` and crop handle updates are invoked (spy or mock assertion).

**Edge Cases:**
- Negative scale or NaN inputs are clamped or sanitized (assert actual behavior).

---

### 5.3 `updateCursorSize`

**Scenario:** Cursor size scales with brush size and view scale.

**Setup:**
- `state.cursor.canDraw = true`.
- `state.brushSize = 0.1`, `state.canvasSize.height = 800`, `state.view.scale = 2`.

**Inputs:**
- `updateCursorSize()`.

**Expected Assertions:**
- Cursor width/height equals `brushPx * scale`, with `brushPx = 0.1 * 800 = 80`.
- `els.cursor.style.width/height === '160px'` (or computed exact string).

**Edge Cases:**
- `state.cursor.canDraw = false` results in no changes to cursor size (assert unchanged).

---

## 6. Coordinate mapping

### 6.1 `getCanvasCoordinates`

**Scenario:** Map screen coordinates to truth-space proportions.

**Setup:**
- `state.view = { scale: 1, translateX: 0, translateY: 0 }`.
- `els.canvasWrapper.getBoundingClientRect()` returns `{ left: 10, top: 20, width: 1000, height: 800 }`.
- `state.canvasSize = { width: 1000, height: 800 }`.

**Inputs:**
- Uncropped: `state.cropped = false`; call with `clientX: 510`, `clientY: 420`.
- Cropped: `state.cropped = true`, `state.crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5, rotation: 90 }`.

**Expected Assertions:**
- Uncropped: returns `{ x: 0.5, y: 0.5 }` (normalized by height where required by implementation).
- Cropped: returns proportions mapped through crop + rotation using `visualToTruthCoordsRaw` logic.

**Edge Cases:**
- Pointer outside canvas bounds results in values < 0 or > 1 but does not throw.
- `state.view.scale = 0.5` correctly adjusts mapping for zoomed out view.

---

### 6.2 `getCropPivot`

**Scenario:** Compute crop pivot in truth space for rotated crop.

**Setup:**
- `state.crop = { x: 0.2, y: 0.1, w: 0.4, h: 0.3, rotation: 90 }`.
- `state.canvasSize = { width: 1000, height: 800 }`.

**Inputs:**
- `getCropPivot()`.

**Expected Assertions:**
- Pivot equals the center of the crop box in truth space (not visual space).
- Values match exact pixel center: `x = (0.2 + 0.2) * 800 = 320` if normalized by height in implementation; adjust expected values to actual math.

**Edge Cases:**
- Zero-width/height crop yields pivot at crop origin (assert no NaN).

---

## 7. Crop interactions

### 7.1 `startCropDrag`

**Scenario:** Determine drag type based on handle hit testing.

**Setup:**
- Mock `getCropHandleType` to return `scale`, `rotate`, or `pan`.
- `state.crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5, rotation: 0 }`.

**Inputs:**
- Pointerdown at handle coords `{ clientX: 120, clientY: 160 }`.

**Expected Assertions:**
- `state.cropDrag.type` is set based on handle (`scale`/`rotate`/`pan`).
- `state.cropDrag.start` stores initial pointer position.
- `state.cropDrag.startCrop` clones current crop values.

**Edge Cases:**
- If no handle matches, defaults to `pan` (assert actual behavior).

---

### 7.2 `attachCropHandlers` and `enforceCropView`

**Scenario:** Hook document listeners and enforce min scale.

**Setup:**
- Spy on `document.addEventListener` for `pointermove`/`pointerup`.
- Mock `getCropMinScale` to return `1.2`.

**Inputs:**
- Call `attachCropHandlers()` then simulate a crop view update via `enforceCropView()`.

**Expected Assertions:**
- Document listeners attached once per call.
- `state.cropView.scale >= 1.2` after enforcement.
- `state.cropView.translateX/Y` clamped to keep crop in view (assert against known expected values given `viewport` and `crop` dims).

**Edge Cases:**
- `getCropMinScale` returns `0` → scale stays unchanged.

---

### 7.3 `forceCropHandleUpdate`

**Scenario:** Ensure crop box/handles CSS variables update.

**Setup:**
- `state.crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5, rotation: 90 }`.
- `els.cropBox.style` and handle styles are empty objects.

**Inputs:**
- `forceCropHandleUpdate()`.

**Expected Assertions:**
- `els.cropBox.style` has CSS variables like `--crop-x`, `--crop-y`, `--crop-w`, `--crop-h`, `--crop-rotation`.
- Rotation handle has correct transform/position values.

**Edge Cases:**
- Crop outside bounds clamps or still writes CSS variables (assert no exception).

---

## 8. Pointer and keyboard handling

### 8.1 `handlePointerDown/Move/Up`

**Scenario:** Drawing vs panning transitions.

**Setup:**
- `state.cursor.canDraw = true`.
- `state.mode = 'erase'`.
- Mock `startStroke`, `appendStroke`, `endStroke`, `dispatchSnapshot`.
- `state.pointer = { isDown: false, isDrawing: false, isPanning: false }`.

**Inputs:**
- `pointerdown` at `{ clientX: 110, clientY: 120, buttons: 1 }`.
- `pointermove` to `{ clientX: 120, clientY: 130, buttons: 1 }`.
- `pointerup` at `{ clientX: 120, clientY: 130 }`.

**Expected Assertions:**
- `state.pointer.isDown === true` after down, then false after up.
- When not panning, `startStroke` called on down, `appendStroke` on move.
- `endStroke` called on up.
- `dispatchSnapshot` called after stroke completes.

**Edge Cases:**
- Spacebar held (pan mode): `state.pointer.isPanning === true`, no stroke calls.
- `buttons = 0` on move does not append stroke.

---

### 8.2 Polyline flow

**Scenario:** Ctrl/meta click toggles polyline points and commit.

**Setup:**
- `state.polyline = { active: false, points: [] }`.

**Inputs:**
- `pointerdown` with `{ ctrlKey: true }` at two distinct points.
- `pointerdown` with `{ ctrlKey: true }` on the first point to close.

**Expected Assertions:**
- First ctrl-click activates polyline mode and adds point.
- Subsequent ctrl-click adds points.
- Clicking close to first point commits polyline, calls `endStroke`/`dispatchSnapshot`.

**Edge Cases:**
- `metaKey` behaves same as `ctrlKey`.

---

### 8.3 Preview loop toggles

**Scenario:** Preview mode starts/stops correctly.

**Setup:**
- Mock `startPreviewLoop` and `stopPreviewLoop` or observe `state.preview.active`.

**Inputs:**
- `pointerdown` to begin drawing.
- `pointerup` to end drawing.

**Expected Assertions:**
- `state.preview.active === true` during drawing.
- `state.preview.active === false` after drawing ends.
- `startPreviewLoop` called once per draw begin; `stopPreviewLoop` once per draw end.

**Edge Cases:**
- Double pointerdown without up does not start multiple loops (assert single active loop).

---

### 8.4 `handleWheel`

**Scenario:** Zoom clamping and focus-point preservation.

**Setup:**
- `state.view = { scale: 1, translateX: 0, translateY: 0 }`.
- `els.viewport.getBoundingClientRect()` returns `{ left: 10, top: 20, width: 1200, height: 800 }`.

**Inputs:**
- Wheel at `{ clientX: 610, clientY: 420, deltaY: -100 }` (zoom in).
- Wheel at `{ clientX: 610, clientY: 420, deltaY: 5000 }` (excess zoom out).

**Expected Assertions:**
- Scale increases/decreases within min/max.
- Translate changes so the visual focus point stays under cursor (assert against expected translate values).

**Edge Cases:**
- With `state.cropped = true`, zoom respects crop min/max scales.

---

### 8.5 Keyboard shortcuts

**Scenario:** Space for pan/reset view, undo/redo, crop accept/cancel.

**Setup:**
- Mock `resetView`, `undo`, `redo`, `applyCrop`, `cancelCrop` functions.

**Inputs & Assertions:**
- `keydown Space` → `state.pointer.isPanning = true` or pan mode toggled; `preventDefault` called.
- `keyup Space` → pan mode cleared.
- `keydown Ctrl+Z` → `undo` called once.
- `keydown Ctrl+Shift+Z` or `Ctrl+Y` → `redo` called once.
- `keydown Enter` in crop mode → `applyCrop` called.
- `keydown Escape` in crop mode → `cancelCrop` called.

**Edge Cases:**
- On mac: `metaKey` triggers same behavior as `ctrlKey`.
- When focus is inside an input, shortcuts should be ignored (assert using mocked `event.target` with `tagName = 'INPUT'`).

---

## Notes

- All tests should assert both **state changes** and **DOM side effects**.
- Use explicit numeric expectations (no fuzzy “changed” checks) except where floating math requires a tolerance.
- Prefer `describe()` blocks mirroring the sections above to keep coverage organized.
