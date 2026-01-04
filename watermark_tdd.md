# Watermark Unit-Test Blueprint (watermark_tdd.md)

## Scope
Unit tests for `scripts/watermark.js` covering `rotatePoint`, `buildMaskCanvas`, `Watermark.apply`, `Watermark.checkAndRemove`, and `Watermark.buildMask`.

## Test Harness & Conventions
- **Environment**: Browser test runner or JSDOM + `canvas`.
- **Helpers**:
  - `makeCanvas(w, h, fillRGBA)`.
  - `getPixel(ctx, x, y)` returns `[r,g,b,a]`.
  - `isOpaque([r,g,b,a])` -> `a === 255`.
  - `isTransparent([r,g,b,a])` -> `a === 0`.
- **Deterministic Settings**: use fixed sizes (e.g., 100x60) so scale/spacing are stable.

## Shared Fixtures
- **Canvas sizes**:
  - Small: `width=100`, `height=60`.
  - Tiny: `width=20`, `height=20` (for minimal mask sampling).
- **Known coordinates**: sample points derived from algorithm:
  - `cx = width / 2`, `cy = height / 2`.
  - Use expected `scale = Math.max(1, Math.floor((height * 0.016) / 5))`.

## `rotatePoint` Tests
### 1. Deterministic rounding (0 degrees)
- **Scenario**: No rotation should return original integer coords.
- **Setup**: `x=10, y=15, cx=0, cy=0, sin=0, cos=1`.
- **Inputs**: `rotatePoint(10,15,0,0,0,1)`.
- **Expected**: `{ x: 10, y: 15 }`.
- **Assertions**:
  - `expect(result).toEqual({ x: 10, y: 15 })`.

### 2. 90-degree rotation around center
- **Scenario**: Rotate point (cx+1, cy) by 90° -> (cx, cy+1) after rounding.
- **Setup**: `cx=5, cy=5, x=6, y=5`, `sin=1`, `cos=0`.
- **Inputs**: `rotatePoint(6,5,5,5,1,0)`.
- **Expected**: `{ x: 5, y: 6 }`.
- **Assertions**:
  - `expect(result).toEqual({ x: 5, y: 6 })`.

### 3. 180-degree rotation (deterministic rounding)
- **Scenario**: Rotate point (cx+2, cy-1) by 180° -> (cx-2, cy+1).
- **Setup**: `cx=10, cy=10, x=12, y=9`, `sin=0`, `cos=-1`.
- **Inputs**: `rotatePoint(12,9,10,10,0,-1)`.
- **Expected**: `{ x: 8, y: 11 }`.
- **Assertions**:
  - `expect(result).toEqual({ x: 8, y: 11 })`.

## `buildMaskCanvas` Tests
### 1. Output size matches input
- **Scenario**: Mask canvas should be exactly width x height.
- **Setup**: `buildMaskCanvas(100, 60)`.
- **Inputs**: call function.
- **Expected**: canvas width/height are 100/60.
- **Assertions**:
  - `expect(canvas.width).toBe(100)`
  - `expect(canvas.height).toBe(60)`.

### 2. Tiling coverage (non-empty alpha)
- **Scenario**: Tiled text should place opaque pixels across the canvas.
- **Setup**: `buildMaskCanvas(100, 60)`.
- **Inputs**: sample pixels at multiple quadrants.
- **Expected**: at least one pixel in each quadrant has alpha 255.
- **Assertions**:
  - `expect(alphaAt(10,10)).toBe(255)` OR collect and assert count of opaque pixels per quadrant > 0.

### 3. Binary alpha thresholding
- **Scenario**: alpha should be strictly 0 or 255 after threshold.
- **Setup**: `buildMaskCanvas(100, 60)`; read all pixels.
- **Inputs**: imageData.
- **Expected**: no alpha values between 1 and 254.
- **Assertions**:
  - `expect(alphaValues.every(a => a === 0 || a === 255)).toBe(true)`.

### 4. Deterministic pattern at known coordinates
- **Scenario**: Given fixed size, the mask should be deterministic.
- **Setup**:
  - Build mask at 100x60.
  - Select a known coordinate based on expected text placement, e.g. center point `(50,30)` and a second point `(5,5)`.
- **Inputs**: `getPixel` at those coordinates.
- **Expected**: explicit alpha values. Example:
  - `alpha(50,30) === 255`
  - `alpha(5,5) === 0`
- **Assertions**:
  - `expect(pixelAt(50,30)[3]).toBe(255)`
  - `expect(pixelAt(5,5)[3]).toBe(0)`.

## `Watermark.apply` and `checkAndRemove` Tests
### 1. apply uses difference composite
- **Scenario**: Applying watermark twice cancels due to XOR/difference behavior.
- **Setup**:
  - Create canvas 20x20 filled with `[10,10,10,255]`.
  - Capture original `ImageData` as `before`.
  - Call `Watermark.apply(ctx, 20, 20)` twice.
- **Inputs**: apply twice.
- **Expected**: final canvas equals original `before`.
- **Assertions**:
  - `expect(after.data).toEqual(before.data)`.

### 2. checkAndRemove is idempotent
- **Scenario**: If watermark already applied, `checkAndRemove` restores original; calling again leaves it unchanged.
- **Setup**:
  - Fill canvas, call `apply` once.
  - Capture `watermarked` state.
  - Call `checkAndRemove` -> should revert to original.
  - Call `checkAndRemove` again -> stays original.
- **Inputs**: `Watermark.checkAndRemove(canvas)` twice.
- **Expected**: second call leaves pixels equal to original.
- **Assertions**:
  - `expect(afterFirstRemoval).toEqual(original)`
  - `expect(afterSecondRemoval).toEqual(original)`.

## `buildMask` Tests
### 1. Returns ImageData with expected alpha distribution
- **Scenario**: Output ImageData is same dimensions with binary alpha.
- **Setup**: `buildMask(100, 60)`.
- **Inputs**: call function.
- **Expected**: `ImageData.width === 100`, `ImageData.height === 60`, alpha values only 0 or 255, and count of alpha 255 > 0.
- **Assertions**:
  - `expect(imageData.width).toBe(100)`
  - `expect(imageData.height).toBe(60)`
  - `expect(alphaValues.every(a => a === 0 || a === 255)).toBe(true)`
  - `expect(alphaValues.filter(a => a === 255).length).toBeGreaterThan(0)`.
