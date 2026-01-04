# OkazuStudio `scripts/main.js` Unit-Test Blueprint

This document defines a production-quality unit-test plan for the behaviors implemented in `scripts/main.js`. Each test includes explicit scenario, setup, inputs, expected results, and assertions. The plan assumes a JSDOM-like environment with canvas support (e.g., `jest-environment-jsdom` + `jest-canvas-mock` or `node-canvas`) and allows direct stubbing/spying of global functions (e.g., `createAdjustmentSystem`, `createInputSystem`, `Logger`).

---

## Test Harness & Fixtures (Shared Setup)

**Test Runner Requirements**
- JSDOM with `document.body`, `document.getElementById`, and `classList` support.
- Canvas mock with `getContext('2d')`, `drawImage`, `getImageData`, `putImageData`, `clearRect`, `fillRect`, `globalCompositeOperation`, `globalAlpha`.
- Ability to stub `requestAnimationFrame`, `setTimeout`, and `ResizeObserver`.

**Global stubs/spies**
- `window.Logger` stub with `info`, `warn`, `error`, `interaction` methods.
- `window.createReplayEngine` stub returning object with `logAction`, `undo`, `redo`, `setUpdateCanvasDimensionsFn`, and `undoFloor`.
- `window.AssetManager` stub with `addAsset` returning deterministic IDs.
- `window.dispatchAction` spy (should be re-assigned by main.js when replay engine exists).
- `createAdjustmentSystem` stub that returns:
  - `applyMasterLUT`, `applyColorOps`, `applySelectiveColor`, `initAdjustments`, `resetAllAdjustments`, `recalculateColorTuning`, `updateAllAdjustmentUI` spies.
- `createInputSystem` stub that returns:
  - `canDraw`, `resetView`, `updateCursorSize`, `attachInputHandlers`, `setBrushPercent`, `setBrushPercentFromSlider`, `setFeather`, `setFeatherFromSlider`, `setFeatherMode`, `syncBrushUIToActive` spies.

**Reusable DOM Fixture**
Create elements with all required IDs from `createDefaultEls`, including but not limited to: `#mainCanvas`, `#previewCanvas`, `#viewport`, `#canvas-wrapper`, `#empty-state`, `#drawer-adj`, `#modeMaster`, `#modeCensor`, `#modeComposite`, `#loading-overlay`, modal elements (`#modal-overlay`, `#modal-title`, `#modal-message`, `#modal-choices`, `#modal-close`), visibility toggles (`#toggleMaskBtn`, `#maskEyeOpen`, `#maskEyeClosed`, `#toggleBackBtn`, `#rearEyeOpen`, `#rearEyeClosed`, `#toggleAdjBtn`, `#adjEyeOpen`, `#adjEyeClosed`), and crop elements (`#cropBtn`, `#crop-overlay-dom`, `#crop-box`, `.crop-handle`).

**Canvas/Image Fixture**
- `img2x3`: 2×3 canvas with distinct RGBA pixels per coordinate (e.g., (0,0)=red, (1,0)=green, (0,1)=blue, etc.) to validate rotation/draw.
- `img4x2`: 4×2 canvas for scaling tests.
- `mask2x3`: 2×3 mask canvas with opaque pixels in a diagonal pattern.

---

## 1. State/element construction

### `createDefaultState`

**Scenario: default state object contains expected primitives and nested defaults.**
- **Setup:** Call `createDefaultState()` directly from `window.OkazuTestables.main` or by importing script into a JSDOM environment.
- **Inputs:** None.
- **Expected:** All defaults match constants and literal values in `scripts/main.js`.
- **Assertions:**
  - Images & metadata: `imgA`, `imgB`, `sourceA`, `sourceB`, `thumbA`, `thumbB` are `null`; `assetIdA`, `assetIdB` are `null`; `nameA`, `nameB`, `formatA`, `formatB` are `''`; `isAFront === true`.
  - Brush defaults: `opacity === 0.8`; `brushSize === 0.1`; `feather === 1`; `featherSize === 0.0012`; `featherMode === false`; `brushMode === 'erase'`.
  - Visibility: `maskVisible === true`, `backVisible === true`, `adjustmentsVisible === true`.
  - History: `history` is empty array, `historyIndex === -1`, `lastActionType === null`.
  - View/pan state: `isSpacePressed === false`, `isPanning === false`, `view` equals `{ x: 0, y: 0, scale: 1 }`, `lastSpaceUp === 0`.
  - Preview/mask: `isPreviewing === false`, `previewMaskCanvas === null`, `previewMaskScale === 1`, `previewLoopId === null`.
  - Polyline: `isPolylineStart === false`, `polylinePoints` empty, `polylineDirty === false`, `polylineSessionId === 0`, `currentPolylineAction === null`.
  - Drawing: `activeStroke === null`, `fastPreviewLastPoint === null`, `pointerDownTime === 0`, `pointerDownCoords === null`.
  - Rotation: `rotation === 0`.
  - Brush presets: `brushSettings.erase.brushSize === 0.1`; `repair.brushSize === 0.05`; `patch.brushSize === 0.05`; `erase.feather === 1`; `patch.feather === 10`; `featherSize` for all is `0.0012`.
  - Adjustments: `gamma === 1`, `levels.black === 0`, `levels.mid === 1`, `levels.white === 255`, `saturation === 0`, `vibrance === 0`, `wb === 0`, `colorBal` all `0`, `colorTuning.*` all zeros for `hue/saturation/vibrance/luminance/shadows/highlights`.
  - Preview/working: `isAdjusting === false`, `previewCanvas === null`, `previewFrontLayer === null`, `workingA/B === null`, `previewWorkingA/B === null`, `previewScaleA/B === 1`, `previewWorkingVersionA/B === 0`, `previewComposite === null`, `adjustmentsVersion === 0`, `workingVersionA/B === 0`.
  - Crop: `isCropping === false`, `cropRect === null`, `cropRectSnapshot === null`, `fullDims === { w: 0, h: 0 }`, `cropDrag === null`.
  - Fast preview: `fastMaskCanvas === null`, `fastMaskCtx === null`, `fastMaskScale === 1`, `useFastPreview === false`.
  - Settings: `settings.brushPreviewResolution === 1080`, `settings.adjustmentPreviewResolution === 1080`.
  - Drawer: `pendingAdjustmentCommit === false`, `drawerCloseTimer === null`, `activeDrawerTab === null`.
  - Mode: `mode === 'master'`, `cropRotation === 0`, `hasShownSaveMergeWarning === false`.

### `createDefaultEls`

**Scenario: DOM elements are wired when present.**
- **Setup:** Build a DOM with all expected IDs (`fileA`, `fileB`, `btnA`, `btnB`, `mainCanvas`, `previewCanvas`, etc.).
- **Inputs:** `createDefaultEls(document)`.
- **Expected:** Each returned property references the element with the matching ID.
- **Assertions:** `els.mainCanvas === document.getElementById('mainCanvas')`, `els.modeMaster === document.getElementById('modeMaster')`, etc.

**Scenario: missing elements are handled without throwing.**
- **Setup:** Provide a root node with only a subset of IDs.
- **Inputs:** `createDefaultEls(customRoot)`.
- **Expected:** Missing elements return `null` for those keys.
- **Assertions:** `els.previewCanvas === null`, `els.toggleAdjBtn === null` when not in DOM.

---

## 2. Mode + UI switching

### `setAppMode`

**Scenario: toggles global classes and button active state.**
- **Setup:**
  - `document.body` exists.
  - `els.modeMaster`, `els.modeCensor`, `els.modeComposite` exist with empty classList.
  - Stub `setFeatherMode` to record calls.
- **Inputs:** `setAppMode('censor')`.
- **Expected:**
  - `state.mode` becomes `'censor'`.
  - Body has `mode-non-master` class.
  - `setFeatherMode(true)` called.
  - Only `els.modeCensor` has class `active`.
- **Assertions:**
  - `document.body.classList.contains('mode-non-master') === true`.
  - `els.modeCensor.classList.contains('active') === true`.
  - `els.modeMaster.classList.contains('active') === false`.
  - `els.modeComposite.classList.contains('active') === false`.

**Scenario: no-op for falsy mode.**
- **Setup:** `state.mode` set to `'master'` initially; spy `setFeatherMode`.
- **Inputs:** `setAppMode('')`.
- **Expected:** No changes, no feather mode calls.
- **Assertions:** `state.mode === 'master'`; `setFeatherMode` not called.

### `bindModeSwitcher`

**Scenario: attaches click events and applies current mode.**
- **Setup:**
  - `state.mode = 'composite'`.
  - Buttons exist; spy on `setAppMode`.
- **Inputs:** `bindModeSwitcher()`.
- **Expected:**
  - Event listeners are attached.
  - `setAppMode('composite')` called once during initialization.
- **Assertions:** Simulate click on `modeMaster` and assert `setAppMode` called with `'master'`.

---

## 3. Canvas utilities

### `cloneToCanvas`

**Scenario: clones canvas/image content to a new canvas.**
- **Setup:** Provide `img2x3` with known pixels.
- **Inputs:** `cloneToCanvas(img2x3)`.
- **Expected:**
  - Output canvas size is 2×3.
  - Pixel content is identical.
- **Assertions:** Compare `getImageData` arrays; verify `drawImage(img2x3,0,0)` was called once.

### `generateThumbnail`

**Scenario: returns null for no input.**
- **Inputs:** `generateThumbnail(null)`.
- **Expected:** Returns `null`.
- **Assertions:** `result === null`.

**Scenario: returns clone when height <= target.**
- **Setup:** `img4x2` and `targetH=4`.
- **Inputs:** `generateThumbnail(img4x2, 4)`.
- **Expected:** Calls `cloneToCanvas` path and preserves size.
- **Assertions:** Returned canvas `width===4`, `height===2`.

**Scenario: progressive downscale to target height.**
- **Setup:** `img` 2000×1000, `targetH=256`.
- **Inputs:** `generateThumbnail(img, 256)`.
- **Expected:**
  - Halves multiple times until height <= 512, then final draw to 256.
  - Final canvas height equals 256 and width scaled proportionally.
- **Assertions:**
  - Final `height === 256`.
  - Final `width === Math.floor(originalWidth * (256 / currentHeightBeforeFinal))`.
  - `imageSmoothingEnabled === true` set for each draw (can assert setter invoked in mock).

### `rotateCanvas`

**Scenario: 0° returns original canvas.**
- **Inputs:** `rotateCanvas(img2x3, 0)`.
- **Expected:** Exact same reference returned.
- **Assertions:** `result === img2x3`.

**Scenario: 90° swaps dimensions and pixels rotate correctly.**
- **Setup:** 2×3 canvas with unique per-pixel colors.
- **Inputs:** `rotateCanvas(img2x3, 90)`.
- **Expected:** New canvas size 3×2. Pixel at original (0,0) ends up at expected rotated position.
- **Assertions:**
  - `result.width === 3`, `result.height === 2`.
  - For a known pixel, verify expected RGBA at target coordinate after rotation (use `getImageData`).

### `rotateRect`

**Scenario: 0° yields shallow copy.**
- **Inputs:** `rotateRect({x:1,y:2,w:3,h:4}, 10, 20, 0)`.
- **Expected:** Same values, not same reference.
- **Assertions:** Deep equality on properties and `result !== original`.

**Scenario: 90° mapping uses `parentH - (y+h)` and swaps `w/h`.**
- **Inputs:** `rect={x:2,y:3,w:4,h:5}`, `parentW=100`, `parentH=50`, `rotation=90`.
- **Expected:** `{ x: 50 - (3+5), y: 2, w: 5, h: 4 }`.
- **Assertions:** Exact numeric equality.

**Scenario: 180° and 270° mappings.**
- **Inputs:** Same rect with rotations 180/270.
- **Expected:**
  - 180°: `{ x: 100 - (2+4), y: 50 - (3+5), w: 4, h: 5 }`.
  - 270°: `{ x: 3, y: 100 - (2+4), w: 5, h: 4 }`.
- **Assertions:** Exact numeric equality.

### `bakeRotation`

**Scenario: no-op when rotation is 0.**
- **Setup:** `state.rotation = 0`; spy `rotateCanvas`, `rebuildWorkingCopies`, `updateUI`.
- **Inputs:** `bakeRotation()`.
- **Expected:** No changes, no calls.
- **Assertions:** `rotateCanvas` not called; `state.rotation === 0`.

**Scenario: rotates layers, mask, updates fullDims/cropRect, clears history.**
- **Setup:**
  - `state.rotation = 90`.
  - `state.imgA`, `state.imgB` set to canvases with known sizes.
  - `maskCanvas` size matches `state.fullDims` and has known pixel(s).
  - `state.fullDims = { w: 200, h: 100 }` and `state.cropRect = { x: 10, y: 20, w: 50, h: 30 }` (pixel units as stored in this routine).
  - `frontLayerCanvas` exists.
  - `state.history` contains items; `state.historyIndex` set to 3.
- **Inputs:** `bakeRotation()`.
- **Expected:**
  - `state.imgA/B` replaced with rotated canvases.
  - `maskCanvas` resized to rotated size and previous content preserved (pixel re-mapped).
  - `state.fullDims` swapped to `{ w: 100, h: 200 }` for 90°.
  - `state.cropRect` rotated via `rotateRect` or reset to full dims if null.
  - `frontLayerCanvas` size updated to new full dims.
  - `state.rotation` reset to 0.
  - `rebuildWorkingCopies(true)` called.
  - History cleared: `history` empty, `historyIndex === -1`.
- **Assertions:**
  - Verify `rotateCanvas` called for each present layer + mask.
  - Verify `state.fullDims.w === 100`, `state.fullDims.h === 200`.
  - Verify `state.history.length === 0` and `state.historyIndex === -1`.

---

## 4. Working/preview layers

### `rebuildWorkingCopyForSlot`

**Scenario: no source clears working state.**
- **Setup:** `state.sourceA = null`.
- **Inputs:** `rebuildWorkingCopyForSlot('A')`.
- **Expected:** `state.workingA === null`, `state.workingVersionA === 0`.
- **Assertions:** Exact equality.

**Scenario: source exists and no active adjustments.**
- **Setup:** `state.sourceA = img2x3`; stub `hasActiveAdjustments` to return `false`.
- **Inputs:** `rebuildWorkingCopyForSlot('A')`.
- **Expected:**
  - New canvas matches source size and pixels.
  - `state.workingVersionA === state.adjustmentsVersion`.
  - `rebuildPreviewLayerForSlot` called.
- **Assertions:**
  - Compare pixel data of `state.workingA` to `img2x3`.
  - `rebuildPreviewLayerForSlot` called with `'A'`.

**Scenario: source exists and adjustments active.**
- **Setup:** `hasActiveAdjustments` returns `true`; stub `applyMasterLUT`, `applyColorOps`, `applySelectiveColor`.
- **Inputs:** `rebuildWorkingCopyForSlot('A')`.
- **Expected:** Each adjustment function called once, `putImageData` called.
- **Assertions:** Verify each spy called with `ImageData`.

### `rebuildWorkingCopies`

**Scenario: forceVersionBump increments adjustmentsVersion.**
- **Setup:** `state.adjustmentsVersion = 3`; spy `markAdjustmentsDirty`, `rebuildWorkingCopyForSlot`.
- **Inputs:** `rebuildWorkingCopies(true)`.
- **Expected:** `markAdjustmentsDirty` called; rebuild called for `A` and `B`.
- **Assertions:** Spies invoked with correct parameters.

### `rebuildPreviewLayerForSlot`

**Scenario: skip when preview disabled or full resolution.**
- **Setup:** `state.settings.brushPreviewResolution = 'Full'`, `state.workingA = img2x3`.
- **Inputs:** `rebuildPreviewLayerForSlot('A')`.
- **Expected:** No changes to `previewWorkingA` or `previewWorkingVersionA`.
- **Assertions:** Values unchanged.

**Scenario: missing working clears preview state.**
- **Setup:** `state.workingA = null`.
- **Inputs:** `rebuildPreviewLayerForSlot('A')`.
- **Expected:** `previewWorkingA === null`, `previewWorkingVersionA === 0`, `previewScaleA === 1`.
- **Assertions:** Exact equality.

**Scenario: downscaled preview built.**
- **Setup:** `state.workingA` 4000×2000; `state.settings.brushPreviewResolution = 1000`, `state.adjustmentsVersion = 7`.
- **Inputs:** `rebuildPreviewLayerForSlot('A')`.
- **Expected:**
  - `previewScaleA === 0.5`.
  - `previewWorkingA` size 2000×1000.
  - `previewWorkingVersionA === 7`.
- **Assertions:** Exact numeric equality.

### `getLayerForRender`

**Scenario: no source returns null layer.**
- **Setup:** `state.imgA = null`.
- **Inputs:** `getLayerForRender('A')`.
- **Expected:** `{ img: null, scale: 1 }`.
- **Assertions:** Deep equality.

**Scenario: adjustments hidden bypasses working.**
- **Setup:** `state.imgA = img2x3`; `state.adjustmentsVisible = false`.
- **Inputs:** `getLayerForRender('A', { useBakedLayers: true })`.
- **Expected:** returns source image with scale 1.
- **Assertions:** `result.img === state.imgA`.

**Scenario: stale working triggers rebuild.**
- **Setup:** `state.adjustmentsVisible = true`; `state.workingA = null`; `state.adjustmentsVersion = 2`; spy `rebuildWorkingCopyForSlot`.
- **Inputs:** `getLayerForRender('A')`.
- **Expected:** rebuild called, result uses `state.workingA` if created or falls back to source.
- **Assertions:** `rebuildWorkingCopyForSlot('A')` called once.

**Scenario: prefer preview uses preview layer when version matches.**
- **Setup:** `state.previewWorkingA` exists and `previewWorkingVersionA === adjustmentsVersion`; `state.previewScaleA = 0.5`.
- **Inputs:** `getLayerForRender('A', { preferPreview: true })`.
- **Expected:** returns preview layer + scale.
- **Assertions:** `result.img === state.previewWorkingA`, `result.scale === 0.5`.

---

## 5. Rendering pipeline

### `renderToContext`

**Scenario: returns early without crop.**
- **Setup:** `state.cropRect = null`, `state.isCropping = false`.
- **Inputs:** `renderToContext(ctx, 100, 100)`.
- **Expected:** only `clearRect` executed.
- **Assertions:** `drawImage` not called.

**Scenario: legacy boolean options map to proper defaults.**
- **Setup:** `state.cropRect` set; `state.backVisible = true`, `state.maskVisible = true`.
- **Inputs:** `renderToContext(ctx, 100, 100, true, true, false, true)`.
- **Expected:** `forceOpacity=true`, `useBakedLayers=true`, `preferPreview=false`, `allowRebuild=true`.
- **Assertions:** Inspect behavior via derived `globalAlpha` and call paths.

**Scenario: mask_alpha render uses destination-out with white background.**
- **Setup:**
  - `state.cropRect = { x: 0, y: 0, w: 1, h: 1 }`, `state.fullDims = { w: 2, h: 3 }`.
  - `maskCanvas` set to `mask2x3`.
  - `state.previewMaskCanvas = null`, `state.isPreviewing = false`.
- **Inputs:** `renderToContext(ctx, 2, 3, { renderMode: 'mask_alpha' })`.
- **Expected:**
  - Background filled white.
  - `globalCompositeOperation` switches to `destination-out`.
  - Mask drawn once at full size.
- **Assertions:**
  - `ctx.fillStyle === '#FFFFFF'` for background.
  - `ctx.globalCompositeOperation` set to `'destination-out'` before draw.

**Scenario: mask_grayscale fills black behind mask holes.**
- **Setup:** same as above.
- **Inputs:** `renderToContext(ctx, 2, 3, { renderMode: 'mask_grayscale' })`.
- **Expected:** After destination-out, fills black with `destination-over`.
- **Assertions:**
  - `ctx.globalCompositeOperation` set to `'destination-over'` for final fill.

**Scenario: composite render uses back/front with mask and opacity.**
- **Setup:**
  - `state.imgA` and `state.imgB` set; `state.isAFront = true`.
  - `state.cropRect = { x: 0, y: 0, w: 1, h: 1 }`, `state.fullDims = { w: 2, h: 3 }`.
  - `state.previewFrontLayer` exists.
  - `state.maskVisible = true` and `maskCanvas` populated.
  - `state.opacity = 0.5` and both layers present.
- **Inputs:** `renderToContext(ctx, 2, 3, { renderMode: 'composite' })`.
- **Expected:**
  - Back layer drawn with `globalAlpha=1`.
  - Front layer drawn onto preview layer, then mask applied with destination-out.
  - Final draw uses `globalAlpha = state.opacity` because both layers exist.
- **Assertions:**
  - `ctx.globalAlpha === 0.5` before final `drawImage` of preview layer.

### `render`

**Scenario: throttles during adjustment preview.**
- **Setup:** `state.isAdjusting = true`, `state.previewThrottle` set to `Date.now()`.
- **Inputs:** `render(false)`.
- **Expected:** render returns early when within 500ms.
- **Assertions:** No draw operations executed.

**Scenario: downscaled preview composite path.**
- **Setup:**
  - `state.useFastPreview = true`.
  - `state.settings.brushPreviewResolution = 1080` and `state.isAdjusting = false`.
  - `state.cropRect` set and `state.fullDims` set.
  - `state.previewCanvas` exists and `mainCanvas` exists.
- **Inputs:** `render(false)`.
- **Expected:**
  - `mainCanvas.style.visibility = 'hidden'`.
  - `previewCanvas` becomes visible (`classList` removes `hidden`).
  - Preview canvas size scaled relative to crop and rotation.
- **Assertions:**
  - Check `previewCanvas.width/height` values.
  - `mainCanvas.style.visibility === 'hidden'`.

---

## 6. Crop workflows

### `toggleCropMode`

**Scenario: entering crop mode.**
- **Setup:**
  - `canDraw()` stub returns true.
  - `state.isCropping = false`, `state.cropRect` set.
  - `els.cropBtn`, `els.viewport`, `#hint-legend`, `#crop-hint-legend` exist.
  - Spy `updateCanvasDimensions`, `resetView`, `render`, `updateUI`.
- **Inputs:** `toggleCropMode()`.
- **Expected:**
  - `state.isCropping === true` and `state.cropRectSnapshot` copied.
  - `cropBtn` gains `active` + `text-yellow-400`.
  - `viewport` gets `cropping` class.
  - Standard legend hidden, crop legend shown.
- **Assertions:**
  - `els.cropBtn.classList.contains('active') === true`.
  - `els.viewport.classList.contains('cropping') === true`.
  - `updateCanvasDimensions(true)` called.

**Scenario: exiting crop mode with auto-trim.**
- **Setup:** `state.isCropping = true`, `state.cropRectSnapshot` non-null; spy `trimCropRectToImageBounds`.
- **Inputs:** `toggleCropMode({ applyAutoTrim: true })`.
- **Expected:**
  - `trimCropRectToImageBounds` called.
  - `cropBtn` classes removed, `viewport` class removed.
  - Legends restored.
- **Assertions:** class toggles and spy call.

### `acceptCrop`

**Scenario: apply crop and dispatch action.**
- **Setup:** `state.isCropping = true`, `state.cropRect` set, `dispatchAction` spy.
- **Inputs:** `acceptCrop()`.
- **Expected:**
  - `trimCropRectToImageBounds` called.
  - `toggleCropMode({ applyAutoTrim: false })` called.
  - `dispatchAction` receives type `CROP` with rect.
- **Assertions:** `dispatchAction` called once with payload matching final rect snapshot.

### `cancelCrop`

**Scenario: restore snapshot and exit.**
- **Setup:** `state.isCropping = true`, `state.cropRectSnapshot` set to known rect.
- **Inputs:** `cancelCrop()`.
- **Expected:** `state.cropRect` restored from snapshot, `cropDrag` cleared, `toggleCropMode({ applyAutoTrim: false })` called.
- **Assertions:** deep equality for restored rect.

### `trimCropRectToImageBounds`

**Scenario: clamp crop to image bounds without rotation.**
- **Setup:**
  - `state.fullDims = { w: 1000, h: 500 }`.
  - `state.rotation = 0`, `state.cropRotation = 0`.
  - `state.cropRect = { x: -0.1, y: -0.1, w: 1.5, h: 1.2 }`.
- **Inputs:** `trimCropRectToImageBounds()`.
- **Expected:** Output crop rect within image bounds, minimum `w/h >= 0.001`.
- **Assertions:**
  - `state.cropRect.x >= 0` and `state.cropRect.y >= 0`.
  - `state.cropRect.w <= (state.fullDims.w / state.fullDims.h)`.
  - `state.cropRect.h <= 1`.

**Scenario: rotation-aware clamping.**
- **Setup:** `state.rotation = 90`, `state.cropRotation = 30`, `state.cropRect` extends outside.
- **Inputs:** `trimCropRectToImageBounds()`.
- **Expected:**
  - Output rect stays within rotated bounds.
  - Center preserved as close as possible.
- **Assertions:**
  - Resulting `cropRect` corresponds to visual bounds (assert via recomputed visual rect from returned props and ensure within min/max).

### `updateCanvasDimensions`

**Scenario: no images returns without changes.**
- **Setup:** `state.imgA = null`, `state.imgB = null`.
- **Inputs:** `updateCanvasDimensions()`.
- **Expected:** No resizing or crop changes.
- **Assertions:** Spies `resizeMainCanvas` and `resetView` not called.

**Scenario: updates union dims, crop rect, and mask size.**
- **Setup:**
  - `state.imgA` and `state.imgB` with different sizes.
  - `maskCanvas` has initial dimensions.
  - `state.cropRect` null.
- **Inputs:** `updateCanvasDimensions(false, false)`.
- **Expected:**
  - `state.fullDims` equals union dims.
  - `state.cropRect` set to full frame proportions.
  - `maskCanvas` resized and content preserved.
  - `resizeMainCanvas` called with visual dims (rotated if applicable).
- **Assertions:** Validate fullDims and cropRect values, mask canvas size, `canvas-wrapper` style width/height.

**Scenario: preserve view avoids reset.**
- **Setup:** `preserveView = true`.
- **Inputs:** `updateCanvasDimensions(true, false)`.
- **Expected:** `resetView` not called.
- **Assertions:** `resetView` spy not invoked.

### `resizeMainCanvas`

**Scenario: resizes main and front layer canvases.**
- **Setup:** `els.mainCanvas`, `frontLayerCanvas` exist.
- **Inputs:** `resizeMainCanvas(640, 480)`.
- **Expected:** Both canvas sizes updated, workspace label refreshed.
- **Assertions:** `els.mainCanvas.width === 640`, `frontLayerCanvas.height === 480`, `updateWorkspaceLabel` called once.

---

## 7. Layer management

### `setLayerSource`

**Scenario: assigns base image, thumb, and resets versions.**
- **Setup:** Provide `img2x3` and stub `cloneToCanvas`, `generateThumbnail`.
- **Inputs:** `setLayerSource('A', img2x3)`.
- **Expected:**
  - `state.imgA === cloned canvas`, `state.sourceA === cloned canvas`.
  - `state.thumbA` set to thumbnail.
  - `workingVersionA === 0`, `previewWorkingVersionA === 0`.
- **Assertions:** strict equality on assigned refs.

### `assignLayer`

**Scenario: first image load (wasEmpty) auto-fits view.**
- **Setup:**
  - `state.imgA = null`, `state.imgB = null`.
  - `AssetManager.addAsset` returns `asset-1`.
  - `els.viewport.clientWidth/Height` set to known values.
  - `state.view.scale` set large to trigger fit.
  - Spies: `resetView`, `updateCanvasDimensions`, `render`, `updateUI`.
- **Inputs:** `assignLayer(img2x3, 'A', 'photo.png')`.
- **Expected:**
  - `state.assetIdA === 'asset-1'`, `state.nameA === 'photo.png'`, `state.formatA === 'PNG'`.
  - `state.fullDims` set via `getUnionDims`.
  - `state.cropRect` framed to front layer width.
  - `resetView` called (auto-fit).
  - `dispatchAction` with type `LOAD_IMAGE`.
- **Assertions:** Validate crop rect calculations: `x === offX / fullH`, `w === visW / fullH`.

### `clearLayer`

**Scenario: clearing last remaining layer resets state.**
- **Setup:** `state.imgA` populated, `state.imgB = null`.
- **Inputs:** `clearLayer('A')`.
- **Expected:**
  - Both layers null, `cropRect === null`.
  - Calls `resetAllAdjustments`, `resetView`, `updateUI`.
  - Canvas hidden and empty state shown.
- **Assertions:** Check DOM class changes and function calls.

**Scenario: clearing one of two layers preserves other and updates canvas.**
- **Setup:** `state.imgA` and `state.imgB` set.
- **Inputs:** `clearLayer('B')`.
- **Expected:**
  - `imgB/sourceB/workingB` cleared.
  - `rebuildWorkingCopies` called.
  - `updateCanvasDimensions(true)` called.
- **Assertions:** spies invoked, state updated.

### `mergeDown`

**Scenario: merges composite into slot A.**
- **Setup:**
  - `canDraw()` returns true.
  - `state.imgA` and `state.imgB` exist.
  - Stub `scheduleHeavyTask` to run immediately.
  - Stub `render` to draw into `els.mainCanvas`, `loadImageSource` resolves a new canvas.
- **Inputs:** `mergeDown()`.
- **Expected:**
  - `state.imgB` cleared, `state.assetIdB` null.
  - `state.imgA` set to merged image, name set to "Merged Layer".
  - Crop preserved or defaulted, `cropRotation` reset to 0.
  - Mask cleared and working copies rebuilt with version bump.
  - UI updated and `dispatchAction` with `MERGE_LAYERS`.
- **Assertions:** verify final state flags (`isAFront === true`, `opacity === 1.0`, opacity UI values at 100%).

### `applyCensor`

**Scenario: builds censored back layer and resets brush defaults.**
- **Setup:**
  - One image loaded in A or B.
  - Stub `scheduleHeavyTask` to run immediately.
  - Stub `loadImageSource` to resolve canvases for base/censored layers.
- **Inputs:** `applyCensor()`.
- **Expected:**
  - Base layer assigned to A, censored layer assigned to B with new asset IDs.
  - Mask reset, crop rotation reset, opacity forced to 1.0.
  - Brush settings reset and feather mode enabled.
  - `dispatchAction` called with `APPLY_CENSOR`.
- **Assertions:**
  - `state.brushSettings.erase.brushSize === 0.1` and `state.brushSettings.repair.brushSize === 0.05`.
  - `state.featherMode === true` (via `setFeatherMode(true, ...)` spy).

---

## 8. IO handling

### `handleFileLoad`

**Scenario: no file resolves without side effects.**
- **Inputs:** `handleFileLoad(null, 'A')`.
- **Expected:** Promise resolves; no calls to `assignLayer`.
- **Assertions:** `assignLayer` spy not called.

**Scenario: stego handler short-circuits assignment.**
- **Setup:** `resolveStegoLoad` resolves `{ handled: true }`.
- **Inputs:** `handleFileLoad(file, 'A')`.
- **Expected:** `assignLayer` not called.
- **Assertions:** spy not called.

**Scenario: assigns layer on success.**
- **Setup:** `resolveStegoLoad` resolves `{ handled: false, image: img2x3 }`.
- **Inputs:** `handleFileLoad(file, 'A')`.
- **Expected:** `assignLayer(img2x3, 'A', file.name)` called.
- **Assertions:** spy called with correct args.

### `fetchImage`

**Scenario: direct fetch success.**
- **Setup:** Stub `fetch` to return `ok: true` and blob type `image/png`.
- **Inputs:** `fetchImage('https://example.com/a.png')`.
- **Expected:** Resolves to blob.
- **Assertions:** `blob.type.startsWith('image/')`.

**Scenario: direct fetch fails and proxy is used.**
- **Setup:** `state.settings.proxyUrl = 'https://proxy/?{url}'`, `fetch` rejects for first call and succeeds for proxy URL.
- **Inputs:** `fetchImage('https://example.com/a.png')`.
- **Expected:** Second fetch uses proxy with encoded URL.
- **Assertions:** `fetch` called with `https://proxy/?https%3A%2F%2Fexample.com%2Fa.png`.

### `handlePaste`

**Scenario: ignores paste in input/textarea.**
- **Setup:** `e.target.tagName = 'INPUT'`.
- **Inputs:** `handlePaste(e)`.
- **Expected:** No processing.
- **Assertions:** `loadLayerWithSmartSlotting` not called.

**Scenario: uses valid blob from clipboard.**
- **Setup:** Clipboard contains one image blob with size > 0.
- **Inputs:** `handlePaste(e)`.
- **Expected:** `loadLayerWithSmartSlotting(blob, 'Pasted Image')` called.
- **Assertions:** spy called once with correct name.

**Scenario: uses URL from text data.**
- **Setup:** Clipboard strings include `https://example.com/img.png`, no valid blobs. `fetchImage` resolves to blob.
- **Inputs:** `handlePaste(e)`.
- **Expected:** `fetchImage` called, then `loadLayerWithSmartSlotting(blob, 'Pasted URL')`.
- **Assertions:** spies called in order.

**Scenario: parses `<img src="...">` HTML.**
- **Setup:** Clipboard contains `text/html` with `<img src="https://example.com/a.png">`.
- **Inputs:** `handlePaste(e)`.
- **Expected:** Extracted URL is fetched.
- **Assertions:** `fetchImage` called with extracted URL.

### `setupDragAndDrop`

**Scenario: dragenter adds body class, dragleave removes when leaving.**
- **Setup:** `document.body` exists; call `setupDragAndDrop()`.
- **Inputs:** Dispatch `dragenter` then `dragleave` with `relatedTarget = null`.
- **Expected:** `body.classList` toggles `dragging`.
- **Assertions:** class presence toggles appropriately.

**Scenario: drop with single image file.**
- **Setup:** `dataTransfer.files` contains one image file.
- **Inputs:** Dispatch `drop` event.
- **Expected:** `loadLayerWithSmartSlotting(file, file.name)` called.
- **Assertions:** spy called with correct args.

**Scenario: drop with two images prompts overwrite when both slots occupied.**
- **Setup:** `state.imgA` and `state.imgB` set; `showModal` resolves `true`.
- **Inputs:** Dispatch drop with two image files.
- **Expected:** `handleFileLoad` called for A and B, `resetView` called.
- **Assertions:** verify call order and counts.

---

## 9. UI maintenance

### `updateUI`

**Scenario: disables/enables controls based on state and cropping.**
- **Setup:**
  - `state.imgA` loaded, `state.imgB` null.
  - `state.isCropping = true`.
  - `window.ActionHistory` stub with cursor/log.
- **Inputs:** `updateUI()`.
- **Expected:**
  - Merge/censor disabled based on `canDraw`.
  - Undo/redo disabled during crop.
  - Brush controls disabled while cropping.
  - Opacity slider disabled when only one image loaded.
  - Empty state hidden when an image exists.
- **Assertions:** Check `disabled` states and DOM visibility.

### `updateVisibilityToggles`

**Scenario: toggles mask/back/adjustments icons and classes.**
- **Setup:** Set `state.maskVisible = false`, `state.backVisible = false`, `state.adjustmentsVisible = false`.
- **Inputs:** `updateVisibilityToggles()`.
- **Expected:** Each toggle button has `bg-accent-dark`, `border-accent-strong`, `accent-icon`; open/closed eye icons are swapped.
- **Assertions:** `maskEyeOpen` hidden, `maskEyeClosed` visible; same for back and adjustments.

### `updateWorkspaceLabel`

**Scenario: hides label when nothing can draw.**
- **Setup:** `canDraw()` returns false.
- **Inputs:** `updateWorkspaceLabel()`.
- **Expected:** `workspaceResolution` hidden.
- **Assertions:** `style.display === 'none'`.

**Scenario: shows label with dimensions.**
- **Setup:** `canDraw()` true; `els.mainCanvas.width/height` set to 120×80.
- **Inputs:** `updateWorkspaceLabel()`.
- **Expected:** Text content equals `120×80`.
- **Assertions:** exact match plus `checkResolutionOverlap` called once.

### `syncDrawerHeights`

**Scenario: sets uniform height based on tallest drawer.**
- **Setup:** create `.drawer-inner` elements with `offsetHeight` values 100 and 200; `.drawer-content` elements exist.
- **Inputs:** `syncDrawerHeights()`.
- **Expected:** each `.drawer-content` height set to `202px` (max + 2).
- **Assertions:** inline style `height` equals `202px`.

### `initDrawerSync`

**Scenario: wires ResizeObserver and window resize.**
- **Setup:** stub `ResizeObserver` constructor and `observe` method; spy `syncDrawerHeights`.
- **Inputs:** `initDrawerSync()`.
- **Expected:**
  - Each `.drawer-inner` observed.
  - `syncDrawerHeights` called via `setTimeout` after 100ms and via `ResizeObserver` callback.
- **Assertions:** `observe` call count matches number of inner drawers.

### `showModal`

**Scenario: displays modal, resolves with chosen value, and cleans up.**
- **Setup:** modal elements exist; fake timers enabled.
- **Inputs:** `showModal('Title', 'Message', [{label:'Yes', value:true}], true)`.
- **Expected:**
  - Overlay becomes visible (`hidden` removed, `visible` added).
  - Clicking choice resolves `true` and starts cleanup (opacity-0).
  - After 200ms, overlay is hidden again.
- **Assertions:**
  - Promise resolves with `true`.
  - `overlay.classList.contains('hidden') === true` after timer advance.

**Scenario: cancellable close returns null.**
- **Setup:** same as above.
- **Inputs:** Trigger `closeBtn.onclick()`.
- **Expected:** Promise resolves `null`.
- **Assertions:** resolved value is `null`.

### `scheduleHeavyTask`

**Scenario: runs task immediately when loading overlay missing.**
- **Setup:** `els.loadingOverlay = null`; `taskFn` spy.
- **Inputs:** `scheduleHeavyTask(taskFn)`.
- **Expected:** Task called synchronously.
- **Assertions:** `taskFn` called once.

**Scenario: toggles loading overlay and handles errors.**
- **Setup:** `els.loadingOverlay` element with `hidden` class; `taskFn` rejects.
- **Inputs:** `scheduleHeavyTask(taskFn)` with fake timers and mocked `requestAnimationFrame`.
- **Expected:**
  - Overlay shows during task (`hidden` removed).
  - On completion/error, overlay hidden again.
  - Error logged via `console.error` and `log`.
- **Assertions:**
  - Overlay class toggles (`hidden` removed then added).
  - `console.error` and `log` called with error message.

---

## Notes on Coverage

- Ensure direct tests for **cropping rotation** paths and the **preview compositing** branch in `render()`.
- Add regression tests for `applyCensor`/`mergeDown` where `state.isCropping` is true to validate restoration of crop mode and canvas sizes.
- Include at least one test verifying `updateUI()` sets undo/redo titles based on `ActionHistory` logs and `replayEngine.undoFloor`.

