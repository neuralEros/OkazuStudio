// Steganography Logic Module
const Stego = (() => {

    // --- Config & Constants ---
    const SOFTWARE_NAME = "OkazuStudio";
    const SOFTWARE_VERSION = "0";

    // --- Hardcoded Default Adjustments ---
    // Match defaults in main.js
    const DEFAULTS = {
        gamma: 1.0,
        levels: { black: 0, mid: 1.0, white: 255 },
        shadows: 0, highlights: 0,
        saturation: 0, vibrance: 0,
        wb: 0,
        colorBal: { r: 0, g: 0, b: 0 },
        // All tuning bands should be 0s
    };

    /**
     * Extracts relevant mask history actions.
     * Strategy:
     * 1. Iterate backwards from current cursor.
     * 2. Stop if we hit a "Mask Barrier" (Load, Merge, Censor, Reset All).
     *    Note: "RESET_ALL" clears the mask. "LOAD_IMAGE" clears mask history if it's a fresh start.
     *    "MERGE_LAYERS" and "APPLY_CENSOR" commit/reset the mask state.
     * 3. Collect STROKE and POLYLINE actions that happened *after* the barrier.
     *
     * @param {Object} historyLog - The global ActionHistory instance
     * @returns {Array} List of actions or null if empty
     */
    function getMaskActions(historyLog) {
        if (!historyLog || !historyLog.actions) return null;

        const actions = historyLog.actions;
        const cursor = historyLog.cursor;

        if (cursor < 0) return null;

        let barrierIndex = -1;

        // Scan backwards to find the last event that reset the mask
        for (let i = cursor; i >= 0; i--) {
            const type = actions[i].type;
            if (
                type === 'LOAD_IMAGE' ||
                type === 'MERGE_LAYERS' ||
                type === 'APPLY_CENSOR' ||
                type === 'RESET_ALL' ||
                type === 'CLEAR_LAYER' // Logic in main.js: clearLayer resets mask if last image gone
            ) {
                // Check edge case: CLEAR_LAYER only resets if both empty.
                // But generally, rely on these being major state changes.
                // For safety, let's treat them as barriers.
                barrierIndex = i;
                break;
            }
        }

        const relevantActions = [];
        for (let i = barrierIndex + 1; i <= cursor; i++) {
            const a = actions[i];
            if (a.type === 'STROKE' || a.type === 'POLYLINE') {
                relevantActions.push(a);
            }
        }

        return relevantActions.length > 0 ? relevantActions : null;
    }

    /**
     * Checks if adjustments differ from defaults.
     * @param {Object} state - The global state object
     * @returns {Object|null} The adjustments object or null if clean
     */
    function getAdjustmentsPacket(state) {
        const a = state.adjustments;
        if (!a) return null;

        // Helper to check deep equality against default
        const isDiff = (val, def) => {
            if (typeof val === 'number') return Math.abs(val - def) > 0.0001;
            if (typeof val === 'object') {
                for (let k in val) {
                    if (isDiff(val[k], def[k])) return true;
                }
                return false;
            }
            return val !== def;
        };

        // Check top-level scalars
        if (Math.abs(a.gamma - DEFAULTS.gamma) > 0.001) return a;
        if (Math.abs(a.shadows - DEFAULTS.shadows) > 0.001) return a;
        if (Math.abs(a.highlights - DEFAULTS.highlights) > 0.001) return a;
        if (Math.abs(a.saturation - DEFAULTS.saturation) > 0.001) return a;
        if (Math.abs(a.vibrance - DEFAULTS.vibrance) > 0.001) return a;
        if (Math.abs(a.wb - DEFAULTS.wb) > 0.001) return a;

        // Check objects
        if (a.levels.black !== DEFAULTS.levels.black ||
            Math.abs(a.levels.mid - DEFAULTS.levels.mid) > 0.001 ||
            a.levels.white !== DEFAULTS.levels.white) return a;

        if (a.colorBal.r !== 0 || a.colorBal.g !== 0 || a.colorBal.b !== 0) return a;

        // Check Color Tuning
        // Iterate all bands
        for (let band in a.colorTuning) {
            const b = a.colorTuning[band];
            if (b.hue !== 0 || b.saturation !== 0 || b.vibrance !== 0 ||
                b.luminance !== 0 || b.shadows !== 0 || b.highlights !== 0) {
                return a;
            }
        }

        return null; // All clean
    }

    /**
     * Checks if a crop is active.
     * @param {Object} state
     * @returns {Object|null}
     */
    function getCropPacket(state) {
        // If state.cropRect exists, check if it's effectively "Full"
        // Full rect in prop space is w = Aspect, h = 1.0 (Wait, logic in main.js sets w = targetW/targetH)

        if (!state.cropRect) return null;

        // Safety check for state.fullDims (although initialized in main.js, safe is better)
        const fullW = (state.fullDims && state.fullDims.w) || 1;
        const fullH = (state.fullDims && state.fullDims.h) || 1;

        const r = state.cropRect;
        // Logic check: Is it roughly the full image?
        // state.fullDims determines the aspect ratio of the full image.
        // Full Image aspect = state.fullDims.w / state.fullDims.h
        const fullAspect = fullW / fullH;

        // Tolerances (Relaxed to 0.01 for floating point safety)
        const isXZero = Math.abs(r.x) < 0.01;
        const isYZero = Math.abs(r.y) < 0.01;
        const isHOne = Math.abs(r.h - 1.0) < 0.01;
        const isWAspect = Math.abs(r.w - fullAspect) < 0.01;

        if (isXZero && isYZero && isHOne && isWAspect) {
            return null; // Is effectively full
        }

        return r;
    }

    /**
     * Assembles the full payload for the image.
     * @param {Object} state - Application state
     * @param {Object} history - ActionHistory instance
     * @param {string} exportType - 'merged', 'front', 'back', 'mask', 'save'
     * @returns {Object|null} Payload object or null if nothing to save
     */
    function assemblePayload(state, history, exportType) {
        const payload = {
            info: {
                software: SOFTWARE_NAME,
                version: SOFTWARE_VERSION,
                type: exportType,
                timestamp: Date.now()
            }
        };

        let hasContent = false;

        // Packet: Censor (Specific for Save Jobs)
        // Detect "Censor Project" state by checking if Back Layer (Slot B) is "Censored Layer"
        // (This name is hardcoded in applyCensor in main.js)
        if (exportType === 'save') {
             if (state.nameB === "Censored Layer") {
                 payload.censor = true;
                 hasContent = true;
             }
        }

        // Packet: Adjustments
        // Stamp on Merged, Front, Back, and Save.
        if (exportType !== 'mask') {
             const adj = getAdjustmentsPacket(state);
             if (adj) {
                 payload.adjustments = adj;
                 hasContent = true;
             }
        }

        // Packet: Crop
        const crop = getCropPacket(state);
        if (crop) {
            payload.crop = crop;
            hasContent = true;
        }

        // Packet: Mask
        // Stamp on Merged, Mask, and Save exports.
        // (Save needs mask history to restore the session)
        if (exportType === 'merged' || exportType === 'mask' || exportType === 'save') {
            const maskActions = getMaskActions(history);
            if (maskActions) {
                payload.mask = maskActions;
                hasContent = true;
            }
        }

        return payload;
    }

    return {
        assemblePayload
    };

})();

// Node.js export for testing
if (typeof module !== 'undefined') {
    module.exports = Stego;
} else {
    window.Stego = Stego;
}
