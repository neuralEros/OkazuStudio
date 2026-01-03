// Geometry helpers (browser-only global namespace)
(function() {
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function roundTo(value, step) {
        if (step === 0) return value;
        return Math.round(value / step) * step;
    }

    function distance(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.hypot(dx, dy);
    }

    window.Geometry = {
        clamp,
        lerp,
        roundTo,
        distance
    };
})();
