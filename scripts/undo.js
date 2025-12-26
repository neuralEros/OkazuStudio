function createUndoSystem({ state, maskCtx, maskCanvas, updateSlider, resizeMainCanvas, render, resetAllAdjustments, log, updateUI, rebuildWorkingCopies, drawStroke }) {

    // --- Asset Manager ---
    // Stores heavy image assets (blobs/images) referenced by UUID
    class AssetManager {
        constructor() {
            this.assets = new Map();
        }

        register(image) {
            // Check if already registered (by src comparison is hard, so we just blindly register)
            // Ideally we'd use a hash, but UUID is fine.
            const id = crypto.randomUUID();
            this.assets.set(id, image);
            return id;
        }

        get(id) {
            return this.assets.get(id);
        }

        has(id) {
            return this.assets.has(id);
        }
    }

    const assetManager = new AssetManager();

    // --- Action Definitions ---
    // Action: { type, payload, timestamp }
    // Payload depends on type:
    // LOAD_IMAGE: { slot: 'A'|'B', assetId: string }
    // STROKE: { points: [], size, feather, featherMode, isErasing }
    // ADJUST: { adjustments: object }
    // CROP: { rect: object }
    // MERGE: { assetId: string } (Merged result is treated as a new asset for simplicity in replay)
    // CENSOR: { assetId: string } (Result treated as asset)
    // CLEAR: {}
    // RESIZE: { width, height }

    // --- History Manager ---
    class HistoryManager {
        constructor() {
            this.actions = [];
            this.keyframes = new Map(); // index -> snapshot
            this.currentIndex = -1;
            this.isReplaying = false;
        }

        record(action) {
            // Discard future if we are in the middle
            if (this.currentIndex < this.actions.length - 1) {
                this.actions = this.actions.slice(0, this.currentIndex + 1);
                // Also clean up future keyframes
                for (const k of this.keyframes.keys()) {
                    if (k > this.currentIndex) this.keyframes.delete(k);
                }
            }

            this.actions.push(action);
            this.currentIndex++;

            this.checkKeyframe();
            updateUI();
        }

        checkKeyframe() {
            const interval = state.settings.undoKeyframeInterval || 20;
            const limit = state.settings.undoHistoryLimit || 5;

            // Save keyframe if interval met
            if (this.currentIndex > 0 && this.currentIndex % interval === 0) {
                this.saveKeyframe(this.currentIndex);
            }

            // Prune old keyframes (keep 0 and last N)
            const keys = Array.from(this.keyframes.keys()).sort((a, b) => a - b);
            // Always keep 0? Maybe. User said "going all the way to the start".
            // If we keep 0, we can always replay from start.
            // If we don't have 0, we can't replay from start unless we have a snapshot covering the start state (which is empty).
            // Let's assume Keyframe 0 is implicitly "Empty State" or we just ensure we have one early on.
            // Actually, best strategy: Keep Keyframe 0 (or closest to it) and the last N.

            // If we have more than limit + 1 (for the base), remove the ones in the middle.
            if (keys.length > limit + 1) {
                // Keep keys[0] (oldest), and keys[keys.length - limit... end]
                // Remove others.
                // Wait, if we keep keyframe 0, and current is 1000, and we keep last 5 (900, 920, 940, 960, 980, 1000).
                // If we undo to 500, and we deleted 500's keyframe, we have to replay from 0. That's fine.

                const toKeep = new Set();
                toKeep.add(keys[0]); // Keep oldest
                for (let i = 0; i < limit; i++) {
                    toKeep.add(keys[keys.length - 1 - i]); // Keep newest N
                }

                for (const k of keys) {
                    if (!toKeep.has(k)) {
                        this.keyframes.delete(k);
                    }
                }
            }
        }

        saveKeyframe(index) {
            const snap = {
                mask: maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height),
                adjustments: JSON.parse(JSON.stringify(state.adjustments)),
                cropRect: { ...state.cropRect },
                imgAId: state.imgAId, // We need to track the current asset ID in state
                imgBId: state.imgBId,
                fullDims: { ...state.fullDims }
            };
            this.keyframes.set(index, snap);
        }

        async undo() {
            if (this.currentIndex < 0) return;
            this.currentIndex--;
            await this.reconstruct();
            updateUI();
            log("Undo", "info");
        }

        async redo() {
            if (this.currentIndex >= this.actions.length - 1) return;
            this.currentIndex++;
            await this.reconstruct();
            updateUI();
            log("Redo", "info");
        }

        async reconstruct() {
            this.isReplaying = true;
            try {
                // 1. Find nearest keyframe <= currentIndex
                let bestKeyIndex = -1;
                // Default to initial state
                let snapshot = null;

                const keys = Array.from(this.keyframes.keys()).sort((a, b) => b - a); // Descending
                for (const k of keys) {
                    if (k <= this.currentIndex) {
                        bestKeyIndex = k;
                        snapshot = this.keyframes.get(k);
                        break;
                    }
                }

                // 2. Restore Snapshot or Reset to Zero
                if (snapshot) {
                    this.restoreSnapshot(snapshot);
                } else {
                    this.resetToZero();
                }

                // 3. Replay actions from bestKeyIndex + 1 to currentIndex
                const startIndex = bestKeyIndex + 1;
                for (let i = startIndex; i <= this.currentIndex; i++) {
                    const action = this.actions[i];
                    await this.executeAction(action);
                }

                // 4. Update UI/View once
                // Note: executeAction updates state, but we might need to trigger renders
                render();
            } finally {
                this.isReplaying = false;
            }
        }

        resetToZero() {
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            // Reset state props
            resetAllAdjustments();
            if (state.fullDims.w > 0) {
                state.cropRect = { x: 0, y: 0, w: state.fullDims.w, h: state.fullDims.h };
            }
            state.imgA = null;
            state.imgB = null;
            state.imgAId = null;
            state.imgBId = null;
            // Also need to clear canvas if we had images
             // Actually executeAction('LOAD') will handle setting images.
             // But if we start from 0, we assume no images.
        }

        restoreSnapshot(snap) {
            if (maskCanvas.width !== snap.mask.width || maskCanvas.height !== snap.mask.height) {
                maskCanvas.width = snap.mask.width;
                maskCanvas.height = snap.mask.height;
            }
            maskCtx.putImageData(snap.mask, 0, 0);

            state.adjustments = JSON.parse(JSON.stringify(snap.adjustments));
            state.cropRect = { ...snap.cropRect };
            state.fullDims = { ...snap.fullDims };

            state.imgAId = snap.imgAId;
            state.imgBId = snap.imgBId;
            state.imgA = snap.imgAId ? assetManager.get(snap.imgAId) : null;
            state.imgB = snap.imgBId ? assetManager.get(snap.imgBId) : null;

            // Sync UI Sliders
            this.syncAdjustmentsUI();

            if (!state.isCropping) {
                resizeMainCanvas(state.cropRect.w, state.cropRect.h);
            }

            if (typeof rebuildWorkingCopies === 'function') rebuildWorkingCopies();
        }

        syncAdjustmentsUI() {
            updateSlider('adj-gamma', state.adjustments.gamma);
            updateSlider('adj-l-black', state.adjustments.levels.black);
            updateSlider('adj-l-mid', state.adjustments.levels.mid);
            updateSlider('adj-l-white', state.adjustments.levels.white);
            updateSlider('adj-sat', state.adjustments.saturation);
            updateSlider('adj-vib', state.adjustments.vibrance);
            updateSlider('adj-wb', state.adjustments.wb);
            updateSlider('adj-cb-r', state.adjustments.colorBal.r);
            updateSlider('adj-cb-g', state.adjustments.colorBal.g);
            updateSlider('adj-cb-b', state.adjustments.colorBal.b);
            updateSlider('adj-shadows', state.adjustments.shadows);
            updateSlider('adj-highlights', state.adjustments.highlights);
        }

        async executeAction(action) {
            switch(action.type) {
                case 'LOAD_IMAGE': {
                    const { slot, assetId } = action.payload;
                    const img = assetManager.get(assetId);
                    if (slot === 'A') {
                        state.imgA = img;
                        state.imgAId = assetId;
                    } else {
                        state.imgB = img;
                        state.imgBId = assetId;
                    }
                    // Re-calculate dims if needed (usually handled by main.js logic, but here we just restore state)
                    // In a true event sourcing, we'd need to re-run the "on load" logic which sets fullDims.
                    // Let's assume we store fullDims in state and it's updated.
                    if (action.payload.fullDims) {
                        state.fullDims = action.payload.fullDims;
                    }
                    if (action.payload.cropRect) {
                        state.cropRect = action.payload.cropRect;
                        resizeMainCanvas(state.cropRect.w, state.cropRect.h);
                    }
                    rebuildWorkingCopies();
                    break;
                }
                case 'STROKE': {
                    if (drawStroke) {
                        drawStroke(maskCtx, action.payload.points, action.payload);
                    }
                    break;
                }
                case 'ADJUST': {
                    state.adjustments = action.payload.adjustments;
                    this.syncAdjustmentsUI();
                    rebuildWorkingCopies();
                    break;
                }
                case 'CROP': {
                    state.cropRect = action.payload.cropRect;
                    resizeMainCanvas(state.cropRect.w, state.cropRect.h);
                    break;
                }
                case 'RESET_MASK': {
                    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                    break;
                }
                case 'MERGE':
                case 'CENSOR': {
                    // Result is stored as a new asset in payload
                    // { assetId, slot }
                    const { slot, assetId } = action.payload;
                    const img = assetManager.get(assetId);
                    if (slot === 'A') { state.imgA = img; state.imgAId = assetId; }
                    else { state.imgB = img; state.imgBId = assetId; }
                    rebuildWorkingCopies();
                    break;
                }
            }
        }
    }

    const history = new HistoryManager();

    // Public API
    function recordAction(type, payload) {
        history.record({ type, payload, timestamp: Date.now() });
    }

    function registerAsset(img) {
        return assetManager.register(img);
    }

    // Adapt old API to new system where possible, or just ignore
    function saveSnapshot(type) {
        // Deprecated, but might be called by old code.
        // We should warn or try to map it if possible.
        console.warn("Legacy saveSnapshot called - ignored in ActionReplay mode");
    }

    return {
        recordAction,
        registerAsset,
        undo: () => history.undo(),
        redo: () => history.redo(),
        resetMaskAndHistory: () => {
             history.actions = [];
             history.keyframes.clear();
             history.currentIndex = -1;
             history.resetToZero();
        },
        saveSnapshot, // Stub
        get canUndo() { return history.currentIndex >= 0; },
        get canRedo() { return history.currentIndex < history.actions.length - 1; }
    };
}
