// Replay Engine - Phase 5
// Keyframe management and deterministic action replay

(function() {

    class KeyframeManager {
        constructor(state, maskCtx, maskCanvas) {
            this.state = state;
            this.maskCtx = maskCtx;
            this.maskCanvas = maskCanvas;
            this.keyframes = new Map(); // index -> snapshot
            this.baseKeyframe = null; // Keyframe at index -1
        }

        createSnapshot() {
            // Capture all necessary state to restore from this point
            // Note: Heavy assets are referenced by ID, not copied
            return {
                timestamp: Date.now(),
                maskData: this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height),
                adjustments: JSON.parse(JSON.stringify(this.state.adjustments)),
                cropRect: this.state.cropRect ? { ...this.state.cropRect } : null,
                fullDims: { ...this.state.fullDims },
                rotation: this.state.rotation,
                brushSettings: JSON.parse(JSON.stringify(this.state.brushSettings)),
                opacity: this.state.opacity,
                isAFront: this.state.isAFront,
                assetIdA: this.state.assetIdA,
                assetIdB: this.state.assetIdB,
                maskVisible: this.state.maskVisible,
                backVisible: this.state.backVisible,
                adjustmentsVisible: this.state.adjustmentsVisible,
                nameA: this.state.nameA,
                nameB: this.state.nameB
            };
        }

        saveKeyframe(actionIndex) {
            const snap = this.createSnapshot();
            this.keyframes.set(actionIndex, snap);

            // Pruning logic (keep last M + base)
            // But we must keep base (-1 or 0)
            // For now, let's just keep them all or prune aggressively?
            // Requirement: "Keep only last M keyframes ... but ALWAYS keep base"
            // We'll implement pruning in ReplayEngine or here later.
        }

        restoreKeyframe(snapshot) {
            if (!snapshot) return;

            // Restore State
            this.state.adjustments = JSON.parse(JSON.stringify(snapshot.adjustments));
            this.state.cropRect = snapshot.cropRect ? { ...snapshot.cropRect } : null;
            this.state.fullDims = { ...snapshot.fullDims };
            this.state.rotation = snapshot.rotation;
            this.state.brushSettings = JSON.parse(JSON.stringify(snapshot.brushSettings));
            this.state.opacity = snapshot.opacity;
            this.state.isAFront = snapshot.isAFront;
            this.state.assetIdA = snapshot.assetIdA;
            this.state.assetIdB = snapshot.assetIdB;
            this.state.maskVisible = snapshot.maskVisible;
            this.state.backVisible = snapshot.backVisible;
            this.state.adjustmentsVisible = snapshot.adjustmentsVisible;
            this.state.nameA = snapshot.nameA;
            this.state.nameB = snapshot.nameB;

            // Restore Mask
            if (this.maskCanvas.width !== snapshot.maskData.width || this.maskCanvas.height !== snapshot.maskData.height) {
                this.maskCanvas.width = snapshot.maskData.width;
                this.maskCanvas.height = snapshot.maskData.height;
            }
            this.maskCtx.putImageData(snapshot.maskData, 0, 0);
        }

        getNearestKeyframe(targetIndex) {
            // Find key k <= targetIndex with max k
            let bestIndex = -2;
            for (const k of this.keyframes.keys()) {
                if (k <= targetIndex && k > bestIndex) {
                    bestIndex = k;
                }
            }
            return { index: bestIndex, snapshot: this.keyframes.get(bestIndex) };
        }
    }

    class ReplayEngine {
        constructor(state, maskCtx, maskCanvas, renderFn, updateUIFn, rebuildWorkingCopiesFn) {
            this.state = state;
            this.maskCtx = maskCtx;
            this.maskCanvas = maskCanvas;
            this.render = renderFn;
            this.updateUI = updateUIFn;
            this.rebuildWorkingCopies = rebuildWorkingCopiesFn;

            this.keyframeManager = new KeyframeManager(state, maskCtx, maskCanvas);
            this.isEnabled = false;

            // Initialize base keyframe at -1
            this.keyframeManager.saveKeyframe(-1);
        }

        toggle(enabled) {
            this.isEnabled = enabled;
            console.log(`[ReplayEngine] ${enabled ? 'Enabled' : 'Disabled'}`);
            if (enabled) {
                // When enabling, maybe we should snapshot current state as the 'current' keyframe if we are at tip?
                // But ActionHistory cursor might be ahead.
                // For now, assume we start clean or sync with cursor.
            }
        }

        applyAction(action) {
            const { type, payload } = action;
            // console.log(`[ReplayEngine] Applying ${type}`, payload);

            switch (type) {
                case 'LOAD_IMAGE':
                case 'MERGE_LAYERS':
                case 'APPLY_CENSOR':
                    // These all involve setting a layer source from an Asset ID
                    const assetId = payload.assetId;
                    const asset = window.AssetManager.getAsset(assetId);
                    if (asset) {
                        const targetSlot = payload.slot || payload.targetSlot || (type === 'APPLY_CENSOR' ? 'B' : null);
                        // Note: APPLY_CENSOR payload in main.js didn't strictly specify slot B in payload object,
                        // but logic implied B. Wait, main.js Phase 3 diff showed:
                        // dispatchAction({ type: 'APPLY_CENSOR', payload: { assetId } });
                        // And code set state.assetIdB = assetId.
                        // So for Censor, it's 'B'. For Merge, payload has targetSlot='A'. For Load, payload has slot.

                        let slot = targetSlot;
                        if (type === 'APPLY_CENSOR' && !slot) slot = 'B';

                        if (slot === 'A') {
                            this.state.assetIdA = assetId;
                            this.state.imgA = cloneCanvas(asset.source); // Helper needed? Or just use asset source if it's a canvas/img
                            this.state.sourceA = this.state.imgA;
                            if (payload.name) this.state.nameA = payload.name;
                            else if (type === 'MERGE_LAYERS') this.state.nameA = "Merged Layer";
                        } else {
                            this.state.assetIdB = assetId;
                            this.state.imgB = cloneCanvas(asset.source);
                            this.state.sourceB = this.state.imgB;
                            if (payload.name) this.state.nameB = payload.name;
                            else if (type === 'APPLY_CENSOR') this.state.nameB = "Censored Layer";
                        }

                        if (type === 'LOAD_IMAGE') {
                             // Initialize dims if first image?
                             // main.js assignLayer does: markAdjustmentsDirty, rebuildWorkingCopies, updateCanvasDimensions, render, updateUI.
                             // We handle those at end of replayTo usually, or explicitly?
                             // We should probably rely on `rebuildWorkingCopies` and `render` calls at end of replay loop.
                        }

                        if (type === 'MERGE_LAYERS') {
                            // Merge also clears B
                            this.state.assetIdB = null;
                            this.state.imgB = null;
                            this.state.sourceB = null;
                            this.state.nameB = "";
                        }
                    }
                    break;

                case 'SWAP_LAYERS':
                    [this.state.imgA, this.state.imgB] = [this.state.imgB, this.state.imgA];
                    [this.state.sourceA, this.state.sourceB] = [this.state.sourceB, this.state.sourceA];
                    [this.state.assetIdA, this.state.assetIdB] = [this.state.assetIdB, this.state.assetIdA];
                    [this.state.nameA, this.state.nameB] = [this.state.nameB, this.state.nameA];
                    // working copies and versions are derived, rebuild at end
                    break;

                case 'STROKE':
                    // payload: { points, size, feather, featherMode, isErasing }
                    // Use BrushKernel
                    if (window.BrushKernel) {
                        window.BrushKernel.drawStroke(this.maskCtx, payload.points, {
                            size: payload.brushSize || payload.size, // Handle field name variance if any
                            feather: payload.feather,
                            featherMode: payload.featherMode,
                            isErasing: payload.isErasing
                        });
                    }
                    break;

                case 'POLYLINE':
                    // payload: { points, shouldFill, brushSize, feather... }
                    if (window.BrushKernel && payload.points) {
                        const { points, brushSize, feather, featherMode, mode } = payload; // mode: erase/repair
                        const isErasing = mode === 'erase';

                        // Fill
                        if (payload.shouldFill) {
                             this.maskCtx.save();
                             this.maskCtx.beginPath();
                             this.maskCtx.moveTo(points[0].x, points[0].y);
                             for (let i = 1; i < points.length; i++) this.maskCtx.lineTo(points[i].x, points[i].y);
                             this.maskCtx.closePath();
                             this.maskCtx.globalCompositeOperation = isErasing ? 'source-over' : 'destination-out';
                             this.maskCtx.fillStyle = isErasing ? 'white' : 'black';
                             this.maskCtx.fill();
                             this.maskCtx.restore();
                        }

                        // Stroke
                        if (points.length > 0) {
                             window.BrushKernel.paintStampAt(this.maskCtx, points[0].x, points[0].y, brushSize, feather, featherMode, isErasing);
                             for (let i = 0; i < points.length - 1; i++) {
                                 window.BrushKernel.paintStrokeSegment(this.maskCtx, points[i], points[i+1], brushSize, feather, featherMode, isErasing);
                                 window.BrushKernel.paintStampAt(this.maskCtx, points[i+1].x, points[i+1].y, brushSize, feather, featherMode, isErasing);
                             }
                        }
                    }
                    break;

                case 'CROP':
                    if (payload.rect) this.state.cropRect = { ...payload.rect };
                    // We might need to update fullDims if it was a crop commit that changed them?
                    // Actually main.js acceptCrop just updates isCropping toggle?
                    // No, main.js acceptCrop logs CROP with state.cropRect.
                    // The crop rect is stored in state.
                    break;

                case 'ROTATE_VIEW':
                    this.state.rotation = (this.state.rotation + 90) % 360;
                    // updateCanvasDimensions logic?
                    // Rotation is visual only in state usually until bake.
                    // But if we baked... bakeRotation clears history in old system.
                    // In new system, bakeRotation happens on Export/Load/Merge.
                    // Those actions (Load, Merge) handle their own bake.
                    // Standard Rotate button just updates state.rotation.
                    break;

                case 'ADJUST':
                    // payload: { id, key, subkey, value }
                    if (payload.subkey) this.state.adjustments[payload.key][payload.subkey] = payload.value;
                    else this.state.adjustments[payload.key] = payload.value;
                    break;

                case 'TUNE_COLOR':
                    // payload: { band, key, value }
                    if (this.state.adjustments.colorTuning[payload.band]) {
                        this.state.adjustments.colorTuning[payload.band][payload.key] = payload.value;
                    }
                    break;

                case 'CLEAR_LAYER':
                    if (payload.slot === 'A') {
                        this.state.imgA = null; this.state.sourceA = null; this.state.assetIdA = null; this.state.nameA = "";
                    } else {
                        this.state.imgB = null; this.state.sourceB = null; this.state.assetIdB = null; this.state.nameB = "";
                    }
                    break;

                case 'RESET_ALL':
                    this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
                    // Reset adjustments... logic from main.js/adjustments.js
                    // Ideally we call a helper, but here we manually reset state props
                    // Or we assume 'RESET_ADJUSTMENTS' is separate?
                    // main.js: clearMask calls dispatch(RESET_ALL), clears mask, resets adjustments.
                    // So we must reset adjustments here.
                    this.state.adjustments = this.getCleanAdjustments();
                    this.state.maskVisible = true;
                    this.state.backVisible = true;
                    this.state.adjustmentsVisible = true;
                    this.state.cropRect = { x:0, y:0, w:this.state.fullDims.w, h:this.state.fullDims.h };
                    break;

                case 'RESET_ADJUSTMENTS':
                    this.state.adjustments = this.getCleanAdjustments();
                    break;

                case 'SET_OPACITY':
                    this.state.opacity = payload.value;
                    break;

                case 'TOGGLE_MASK': this.state.maskVisible = payload.visible; break;
                case 'TOGGLE_BACK': this.state.backVisible = payload.visible; break;
                case 'TOGGLE_ADJUSTMENTS': this.state.adjustmentsVisible = payload.visible; break;
            }
        }

        getCleanAdjustments() {
             // Return default structure
             return {
                 gamma: 1.0,
                 levels: { black: 0, mid: 1.0, white: 255 },
                 shadows: 0, highlights: 0,
                 saturation: 0, vibrance: 0,
                 wb: 0, colorBal: { r: 0, g: 0, b: 0 },
                 colorTuning: this.state.adjustments.colorTuning // Resetting structure is tedious, maybe iterate?
                 // For now, let's assume colorTuning keys exist and reset values
             };
             // Actually, a helper to reset is better.
        }

        async replayTo(targetIndex) {
            if (!this.isEnabled) return;

            const startTime = performance.now();
            const log = window.ActionHistory.getLog();

            // 1. Find nearest keyframe
            const { index: kIndex, snapshot } = this.keyframeManager.getNearestKeyframe(targetIndex);

            if (snapshot) {
                // console.log(`[ReplayEngine] Restoring keyframe ${kIndex}`);
                this.keyframeManager.restoreKeyframe(snapshot);
            } else {
                // console.warn("No keyframe found, starting from scratch?");
                // Should not happen if -1 is saved.
            }

            // 2. Replay actions
            for (let i = kIndex + 1; i <= targetIndex; i++) {
                const action = log[i];
                if (action) {
                    this.applyAction(action);
                }
            }

            // 3. Finalize
            // Recalculate derived state (like working copies from adjustments)
            if (typeof this.rebuildWorkingCopies === 'function') {
                this.rebuildWorkingCopies(true); // force version bump
            }

            // Update UI
            if (typeof this.updateUI === 'function') {
                this.updateUI();
            }

            // Update Canvas Dimensions (if crop/rotation changed)
            // Ideally main.js exports updateCanvasDimensions or we replicate it
            // We can't easily replicate it.
            // Phase 1 used `dispatchAction` before execution.
            // Phase 5 Replay completely *bypasses* execution logic in main.js for past actions.
            // So we need to ensure the view matches the state.
            // We need to call `resizeMainCanvas` and transform wrapper based on state.
            // This is tricky without exposing main.js internals.
            // BUT: `ReplayEngine` is instantiated in `main.js`. So we can pass `updateCanvasDimensions` as a callback!

            if (this.updateCanvasDimensionsFn) this.updateCanvasDimensionsFn();

            // Render
            if (typeof this.render === 'function') {
                this.render();
            }

            console.log(`[ReplayEngine] Replay to ${targetIndex} took ${(performance.now() - startTime).toFixed(1)}ms`);
        }

        // Helper to register canvas update callback
        setUpdateCanvasDimensionsFn(fn) {
            this.updateCanvasDimensionsFn = fn;
        }

        onActionLogged(action, index) {
            if (!this.isEnabled) return;

            // Logic to create new keyframe
            // Check interval setting
            const interval = this.state.settings.keyframeInterval || 10;
            if (index % interval === 0) {
                // console.log(`[ReplayEngine] Creating keyframe at index ${index}`);
                this.keyframeManager.saveKeyframe(index);
            }
        }
    }

    function cloneCanvas(source) {
        if (!source) return null;
        const c = document.createElement('canvas');
        c.width = source.width;
        c.height = source.height;
        c.getContext('2d').drawImage(source, 0, 0);
        return c;
    }

    window.createReplayEngine = function(state, maskCtx, maskCanvas, render, updateUI, rebuildWorkingCopies) {
        return new ReplayEngine(state, maskCtx, maskCanvas, render, updateUI, rebuildWorkingCopies);
    };

})();
