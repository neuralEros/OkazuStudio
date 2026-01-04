// Replay Engine - Phase 6
// Centralized History, Keyframes, and Deterministic Replay

(function() {

    // --- Action History ---
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    class ActionHistoryLog {
        constructor() {
            this.actions = [];
            this.cursor = -1;
        }

        logAction(action) {
            // Truncate future if we are in the middle of history
            if (this.cursor < this.actions.length - 1) {
                this.actions.splice(this.cursor + 1);
            }

            const entry = {
                id: generateId(),
                timestamp: Date.now(),
                type: action.type,
                payload: action.payload // Payload should be immutable-ish
            };

            this.actions.push(entry);
            this.cursor = this.actions.length - 1;

            if (window.Logger) {
                const type = entry.type;
                const p = entry.payload;

                if (type === 'STROKE' || type === 'POLYLINE') {
                    const mode = p.mode || p.tool || (p.isErasing ? 'erase' : 'unknown');
                    const size = typeof p.brushSize === 'number' ? p.brushSize.toFixed(4) : '?';
                    const feather = typeof p.feather === 'number' ? p.feather.toFixed(4) : '?';
                    const fMode = p.featherMode ? 'Fixed' : 'Hardness';

                    window.Logger.info(`Action: ${type} | Tool: ${mode} | Size: ${size} | Feather: ${feather} (${fMode})`);

                    if (p.points && Array.isArray(p.points)) {
                        p.points.forEach((pt, i) => {
                            window.Logger.info(`${type} Point ${i}: (${pt.x.toFixed(4)}, ${pt.y.toFixed(4)})`);
                        });
                    }
                }
                else if (type === 'ADJUST' || type === 'TUNE_COLOR') {
                    const key = p.key;
                    const sub = p.subkey ? `.${p.subkey}` : '';
                    const band = p.band ? `[${p.band}] ` : '';
                    const oldV = typeof p.oldValue === 'number' ? p.oldValue.toFixed(2) : (p.oldValue || '0.00');
                    const newV = typeof p.value === 'number' ? p.value.toFixed(2) : (p.value || '0.00');

                    window.Logger.info(`Action: ${type} | ${band}${key}${sub}: ${oldV} -> ${newV}`);
                }
                else {
                    let summary = '';
                    try {
                        summary = Object.entries(p)
                            .filter(([k]) => typeof k === 'string' && k !== 'points') // Filter out heavy arrays just in case
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ');
                    } catch(e) { summary = '...'; }

                    if (summary) window.Logger.info(`Action: ${type} | ${summary}`);
                    else window.Logger.info(`Action: ${type}`);
                }
            }

            console.log(`[ActionHistory] Logged: ${entry.type} (Cursor: ${this.cursor})`, entry.payload);
            return this.cursor;
        }

        getLog() {
            return this.actions;
        }
    }

    // --- Keyframe Manager ---
    class KeyframeManager {
        constructor(state, maskCtx, maskCanvas) {
            this.state = state;
            this.maskCtx = maskCtx;
            this.maskCanvas = maskCanvas;
            this.keyframes = new Map(); // index -> snapshot
        }

        createSnapshot() {
            return {
                timestamp: Date.now(),
                // Mask Pixel Data
                maskData: this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height),

                // Deep Copy mutable simple state
                adjustments: JSON.parse(JSON.stringify(this.state.adjustments)),
                cropRect: this.state.cropRect ? { ...this.state.cropRect } : null,
                fullDims: { ...this.state.fullDims },
                rotation: this.state.rotation,
                brushSettings: JSON.parse(JSON.stringify(this.state.brushSettings)),
                opacity: this.state.opacity,
                isAFront: this.state.isAFront,

                // References (IDs) to Heavy Assets
                assetIdA: this.state.assetIdA,
                assetIdB: this.state.assetIdB,
                nameA: this.state.nameA,
                nameB: this.state.nameB,

                // Toggles
                maskVisible: this.state.maskVisible,
                backVisible: this.state.backVisible,
                adjustmentsVisible: this.state.adjustmentsVisible,
                brushMode: this.state.brushMode,
                feather: this.state.feather,
                featherSize: this.state.featherSize, // Prop
                featherMode: this.state.featherMode,
                brushSize: this.state.brushSize // Prop
            };
        }

        saveKeyframe(actionIndex) {
            const snap = this.createSnapshot();
            this.keyframes.set(actionIndex, snap);
            this.pruneKeyframes(actionIndex);
        }

        pruneKeyframes(currentIndex) {
            // Policy: Keep Base (-1) and last M keyframes
            // Also keep current index if it is a keyframe?
            const buffer = (this.state.settings && this.state.settings.keyframeBuffer) || 5;

            // Get all indices, sorted
            const indices = Array.from(this.keyframes.keys()).sort((a, b) => a - b);

            // Keep -1 (Base)
            // Keep last 'buffer' amount
            const toKeep = new Set();
            if (this.keyframes.has(-1)) toKeep.add(-1);

            // Add the last 'buffer' indices
            const recent = indices.slice(-buffer);
            recent.forEach(i => toKeep.add(i));

            // Delete others
            indices.forEach(i => {
                if (!toKeep.has(i)) {
                    this.keyframes.delete(i);
                    // console.log(`[KeyframeManager] Pruned keyframe ${i}`);
                }
            });
        }

        invalidateFutureKeyframes(currentIndex) {
            const indices = Array.from(this.keyframes.keys());
            indices.forEach(i => {
                if (i > currentIndex) {
                    this.keyframes.delete(i);
                    // console.log(`[KeyframeManager] Invalidated future keyframe ${i}`);
                }
            });
        }

        restoreKeyframe(snapshot) {
            if (!snapshot) return;

            // 1. Restore Simple State
            this.state.adjustments = JSON.parse(JSON.stringify(snapshot.adjustments));
            this.state.cropRect = snapshot.cropRect ? { ...snapshot.cropRect } : null;
            this.state.fullDims = { ...snapshot.fullDims };
            this.state.rotation = snapshot.rotation;
            this.state.brushSettings = JSON.parse(JSON.stringify(snapshot.brushSettings));
            this.state.opacity = snapshot.opacity;
            this.state.isAFront = snapshot.isAFront;
            this.state.maskVisible = snapshot.maskVisible;
            this.state.backVisible = snapshot.backVisible;
            this.state.adjustmentsVisible = snapshot.adjustmentsVisible;
            this.state.nameA = snapshot.nameA;
            this.state.nameB = snapshot.nameB;
            this.state.brushMode = snapshot.brushMode;
            this.state.feather = snapshot.feather;
            this.state.featherSize = snapshot.featherSize;
            this.state.featherMode = snapshot.featherMode;
            this.state.brushSize = snapshot.brushSize;

            this.state.assetIdA = snapshot.assetIdA;
            this.state.assetIdB = snapshot.assetIdB;

            // 2. Re-hydrate Heavy Objects from Asset IDs
            // Critical Step: Restore imgA/imgB/sourceA/sourceB
            this.hydrateLayer('A', snapshot.assetIdA);
            this.hydrateLayer('B', snapshot.assetIdB);

            // 3. Restore Mask
            if (this.maskCanvas.width !== snapshot.maskData.width || this.maskCanvas.height !== snapshot.maskData.height) {
                this.maskCanvas.width = snapshot.maskData.width;
                this.maskCanvas.height = snapshot.maskData.height;
            }
            this.maskCtx.putImageData(snapshot.maskData, 0, 0);
        }

        hydrateLayer(slot, assetId) {
            if (!assetId) {
                if (slot === 'A') {
                    this.state.imgA = null; this.state.sourceA = null; this.state.workingA = null;
                } else {
                    this.state.imgB = null; this.state.sourceB = null; this.state.workingB = null;
                }
                return;
            }

            const asset = window.AssetManager.getAsset(assetId);
            if (asset) {
                const copy = cloneCanvas(asset.source);
                if (slot === 'A') {
                    this.state.imgA = copy; this.state.sourceA = copy;
                    // working copy will be rebuilt by replay engine loop end
                } else {
                    this.state.imgB = copy; this.state.sourceB = copy;
                }
            } else {
                console.warn(`[Replay] Missing asset ${assetId} for slot ${slot}`);
            }
        }

        getNearestKeyframe(targetIndex) {
            let bestIndex = -2;
            for (const k of this.keyframes.keys()) {
                if (k <= targetIndex && k > bestIndex) {
                    bestIndex = k;
                }
            }
            return { index: bestIndex, snapshot: this.keyframes.get(bestIndex) };
        }
    }

    // --- Replay Engine ---
    class ReplayEngine {
        constructor(state, maskCtx, maskCanvas, renderFn, updateUIFn, rebuildWorkingCopiesFn) {
            this.state = state;
            this.maskCtx = maskCtx;
            this.maskCanvas = maskCanvas;
            this.render = renderFn;
            this.updateUI = updateUIFn;
            this.rebuildWorkingCopies = rebuildWorkingCopiesFn;

            this.history = new ActionHistoryLog();
            this.keyframeManager = new KeyframeManager(state, maskCtx, maskCanvas);
            this.undoFloor = -1;

            // Expose globally for legacy access if needed
            window.ActionHistory = this.history;

            // Initialize base keyframe
            this.keyframeManager.saveKeyframe(-1);
        }

        // Main Entry Point for New Actions
        logAction(action) {
            // Invalidate any keyframes ahead of the current cursor before branching
            // The history.logAction will increment cursor, so we check cursor BEFORE log
            this.keyframeManager.invalidateFutureKeyframes(this.history.cursor);

            const index = this.history.logAction(action);

            // Check for keyframe creation
            const interval = (this.state.settings && this.state.settings.keyframeInterval) || 10;
            if (index >= 0 && index % interval === 0) {
                this.keyframeManager.saveKeyframe(index);
            }

            // Update UI State (Undo/Redo buttons)
            if (this.updateUI) this.updateUI();
        }

        undo() {
            if (this.history.cursor >= 0 && this.history.cursor > this.undoFloor) {
                this.history.cursor--;
                this.replayTo(this.history.cursor);
            }
        }

        redo() {
            if (this.history.cursor < this.history.actions.length - 1) {
                this.history.cursor++;
                this.replayTo(this.history.cursor);
            }
        }

        clear() {
            this.history.actions = [];
            this.history.cursor = -1;
            this.keyframeManager.keyframes.clear();
            this.keyframeManager.saveKeyframe(-1);
            this.undoFloor = -1;
            if (typeof this.updateUI === 'function') {
                this.updateUI();
            }
        }

        setUndoFloor(index) {
            this.undoFloor = Math.max(-1, index);
            if (typeof this.updateUI === 'function') {
                this.updateUI();
            }
        }

        saveKeyframeAtCursor() {
            const index = this.history.cursor;
            if (index >= -1) {
                this.keyframeManager.saveKeyframe(index);
            }
        }

        async replayTo(targetIndex) {
            const startTime = performance.now();
            const log = this.history.getLog();

            // 1. Find and Restore Keyframe
            const { index: kIndex, snapshot } = this.keyframeManager.getNearestKeyframe(targetIndex);

            if (snapshot) {
                this.keyframeManager.restoreKeyframe(snapshot);
            } else {
                console.warn("[Replay] Critical: No base keyframe found. State may be corrupt.");
            }

            // 2. Replay Actions
            for (let i = kIndex + 1; i <= targetIndex; i++) {
                const action = log[i];
                if (action) {
                    this.applyAction(action.type, action.payload);
                }
            }

            // 3. Finalize
            if (typeof this.rebuildWorkingCopies === 'function') {
                this.rebuildWorkingCopies(true); // force version bump
            }

            if (this.updateCanvasDimensionsFn) {
                this.updateCanvasDimensionsFn();
            }

            if (typeof this.updateUI === 'function') {
                this.updateUI();
            }

            if (typeof this.render === 'function') {
                this.render();
            }

            console.log(`[ReplayEngine] Replay to ${targetIndex} (from ${kIndex}) took ${(performance.now() - startTime).toFixed(1)}ms`);
        }

        // Simulation Helper for baking rotation (Load, Merge, Censor)
        performBakeRotation() {
            if (this.state.rotation === 0) return;
            const rot = this.state.rotation;

            // Rotate Layers
            if (this.state.imgA) {
                this.state.imgA = rotateCanvas(this.state.imgA, rot);
                this.state.sourceA = this.state.imgA;
            }
            if (this.state.imgB) {
                this.state.imgB = rotateCanvas(this.state.imgB, rot);
                this.state.sourceB = this.state.imgB;
            }

            // Rotate Mask
            const rotatedMask = rotateCanvas(this.maskCanvas, rot);
            this.maskCanvas.width = rotatedMask.width;
            this.maskCanvas.height = rotatedMask.height;
            this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
            this.maskCtx.drawImage(rotatedMask, 0, 0);

            // Update Full Dims
            const oldFullW = this.state.fullDims.w;
            const oldFullH = this.state.fullDims.h;
            if (rot % 180 !== 0) {
                this.state.fullDims = { w: oldFullH, h: oldFullW };
            }

            // Update Crop Rect
            if (this.state.cropRect) {
                this.state.cropRect = rotateRect(this.state.cropRect, oldFullW, oldFullH, rot);
            } else {
                this.state.cropRect = { x: 0, y: 0, w: this.state.fullDims.w, h: this.state.fullDims.h };
            }

            this.state.rotation = 0;
        }

        applyAction(type, payload) {
            switch (type) {
                case 'LOAD_IMAGE':
                case 'MERGE_LAYERS':
                case 'APPLY_CENSOR':
                    // These actions trigger a bake in Live, so they must in Replay
                    this.performBakeRotation();

                    // 1. Handle Censor Layer (Slot B)
                    const assetId = payload.assetId;
                    const asset = window.AssetManager.getAsset(assetId);

                    // 2. Handle Base Layer (Slot A) - if provided
                    const baseId = payload.baseId;
                    if (baseId) {
                        const baseAsset = window.AssetManager.getAsset(baseId);
                        if (baseAsset) {
                            this.state.assetIdA = baseId;
                            this.state.imgA = cloneCanvas(baseAsset.source);
                            this.state.sourceA = this.state.imgA;
                            this.state.nameA = "Base Layer";
                        }
                    }

                    if (asset) {
                        // Determine Slot (Legacy fallback)
                        let slot = payload.slot || payload.targetSlot;
                        if (!slot) {
                            slot = type === 'APPLY_CENSOR' ? 'B' : 'A';
                        }

                        // Logic
                        if (slot === 'A') {
                            this.state.assetIdA = assetId;
                            this.state.imgA = cloneCanvas(asset.source);
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

                        // Side Effects
                        if (type === 'LOAD_IMAGE') {
                             // Calculate Union Dimensions
                             const union = getUnionDims(this.state.imgA, this.state.imgB);
                             const newW = union.w;
                             const newH = union.h;

                             if (this.state.fullDims.w !== newW || this.state.fullDims.h !== newH) {
                                 // Resize Mask Preserving Center
                                 if (this.maskCanvas.width > 0 && this.maskCanvas.height > 0) {
                                     const temp = document.createElement('canvas');
                                     temp.width = this.maskCanvas.width;
                                     temp.height = this.maskCanvas.height;
                                     temp.getContext('2d').drawImage(this.maskCanvas, 0, 0);

                                     this.maskCanvas.width = newW;
                                     this.maskCanvas.height = newH;

                                     // Center old mask
                                     const sY = newH / temp.height;
                                     const sX = sY;
                                     const projW = temp.width * sX;
                                     const offX = (newW - projW) / 2;

                                     this.maskCtx.clearRect(0, 0, newW, newH);
                                     this.maskCtx.drawImage(temp, 0, 0, temp.width, temp.height, offX, 0, projW, newH);
                                 } else {
                                     this.maskCanvas.width = newW;
                                     this.maskCanvas.height = newH;
                                 }
                             }
                             this.state.fullDims = { w: newW, h: newH };

                             // Default Crop: Frame the Loaded Image (Centered in Union)
                             // Note: In case of smart-slotting (A->B, New->A), we want to frame New A.
                             // Logic here assumes 'asset' is the one we want to see.
                             // If we loaded to B (Back), and A exists, maybe we shouldn't re-frame?
                             // But standard behavior: Load -> Show what you loaded (or the composition context).
                             // User preference: "Frame Front".
                             // If we loaded to A: Asset is A. Frame it.
                             // If we loaded to B: Asset is B. A exists. Frame A?
                             // Current Replay logic applies to 'asset' (the payload).
                             // If payload slot is B, this frames B.
                             // To strictly "Frame Front":
                             const targetImg = (slot === 'A') ? this.state.imgA : (this.state.imgA || this.state.imgB);
                             const targetW = targetImg ? targetImg.width : 1;
                             const targetH = targetImg ? targetImg.height : 1;

                             const scale = (newH / targetH) || 1;
                             const visW = targetW * scale;
                             const offX = (newW - visW) / 2;

                             const propX = offX / newH;
                             const propW = visW / newH;

                             this.state.cropRect = { x: propX, y: 0, w: propW, h: 1.0 };
                             this.state.rotation = 0;
                        } else if (type === 'MERGE_LAYERS') {
                             // Merge clears B
                             this.state.assetIdB = null;
                             this.state.imgB = null;
                             this.state.sourceB = null;
                             this.state.nameB = "";

                             this.state.fullDims = { w: asset.width, h: asset.height };
                             this.state.cropRect = { x: 0, y: 0, w: asset.width/asset.height, h: 1.0 };
                        } else if (type === 'APPLY_CENSOR') {
                             this.state.fullDims = { w: asset.width, h: asset.height };
                             if (!this.state.cropRect) {
                                 this.state.cropRect = { x: 0, y: 0, w: asset.width/asset.height, h: 1.0 };
                             }
                             // Censor resets UI state usually
                             this.state.opacity = 1.0;
                             this.state.isAFront = true;
                        }
                    }
                    break;

                case 'SWAP_LAYERS':
                    [this.state.imgA, this.state.imgB] = [this.state.imgB, this.state.imgA];
                    [this.state.sourceA, this.state.sourceB] = [this.state.sourceB, this.state.sourceA];
                    [this.state.assetIdA, this.state.assetIdB] = [this.state.assetIdB, this.state.assetIdA];
                    [this.state.nameA, this.state.nameB] = [this.state.nameB, this.state.nameA];

                    // Update dimensions and reset crop to ensure correct view
                    const union = getUnionDims(this.state.imgA, this.state.imgB);
                    if (union.w > 0) {
                        const newW = union.w;
                        const newH = union.h;

                        // If dimensions changed, resize mask and center content to preserve paint
                        if (newW !== this.maskCanvas.width || newH !== this.maskCanvas.height) {
                            const temp = document.createElement('canvas');
                            temp.width = this.maskCanvas.width;
                            temp.height = this.maskCanvas.height;
                            temp.getContext('2d').drawImage(this.maskCanvas, 0, 0);

                            this.maskCanvas.width = newW;
                            this.maskCanvas.height = newH;

                            // Center old mask
                            const sY = newH / temp.height;
                            const sX = sY;
                            const projW = temp.width * sX;
                            const offX = (newW - projW) / 2;

                            this.maskCtx.clearRect(0, 0, newW, newH);
                            this.maskCtx.drawImage(temp, 0, 0, temp.width, temp.height, offX, 0, projW, newH);
                        }
                        this.state.fullDims = { w: newW, h: newH };
                    }

                    if (this.state.imgA) {
                        // Frame Front Image (Centered)
                        const h = this.state.imgA.height || 1;
                        const scale = (this.state.fullDims.h / h) || 1;
                        const visW = this.state.imgA.width * scale;
                        const offX = (this.state.fullDims.w - visW) / 2;

                        const propX = offX / this.state.fullDims.h;
                        const propW = visW / this.state.fullDims.h;

                        this.state.cropRect = { x: propX, y: 0, w: propW, h: 1.0 };
                    } else if (this.state.imgB) {
                        // Frame Back Image (Centered) if A is missing
                        const h = this.state.imgB.height || 1;
                        const scale = (this.state.fullDims.h / h) || 1;
                        const visW = this.state.imgB.width * scale;
                        const offX = (this.state.fullDims.w - visW) / 2;

                        const propX = offX / this.state.fullDims.h;
                        const propW = visW / this.state.fullDims.h;

                        this.state.cropRect = { x: propX, y: 0, w: propW, h: 1.0 };
                    }
                    break;

                case 'STROKE':
                    if (window.BrushKernel) {
                        const fullH = this.state.fullDims.h || 1;
                        const brushPx = (payload.brushSize || payload.size) * fullH;
                        const featherVal = payload.featherMode ? (payload.feather * fullH) : payload.feather;

                        // Convert payload points (props) to pixels
                        const pointsPx = payload.points.map(p => ({ x: p.x * fullH, y: p.y * fullH }));

                        window.BrushKernel.drawStroke(this.maskCtx, pointsPx, {
                            size: brushPx,
                            feather: featherVal,
                            featherMode: payload.featherMode,
                            isErasing: payload.isErasing
                        });
                    }
                    break;

                case 'POLYLINE':
                    if (window.BrushKernel && payload.points) {
                        const { points, brushSize, feather, featherMode, mode, shouldFill } = payload;
                        const isErasing = mode === 'erase';
                        const fullH = this.state.fullDims.h || 1;

                        const brushPx = brushSize * fullH;
                        const featherVal = featherMode ? (feather * fullH) : feather;

                        if (shouldFill) {
                             this.maskCtx.save();
                             this.maskCtx.beginPath();
                             this.maskCtx.moveTo(points[0].x * fullH, points[0].y * fullH);
                             for (let i = 1; i < points.length; i++) this.maskCtx.lineTo(points[i].x * fullH, points[i].y * fullH);
                             this.maskCtx.closePath();
                             this.maskCtx.globalCompositeOperation = isErasing ? 'source-over' : 'destination-out';
                             this.maskCtx.fillStyle = isErasing ? 'white' : 'black';
                             this.maskCtx.fill();
                             this.maskCtx.restore();
                        }

                        if (points.length > 0) {
                             // Note: Paint functions take pixels
                             window.BrushKernel.paintStampAt(this.maskCtx, points[0].x * fullH, points[0].y * fullH, brushPx, featherVal, featherMode, isErasing);
                             for (let i = 0; i < points.length - 1; i++) {
                                 const p1 = { x: points[i].x * fullH, y: points[i].y * fullH };
                                 const p2 = { x: points[i+1].x * fullH, y: points[i+1].y * fullH };
                                 window.BrushKernel.paintStrokeSegment(this.maskCtx, p1, p2, brushPx, featherVal, featherMode, isErasing);
                                 window.BrushKernel.paintStampAt(this.maskCtx, p2.x, p2.y, brushPx, featherVal, featherMode, isErasing);
                             }
                        }
                    }
                    break;

                case 'CROP':
                    if (payload.rect) this.state.cropRect = { ...payload.rect };
                    break;

                case 'ROTATE_VIEW':
                    this.state.rotation = (this.state.rotation + 90) % 360;
                    break;

                case 'ADJUST':
                    if (payload.subkey) this.state.adjustments[payload.key][payload.subkey] = payload.value;
                    else this.state.adjustments[payload.key] = payload.value;
                    break;

                case 'TUNE_COLOR':
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
                    this.state.adjustments = this.getCleanAdjustments();
                    this.state.maskVisible = true;
                    this.state.backVisible = true;
                    this.state.adjustmentsVisible = true;
                    const aspect = (this.state.fullDims.w || 1) / (this.state.fullDims.h || 1);
                    this.state.cropRect = { x:0, y:0, w:aspect, h:1.0 };
                    break;

                case 'RESET_ADJUSTMENTS':
                    this.state.adjustments = this.getCleanAdjustments();
                    break;

                case 'RESET_LEVELS':
                    this.state.adjustments.levels = { black: 0, mid: 1.0, white: 255 };
                    break;
                case 'RESET_SATURATION':
                    this.state.adjustments.saturation = 0;
                    this.state.adjustments.vibrance = 0;
                    break;
                case 'RESET_COLOR_BALANCE':
                    this.state.adjustments.wb = 0;
                    this.state.adjustments.colorBal = { r: 0, g: 0, b: 0 };
                    break;
                case 'RESET_TUNING_BAND':
                    this.state.adjustments.colorTuning[payload.band] = { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
                    break;
                case 'RESET_TUNING_ALL':
                    this.state.adjustments.colorTuning = this.createCleanColorTuning();
                    break;

                case 'SET_OPACITY':
                    this.state.opacity = payload.value;
                    break;

                case 'TOGGLE_MASK': this.state.maskVisible = payload.visible; break;
                case 'TOGGLE_BACK': this.state.backVisible = payload.visible; break;
                case 'TOGGLE_ADJUSTMENTS': this.state.adjustmentsVisible = payload.visible; break;
                case 'RESTORE_ADJUSTMENTS':
                    this.state.adjustments = JSON.parse(JSON.stringify(payload.adjustments || this.getCleanAdjustments()));
                    break;
            }
        }

        getCleanAdjustments() {
             return {
                 gamma: 1.0,
                 levels: { black: 0, mid: 1.0, white: 255 },
                 shadows: 0, highlights: 0,
                 saturation: 0, vibrance: 0,
                 wb: 0, colorBal: { r: 0, g: 0, b: 0 },
                 colorTuning: this.createCleanColorTuning()
             };
        }

        createCleanColorTuning() {
            const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta', 'lights', 'mids', 'darks'];
            const t = {};
            bands.forEach(b => {
                t[b] = { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
            });
            return t;
        }

        setUpdateCanvasDimensionsFn(fn) {
            this.updateCanvasDimensionsFn = fn;
        }
    }

    // --- Helpers ---
    function getUnionDims(imgA, imgB) {
        if (!imgA && !imgB) return { w: 0, h: 0 };
        if (!imgA) return { w: imgB.width, h: imgB.height };
        if (!imgB) return { w: imgA.width, h: imgA.height };

        const unionH = Math.max(imgA.height, imgB.height);
        const scaleA = unionH / imgA.height;
        const scaleB = unionH / imgB.height;
        const unionW = Math.max(imgA.width * scaleA, imgB.width * scaleB);
        return { w: Math.round(unionW), h: unionH };
    }

    function cloneCanvas(source) {
        if (!source) return null;
        if (!isDrawableSource(source)) return source;
        const width = source.naturalWidth || source.width;
        const height = source.naturalHeight || source.height;
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        c.getContext('2d').drawImage(source, 0, 0);
        return c;
    }

    function isDrawableSource(source) {
        if (!source) return false;
        if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) return true;
        if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) return true;
        if (typeof Image !== 'undefined' && source instanceof Image) return true;
        return typeof source.getContext === 'function';
    }

    function rotateCanvas(canvas, rotation) {
        if (rotation === 0 || !canvas) return canvas;
        if (!isDrawableSource(canvas)) return canvas;
        const w = canvas.naturalWidth || canvas.width;
        const h = canvas.naturalHeight || canvas.height;
        const newW = (rotation % 180 === 0) ? w : h;
        const newH = (rotation % 180 === 0) ? h : w;
        const temp = document.createElement('canvas');
        temp.width = newW;
        temp.height = newH;
        const ctx = temp.getContext('2d');
        ctx.translate(newW / 2, newH / 2);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.drawImage(canvas, -w / 2, -h / 2);
        return temp;
    }

    function rotateRect(rect, parentW, parentH, rotation) {
        if (rotation === 0) return { ...rect };
        if (rotation === 90) return { x: parentH - (rect.y + rect.h), y: rect.x, w: rect.h, h: rect.w };
        if (rotation === 180) return { x: parentW - (rect.x + rect.w), y: parentH - (rect.y + rect.h), w: rect.w, h: rect.h };
        if (rotation === 270) return { x: rect.y, y: parentW - (rect.x + rect.w), w: rect.h, h: rect.w };
        return { ...rect };
    }

    // --- Factory ---
    window.createReplayEngine = function(state, maskCtx, maskCanvas, render, updateUI, rebuildWorkingCopies) {
        return new ReplayEngine(state, maskCtx, maskCanvas, render, updateUI, rebuildWorkingCopies);
    };

    window.OkazuTestables = window.OkazuTestables || {};
    window.OkazuTestables.replay = {
        ActionHistoryLog,
        KeyframeManager,
        ReplayEngine,
        getUnionDims,
        cloneCanvas,
        rotateCanvas,
        rotateRect
    };

    // Global Dispatch shim is now handled in main.js via delegation,
    // but we ensure the global object exists for safety if main.js calls it early.
    window.dispatchAction = function(action) {
        // Fallback if ReplayEngine isn't hooked yet
        console.warn("Global dispatchAction called before ReplayEngine initialization");
    };

})();
