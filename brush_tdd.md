# BrushKernel Unit Test Blueprint

## Scope
These tests target `scripts/brush.js` and validate the brush kernel’s deterministic canvas drawing logic.

## Test Environment
- **Framework**: Jest with JSDOM.
- **Canvas Mock**: Provide a fake 2D context with spies for `globalCompositeOperation`, `fillStyle`, `beginPath`, `arc`, `fill`, `createRadialGradient`, and gradient `addColorStop`.
- **Utilities**:
  - Use `jest.fn()` for all ctx methods.
  - Provide `createRadialGradient` mock that returns an object with `addColorStop` spy and recognizable identity.

## Test Data Fixtures
- **ctx**: mock 2D context with:
  - `globalCompositeOperation` (settable string property)
  - `fillStyle` (settable)
  - `beginPath`, `arc`, `fill` (spies)
  - `createRadialGradient` (spy returning `gradientMock`)
- **gradientMock**:
  - `addColorStop` spy

## Tests for `getSoftness(size, feather, featherMode)`

### 1. Size = 0 Returns 0
**Scenario:** Zero size yields zero softness.

**Setup:** None.

**Inputs:** `getSoftness(0, 5, false)`

**Expected Output:** `0`.

**Exact Assertions:**
1. `expect(getSoftness(0, 5, false)).toBe(0)`

### 2. Negative Size Returns 0
**Scenario:** Negative size should also yield 0 (radius <= 0).

**Setup:** None.

**Inputs:** `getSoftness(-10, 5, true)`

**Expected Output:** `0`.

**Exact Assertions:**
1. `expect(getSoftness(-10, 5, true)).toBe(0)`

### 3. Feather Mode On Uses `feather / radius`
**Scenario:** With featherMode on, softness is feather divided by radius and clamped to 1.

**Setup:** None.

**Inputs:** `getSoftness(20, 5, true)` (radius=10)

**Expected Output:** `0.5`.

**Exact Assertions:**
1. `expect(getSoftness(20, 5, true)).toBeCloseTo(0.5)`

### 4. Feather Mode Off Uses `feather / HARDNESS_MAX`
**Scenario:** With featherMode off, softness uses hardness mapping and clamps to [0,1].

**Setup:** None.

**Inputs:**
- `getSoftness(20, 10, false)` → `10/20 = 0.5`
- `getSoftness(20, 40, false)` → clamped to `1`

**Expected Output:** `0.5` and `1`.

**Exact Assertions:**
1. `expect(getSoftness(20, 10, false)).toBeCloseTo(0.5)`
2. `expect(getSoftness(20, 40, false)).toBe(1)`

### 5. Clamping to [0,1]
**Scenario:** Ensure softness never drops below 0 or above 1.

**Setup:** None.

**Inputs:**
- `getSoftness(20, -5, false)`
- `getSoftness(20, 1000, true)`

**Expected Output:** `0` and `1`.

**Exact Assertions:**
1. `expect(getSoftness(20, -5, false)).toBe(0)`
2. `expect(getSoftness(20, 1000, true)).toBe(1)`

### 6. Feather Greater Than Radius
**Scenario:** featherMode on should clamp feather>radius to 1.

**Setup:** None.

**Inputs:** `getSoftness(10, 100, true)` (radius=5)

**Expected Output:** `1`.

**Exact Assertions:**
1. `expect(getSoftness(10, 100, true)).toBe(1)`

## Tests for `paintStampAt(ctx, x, y, size, feather, featherMode, isErasing)`

### 7. Guard Against Non-finite Values
**Scenario:** Non-finite inputs should short-circuit and avoid any ctx calls.

**Setup:**
1. Create `ctx` mock with all methods as spies.

**Inputs:**
- `paintStampAt(ctx, NaN, 0, 10, 5, false, true)`
- `paintStampAt(ctx, 0, Infinity, 10, 5, false, true)`
- `paintStampAt(ctx, 0, 0, NaN, 5, false, true)`
- `paintStampAt(ctx, 0, 0, 10, NaN, false, true)`

**Expected Output:**
- No ctx method calls, no property changes.

**Exact Assertions:**
1. `expect(ctx.beginPath).not.toHaveBeenCalled()`
2. `expect(ctx.arc).not.toHaveBeenCalled()`
3. `expect(ctx.fill).not.toHaveBeenCalled()`
4. `expect(ctx.createRadialGradient).not.toHaveBeenCalled()`

### 8. Composite Operation Set for Erase vs Repair
**Scenario:** Erase uses `source-over`; repair uses `destination-out`.

**Setup:** ctx mock.

**Inputs:**
- `paintStampAt(ctx, 5, 5, 10, 0, false, true)`
- `paintStampAt(ctx, 5, 5, 10, 0, false, false)`

**Expected Output:**
- `globalCompositeOperation` set appropriately per call.

**Exact Assertions:**
1. `paintStampAt(ctx, 5, 5, 10, 0, false, true)`
2. `expect(ctx.globalCompositeOperation).toBe('source-over')`
3. `paintStampAt(ctx, 5, 5, 10, 0, false, false)`
4. `expect(ctx.globalCompositeOperation).toBe('destination-out')`

### 9. Solid Fill Path When Softness = 0
**Scenario:** Softness 0 uses solid fill with white/black and no gradient.

**Setup:** ctx mock.

**Inputs:**
- `paintStampAt(ctx, 10, 20, 10, 0, false, true)` (erase)
- `paintStampAt(ctx, 10, 20, 10, 0, false, false)` (repair)

**Expected Output:**
- `fillStyle` is `white` for erase, `black` for repair.
- `beginPath`, `arc`, `fill` called once per call.
- `createRadialGradient` not called.

**Exact Assertions:**
1. `paintStampAt(ctx, 10, 20, 10, 0, false, true)`
2. `expect(ctx.fillStyle).toBe('white')`
3. `expect(ctx.createRadialGradient).not.toHaveBeenCalled()`
4. `expect(ctx.beginPath).toHaveBeenCalled()`
5. `expect(ctx.arc).toHaveBeenCalledWith(10, 20, 5, 0, Math.PI * 2)`
6. `expect(ctx.fill).toHaveBeenCalled()`
7. Reset spies.
8. `paintStampAt(ctx, 10, 20, 10, 0, false, false)`
9. `expect(ctx.fillStyle).toBe('black')`
10. `expect(ctx.createRadialGradient).not.toHaveBeenCalled()`

### 10. Gradient Path When Softness > 0
**Scenario:** Softness > 0 uses radial gradient with exact color stops.

**Setup:**
1. `ctx.createRadialGradient` returns `gradientMock`.

**Inputs:**
- `paintStampAt(ctx, 10, 20, 10, 5, true, true)` (erase, softness=1)
- `paintStampAt(ctx, 10, 20, 10, 5, true, false)` (repair, softness=1)

**Expected Output:**
- `createRadialGradient` called with inner radius `radius * (1 - softness)`.
- For erase: color stops (0, rgba(255,255,255,1)) and (1, rgba(255,255,255,0)).
- For repair: color stops (0, rgba(0,0,0,1)) and (1, rgba(0,0,0,0)).
- `fillStyle` set to gradient, `arc`/`fill` invoked.

**Exact Assertions:**
1. `paintStampAt(ctx, 10, 20, 10, 5, true, true)`
2. `expect(ctx.createRadialGradient).toHaveBeenCalledWith(10, 20, 0, 10, 20, 5)`
3. `expect(gradientMock.addColorStop).toHaveBeenCalledWith(0, 'rgba(255, 255, 255, 1)')`
4. `expect(gradientMock.addColorStop).toHaveBeenCalledWith(1, 'rgba(255, 255, 255, 0)')`
5. `expect(ctx.fillStyle).toBe(gradientMock)`
6. `expect(ctx.arc).toHaveBeenCalledWith(10, 20, 5, 0, Math.PI * 2)`
7. Reset spies.
8. `paintStampAt(ctx, 10, 20, 10, 5, true, false)`
9. `expect(gradientMock.addColorStop).toHaveBeenCalledWith(0, 'rgba(0, 0, 0, 1)')`
10. `expect(gradientMock.addColorStop).toHaveBeenCalledWith(1, 'rgba(0, 0, 0, 0)')`

### 11. Arc Geometry Correctness and Fill Invocation
**Scenario:** Arc must be drawn at (x, y) with radius size/2, then filled.

**Setup:** ctx mock.

**Inputs:** `paintStampAt(ctx, 3, 4, 12, 0, false, true)`

**Expected Output:**
- `arc` called with radius 6 and full circle.
- `fill` called once.

**Exact Assertions:**
1. `paintStampAt(ctx, 3, 4, 12, 0, false, true)`
2. `expect(ctx.arc).toHaveBeenCalledWith(3, 4, 6, 0, Math.PI * 2)`
3. `expect(ctx.fill).toHaveBeenCalledTimes(1)`

## Tests for `paintStrokeSegment(ctx, lastStamp, point, size, feather, featherMode, isErasing)`

### 12. No `lastStamp` Paints Single Stamp
**Scenario:** If `lastStamp` is null, it should paint one stamp and return the point.

**Setup:**
1. Spy on `paintStampAt`.

**Inputs:**
- `paintStrokeSegment(ctx, null, { x: 10, y: 20 }, 10, 0, false, true)`

**Expected Output:**
- `paintStampAt` called once at point.
- Return `{ x: 10, y: 20 }`.

**Exact Assertions:**
1. `expect(paintStampAt).toHaveBeenCalledWith(ctx, 10, 20, 10, 0, false, true)`
2. `expect(result).toEqual({ x: 10, y: 20 })`

### 13. Spacing Threshold Behavior (Distance < Spacing)
**Scenario:** If movement is less than spacing, it should return last stamp and not paint.

**Setup:**
1. size=20 ⇒ spacing=max(1, 3) = 3.
2. lastStamp at (0,0), point at (2,2) ⇒ dist ≈ 2.828 < 3.

**Inputs:** `paintStrokeSegment(ctx, { x: 0, y: 0 }, { x: 2, y: 2 }, 20, 0, false, true)`

**Expected Output:**
- `paintStampAt` not called.
- Returns original lastStamp.

**Exact Assertions:**
1. `expect(paintStampAt).not.toHaveBeenCalled()`
2. `expect(result).toEqual({ x: 0, y: 0 })`

### 14. Correct Step Count for Distance Multiples
**Scenario:** For distance 30 and spacing 3, steps=10 and 10 stamps drawn.

**Setup:**
1. size=20 ⇒ spacing=3.
2. lastStamp at (0,0), point at (30,0).

**Inputs:** `paintStrokeSegment(ctx, { x: 0, y: 0 }, { x: 30, y: 0 }, 20, 0, false, true)`

**Expected Output:**
- `paintStampAt` called exactly 10 times at x=3,6,...,30.
- Returns `{ x: 30, y: 0 }`.

**Exact Assertions:**
1. `expect(paintStampAt).toHaveBeenCalledTimes(10)`
2. `expect(paintStampAt).toHaveBeenNthCalledWith(1, ctx, 3, 0, 20, 0, false, true)`
3. `expect(paintStampAt).toHaveBeenNthCalledWith(10, ctx, 30, 0, 20, 0, false, true)`
4. `expect(result).toEqual({ x: 30, y: 0 })`

### 15. Returned Last Stamp Coordinates
**Scenario:** Returned last stamp should be the final drawn position.

**Setup:** size=10 ⇒ spacing=1.5 (rounded by Math.max → 1.5); dist=4.5 ⇒ steps=3.

**Inputs:** `paintStrokeSegment(ctx, { x: 1, y: 1 }, { x: 5.5, y: 1 }, 10, 0, false, true)`

**Expected Output:**
- Returns `{ x: 5.5, y: 1 }`.

**Exact Assertions:**
1. `expect(result).toEqual({ x: 5.5, y: 1 })`

## Tests for `drawStroke(ctx, points, settings)`

### 16. Empty List Is No-op
**Scenario:** No points should result in no stamps.

**Setup:** Spy on `paintStrokeSegment` and `paintStampAt`.

**Inputs:** `drawStroke(ctx, [], settings)`

**Expected Output:** No calls.

**Exact Assertions:**
1. `expect(paintStrokeSegment).not.toHaveBeenCalled()`
2. `expect(paintStampAt).not.toHaveBeenCalled()`

### 17. Single Point Draws Exactly One End Cap
**Scenario:** One point leads to a single stamp (end cap), not double.

**Setup:**
1. points = [{ x: 5, y: 5 }]
2. settings: `{ size: 10, feather: 0, featherMode: false, isErasing: true }`

**Inputs:** `drawStroke(ctx, points, settings)`

**Expected Output:**
- `paintStrokeSegment` called once.
- `paintStampAt` called once for end cap at (5,5).

**Exact Assertions:**
1. `expect(paintStrokeSegment).toHaveBeenCalledTimes(1)`
2. `expect(paintStampAt).toHaveBeenCalledWith(ctx, 5, 5, 10, 0, false, true)`

### 18. Multi-point Draws Intermediate Stamps and Final Cap
**Scenario:** Two or more points should call `paintStrokeSegment` for each point and draw a final end cap.

**Setup:**
1. points = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
2. settings = `{ size: 10, feather: 1, featherMode: true, isErasing: false }`

**Inputs:** `drawStroke(ctx, points, settings)`

**Expected Output:**
- `paintStrokeSegment` called twice (for each point).
- `paintStampAt` called once after loop for final cap at last point.

**Exact Assertions:**
1. `expect(paintStrokeSegment).toHaveBeenCalledTimes(2)`
2. `expect(paintStrokeSegment).toHaveBeenNthCalledWith(1, ctx, null, { x: 0, y: 0 }, 10, 1, true, false)`
3. `expect(paintStrokeSegment).toHaveBeenNthCalledWith(2, ctx, expect.any(Object), { x: 10, y: 0 }, 10, 1, true, false)`
4. `expect(paintStampAt).toHaveBeenCalledWith(ctx, 10, 0, 10, 1, true, false)`

### 19. Uses Provided Settings (size/feather/featherMode/isErasing)
**Scenario:** Settings should be passed through without mutation.

**Setup:**
1. settings = `{ size: 25, feather: 4, featherMode: false, isErasing: true }`
2. points = [{ x: 3, y: 7 }, { x: 6, y: 7 }]

**Inputs:** `drawStroke(ctx, points, settings)`

**Expected Output:**
- `paintStrokeSegment` receives the same setting values.

**Exact Assertions:**
1. `expect(paintStrokeSegment).toHaveBeenNthCalledWith(1, ctx, null, { x: 3, y: 7 }, 25, 4, false, true)`
2. `expect(paintStrokeSegment).toHaveBeenNthCalledWith(2, ctx, expect.any(Object), { x: 6, y: 7 }, 25, 4, false, true)`
