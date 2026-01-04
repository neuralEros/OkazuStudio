(function() {
    const { register, assert, assertEqual, assertApprox, spyOn } = window.TestRunner;

    // 1. Helpers
    function createMockCtx() {
        const ctx = {
            globalCompositeOperation: 'source-over',
            fillStyle: 'black',
            beginPath: spyOn({}, 'beginPath'),
            arc: spyOn({}, 'arc'),
            fill: spyOn({}, 'fill'),
            createRadialGradient: spyOn({}, 'createRadialGradient')
        };
        // Fix spy binding manually since the simple spyOn might not bind 'this' correctly if used as method
        // But here we are calling methods on ctx, so spy logic in test_runner needs to handle 'this' if methods use it?
        // The methods are empty spies, so they don't need 'this'.
        return ctx;
    }

    function createMockGradient() {
        return {
            addColorStop: spyOn({}, 'addColorStop')
        };
    }

    // 2. Tests for getSoftness
    register('BrushKernel: getSoftness 0 size', () => {
        const { getSoftness } = window.OkazuTestables.brush;
        assertEqual(getSoftness(0, 5, false), 0);
    });

    register('BrushKernel: getSoftness negative size', () => {
        const { getSoftness } = window.OkazuTestables.brush;
        assertEqual(getSoftness(-10, 5, true), 0);
    });

    register('BrushKernel: getSoftness feather mode on', () => {
        const { getSoftness } = window.OkazuTestables.brush;
        // radius 10, feather 5 -> 0.5
        assertApprox(getSoftness(20, 5, true), 0.5);
    });

    register('BrushKernel: getSoftness feather mode off', () => {
        const { getSoftness } = window.OkazuTestables.brush;
        // 10 / 20 = 0.5 (HARDNESS_MAX assumed 20)
        assertApprox(getSoftness(20, 10, false), 0.5);
        // Clamped
        assertEqual(getSoftness(20, 40, false), 1);
    });

    register('BrushKernel: getSoftness clamping', () => {
        const { getSoftness } = window.OkazuTestables.brush;
        assertEqual(getSoftness(20, -5, false), 0);
        assertEqual(getSoftness(20, 1000, true), 1);
        assertEqual(getSoftness(10, 100, true), 1); // Feather > Radius
    });

    // 3. Tests for paintStampAt
    register('BrushKernel: paintStampAt guard against non-finite', () => {
        const { paintStampAt } = window.OkazuTestables.brush;
        const ctx = createMockCtx();
        paintStampAt(ctx, NaN, 0, 10, 5, false, true);
        ctx.beginPath.expectNotCalled();
        ctx.createRadialGradient.expectNotCalled();
    });

    register('BrushKernel: paintStampAt composite ops', () => {
        const { paintStampAt } = window.OkazuTestables.brush;
        const ctx = createMockCtx();

        paintStampAt(ctx, 5, 5, 10, 0, false, true);
        assertEqual(ctx.globalCompositeOperation, 'source-over');

        paintStampAt(ctx, 5, 5, 10, 0, false, false);
        assertEqual(ctx.globalCompositeOperation, 'destination-out');
    });

    register('BrushKernel: paintStampAt solid fill (softness 0)', () => {
        const { paintStampAt } = window.OkazuTestables.brush;
        const ctx = createMockCtx();

        paintStampAt(ctx, 10, 20, 10, 0, false, true);
        assertEqual(ctx.fillStyle, 'white');
        ctx.createRadialGradient.expectNotCalled();
        ctx.beginPath.expectCalled();
        ctx.arc.expectCalledWith(10, 20, 5, 0, Math.PI * 2);
        ctx.fill.expectCalled();

        // Repair
        paintStampAt(ctx, 10, 20, 10, 0, false, false);
        assertEqual(ctx.fillStyle, 'black');
    });

    register('BrushKernel: paintStampAt gradient fill (softness > 0)', () => {
        const { paintStampAt } = window.OkazuTestables.brush;
        const ctx = createMockCtx();
        const grad = createMockGradient();
        ctx.createRadialGradient.mockReturnValue(grad);

        paintStampAt(ctx, 10, 20, 10, 5, true, true); // Softness 0.5

        // r=5. softness=0.5. inner=2.5.
        ctx.createRadialGradient.expectCalledWith(10, 20, 2.5, 10, 20, 5);
        grad.addColorStop.expectCalledWith(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop.expectCalledWith(1, 'rgba(255, 255, 255, 0)');

        // Repair
        paintStampAt(ctx, 10, 20, 10, 5, true, false);
        grad.addColorStop.expectCalledWith(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop.expectCalledWith(1, 'rgba(0, 0, 0, 0)');
    });

    // 4. Tests for paintStrokeSegment
    register('BrushKernel: paintStrokeSegment no last stamp', () => {
        const { paintStrokeSegment } = window.OkazuTestables.brush;
        const ctx = createMockCtx();
        // Mock paintStampAt? Or check calls on ctx?
        // Since paintStampAt is internal to module closure in some ways or exposed?
        // It's exposed in testables. But the internal function calls the internal reference.
        // We can't spy on the internal call easily unless we overwrite window.OkazuTestables.brush AND the code uses `this` or `window`.
        // The code uses `paintStampAt(ctx...)` directly.
        // So we must verify side effects on ctx.

        paintStrokeSegment(ctx, null, {x:10, y:20}, 10, 0, false, true);
        ctx.arc.expectCalledWith(10, 20, 5, 0, Math.PI*2);
    });

    register('BrushKernel: paintStrokeSegment spacing threshold', () => {
        const { paintStrokeSegment } = window.OkazuTestables.brush;
        const ctx = createMockCtx();

        // Size 20 -> Spacing 3. Dist 2.8.
        const res = paintStrokeSegment(ctx, {x:0, y:0}, {x:2, y:2}, 20, 0, false, true);
        ctx.arc.expectNotCalled();
        assertEqual(res.x, 0);
        assertEqual(res.y, 0);
    });

    register('BrushKernel: paintStrokeSegment step count', () => {
        const { paintStrokeSegment } = window.OkazuTestables.brush;
        const ctx = createMockCtx();

        // Size 20 -> Spacing 3. Dist 30. Steps 10.
        const res = paintStrokeSegment(ctx, {x:0, y:0}, {x:30, y:0}, 20, 0, false, true);

        // Should draw 10 times?
        // Calls: 3, 6, 9 ... 30.
        // Last call at 30.

        // Verify ctx.arc calls
        // Since spy.calls is array of args.
        // We can check count.
        // 10 calls.
        if (ctx.arc.calls.length !== 10) {
            throw new Error(`Expected 10 stamps, got ${ctx.arc.calls.length}`);
        }

        // Check first and last
        // First: 3, 0
        assertEqual(ctx.arc.calls[0][0], 3);
        // Last: 30, 0
        assertEqual(ctx.arc.calls[9][0], 30);

        assertEqual(res.x, 30);
    });

    // 5. Tests for drawStroke
    register('BrushKernel: drawStroke single point', () => {
        const { drawStroke } = window.OkazuTestables.brush;
        const ctx = createMockCtx();

        drawStroke(ctx, [{x:5, y:5}], {size:10, feather:0, featherMode:false, isErasing:true});
        ctx.arc.expectCalledWith(5, 5, 5, 0, Math.PI*2);
        // Called once
        if(ctx.arc.calls.length !== 1) throw new Error('Should call once');
    });

    register('BrushKernel: drawStroke multi point', () => {
        const { drawStroke } = window.OkazuTestables.brush;
        const ctx = createMockCtx();

        // 0,0 -> 10,0. Spacing ~1.5 (size 10). Dist 10. Steps ~6.
        // Plus End Cap at 10,0.
        // 0,0 (first point) -> paintStrokeSegment(null...) calls paintStampAt(0,0).
        // Then 10,0 -> paintStrokeSegment -> interpolation (approx 6 stamps).
        // Then End Cap -> paintStampAt(10,0).

        drawStroke(ctx, [{x:0, y:0}, {x:10, y:0}], {size:10, feather:1, featherMode:true, isErasing:false});

        assert(ctx.arc.calls.length >= 2, 'Should draw multiple stamps');
        // First call 0,0
        assertEqual(ctx.arc.calls[0][0], 0);
        // Last call 10,0
        assertEqual(ctx.arc.calls[ctx.arc.calls.length-1][0], 10);
    });

})();
