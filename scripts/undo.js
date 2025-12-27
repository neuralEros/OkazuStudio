function createUndoSystem({ state, maskCtx, maskCanvas, resizeMainCanvas, render, resetAllAdjustments, log, updateUI, rebuildWorkingCopies, recalculateColorTuning, updateAllAdjustmentUI, Logger }) {
    function saveSnapshot(actionType = 'generic') {
        const snap = {
            mask: maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height),
            adjustments: JSON.parse(JSON.stringify(state.adjustments)),
            cropRect: { ...state.cropRect },
            rotation: state.rotation
        };

        const canCoalesce = actionType !== 'draw' && actionType !== 'generic';
        const isSameAction = canCoalesce
            && actionType === state.lastActionType
            && state.historyIndex === state.history.length - 1;

        if (isSameAction) {
            state.history[state.historyIndex] = snap;
            Logger.info(`Updated existing snapshot at index ${state.historyIndex}. Action: ${actionType}`);
        } else {
            if (state.historyIndex < state.history.length - 1) {
                state.history = state.history.slice(0, state.historyIndex + 1);
            }
            if (state.history.length > 30) state.history.shift();
            state.history.push(snap);
            state.historyIndex = state.history.length - 1;
            Logger.info(`Created new snapshot at index ${state.historyIndex}. Action: ${actionType}`);
        }
        state.lastActionType = actionType;
        updateUI();
    }

    function resetMaskAndHistory() {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        state.history = [];
        state.historyIndex = -1;
        resetAllAdjustments();
        state.rotation = 0;
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
        state.rotation = snapshot.rotation || 0;

        if (!state.isCropping) {
            // This needs to be mindful of rotation - render() handles the final sizing
            // But resizeMainCanvas generally sets the "Truth" dimensions if rotation logic is added there?
            // Actually, mainCanvas resizing is typically strictly visual in most frameworks, but here
            // resizeMainCanvas sets .width/.height.
            // We should let render() handle the visual swap, so passing "Truth" dims here is tricky
            // if resizeMainCanvas expects Truth.
            // In our plan, render() handles visual resizing.
            // So we just update state, and call render().
            // However, resizeMainCanvas is used to force canvas size.
            // If we are rotated, we might need to swap W/H.
            // For now, let's trust that the render pipeline or main.js logic handles the swap based on state.rotation.
            // We will update resizeMainCanvas logic in main.js if needed.
            // But we must call it to reset buffers?
            // Let's defer to main.js updates. For now, pass Truth Dims as before.
            // Actually, wait. If rotation is 90, and cropRect is 100x200.
            // Visual canvas should be 200x100.
            // If resizeMainCanvas sets width/height, it needs to know about rotation.
            // We will update resizeMainCanvas in main.js to respect state.rotation.
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
            const undos = state.historyIndex;
            const redos = state.history.length - 1 - state.historyIndex;
            Logger.info(`Undo cursor position: ${state.historyIndex} | Undo steps: ${undos} | Redo steps: ${redos}`);
            restoreState(state.history[state.historyIndex]);
            state.lastActionType = null;
            updateUI();
            log("Undo", "info");
        } else {
            Logger.warn("Undo: Reached start of history.");
        }
    }

    function redo() {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            const undos = state.historyIndex;
            const redos = state.history.length - 1 - state.historyIndex;
            Logger.info(`Undo cursor position: ${state.historyIndex} | Undo steps: ${undos} | Redo steps: ${redos}`);
            restoreState(state.history[state.historyIndex]);
            state.lastActionType = null;
            updateUI();
            log("Redo", "info");
        } else {
            Logger.warn("Redo: Reached end of history.");
        }
    }

    return { saveSnapshot, resetMaskAndHistory, resetMaskOnly, restoreState, undo, redo };
}
