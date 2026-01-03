// Core adjustment helpers (browser-only global namespace)
(function() {
    function clampChannel(value) {
        return Math.max(0, Math.min(255, value));
    }

    function applyLUT(value, lut) {
        if (!lut || !lut.length) return value;
        return lut[clampChannel(value)] ?? value;
    }

    window.AdjustmentsCore = {
        clampChannel,
        applyLUT
    };
})();
