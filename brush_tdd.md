# BrushKernel Unit Test Blueprint Implementation Checklist

[ ] 1. Test Environment Setup
[ ] 1.1. Configure Jest with JSDOM environment
[ ] 1.2. Implement Canvas Mock 2D context
    [ ] 1.2.1. Add settable string property: globalCompositeOperation
    [ ] 1.2.2. Add settable property: fillStyle
    [ ] 1.2.3. Add jest.fn() spy: beginPath
    [ ] 1.2.4. Add jest.fn() spy: arc
    [ ] 1.2.5. Add jest.fn() spy: fill
    [ ] 1.2.6. Add jest.fn() spy: createRadialGradient
[ ] 1.3. Implement gradientMock utility
    [ ] 1.3.1. Mock object with recognizable identity
    [ ] 1.3.2. Add jest.fn() spy: addColorStop
    [ ] 1.3.3. Link createRadialGradient spy to return gradientMock

[ ] 2. Tests for getSoftness(size, feather, featherMode)
[ ] 2.1. Size = 0 Returns 0
    # Scenario: Zero size yields zero softness.
    # Inputs: getSoftness(0, 5, false)
    # Expected Output: 0
    [ ] 2.1.1. expect(getSoftness(0, 5, false)).toBe(0)
[ ] 2.2. Negative Size Returns 0
    # Scenario: Negative size should also yield 0 (radius <= 0).
    # Inputs: getSoftness(-10, 5, true)
    # Expected Output: 0
    [ ] 2.2.1. expect(getSoftness(-10, 5, true)).toBe(0)
[ ] 2.3. Feather Mode On Uses feather / radius
    # Scenario: With featherMode on, softness is feather divided by radius and clamped to 1.
    # Inputs: getSoftness(20, 5, true) (radius=10)
    # Expected Output: 0.5
    [ ] 2.3.1. expect(getSoftness(20, 5, true)).toBeCloseTo(0.5)
[ ] 2.4. Feather Mode Off Uses feather / HARDNESS_MAX
    # Scenario: With featherMode off, softness uses hardness mapping and clamps to [0,1].
    # Inputs: getSoftness(20, 10, false) -> 10/20 = 0.5
    # Inputs: getSoftness(20, 40, false) -> clamped to 1
    [ ] 2.4.1. expect(getSoftness(20, 10, false)).toBeCloseTo(0.5)
    [ ] 2.4.2. expect(getSoftness(20, 40, false)).toBe(1)
[ ] 2.5. Clamping to [0,1]
    # Scenario: Ensure softness never drops below 0 or above 1.
    # Inputs: getSoftness(20, -5, false)
    # Inputs: getSoftness(20, 1000, true)
    # Expected Output: 0 and 1
    [ ] 2.5.1. expect(getSoftness(20, -5, false)).toBe(0)
    [ ] 2.5.2. expect(getSoftness(20, 1000, true)).toBe(1)
[ ] 2.6. Feather Greater Than Radius
    # Scenario: featherMode on should clamp feather>radius to 1.
    # Inputs: getSoftness(10, 100, true) (radius=5)
    # Expected Output: 1
    [ ] 2.6.1. expect(getSoftness(10, 100, true)).toBe(1)

[ ] 3. Tests for paintStampAt(ctx, x, y, size, feather, featherMode, isErasing)
[ ] 3.1. Guard Against Non-finite Values
    # Scenario: Non-finite inputs should short-circuit and avoid any ctx calls.
    # Setup: Create ctx mock with all methods as spies.
    # Inputs: paintStampAt(ctx, NaN, 0, 10, 5, false, true)
    # Inputs: paintStampAt(ctx, 0, Infinity, 10, 5, false, true)
    # Inputs: paintStampAt(ctx, 0, 0, NaN, 5, false, true)
    # Inputs: paintStampAt(ctx, 0, 0, 10, NaN, false, true)
    [ ] 3.1.1. expect(ctx.beginPath).not.toHaveBeenCalled()
    [ ] 3.1.2. expect(ctx.arc).not.toHaveBeenCalled()
    [ ] 3.1.3. expect(ctx.fill).not.toHaveBeenCalled()
    [ ] 3.1.4. expect(ctx.createRadialGradient).not.toHaveBeenCalled()
[ ] 3.2. Composite Operation Set for Erase vs Repair
    # Scenario: Erase uses source-over; repair uses destination-out.
    [ ] 3.2.1. Run paintStampAt(ctx, 5, 5, 10, 0, false, true)
    [ ] 3.2.2. expect(ctx.globalCompositeOperation).toBe('source-over')
    [ ] 3.2.3. Run paintStampAt(ctx, 5, 5, 10, 0, false, false)
    [ ] 3.2.4. expect(ctx.globalCompositeOperation).toBe('destination-out')
[ ] 3.3. Solid Fill Path When Softness = 0
    # Scenario: Softness 0 uses solid fill with white/black and no gradient.
    [ ] 3.3.1. Run paintStampAt(ctx, 10, 20, 10, 0, false, true) (erase)
    [ ] 3.3.2. expect(ctx.fillStyle).toBe('white')
    [ ] 3.3.3. expect(ctx.createRadialGradient).not.toHaveBeenCalled()
    [ ] 3.3.4. expect(ctx.beginPath).toHaveBeenCalled()
    [ ] 3.3.5. expect(ctx.arc).toHaveBeenCalledWith(10, 20, 5, 0, Math.PI * 2)
    [ ] 3.3.6. expect(ctx.fill).toHaveBeenCalled()
    [ ] 3.3.7. Reset spies
    [ ] 3.3.8. Run paintStampAt(ctx, 10, 20, 10, 0, false, false) (repair)
    [ ] 3.3.9. expect(ctx.fillStyle).toBe('black')
    [ ] 3.3.10. expect(ctx.createRadialGradient).not.toHaveBeenCalled()
[ ] 3.4. Gradient Path When Softness > 0
    # Scenario: Softness > 0 uses radial gradient with exact color stops.
    # Setup: ctx.createRadialGradient returns gradientMock.
    [ ] 3.4.1. Run paintStampAt(ctx, 10, 20, 10, 5, true, true) (erase, softness=1)
    [ ] 3.4.2. expect(ctx.createRadialGradient).toHaveBeenCalledWith(10, 20, 0, 10, 20, 5)
    [ ] 3.4.3. expect(gradientMock.addColorStop).toHaveBeenCalledWith(0, 'rgba(255, 255, 255, 1)')
    [ ] 3.4.4. expect(gradientMock.addColorStop).toHaveBeenCalledWith(1, 'rgba(255, 255, 255, 0)')
    [ ] 3.4.5. expect(ctx.fillStyle).toBe(gradientMock)
    [ ] 3.4.6. expect(ctx.arc).toHaveBeenCalledWith(10, 20, 5, 0, Math.PI * 2)
    [ ] 3.4.7. Reset spies
    [ ] 3.4.8. Run paintStampAt(ctx, 10, 20, 10, 5, true, false) (repair, softness=1)
    [ ] 3.4.9. expect(gradientMock.addColorStop).toHaveBeenCalledWith(0, 'rgba(0, 0, 0, 1)')
    [ ] 3.4.10. expect(gradientMock.addColorStop).toHaveBeenCalledWith(1, 'rgba(0, 0, 0, 0)')
[ ] 3.5. Arc Geometry Correctness and Fill Invocation
    # Scenario: Arc must be drawn at (x, y) with radius size/2, then filled.
    # Inputs: paintStampAt(ctx, 3, 4, 12, 0, false, true)
    [ ] 3.5.1. expect(ctx.arc).toHaveBeenCalledWith(3, 4, 6, 0, Math.PI * 2)
    [ ] 3.5.2. expect(ctx.fill).toHaveBeenCalledTimes(1)

[ ] 4. Tests for paintStrokeSegment(ctx, lastStamp, point, size, feather, featherMode, isErasing)
[ ] 4.1. No lastStamp Paints Single Stamp
    # Scenario: If lastStamp is null, it should paint one stamp and return the point.
    # Setup: Spy on paintStampAt.
    # Inputs: paintStrokeSegment(ctx, null, { x: 10, y: 20 }, 10, 0, false, true)
    [ ] 4.1.1. expect(paintStampAt).toHaveBeenCalledWith(ctx, 10, 20, 10, 0, false, true)
    [ ] 4.1.2. expect(result).toEqual({ x: 10, y: 20 })
[ ] 4.2. Spacing Threshold Behavior (Distance < Spacing)
    # Scenario: If movement is less than spacing, it should return last stamp and not paint.
    # Setup: size=20 => spacing=max(1, 3) = 3. lastStamp at (0,0), point at (2,2) => dist approx 2.828 < 3.
    # Inputs: paintStrokeSegment(ctx, { x: 0, y: 0 }, { x: 2, y: 2 }, 20, 0, false, true)
    [ ] 4.2.1. expect(paintStampAt).not.toHaveBeenCalled()
    [ ] 4.2.2. expect(result).toEqual({ x: 0, y: 0 })
[ ] 4.3. Correct Step Count for Distance Multiples
    # Scenario: For distance 30 and spacing 3, steps=10 and 10 stamps drawn.
    # Setup: size=20 => spacing=3. lastStamp at (0,0), point at (30,0).
    # Inputs: paintStrokeSegment(ctx, { x: 0, y: 0 }, { x: 30, y: 0 }, 20, 0, false, true)
    [ ] 4.3.1. expect(paintStampAt).toHaveBeenCalledTimes(10)
    [ ] 4.3.2. expect(paintStampAt).toHaveBeenNthCalledWith(1, ctx, 3, 0, 20, 0, false, true)
    [ ] 4.3.3. expect(paintStampAt).toHaveBeenNthCalledWith(10, ctx, 30, 0, 20, 0, false, true)
    [ ] 4.3.4. expect(result).toEqual({ x: 30, y: 0 })
[ ] 4.4. Returned Last Stamp Coordinates
    # Scenario: Returned last stamp should be the final drawn position.
    # Setup: size=10 => spacing=1.5; dist=4.5 => steps=3.
    # Inputs: paintStrokeSegment(ctx, { x: 1, y: 1 }, { x: 5.5, y: 1 }, 10, 0, false, true)
    [ ] 4.4.1. expect(result).toEqual({ x: 5.5, y: 1 })

[ ] 5. Tests for drawStroke(ctx, points, settings)
[ ] 5.1. Empty List Is No-op
    # Scenario: No points should result in no stamps.
    # Setup: Spy on paintStrokeSegment and paintStampAt.
    # Inputs: drawStroke(ctx, [], settings)
    [ ] 5.1.1. expect(paintStrokeSegment).not.toHaveBeenCalled()
    [ ] 5.1.2. expect(paintStampAt).not.toHaveBeenCalled()
[ ] 5.2. Single Point Draws Exactly One End Cap
    # Scenario: One point leads to a single stamp (end cap), not double.
    # Setup: points = [{ x: 5, y: 5 }], settings: { size: 10, feather: 0, featherMode: false, isErasing: true }
    [ ] 5.2.1. expect(paintStrokeSegment).toHaveBeenCalledTimes(1)
    [ ] 5.2.2. expect(paintStampAt).toHaveBeenCalledWith(ctx, 5, 5, 10, 0, false, true)
[ ] 5.3. Multi-point Draws Intermediate Stamps and Final Cap
    # Scenario: Two or more points should call paintStrokeSegment for each point and draw a final end cap.
    # Setup: points = [{ x: 0, y: 0 }, { x: 10, y: 0 }], settings = { size: 10, feather: 1, featherMode: true, isErasing: false }
    [ ] 5.3.1. expect(paintStrokeSegment).toHaveBeenCalledTimes(2)
    [ ] 5.3.2. expect(paintStrokeSegment).toHaveBeenNthCalledWith(1, ctx, null, { x: 0, y: 0 }, 10, 1, true, false)
    [ ] 5.3.3. expect(paintStrokeSegment).toHaveBeenNthCalledWith(2, ctx, expect.any(Object), { x: 10, y: 0 }, 10, 1, true, false)
    [ ] 5.3.4. expect(paintStampAt).toHaveBeenCalledWith(ctx, 10, 0, 10, 1, true, false)
[ ] 5.4. Uses Provided Settings (size/feather/featherMode/isErasing)
    # Scenario: Settings should be passed through without mutation.
    # Setup: settings = { size: 25, feather: 4, featherMode: false, isErasing: true }, points = [{ x: 3, y: 7 }, { x: 6, y: 7 }]
    [ ] 5.4.1. expect(paintStrokeSegment).toHaveBeenNthCalledWith(1, ctx, null, { x: 3, y: 7 }, 25, 4, false, true)
    [ ] 5.4.2. expect(paintStrokeSegment).toHaveBeenNthCalledWith(2, ctx, expect.any(Object), { x: 6, y: 7 }, 25, 4, false, true)

