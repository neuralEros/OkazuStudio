
// ------------------------------------------------------------------------------------------------
// BrushKernel Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping brush tests.');
        return;
    }

    const { register, assert, assertEqual, assertApprox, assertDeepEqual, spyOn } = window.TestRunner;

    // --- 1. Harness & Mocking ---

    function createMockCtx() {
        const gradientMock = {
            id: 'gradient-' + Math.random(),
            addColorStop: spyOn({}, 'addColorStop')
        };

        return {
            gradientMock,
            globalCompositeOperation: 'source-over',
            fillStyle: '#000000',
            beginPath: spyOn({}, 'beginPath'),
            arc: spyOn({}, 'arc'),
            fill: spyOn({}, 'fill'),
            createRadialGradient: spyOn({}, 'createRadialGradient').mockReturnValue(gradientMock)
        };
    }

    const BrushKernel = window.BrushKernel;

    // --- 2. getSoftness ---

    register('BrushKernel: 2.1 Size 0 Returns 0', () => {
        assertEqual(BrushKernel.getSoftness(0, 5, false), 0);
    });

    register('BrushKernel: 2.2 Negative Size Returns 0', () => {
        assertEqual(BrushKernel.getSoftness(-10, 5, true), 0);
    });

    register('BrushKernel: 2.3 Feather Mode On', () => {
        // feather 5, size 20 (radius 10) => 5/10 = 0.5
        assertApprox(BrushKernel.getSoftness(20, 5, true), 0.5, 1e-6);
    });

    register('BrushKernel: 2.4 Feather Mode Off', () => {
        // feather 10, Hardness Max 20 => 10/20 = 0.5
        assertApprox(BrushKernel.getSoftness(20, 10, false), 0.5, 1e-6);
        // clamp to 1
        assertEqual(BrushKernel.getSoftness(20, 40, false), 1);
    });

    register('BrushKernel: 2.5 Clamping', () => {
        assertEqual(BrushKernel.getSoftness(20, -5, false), 0);
        assertEqual(BrushKernel.getSoftness(20, 1000, true), 1);
    });

    register('BrushKernel: 2.6 Feather > Radius', () => {
        // radius 5, feather 100 => 1
        assertEqual(BrushKernel.getSoftness(10, 100, true), 1);
    });

    // --- 3. paintStampAt ---

    register('BrushKernel: 3.1 Non-finite Guards', () => {
        const ctx = createMockCtx();
        BrushKernel.paintStampAt(ctx, NaN, 0, 10, 5, false, true);
        ctx.beginPath.expectNotCalled();

        BrushKernel.paintStampAt(ctx, 0, Infinity, 10, 5, false, true);
        ctx.beginPath.expectNotCalled();

        BrushKernel.paintStampAt(ctx, 0, 0, NaN, 5, false, true);
        ctx.beginPath.expectNotCalled();
    });

    register('BrushKernel: 3.2 Composite Operation', () => {
        const ctx = createMockCtx();
        // Erase
        BrushKernel.paintStampAt(ctx, 5, 5, 10, 0, false, true);
        assertEqual(ctx.globalCompositeOperation, 'source-over');

        // Repair
        BrushKernel.paintStampAt(ctx, 5, 5, 10, 0, false, false);
        assertEqual(ctx.globalCompositeOperation, 'destination-out');
    });

    register('BrushKernel: 3.3 Solid Fill (Softness 0)', () => {
        const ctx = createMockCtx();

        // Erase (White)
        BrushKernel.paintStampAt(ctx, 10, 20, 10, 0, false, true);
        assertEqual(ctx.fillStyle, 'white');
        ctx.createRadialGradient.expectNotCalled();
        ctx.beginPath.expectCalled();
        ctx.arc.expectCalledWith(10, 20, 5, 0, Math.PI * 2);
        ctx.fill.expectCalled();

        // Repair (Black)
        const ctx2 = createMockCtx();
        BrushKernel.paintStampAt(ctx2, 10, 20, 10, 0, false, false);
        assertEqual(ctx2.fillStyle, 'black');
        ctx2.createRadialGradient.expectNotCalled();
    });

    register('BrushKernel: 3.4 Gradient Fill (Softness > 0)', () => {
        const ctx = createMockCtx();

        // Erase
        // size 10 (rad 5), feather 5, mode true => softness 1
        BrushKernel.paintStampAt(ctx, 10, 20, 10, 5, true, true);

        ctx.createRadialGradient.expectCalledWith(10, 20, 0, 10, 20, 5);
        ctx.gradientMock.addColorStop.expectCalledWith(0, 'rgba(255, 255, 255, 1)');
        ctx.gradientMock.addColorStop.expectCalledWith(1, 'rgba(255, 255, 255, 0)');
        assertEqual(ctx.fillStyle, ctx.gradientMock);
        ctx.arc.expectCalledWith(10, 20, 5, 0, Math.PI * 2);

        // Repair
        const ctx2 = createMockCtx();
        BrushKernel.paintStampAt(ctx2, 10, 20, 10, 5, true, false);
        ctx2.gradientMock.addColorStop.expectCalledWith(0, 'rgba(0, 0, 0, 1)');
        ctx2.gradientMock.addColorStop.expectCalledWith(1, 'rgba(0, 0, 0, 0)');
    });

    // --- 4. paintStrokeSegment ---

    register('BrushKernel: 4.1 No lastStamp', () => {
        const ctx = createMockCtx();
        const paintSpy = spyOn(BrushKernel, 'paintStampAt');

        const result = BrushKernel.paintStrokeSegment(ctx, null, { x: 10, y: 20 }, 10, 0, false, true);

        paintSpy.expectCalledWith(ctx, 10, 20, 10, 0, false, true);
        assertDeepEqual(result, { x: 10, y: 20 });

        paintSpy.restore();
    });

    register('BrushKernel: 4.2 Spacing Threshold', () => {
        const ctx = createMockCtx();
        const paintSpy = spyOn(BrushKernel, 'paintStampAt');

        // Size 20 => spacing 3.
        // Dist sqrt(8) approx 2.8 < 3.

        const result = BrushKernel.paintStrokeSegment(ctx, { x: 0, y: 0 }, { x: 2, y: 2 }, 20, 0, false, true);

        paintSpy.expectNotCalled();
        assertDeepEqual(result, { x: 0, y: 0 }); // Should return lastStamp if skipped

        paintSpy.restore();
    });

    register('BrushKernel: 4.3 Steps Count', () => {
        const ctx = createMockCtx();
        const paintSpy = spyOn(BrushKernel, 'paintStampAt');

        // Size 20 => spacing 3.
        // Dist 30 => 10 steps.

        const result = BrushKernel.paintStrokeSegment(ctx, { x: 0, y: 0 }, { x: 30, y: 0 }, 20, 0, false, true);

        assertEqual(paintSpy.calls.length, 10);
        // First call at 3
        assertDeepEqual(paintSpy.calls[0], [ctx, 3, 0, 20, 0, false, true]);
        // Last call at 30
        assertDeepEqual(paintSpy.calls[9], [ctx, 30, 0, 20, 0, false, true]);
        assertDeepEqual(result, { x: 30, y: 0 });

        paintSpy.restore();
    });

    // --- 5. drawStroke ---

    register('BrushKernel: 5.1 Empty List', () => {
        const ctx = createMockCtx();
        const segSpy = spyOn(BrushKernel, 'paintStrokeSegment');
        const stampSpy = spyOn(BrushKernel, 'paintStampAt');

        BrushKernel.drawStroke(ctx, [], { size: 10 });

        segSpy.expectNotCalled();
        stampSpy.expectNotCalled();

        segSpy.restore();
        stampSpy.restore();
    });

    register('BrushKernel: 5.2 Single Point', () => {
        const ctx = createMockCtx();
        const segSpy = spyOn(BrushKernel, 'paintStrokeSegment');
        const stampSpy = spyOn(BrushKernel, 'paintStampAt');

        BrushKernel.drawStroke(ctx, [{ x: 5, y: 5 }], { size: 10, feather: 0, featherMode: false, isErasing: true });

        // Single point should trigger exactly one stamp and no segments
        segSpy.expectNotCalled();
        stampSpy.expectCalledWith(ctx, 5, 5, 10, 0, false, true);
        assertEqual(stampSpy.calls.length, 1);

        segSpy.restore();
        stampSpy.restore();
    });

    register('BrushKernel: 5.3 Multi-point Stroke', () => {
        const ctx = createMockCtx();
        const segSpy = spyOn(BrushKernel, 'paintStrokeSegment');
        const stampSpy = spyOn(BrushKernel, 'paintStampAt');

        const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
        const settings = { size: 10, feather: 1, featherMode: true, isErasing: false };

        // Logic:
        // 1. Loop points.
        //    i=0: paintStrokeSegment(null, p0) -> paints p0, returns p0
        //    i=1: paintStrokeSegment(p0, p1) -> paints steps to p1, returns p1
        // 2. End Cap: paintStampAt(p1) -> paints p1

        BrushKernel.drawStroke(ctx, points, settings);

        assertEqual(segSpy.calls.length, 2);

        // Check first segment call (null start)
        assertDeepEqual(segSpy.calls[0], [ctx, null, {x:0,y:0}, 10, 1, true, false]);

        // Check second segment call (from p0 to p1)
        // Note: We can't strictly match the returned object reference from the first call
        // without more complex mocking, but we can verify arguments structure.
        const secondCall = segSpy.calls[1];
        assertDeepEqual(secondCall[2], {x:10,y:0}); // Destination

        // Check explicit end cap
        stampSpy.expectCalledWith(ctx, 10, 0, 10, 1, true, false);

        segSpy.restore();
        stampSpy.restore();
    });

    register('BrushKernel: 5.4 Uses Settings', () => {
        const ctx = createMockCtx();
        const segSpy = spyOn(BrushKernel, 'paintStrokeSegment');

        const settings = { size: 25, feather: 4, featherMode: false, isErasing: true };
        const points = [{ x: 3, y: 7 }, { x: 6, y: 7 }];

        BrushKernel.drawStroke(ctx, points, settings);

        // Verify settings are passed through correctly to segment calls
        const firstCall = segSpy.calls[0];
        assertEqual(firstCall[3], 25); // size
        assertEqual(firstCall[4], 4);  // feather
        assertEqual(firstCall[5], false); // mode
        assertEqual(firstCall[6], true); // erasing

        segSpy.restore();
    });

})();
