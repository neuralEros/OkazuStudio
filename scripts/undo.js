function createUndoSystem({ state, maskCtx, maskCanvas, resizeMainCanvas, render, resetAllAdjustments, log, updateUI, rebuildWorkingCopies, recalculateColorTuning, updateAllAdjustmentUI, Logger }) {

    function generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    function saveSnapshot(actionType = 'generic') {
        const snap = {
            id: generateId(),
            timestamp: Date.now(),
            actionType,
            imgA: state.imgA ? state.imgA.toDataURL() : null,
            imgB: state.imgB ? state.imgB.toDataURL() : null,
            nameA: state.nameA,
            nameB: state.nameB,
            isAFront: state.isAFront,
            opacity: state.opacity,
            maskData: maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height),
            cropRect: state.cropRect ? { ...state.cropRect } : null,
            fullDims: { ...state.fullDims },
            rotation: state.rotation,
            adjustments: JSON.parse(JSON.stringify(state.adjustments)),
            brushSettings: JSON.parse(JSON.stringify(state.brushSettings))
        };

        const canCoalesce = actionType !== 'draw' && actionType !== 'generic';
        // Coalesce if same action type and we are at the tip of history
        // Special case for 'rotate_view': it should coalesce
        const isSameAction = (canCoalesce || actionType === 'rotate_view')
            && actionType === state.lastActionType
            && state.historyIndex === state.history.length - 1;

        if (isSameAction) {
            state.history[state.historyIndex] = snap;
            Logger.info(`Updated existing snapshot at index ${state.historyIndex}. Action: ${actionType}`);
        } else {
            if (state.historyIndex < state.history.length - 1) {
                state.history = state.history.slice(0, state.historyIndex + 1);
            }
            if (state.history.length > (state.settings.undoHistoryLimit || 30)) state.history.shift();

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
        state.lastActionType = null;
        if (state.fullDims.w > 0) {
            state.cropRect = { x: 0, y: 0, w: state.fullDims.w, h: state.fullDims.h };
        }
        // Don't auto-snapshot here, let caller do it if needed (initially)
        // But for reset, we should probably have a baseline.
        // Actually main.js calls saveSnapshot('clear_all') after reset.
    }

    function resetMaskOnly() {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        state.history = [];
        state.historyIndex = -1;
        state.lastActionType = null;
    }

    function restoreState(snapshot) {
        if (!snapshot) return;

        // Restore Adjustments first (state)
        state.adjustments = JSON.parse(JSON.stringify(snapshot.adjustments));
        if (typeof recalculateColorTuning === 'function') recalculateColorTuning();
        if (typeof updateAllAdjustmentUI === 'function') updateAllAdjustmentUI();

        // Restore Brushes
        if (snapshot.brushSettings) {
            state.brushSettings = JSON.parse(JSON.stringify(snapshot.brushSettings));
        }

        state.nameA = snapshot.nameA;
        state.nameB = snapshot.nameB;
        state.isAFront = snapshot.isAFront;
        state.opacity = snapshot.opacity;
        state.cropRect = snapshot.cropRect ? { ...snapshot.cropRect } : null;
        state.fullDims = { ...snapshot.fullDims };
        state.rotation = snapshot.rotation || 0;

        // Restore Mask
        if (snapshot.maskData) {
            // Note: maskData is ImageData. Ensure canvas size matches.
            if (maskCanvas.width !== snapshot.maskData.width || maskCanvas.height !== snapshot.maskData.height) {
                maskCanvas.width = snapshot.maskData.width;
                maskCanvas.height = snapshot.maskData.height;
            }
            maskCtx.putImageData(snapshot.maskData, 0, 0);
        } else if (snapshot.mask) {
             // Legacy field support if any?
             // My grep showed 'mask', but my replacement used 'maskData'.
             // Let's support 'mask' as well just in case.
             if (maskCanvas.width !== snapshot.mask.width || maskCanvas.height !== snapshot.mask.height) {
                maskCanvas.width = snapshot.mask.width;
                maskCanvas.height = snapshot.mask.height;
            }
            maskCtx.putImageData(snapshot.mask, 0, 0);
        }

        // Images
        // Helper to load image from dataURL
        const loadImg = (src) => {
            return new Promise(resolve => {
                if (!src) return resolve(null);
                const i = new Image();
                i.onload = () => resolve(i);
                i.src = src;
            });
        };

        // Note: Restoring images from DataURL might be heavy but is needed for robust Undo.
        // If snapshot stores null (not loaded), state is null.
        Promise.all([loadImg(snapshot.imgA), loadImg(snapshot.imgB)]).then(([iA, iB]) => {
            // Restore images to state (canvases)
            if (iA) {
                state.imgA = document.createElement('canvas');
                state.imgA.width = iA.width; state.imgA.height = iA.height;
                state.imgA.getContext('2d').drawImage(iA, 0, 0);
                state.sourceA = state.imgA;
            } else state.imgA = null;

            if (iB) {
                state.imgB = document.createElement('canvas');
                state.imgB.width = iB.width; state.imgB.height = iB.height;
                state.imgB.getContext('2d').drawImage(iB, 0, 0);
                state.sourceB = state.imgB;
            } else state.imgB = null;

            // Rebuild workings
            if (typeof rebuildWorkingCopies === 'function') rebuildWorkingCopies(true);

            // Resize canvas to match restored rotation/crop
            // Note: resizeMainCanvas sets physical size.
            // updateCanvasDimensions logic handles rotation swap.
            // Here we must replicate visual size logic.
            const isRotated = state.rotation % 180 !== 0;
            const visualW = isRotated ? state.cropRect.h : state.cropRect.w;
            const visualH = isRotated ? state.cropRect.w : state.cropRect.h;

            resizeMainCanvas(visualW, visualH);

            // Update wrapper dimensions
            const wrapper = document.getElementById('canvas-wrapper');
            if (wrapper) {
                wrapper.style.width = visualW + 'px';
                wrapper.style.height = visualH + 'px';
            }

            // Re-render
            render();
            if (typeof updateUI === 'function') updateUI();

            // Update Text UI
            const btnA = document.getElementById('btnA');
            const btnB = document.getElementById('btnB');
            // Assuming the span structure is consistent
            if(btnA && btnA.firstElementChild) btnA.firstElementChild.textContent = state.nameA ? (state.nameA.length > 8 ? state.nameA.substring(0,6)+'..' : state.nameA) : "Load";
            if(btnB && btnB.firstElementChild) btnB.firstElementChild.textContent = state.nameB ? (state.nameB.length > 8 ? state.nameB.substring(0,6)+'..' : state.nameB) : "Load";
            // Also need to handle border classes?
            if(state.imgA) btnA.classList.add('border-accent-strong', 'text-accent');
            else btnA.classList.remove('border-accent-strong', 'text-accent');
            if(state.imgB) btnB.classList.add('border-accent-strong', 'text-accent');
            else btnB.classList.remove('border-accent-strong', 'text-accent');

            const opSlider = document.getElementById('opacitySlider');
            const opVal = document.getElementById('opacityVal');
            if(opSlider) opSlider.value = Math.round(state.opacity * 100);
            if(opVal) opVal.textContent = Math.round(state.opacity * 100) + '%';
        });
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
