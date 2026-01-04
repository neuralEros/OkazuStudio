// Brush Kernel - Phase 4
// Pure, deterministic brush rendering logic

(function() {
    const HARDNESS_MAX = 20;

    function getSoftness(size, feather, featherMode) {
        if (!Number.isFinite(size)) {
            return Number.isNaN(size) ? NaN : 0;
        }
        if (!Number.isFinite(feather)) {
            return Number.isNaN(feather) ? NaN : 0;
        }
        const radius = size / 2;
        if (radius <= 0) return 0;
        if (featherMode) {
            return Math.min(1, feather / radius);
        }
        return Math.max(0, Math.min(1, feather / HARDNESS_MAX));
    }

    function paintStampAt(ctx, x, y, size, feather, featherMode, isErasing) {
        // Safety guard for non-finite values to prevent canvas crashes
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || !Number.isFinite(feather)) {
            return;
        }

        const radius = size / 2;
        const softness = getSoftness(size, feather, featherMode);

        ctx.globalCompositeOperation = isErasing ? 'source-over' : 'destination-out';

        if (softness === 0) {
            ctx.fillStyle = isErasing ? 'white' : 'black';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        const grad = ctx.createRadialGradient(x, y, radius * (1 - softness), x, y, radius);
        if (isErasing) {
            grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
            grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    function paintStrokeSegment(ctx, lastStamp, point, size, feather, featherMode, isErasing) {
        // If no last stamp, just paint at current point and return it
        if (!lastStamp) {
            paintStampAt(ctx, point.x, point.y, size, feather, featherMode, isErasing);
            return { x: point.x, y: point.y };
        }

        const spacing = Math.max(1, size * 0.15);
        const dx = point.x - lastStamp.x;
        const dy = point.y - lastStamp.y;
        const dist = Math.hypot(dx, dy);

        if (dist < spacing) {
            return lastStamp;
        }

        const steps = Math.floor(dist / spacing);
        const stepX = (dx / dist) * spacing;
        const stepY = (dy / dist) * spacing;

        let currentX = lastStamp.x;
        let currentY = lastStamp.y;

        for (let i = 1; i <= steps; i++) {
            currentX += stepX;
            currentY += stepY;
            paintStampAt(ctx, currentX, currentY, size, feather, featherMode, isErasing);
        }

        return { x: currentX, y: currentY };
    }

    function drawStroke(ctx, points, settings) {
        if (!points || points.length === 0) return;
        const { size, feather, featherMode, isErasing } = settings;

        if (points.length === 1) {
            const onlyPt = points[0];
            paintStampAt(ctx, onlyPt.x, onlyPt.y, size, feather, featherMode, isErasing);
            return;
        }

        let lastStamp = null;
        for (const pt of points) {
            lastStamp = paintStrokeSegment(ctx, lastStamp, pt, size, feather, featherMode, isErasing);
        }

        // Ensure End Cap is drawn if we have points
        if (points.length > 0) {
            const lastPt = points[points.length - 1];
            paintStampAt(ctx, lastPt.x, lastPt.y, size, feather, featherMode, isErasing);
        }
    }

    window.BrushKernel = {
        paintStampAt,
        paintStrokeSegment,
        drawStroke,
        getSoftness // Exposed for debugging/UI if needed
    };

    window.OkazuTestables = window.OkazuTestables || {};
    window.OkazuTestables.brush = {
        paintStampAt,
        paintStrokeSegment,
        drawStroke,
        getSoftness
    };

})();
