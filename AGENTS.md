# OkazuStudio Agent Guide

## What this project does
- Single-page web app for compositing two user-provided images (slots A and B) with masking and pixel-level adjustments.
- Users load or drag/drop images, paint an erase/repair mask to reveal the rear image through the front image, adjust blending opacity, and export a flattened PNG.
- Provides a rich toolset: undo/redo history, brush sizing/hardness, pan/zoom navigation, cropping workflow with dimmer overlay, swap front/back images, toggle mask/back visibility, censor (blur/mosaic) helper, and merge-to-front utility.
- Adjustment drawer applies gamma/levels, shadows/highlights, saturation/vibrance, white balance, and RGB color balance via lookup tables before final render.

## High-level architecture
- **index.html** hosts all UI markup, styling (Tailwind CDN + custom CSS), and JavaScript logic—no build step.
- **scripts/undo.js** encapsulates history/undo helpers while `scripts/main.js` wires them to state, rendering, and UI controls.
- **scripts/state.js** provides a browser-only factory for fresh default state objects used by `scripts/main.js` and future tests.
- **scripts/adjustments.js** holds LUT/color adjustment logic and UI wiring, with `scripts/main.js` delegating slider handling and image filtering to it.
- **scripts/input.js** owns pointer/keyboard handlers, panning/zooming, crop interactions, and brush cursor updates, with `scripts/main.js` consuming the exported hooks.
- **scripts/geometry.js** provides reusable, DOM-free geometry helpers shared by input and future tooling.
- **scripts/kakushi.js** provides LSB steganography helpers for embedding and extracting small payloads in PNG pixel data.
- **Determinism hooks**: `AssetManager` and `ReplayEngine` accept optional time/ID providers (constructor options or setter helpers) to make deterministic browser testing possible without altering runtime behavior.
- **Core namespaces**: `scripts/geometry.js`, `scripts/state.js`, and `scripts/adjustments-core.js` expose browser-only global helpers on `window.Geometry`, `window.StateFactory`, and `window.AdjustmentsCore`.
- **scripts/test-utils.js** provides deterministic canvas/ImageData generators for offline browser-only tests.
- **State & elements**: a central `state` object tracks images, view transforms, brush/mask settings (including per-mode hardness + fixed-feather px values and the global feather mode toggle), adjustment values, history, cropping data, the active top-level mode (master/censor/composite) that drives UI visibility, plus session-only flags like the save-merge warning. `els` caches DOM references for fast event wiring.
- **Brush presets**: `state.brushSettings` keeps per-mode brush size/hardness (erase defaults to 10% size, repair defaults to 5% with shared hardness) so swapping modes restores each brush's last settings.
- **Canvas stack**: main display canvas (`#mainCanvas`) sits inside a transformable wrapper (`#canvas-wrapper`) controlled by the viewport for pan/zoom. A `#previewCanvas` overlays the main canvas to display low-resolution composites during high-performance interactions (drawing). Offscreen canvases include `maskCanvas` (brush strokes), `frontLayerCanvas` (front image after mask), and preview canvases for throttled adjustment previews.
- **Adjusted layer copies**: each loaded image has a working canvas (`state.workingA`/`state.workingB`) that bakes current adjustments so regular renders can composite without per-frame pixel filtering. Working copies are rebuilt when sliders finish changing or when images are replaced, and a version counter keeps baked canvases in sync with the latest adjustments so renders never recompute filters every frame. Downscaled 1080p previews (`previewWorkingA`/`previewWorkingB`) mirror the baked layers and power fast brush interactions without sacrificing fidelity when strokes are replayed at full resolution. A fast preview composite path assembles the scene into a 1080p buffer while the user is actively drawing so full-resolution layers stay untouched until interaction ends.
- **Input handling**: pointer/wheel listeners support brush painting (with optional polyline mode via Ctrl-click), panning (space drag), zooming (wheel), cropping drag handles, and keyboard shortcuts (undo/redo, view reset). Drag-and-drop auto-assigns images.
- **Rendering pipeline**: image load updates canvas dimensions, the render routine composites the front/back images through the mask with optional opacity, applies LUT-driven adjustments and color operations, and refreshes previews during slider drags. Snapshot history enables undo/redo of mask and adjustment changes.
- **Exports & utilities**: export saves the adjusted composition as PNG; merge moves the visible composite into slot A; censor creates blurred/mosaicked background mask; clear/reset helpers wipe mask and adjustments.
- **Watermark + Stego**: reversible watermarking uses a deterministic mask, and stego embedding skips watermark pixels so payloads remain readable even with visible watermark applied.

## Universal Coordinate System
- **Height-Based Proportions**: All stored spatial data—including crop rectangles, brush strokes, polyline points, brush sizes, and feather radii—are normalized as **proportions of the uncropped image height** (0.0 to 1.0+). This ensures resolution independence, allowing mask history to be deterministically replayed even if the underlying image is swapped for a higher/lower resolution version or a different asset.
- **Truth Space**: The coordinate system operates in "Truth Space", which corresponds to the pixel grid of the **unrotated, uncropped source image**.
- **Rotation Handling**: The application supports non-destructive 90/180/270-degree rotations. Input handlers (`scripts/input.js`) transform visual screen coordinates (which may be rotated and cropped) back into Truth Space before normalizing them to proportions. The renderer (`scripts/main.js`) performs the inverse transformation to display the content correctly.
- **Crop Logic**: The crop rectangle is stored as `{ x, y, w, h }` proportions in Truth Space. When rendering, these proportions are converted to pixels relative to the current source image height.

## Contribution expectations
- Keep this file up to date as you modify architecture, state shape, rendering flow, or major features—future agents rely on it as the shared scratch-pad.
- Prefer adding brief notes about new canvases, modules, or workflows when you touch them.
- Under no condition should you ever commit screenshots, test images, logs, or other cruft to the repository.
