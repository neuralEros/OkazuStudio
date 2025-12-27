// Legacy Undo System - Deprecated in favor of ReplayEngine
// Kept for partial compatibility with existing function signatures

function createUndoSystem({ state, maskCtx, maskCanvas, resetAllAdjustments, Logger }) {

    function saveSnapshot(actionType) {
        // No-op
    }

    function resetMaskAndHistory() {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        state.history = [];
        state.historyIndex = -1;
        if (resetAllAdjustments) resetAllAdjustments();

        // Reset crop to full dims if valid
        if (state.fullDims.w > 0) {
            state.cropRect = { x: 0, y: 0, w: state.fullDims.w, h: state.fullDims.h };
        }
    }

    function resetMaskOnly() {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }

    function restoreState() {}
    function undo() {}
    function redo() {}

    return { saveSnapshot, resetMaskAndHistory, resetMaskOnly, restoreState, undo, redo };
}
