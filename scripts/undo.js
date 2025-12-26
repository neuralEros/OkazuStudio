function createUndoSystem({ state, maskCtx, maskCanvas, resizeMainCanvas, render, resetAllAdjustments, log, updateUI, rebuildWorkingCopies, recalculateColorTuning, updateAllAdjustmentUI }) {
    function saveSnapshot(actionType = 'generic') {
        if (actionType.startsWith('tuning')) {
             console.log(`[Undo] Saving Snapshot: ${actionType}`);
        }

        const snap = {
            mask: maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height),
            adjustments: JSON.parse(JSON.stringify(state.adjustments)),
            cropRect: { ...state.cropRect }
        };

        const canCoalesce = actionType !== 'draw' && actionType !== 'generic';
        const isSameAction = canCoalesce
            && actionType === state.lastActionType
            && state.historyIndex === state.history.length - 1;

        if (isSameAction) {
            state.history[state.historyIndex] = snap;
        } else {
            if (state.historyIndex < state.history.length - 1) {
                state.history = state.history.slice(0, state.historyIndex + 1);
            }
            if (state.history.length > 30) state.history.shift();
            state.history.push(snap);
            state.historyIndex = state.history.length - 1;
        }
        state.lastActionType = actionType;
        updateUI();
    }

    function resetMaskAndHistory() {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        state.history = [];
        state.historyIndex = -1;
        resetAllAdjustments();
        state.lastActionType = null;
        if (state.fullDims.w > 0) {
            state.cropRect = { x: 0, y: 0, w: state.fullDims.w, h: state.fullDims.h };
        }
        saveSnapshot('init');
    }

    function resetMaskOnly() {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        state.history = [];
        state.historyIndex = -1;
        state.lastActionType = null;
        saveSnapshot('merge_init');
    }

    function restoreState(snapshot) {
        maskCtx.putImageData(snapshot.mask, 0, 0);
        state.adjustments = JSON.parse(JSON.stringify(snapshot.adjustments));
        state.cropRect = { ...snapshot.cropRect };

        if (!state.isCropping) {
            resizeMainCanvas(state.cropRect.w, state.cropRect.h);
        } else {
            resizeMainCanvas(state.fullDims.w, state.fullDims.h);
        }

        if (typeof recalculateColorTuning === 'function') recalculateColorTuning();
        if (typeof updateAllAdjustmentUI === 'function') updateAllAdjustmentUI();

        if (typeof rebuildWorkingCopies === 'function') rebuildWorkingCopies();

        render();
    }

    function undo() {
        if (state.historyIndex > 0) {
            state.historyIndex--;
            restoreState(state.history[state.historyIndex]);
            state.lastActionType = null;
            updateUI();
            log("Undo", "info");
        }
    }

    function redo() {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            restoreState(state.history[state.historyIndex]);
            state.lastActionType = null;
            updateUI();
            log("Redo", "info");
        }
    }

    return { saveSnapshot, resetMaskAndHistory, resetMaskOnly, restoreState, undo, redo };
}
