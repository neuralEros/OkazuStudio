# Watermark Unit-Test Blueprint (watermark_tdd.md)
# Scope: Unit tests for scripts/watermark.js covering rotatePoint, buildMaskCanvas, Watermark.apply, Watermark.checkAndRemove, and Watermark.buildMask.

1. [ ] Test Harness & Conventions
    # Environment: Browser test runner or JSDOM + canvas.
    1.1. [ ] Implement Helper: makeCanvas(w, h, fillRGBA)
    1.2. [ ] Implement Helper: getPixel(ctx, x, y) returns [r,g,b,a]
    1.3. [ ] Implement Helper: isOpaque([r,g,b,a]) -> a === 255
    1.4. [ ] Implement Helper: isTransparent([r,g,b,a]) -> a === 0
    # Deterministic Settings: use fixed sizes (e.g., 100x60) so scale/spacing are stable.

2. [ ] Shared Fixtures
    2.1. [ ] Define Canvas sizes:
        2.1.1. [ ] Small: width=100, height=60
        2.1.2. [ ] Tiny: width=20, height=20 (for minimal mask sampling)
    2.2. [ ] Define Known coordinates: sample points derived from algorithm:
        2.2.1. [ ] cx = width / 2
        2.2.2. [ ] cy = height / 2
        2.2.3. [ ] Calculate expected scale = Math.max(1, Math.floor((height * 0.016) / 5))

3. [ ] rotatePoint Tests
    3.1. [ ] 1. Deterministic rounding (0 degrees)
        # Scenario: No rotation should return original integer coords.
        3.1.1. [ ] Setup: x=10, y=15, cx=0, cy=0, sin=0, cos=1.
        3.1.2. [ ] Inputs: rotatePoint(10,15,0,0,0,1)
        # Expected: { x: 10, y: 15 }
        3.1.3. [ ] Assertion: expect(result).toEqual({ x: 10, y: 15 })
    3.2. [ ] 2. 90-degree rotation around center
        # Scenario: Rotate point (cx+1, cy) by 90-degrees -> (cx, cy+1) after rounding.
        3.2.1. [ ] Setup: cx=5, cy=5, x=6, y=5, sin=1, cos=0.
        3.2.2. [ ] Inputs: rotatePoint(6,5,5,5,1,0)
        # Expected: { x: 5, y: 6 }
        3.2.3. [ ] Assertion: expect(result).toEqual({ x: 5, y: 6 })
    3.3. [ ] 3. 180-degree rotation (deterministic rounding)
        # Scenario: Rotate point (cx+2, cy-1) by 180-degrees -> (cx-2, cy+1).
        3.3.1. [ ] Setup: cx=10, cy=10, x=12, y=9, sin=0, cos=-1.
        3.3.2. [ ] Inputs: rotatePoint(12,9,10,10,0,-1)
        # Expected: { x: 8, y: 11 }
        3.3.3. [ ] Assertion: expect(result).toEqual({ x: 8, y: 11 })

4. [ ] buildMaskCanvas Tests
    4.1. [ ] 1. Output size matches input
        # Scenario: Mask canvas should be exactly width x height.
        4.1.1. [ ] Setup: buildMaskCanvas(100, 60)
        4.1.2. [ ] Inputs: call function
        # Expected: canvas width/height are 100/60
        4.1.3. [ ] Assertion: expect(canvas.width).toBe(100)
        4.1.4. [ ] Assertion: expect(canvas.height).toBe(60)
    4.2. [ ] 2. Tiling coverage (non-empty alpha)
        # Scenario: Tiled text should place opaque pixels across the canvas.
        4.2.1. [ ] Setup: buildMaskCanvas(100, 60)
        4.2.2. [ ] Inputs: sample pixels at multiple quadrants
        # Expected: at least one pixel in each quadrant has alpha 255
        4.2.3. [ ] Assertion: expect(alphaAt(10,10)).toBe(255) OR collect and assert count of opaque pixels per quadrant > 0.
    4.3. [ ] 3. Binary alpha thresholding
        # Scenario: alpha should be strictly 0 or 255 after threshold.
        4.3.1. [ ] Setup: buildMaskCanvas(100, 60); read all pixels
        4.3.2. [ ] Inputs: imageData
        # Expected: no alpha values between 1 and 254
        4.3.3. [ ] Assertion: expect(alphaValues.every(a => a === 0 || a === 255)).toBe(true)
    4.4. [ ] 4. Deterministic pattern at known coordinates
        # Scenario: Given fixed size, the mask should be deterministic.
        4.4.1. [ ] Setup: Build mask at 100x60
        4.4.2. [ ] Setup: Select a known coordinate based on expected text placement (e.g. center point (50,30) and second point (5,5))
        4.4.3. [ ] Inputs: getPixel at those coordinates
        # Expected: explicit alpha values (e.g. alpha(50,30) === 255, alpha(5,5) === 0)
        4.4.4. [ ] Assertion: expect(pixelAt(50,30)[3]).toBe(255)
        4.4.5. [ ] Assertion: expect(pixelAt(5,5)[3]).toBe(0)

5. [ ] Watermark.apply and checkAndRemove Tests
    5.1. [ ] 1. apply uses difference composite
        # Scenario: Applying watermark twice cancels due to XOR/difference behavior.
        5.1.1. [ ] Setup: Create canvas 20x20 filled with [10,10,10,255]
        5.1.2. [ ] Setup: Capture original ImageData as before
        5.1.3. [ ] Inputs: call Watermark.apply(ctx, 20, 20) twice
        # Expected: final canvas equals original before
        5.1.4. [ ] Assertion: expect(after.data).toEqual(before.data)
    5.2. [ ] 2. checkAndRemove is idempotent
        # Scenario: If watermark already applied, checkAndRemove restores original; calling again leaves it unchanged.
        5.2.1. [ ] Setup: Fill canvas, call apply once
        5.2.2. [ ] Setup: Capture watermarked state
        5.2.3. [ ] Inputs: call Watermark.checkAndRemove(canvas) twice
        # Expected: second call leaves pixels equal to original
        5.2.4. [ ] Assertion: expect(afterFirstRemoval).toEqual(original)
        5.2.5. [ ] Assertion: expect(afterSecondRemoval).toEqual(original)

6. [ ] buildMask Tests
    6.1. [ ] 1. Returns ImageData with expected alpha distribution
        # Scenario: Output ImageData is same dimensions with binary alpha.
        6.1.1. [ ] Setup: buildMask(100, 60)
        6.1.2. [ ] Inputs: call function
        # Expected: ImageData.width === 100, ImageData.height === 60, alpha values only 0 or 255, and count of alpha 255 > 0.
        6.1.3. [ ] Assertion: expect(imageData.width).toBe(100)
        6.1.4. [ ] Assertion: expect(imageData.height).toBe(60)
        6.1.5. [ ] Assertion: expect(alphaValues.every(a => a === 0 || a === 255)).toBe(true)
        6.1.6. [ ] Assertion: expect(alphaValues.filter(a => a === 255).length).toBeGreaterThan(0)

