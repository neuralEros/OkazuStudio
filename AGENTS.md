# OkazuStudio Agent Guide

## What this project does
- Single-page web app for compositing two user-provided images (slots A and B) with masking and pixel-level adjustments.
- Users load or drag/drop images, paint an erase/repair mask to reveal the rear image through the front image, adjust blending opacity, and export a flattened PNG.
- Provides a rich toolset: undo/redo history, brush sizing/hardness, pan/zoom navigation, cropping workflow with dimmer overlay, swap front/back images, toggle mask/back visibility, censor (blur/mosaic) helper, and merge-to-front utility.
- Adjustment drawer applies gamma/levels, shadows/highlights, saturation/vibrance, white balance, and RGB color balance via lookup tables before final render.

## High-level architecture
- **index.html** hosts all UI markup, styling (Tailwind CDN + custom CSS), and JavaScript logic—no build step.
- **undo.js** encapsulates history/undo helpers while `main.js` wires them to state, rendering, and UI controls.
- **State & elements**: a central `state` object tracks images, view transforms, brush/mask settings, adjustment values, history, and cropping data. `els` caches DOM references for fast event wiring.
- **Canvas stack**: main display canvas (`#mainCanvas`) sits inside a transformable wrapper (`#canvas-wrapper`) controlled by the viewport for pan/zoom. Offscreen canvases include `maskCanvas` (brush strokes), `frontLayerCanvas` (front image after mask), and preview canvases for throttled adjustment previews.
- **Input handling**: pointer/wheel listeners support brush painting (with optional polyline mode via Ctrl-click), panning (space drag), zooming (wheel), cropping drag handles, and keyboard shortcuts (undo/redo, view reset). Drag-and-drop auto-assigns images.
- **Rendering pipeline**: image load updates canvas dimensions, the render routine composites the front/back images through the mask with optional opacity, applies LUT-driven adjustments and color operations, and refreshes previews during slider drags. Snapshot history enables undo/redo of mask and adjustment changes.
- **Exports & utilities**: export saves the adjusted composition as PNG; merge moves the visible composite into slot A; censor creates blurred/mosaicked background mask; clear/reset helpers wipe mask and adjustments.

## Contribution expectations
- Keep this file up to date as you modify architecture, state shape, rendering flow, or major features—future agents rely on it as the shared scratch-pad.
- Prefer adding brief notes about new canvases, modules, or workflows when you touch them.
