(function() {
    const { register, assert, assertEqual, assertApprox, assertDeepEqual } = window.TestRunner;
    const { getSoftness, paintStampAt, paintStrokeSegment, drawStroke } = window.OkazuTestables.brush;

    // 1. Test Environment Setup
    // Mock Context
    function createMockCtx() {
        return {
            globalCompositeOperation: '',
            fillStyle: '',
            beginPath: function() { this.calls.push(['beginPath']); },
            arc: function(x, y, r, sa, ea) { this.calls.push(['arc', x, y, r, sa, ea]); },
            fill: function() { this.calls.push(['fill']); },
            createRadialGradient: function(x0, y0, r0, x1, y1, r1) {
                this.calls.push(['createRadialGradient', x0, y0, r0, x1, y1, r1]);
                return {
                    addColorStop: function(offset, color) {
                        this.stops.push([offset, color]);
                    },
                    stops: []
                };
            },
            calls: [],
            clearCalls: function() { this.calls = []; }
        };
    }

    // 2. Tests for getSoftness
    register('BrushKernel: getSoftness', () => {
        // 2.1 Size 0
        assertEqual(getSoftness(0, 5, false), 0, 'Size 0 -> 0');
        // 2.2 Negative Size
        assertEqual(getSoftness(-10, 5, true), 0, 'Negative size -> 0');
        // 2.2b Non-finite inputs
        assert(Number.isNaN(getSoftness(NaN, 5, false)), 'NaN size returns NaN');
        assert(Number.isNaN(getSoftness(10, NaN, true)), 'NaN feather returns NaN');
        assertEqual(getSoftness(Infinity, 5, true), 0, 'Infinite size clamps to zero softness');
        // 2.3 Feather Mode On
        // size=20 (radius 10), feather=5 -> 0.5
        assertApprox(getSoftness(20, 5, true), 0.5, 1e-6, 'Feather mode ratio');
        // 2.4 Feather Mode Off
        // feather 10 / 20 (MAX) = 0.5
        assertApprox(getSoftness(20, 10, false), 0.5, 1e-6, 'Standard mode ratio');
        // 2.5 Clamping
        assertEqual(getSoftness(20, -5, false), 0, 'Clamp min');
        assertEqual(getSoftness(20, 1000, true), 1, 'Clamp max');
        // 2.6 Feather > Radius
        assertEqual(getSoftness(10, 100, true), 1, 'Feather > Radius clamps to 1');
    });

    // 3. Tests for paintStampAt
    register('BrushKernel: paintStampAt', () => {
        const ctx = createMockCtx();

        // 3.1 Guard Against Non-finite
        paintStampAt(ctx, NaN, 0, 10, 5, false, true);
        paintStampAt(ctx, 0, Infinity, 10, 5, false, true);
        paintStampAt(ctx, 0, 0, NaN, 5, false, true);
        paintStampAt(ctx, 0, 0, 10, NaN, false, true);
        assertEqual(ctx.calls.length, 0, 'No calls for non-finite inputs');

        // 3.2 Composite Operation
        paintStampAt(ctx, 5, 5, 10, 0, false, true); // Erase
        assertEqual(ctx.globalCompositeOperation, 'source-over', 'Erase uses source-over');

        paintStampAt(ctx, 5, 5, 10, 0, false, false); // Repair
        assertEqual(ctx.globalCompositeOperation, 'destination-out', 'Repair uses destination-out');

        // 3.3 Solid Fill (Softness 0)
        ctx.clearCalls();
        paintStampAt(ctx, 10, 20, 10, 0, false, true); // Erase, Hard
        assertEqual(ctx.fillStyle, 'white', 'Erase hard is white');
        assert(ctx.calls.some(c => c[0] === 'beginPath'), 'Called beginPath');
        assert(ctx.calls.some(c => c[0] === 'arc' && c[1] === 10 && c[2] === 20 && c[3] === 5), 'Arc correct');
        assert(ctx.calls.some(c => c[0] === 'fill'), 'Called fill');
        assert(!ctx.calls.some(c => c[0] === 'createRadialGradient'), 'No gradient for hard brush');

        // 3.4 Gradient Fill (Softness > 0)
        ctx.clearCalls();
        paintStampAt(ctx, 10, 20, 10, 5, true, true); // Erase, Soft
        const gradCall = ctx.calls.find(c => c[0] === 'createRadialGradient');
        assert(gradCall, 'Gradient created');
        // r0 should be radius * (1 - softness). size=10 -> r=5. softness=1 (5/5). r0=0.
        // Wait, 10 size, 5 feather, featherMode=true => softness = 5/5 = 1.
        // 1 - 1 = 0. So inner radius 0.
        assertEqual(gradCall[1], 10, 'Gradient x0 correct');
        assertEqual(gradCall[2], 20, 'Gradient y0 correct');
        assertEqual(gradCall[3], 0, 'Inner radius correct');
        assertEqual(gradCall[4], 10, 'Gradient x1 correct');
        assertEqual(gradCall[5], 20, 'Gradient y1 correct');
        assertEqual(gradCall[6], 5, 'Outer radius correct');

        // Check gradient colors (via the returned mock object which we need to capture differently or inspect context)
        // Since `ctx.fillStyle` is assigned the object return by createRadialGradient, we can inspect it.
        const gradObj = ctx.fillStyle;
        assert(gradObj.stops.length === 2, 'Two color stops');
        assertEqual(gradObj.stops[0][1], 'rgba(255, 255, 255, 1)', 'Start color white opaque');
        assertEqual(gradObj.stops[1][1], 'rgba(255, 255, 255, 0)', 'End color white transparent');

        // 3.5 Repair Gradient Colors
        ctx.clearCalls();
        paintStampAt(ctx, 10, 20, 10, 5, true, false); // Repair, Soft
        const repairGradCall = ctx.calls.find(c => c[0] === 'createRadialGradient');
        assert(repairGradCall, 'Repair gradient created');
        assertEqual(repairGradCall[1], 10, 'Repair gradient x0 correct');
        assertEqual(repairGradCall[2], 20, 'Repair gradient y0 correct');
        assertEqual(repairGradCall[3], 0, 'Repair inner radius correct');
        assertEqual(repairGradCall[4], 10, 'Repair gradient x1 correct');
        assertEqual(repairGradCall[5], 20, 'Repair gradient y1 correct');
        assertEqual(repairGradCall[6], 5, 'Repair outer radius correct');

        const repairGradObj = ctx.fillStyle;
        assert(repairGradObj.stops.length === 2, 'Repair has two color stops');
        assertEqual(repairGradObj.stops[0][1], 'rgba(0, 0, 0, 1)', 'Repair start color black opaque');
        assertEqual(repairGradObj.stops[1][1], 'rgba(0, 0, 0, 0)', 'Repair end color black transparent');
    });

    // 4. Tests for paintStrokeSegment
    register('BrushKernel: paintStrokeSegment', () => {
        const ctx = createMockCtx();
        // Mock paintStampAt behavior by spying on ctx calls again
        // Actually, we can just inspect calls.

        // 4.1 No lastStamp
        ctx.clearCalls();
        const res1 = paintStrokeSegment(ctx, null, { x: 10, y: 20 }, 10, 0, false, true);
        assertDeepEqual(res1, { x: 10, y: 20 }, 'Returns point as last stamp');
        const arcs1 = ctx.calls.filter(c => c[0] === 'arc');
        assertEqual(arcs1.length, 1, 'Painted one stamp');
        assertEqual(arcs1[0][1], 10, 'Stamp x correct');
        assertEqual(arcs1[0][2], 20, 'Stamp y correct');

        // 4.1b Non-finite inputs
        ctx.clearCalls();
        const nonFiniteRes = paintStrokeSegment(ctx, null, { x: NaN, y: 20 }, 10, 0, false, true);
        assertEqual(ctx.calls.length, 0, 'No calls for non-finite point');
        assert(Number.isNaN(nonFiniteRes.x), 'Non-finite result x preserved');
        ctx.clearCalls();
        const nonFiniteSizeRes = paintStrokeSegment(ctx, null, { x: 10, y: 20 }, NaN, 0, false, true);
        assertEqual(ctx.calls.length, 0, 'No calls for non-finite size');
        assertDeepEqual(nonFiniteSizeRes, { x: 10, y: 20 }, 'Non-finite size preserves point');

        // 4.2 Distance < Spacing
        // Size 20 => Spacing 3. Dist (0,0)->(2,2) is ~2.82 < 3.
        ctx.clearCalls();
        const res2 = paintStrokeSegment(ctx, { x: 0, y: 0 }, { x: 2, y: 2 }, 20, 0, false, true);
        assertDeepEqual(res2, { x: 0, y: 0 }, 'Returns original last stamp');
        assertEqual(ctx.calls.length, 0, 'No paint calls');

        // 4.3 Distance Multiples
        // Size 20 => Spacing 3. Dist 30. Steps = 10.
        ctx.clearCalls();
        const res3 = paintStrokeSegment(ctx, { x: 0, y: 0 }, { x: 30, y: 0 }, 20, 0, false, true);
        // Expect 10 'fill' calls (one per stamp)
        const arcs3 = ctx.calls.filter(c => c[0] === 'arc');
        assertEqual(arcs3.length, 10, 'Painted 10 stamps');
        const expectedXs = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
        expectedXs.forEach((x, idx) => {
            assertEqual(arcs3[idx][1], x, `Stamp ${idx + 1} x position`);
            assertEqual(arcs3[idx][2], 0, `Stamp ${idx + 1} y position`);
        });
        assertDeepEqual(res3, { x: 30, y: 0 }, 'Returned end point');
    });

    // 5. Tests for drawStroke
    register('BrushKernel: drawStroke', () => {
        const ctx = createMockCtx();

        // 5.1 Empty
        drawStroke(ctx, [], {});
        assertEqual(ctx.calls.length, 0, 'No-op empty');

        // 5.2 Single Point
        ctx.clearCalls();
        drawStroke(ctx, [{x:5,y:5}], {size:10, feather:0, featherMode:false, isErasing:true});
        const arcs1 = ctx.calls.filter(c => c[0] === 'arc');
        assertEqual(arcs1.length, 1, 'Single stamp for single point');
        assertEqual(arcs1[0][1], 5, 'Single point x');
        assertEqual(arcs1[0][2], 5, 'Single point y');

        // 5.2b Non-finite inputs
        ctx.clearCalls();
        drawStroke(ctx, [{x:NaN,y:5}], {size:10, feather:0, featherMode:false, isErasing:true});
        assertEqual(ctx.calls.length, 0, 'No calls for non-finite drawStroke point');
        ctx.clearCalls();
        drawStroke(ctx, [{x:5,y:5}], {size:NaN, feather:0, featherMode:false, isErasing:true});
        assertEqual(ctx.calls.length, 0, 'No calls for non-finite drawStroke size');

        // 5.3 Multi Point
        ctx.clearCalls();
        // P1(0,0) -> P2(10,0). Size 10 => Spacing 1.5. Dist 10. Steps 6.
        // 6 segments stamps + 1 final cap = 7 stamps.
        // Wait, paintStrokeSegment(P1->P2) does intermediate stamps.
        // First iteration: lastStamp=null, current=P1. Segment P1->P1 (no dist). Returns P1. Paints P1.
        // Wait, loop:
        // 1. pt=P1. lastStamp=null. call segment(null, P1). Paints P1. Returns P1.
        // 2. pt=P2. lastStamp=P1. call segment(P1, P2). Paints steps (6). Returns approx P2.
        // End: Paint cap at P2.
        // Total: 1 (start) + 6 (steps) + 1 (end) = 8?
        // Let's trace carefully.
        // paintStrokeSegment(null, P1) -> Paints P1.
        // paintStrokeSegment(P1, P2) -> spacing 1.5. dist 10. steps 6. paints 6 times (at 1.5, 3.0 ... 9.0). Returns 9.0.
        // Actually returns currentX/Y which updates in loop.
        // Loop i=1 to 6. currentX += step.
        // So it paints at 1.5, 3.0, 4.5, 6.0, 7.5, 9.0. Returns (9.0, 0).
        // Finally drawStroke paints cap at P2 (10, 0).
        // Total stamps: 1 (start) + 6 (interp) + 1 (end) = 8.
        drawStroke(ctx, [{x:0,y:0}, {x:10,y:0}], {size:10, feather:0, featherMode:false, isErasing:true});
        const arcs2 = ctx.calls.filter(c => c[0] === 'arc');
        assertEqual(arcs2.length, 8, 'Painted exact stamp count including end cap');
        const expectedMultiXs = [0, 1.5, 3, 4.5, 6, 7.5, 9, 10];
        expectedMultiXs.forEach((x, idx) => {
            assertApprox(arcs2[idx][1], x, 1e-6, `Multi stamp ${idx + 1} x`);
            assertApprox(arcs2[idx][2], 0, 1e-6, `Multi stamp ${idx + 1} y`);
        });
    });

})();
