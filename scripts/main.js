        const log = (msg, type = 'error') => {
            console.log(`[${type}] ${msg}`);
            const consoleEl = document.getElementById('error-console');
            const el = document.createElement('div');
            el.className = `console-msg ${type}`;
            el.textContent = msg;
            consoleEl.appendChild(el);
            setTimeout(() => {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 200);
            }, 6000); 
        };

        let hintTimer = null;
        function showHints() {
            const legend = document.getElementById('hint-legend');
            legend.style.opacity = '1';
            if (hintTimer) clearTimeout(hintTimer);
            hintTimer = setTimeout(() => {
                legend.style.opacity = '0';
            }, 6000);
        }

        const DEFAULT_BRUSH_SIZE = 0.1;
        const DEFAULT_FEATHER = 1;
        const DEFAULT_FEATHER_SIZE = 0.015;
        const DEFAULT_REPAIR_BRUSH_SIZE = DEFAULT_BRUSH_SIZE / 2;
        const DEFAULT_PATCH_FEATHER = 10; // For Hardness mode
        const HARDNESS_MAX = 20;

        const state = {
            imgA: null, imgB: null, assetIdA: null, assetIdB: null, nameA: '', nameB: '', isAFront: true,
            opacity: 0.8, brushSize: DEFAULT_BRUSH_SIZE, feather: DEFAULT_FEATHER, featherSize: DEFAULT_FEATHER_SIZE, featherMode: false, brushMode: 'erase', isDrawing: false,
            maskVisible: true, backVisible: true, adjustmentsVisible: true, history: [], historyIndex: -1, lastActionType: null,
            isSpacePressed: false, isPanning: false, lastPanX: 0, lastPanY: 0, view: { x: 0, y: 0, scale: 1 }, lastSpaceUp: 0,
            isCtrlPressed: false, isPreviewing: false, lastPreviewTime: 0, previewMaskCanvas: null, previewMaskScale: 1, previewLoopId: null,
            isPolylineStart: false, polylinePoints: [], polylineDirty: false, polylineSessionId: 0, currentPolylineAction: null, currentPointerX: null, currentPointerY: null,
            activeStroke: null, fastPreviewLastPoint: null, pointerDownTime: 0, pointerDownCoords: null,
            rotation: 0,
            brushSettings: {
                erase: { brushSize: DEFAULT_BRUSH_SIZE, feather: DEFAULT_FEATHER, featherSize: DEFAULT_FEATHER_SIZE },
                repair: { brushSize: DEFAULT_REPAIR_BRUSH_SIZE, feather: DEFAULT_FEATHER, featherSize: DEFAULT_FEATHER_SIZE },
                patch: { brushSize: DEFAULT_REPAIR_BRUSH_SIZE, feather: DEFAULT_PATCH_FEATHER, featherSize: DEFAULT_FEATHER_SIZE }
            },
            adjustments: {
                gamma: 1.0,
                levels: { black: 0, mid: 1.0, white: 255 },
                shadows: 0, highlights: 0,
                saturation: 0, vibrance: 0,
                wb: 0,
                colorBal: { r: 0, g: 0, b: 0 },
                colorTuning: {
                    red: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    orange: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    yellow: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    green: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    aqua: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    blue: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    purple: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    magenta: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    lights: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    mids: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                    darks: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 }
                }
            },
            activeColorBand: 'red',
            isAdjusting: false, previewCanvas: null, previewFrontLayer: null, previewThrottle: 0,
            workingA: null, workingB: null, sourceA: null, sourceB: null,
            previewWorkingA: null, previewWorkingB: null, previewScaleA: 1, previewScaleB: 1,
            previewWorkingVersionA: 0, previewWorkingVersionB: 0,
            previewComposite: null,
            adjustmentsVersion: 0, workingVersionA: 0, workingVersionB: 0,
            isCropping: false, cropRect: null, cropRectSnapshot: null, fullDims: { w: 0, h: 0 }, cropDrag: null,
            fastMaskCanvas: null, fastMaskCtx: null, fastMaskScale: 1, useFastPreview: false,
            settings: { brushPreviewResolution: 1080, adjustmentPreviewResolution: 1080 },
            pendingAdjustmentCommit: false, drawerCloseTimer: null,
            activeDrawerTab: null
        };

        const els = {
            fileA: document.getElementById('fileA'), fileB: document.getElementById('fileB'),
            btnA: document.getElementById('btnA'), btnB: document.getElementById('btnB'),
            btnTrashA: document.getElementById('btnTrashA'), btnTrashB: document.getElementById('btnTrashB'),
            mainCanvas: document.getElementById('mainCanvas'), previewCanvas: document.getElementById('previewCanvas'),
            loadingOverlay: document.getElementById('loading-overlay'),
            adjDrawer: document.getElementById('drawer-adj'),
            viewport: document.getElementById('viewport'),
            canvasWrapper: document.getElementById('canvas-wrapper'), emptyState: document.getElementById('empty-state'),
            swapBtn: document.getElementById('swapBtn'), opacitySlider: document.getElementById('opacitySlider'),
            opacityVal: document.getElementById('opacityVal'), brushSize: document.getElementById('brushSize'),
            brushSizeVal: document.getElementById('brushSizeVal'), feather: document.getElementById('feather'),
            featherVal: document.getElementById('featherVal'), featherLabel: document.getElementById('featherLabel'),
            featherModeBtn: document.getElementById('featherModeBtn'), eraseMode: document.getElementById('eraseMode'),
            repairMode: document.getElementById('repairMode'), patchMode: document.getElementById('patchMode'), clearMask: document.getElementById('clearMask'),
            saveBtn: document.getElementById('saveBtn'), dragOverlay: document.getElementById('drag-overlay'),
            toggleMaskBtn: document.getElementById('toggleMaskBtn'), maskEyeOpen: document.getElementById('maskEyeOpen'), maskEyeClosed: document.getElementById('maskEyeClosed'),
            toggleBackBtn: document.getElementById('toggleBackBtn'), rearEyeOpen: document.getElementById('rearEyeOpen'), rearEyeClosed: document.getElementById('rearEyeClosed'),
            toggleAdjBtn: document.getElementById('toggleAdjBtn'), adjEyeOpen: document.getElementById('adjEyeOpen'), adjEyeClosed: document.getElementById('adjEyeClosed'),
            mergeBtn: document.getElementById('mergeBtn'), censorBtn: document.getElementById('censorBtn'),
            undoBtn: document.getElementById('undoBtn'), redoBtn: document.getElementById('redoBtn'),
            rotateBtn: document.getElementById('rotateBtn'),
            cropBtn: document.getElementById('cropBtn'), cursor: document.getElementById('brush-cursor'),
            resetAdjBtn: document.getElementById('resetAdjBtn'), resetLevelsBtn: document.getElementById('resetLevelsBtn'),
            resetColorBtn: document.getElementById('resetColorBtn'), resetSatBtn: document.getElementById('resetSatBtn'),
            adjGamma: document.getElementById('adj-gamma'), valGamma: document.getElementById('val-gamma'),
            cropOverlayDom: document.getElementById('crop-overlay-dom'), cropBox: document.getElementById('crop-box'),
            workspaceResolution: document.getElementById('workspace-resolution'),
            colorTuningDrawer: document.getElementById('drawer-tools')
        };

        const ctx = els.mainCanvas.getContext('2d');
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
        const frontLayerCanvas = document.createElement('canvas');
        const frontLayerCtx = frontLayerCanvas.getContext('2d');
        let replayEngine = null;

        function scheduleHeavyTask(taskFn) {
            if (!els.loadingOverlay) return taskFn();
            els.loadingOverlay.classList.remove('hidden');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(async () => {
                        try {
                            await taskFn();
                        } catch(e) {
                            console.error(e);
                            log("Task failed: " + e.message);
                        } finally {
                            els.loadingOverlay.classList.add('hidden');
                        }
                    }, 0);
                });
            });
        }

        function showModal(message, choices, cancellable = true) {
            return new Promise((resolve) => {
                const overlay = document.getElementById('modal-overlay');
                const msg = document.getElementById('modal-message');
                const choiceContainer = document.getElementById('modal-choices');
                const cancelContainer = document.querySelector('#modal-box > .border-t');

                // Hide legacy separate cancel container if it exists
                if (cancelContainer) cancelContainer.style.display = 'none';

                msg.textContent = message;
                choiceContainer.innerHTML = '';

                // Reset state
                overlay.classList.remove('hidden');
                // Trigger reflow for transition
                void overlay.offsetWidth;
                overlay.classList.add('visible');
                overlay.classList.remove('opacity-0');

                const cleanup = () => {
                     overlay.classList.add('opacity-0');
                     overlay.classList.remove('visible');
                     setTimeout(() => {
                         overlay.classList.add('hidden');
                     }, 200);
                };

                // Helper for button creation
                const createBtn = (text, onClick, isCancel = false) => {
                    const btn = document.createElement('button');
                    // "accent color... one dialog-spanning column... same width... smaller corner rounding"
                    // Using accent-action class which provides bg-accent-dark, border-accent, white text
                    // Adding w-full, py-2 (less padding), rounded-sm (smaller rounding)
                    // If Cancel, maybe less emphasis? The user said "they should be the accent color, as well", implying uniformity.
                    // But usually Cancel is distinct. I will make Cancel same shape/size but maybe outlined or slightly different shade
                    // to avoid dangerous confusion, OR follow strictly "they should be the accent color".
                    // Let's use accent-action for choices, and a similar but distinct style for Cancel to be safe,
                    // OR if interpreted literally: "The cancel button and option buttons... should be the accent color".
                    // I'll make them all accent-action but maybe Cancel is outlined.

                    if (isCancel) {
                         btn.className = "w-full py-2.5 px-4 bg-transparent border-accent text-accent hover:bg-[var(--accent-strong)] hover:text-[var(--accent-ink)] hover:border-accent-strong rounded-sm transition-all text-xs font-bold uppercase tracking-widest";
                    } else {
                         btn.className = "w-full py-2.5 px-4 bg-accent border-accent hover:brightness-110 hover:border-accent-strong rounded-sm transition-all text-xs font-bold uppercase tracking-widest shadow-sm";
                    }

                    btn.textContent = text;
                    btn.onclick = () => {
                        cleanup();
                        onClick();
                    };
                    return btn;
                };

                choices.forEach(choice => {
                    choiceContainer.appendChild(createBtn(choice.label, () => resolve(choice.value)));
                });

                if (cancellable) {
                    // "Cancel button and option buttons should all be in one dialog-spanning column"
                    // Appending to same container
                    choiceContainer.appendChild(createBtn("Cancel", () => resolve(null), true));
                }
            });
        }

        const settingsSystem = createSettingsSystem({ state, els, render, scheduleHeavyTask });

        if (window.createReplayEngine) {
            replayEngine = window.createReplayEngine(state, maskCtx, maskCanvas, render, updateUI, updateWorkingCopiesAfterAdjustments);
            replayEngine.setUpdateCanvasDimensionsFn(() => {
                 if (!state.cropRect) {
                     els.mainCanvas.classList.add('hidden');
                     els.emptyState.style.display = '';
                     return;
                 }
                 const isRotated = state.rotation % 180 !== 0;

                 // Fix: cropRect is Prop. Convert to pixels using fullH.
                 const fullH = state.fullDims.h || 1;
                 const baseW = state.isCropping ? state.fullDims.w : (state.cropRect.w * fullH);
                 const baseH = state.isCropping ? state.fullDims.h : (state.cropRect.h * fullH);

                 const visualW = Math.max(1, isRotated ? baseH : baseW);
                 const visualH = Math.max(1, isRotated ? baseW : baseH);

                 resizeMainCanvas(visualW, visualH);
                 els.mainCanvas.classList.remove('hidden');
                 els.emptyState.style.display = 'none';
                 els.canvasWrapper.style.width = visualW + 'px';
                 els.canvasWrapper.style.height = visualH + 'px';
            });

            // Override dispatchAction to use ReplayEngine directly
            window.dispatchAction = function(action) {
                if (replayEngine) {
                    replayEngine.logAction(action);
                }
            };
        }

        const {
            applyMasterLUT,
            applyColorOps,
            applySelectiveColor,
            updateAdjustmentPreview,
            initAdjustments,
            resetAllAdjustments,
            updateSlider,
            setSaveSnapshotHandler,
            setUpdateWorkingCopiesHandler,
            recalculateColorTuning,
            refreshColorTuningUI,
            updateAllAdjustmentUI
        } = createAdjustmentSystem({
            state,
            els,
            ctx,
            renderToContext,
            render,
            scheduleHeavyTask,
            Logger
        });

        // Helper to reset mask only (for internal ops like merge)
        function resetMaskOnly() {
             maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        }

        // Helper to reset both mask and history (for full reset)
        function resetMaskAndHistory() {
             maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
             // History reset is handled by ReplayEngine via RESET_ALL action usually,
             // but if we need manual force reset:
             if (replayEngine) {
                  // Actually, ReplayEngine history clearing is not exposed directly.
                  // But creating a new ReplayEngine or logging a RESET action is the way.
                  // For now, main logic assumes dispatchAction('RESET_ALL') handles state.
             }
        }

        const {
            canDraw,
            resetView,
            updateCursorSize,
            attachInputHandlers,
            setBrushPercent,
            setBrushPercentFromSlider,
            setFeather,
            setFeatherFromSlider,
            setFeatherMode,
            syncBrushUIToActive
        } = createInputSystem({
            state,
            els,
            maskCtx,
            maskCanvas,
            render,
            saveSnapshot: () => {}, // Legacy shim
            undo: () => replayEngine && replayEngine.undo(),
            redo: () => replayEngine && replayEngine.redo(),
            showHints,
            scheduleHeavyTask,
            acceptCrop,
            cancelCrop,
            setBrushMode: setMode
        });

        setSaveSnapshotHandler(() => {}); // Legacy shim
        setUpdateWorkingCopiesHandler(updateWorkingCopiesAfterAdjustments);

        function hasActiveAdjustments() {
            const a = state.adjustments;
            let hasTuning = false;
            for(let key in a.colorTuning) {
                const b = a.colorTuning[key];
                if (b.hue!==0 || b.saturation!==0 || b.vibrance!==0 || b.luminance!==0 || b.shadows!==0 || b.highlights!==0) {
                    hasTuning = true;
                    break;
                }
            }
            return a.gamma !== 1.0 || a.levels.black !== 0 || a.levels.mid !== 1.0 || a.levels.white !== 255 ||
                             a.saturation !== 0 || a.vibrance !== 0 || a.wb !== 0 ||
                             a.colorBal.r !== 0 || a.colorBal.g !== 0 || a.colorBal.b !== 0 ||
                             a.shadows !== 0 || a.highlights !== 0 || hasTuning;
        }

        function markAdjustmentsDirty() {
            state.adjustmentsVersion += 1;
        }

        function cloneToCanvas(img) {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const c = canvas.getContext('2d');
            c.drawImage(img, 0, 0);
            return canvas;
        }

        function rotateCanvas(canvas, rotation) {
            if (rotation === 0 || !canvas) return canvas;
            const w = canvas.width;
            const h = canvas.height;
            // For 90 and 270 degrees, dimensions are swapped
            const newW = (rotation % 180 === 0) ? w : h;
            const newH = (rotation % 180 === 0) ? h : w;

            const temp = document.createElement('canvas');
            temp.width = newW;
            temp.height = newH;
            const ctx = temp.getContext('2d');

            // Transform context to rotate the drawing
            // Translate to center of new canvas
            ctx.translate(newW / 2, newH / 2);
            // Apply rotation (convert to radians)
            ctx.rotate(rotation * Math.PI / 180);
            // Draw original image centered
            ctx.drawImage(canvas, -w / 2, -h / 2);

            return temp;
        }

        function rotateRect(rect, parentW, parentH, rotation) {
            if (rotation === 0) return { ...rect };

            // 90 Deg CW: (x, y) -> (h - y, x) relative to origin?
            // Actually let's use the explicit mapping derived:
            // Top-Left (x, y) becomes Top-Right relative to new dims?
            // Let's trace corners.
            // 90 Deg CW:
            // Width -> Height, Height -> Width
            // (0,0) -> (H, 0)
            // (W,0) -> (H, W)
            // (0,H) -> (0, 0)
            // (W,H) -> (0, W)
            // Wait, this is CCW?
            // CW 90:
            //  A B  ->  C A
            //  C D      D B
            // A(0,0) -> (H, 0)? No. New grid is H x W.
            // A is at Top-Right (Effective).
            // Let's rely on standard rotation formula about center, then shift origin?
            // Or simpler:
            // 90 CW: newX = parentH - (rect.y + rect.h)
            //        newY = rect.x
            //        newW = rect.h
            //        newH = rect.w

            if (rotation === 90) {
                return {
                    x: parentH - (rect.y + rect.h),
                    y: rect.x,
                    w: rect.h,
                    h: rect.w
                };
            }
            if (rotation === 180) {
                return {
                    x: parentW - (rect.x + rect.w),
                    y: parentH - (rect.y + rect.h),
                    w: rect.w,
                    h: rect.h
                };
            }
            if (rotation === 270) {
                return {
                    x: rect.y,
                    y: parentW - (rect.x + rect.w),
                    w: rect.h,
                    h: rect.w
                };
            }
            return { ...rect };
        }

        function bakeRotation() {
            if (state.rotation === 0) return;
            const rot = state.rotation;

            Logger.info(`Baking rotation: ${rot} degrees`);

            // Rotate Source/Img Layers
            if (state.imgA) {
                state.imgA = rotateCanvas(state.imgA, rot);
                state.sourceA = state.imgA; // Assuming source is same as imgA for baking
            }
            if (state.imgB) {
                state.imgB = rotateCanvas(state.imgB, rot);
                state.sourceB = state.imgB;
            }

            // Rotate Mask
            // Mask is a global canvas, we must update it in place
            if (maskCanvas) {
                const rotatedMask = rotateCanvas(maskCanvas, rot);
                maskCanvas.width = rotatedMask.width;
                maskCanvas.height = rotatedMask.height;
                maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                maskCtx.drawImage(rotatedMask, 0, 0);
            }

            // Update Full Dims
            const oldFullW = state.fullDims.w;
            const oldFullH = state.fullDims.h;
            if (rot % 180 !== 0) {
                state.fullDims = { w: oldFullH, h: oldFullW };
            }

            // Update Crop Rect
            if (state.cropRect) {
                state.cropRect = rotateRect(state.cropRect, oldFullW, oldFullH, rot);
            } else {
                // If no crop rect, set to new full dims
                state.cropRect = { x: 0, y: 0, w: state.fullDims.w, h: state.fullDims.h };
            }

            // Update FrontLayerCanvas (buffer) dimensions
            if (frontLayerCanvas) {
                frontLayerCanvas.width = state.fullDims.w;
                frontLayerCanvas.height = state.fullDims.h;
            }

            // Reset Rotation
            state.rotation = 0;

            // Rebuild workings
            rebuildWorkingCopies(true);

            // Reset Mask History & State (History coordinates are now invalid)
            // But we want to preserve the mask content we just rotated.
            // resetMaskAndHistory() clears the mask! We must avoid that.
            // We just need to clear history stack because Undo actions (coordinates) are invalid.
            state.history = [];
            state.historyIndex = -1;
            // Or better: We accept that baking clears history.
            // But we MUST NOT clear the maskCanvas we just rotated.
            // resetMaskAndHistory calls maskCtx.clearRect.
            // So we manually reset history and update UI.
            updateUI();
        }

        function rotateView() {
            scheduleHeavyTask(() => {
                state.rotation = (state.rotation + 90) % 360;
                updateCanvasDimensions(true); // Preserve crop
                resetView(); // Force fit to screen
                render();
                // saveSnapshot('rotate_view');
                if (window.dispatchAction) dispatchAction({ type: 'ROTATE_VIEW', payload: {} });
            });
        }

        function setLayerSource(slot, img) {
            const base = cloneToCanvas(img);
            if (slot === 'A') {
                state.imgA = base;
                state.sourceA = base;
                state.workingVersionA = 0;
                state.previewWorkingVersionA = 0;
            } else {
                state.imgB = base;
                state.sourceB = base;
                state.workingVersionB = 0;
                state.previewWorkingVersionB = 0;
            }
        }

        function rebuildPreviewLayerForSlot(slot, allowFullResWork = true) {
            if (!allowFullResWork) return;
            if (state.settings.brushPreviewResolution === 'Full') return; // Skip preview buffer if Full

            const working = slot === 'A' ? state.workingA : state.workingB;
            if (!working) {
                if (slot === 'A') { state.previewWorkingA = null; state.previewWorkingVersionA = 0; state.previewScaleA = 1; }
                else { state.previewWorkingB = null; state.previewWorkingVersionB = 0; state.previewScaleB = 1; }
                return;
            }

            const targetH = state.settings.brushPreviewResolution || 1080;
            const scale = Math.min(1, targetH / working.height);
            const pw = Math.max(1, Math.round(working.width * scale));
            const ph = Math.max(1, Math.round(working.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = pw;
            canvas.height = ph;
            canvas.getContext('2d').drawImage(working, 0, 0, pw, ph);

            if (slot === 'A') {
                state.previewWorkingA = canvas;
                state.previewScaleA = scale;
                state.previewWorkingVersionA = state.adjustmentsVersion;
            } else {
                state.previewWorkingB = canvas;
                state.previewScaleB = scale;
                state.previewWorkingVersionB = state.adjustmentsVersion;
            }
        }

        function getLayerForRender(slot, { useBakedLayers = true, preferPreview = false, allowRebuild = true } = {}) {
            const source = slot === 'A' ? state.imgA : state.imgB;
            if (!source) return { img: null, scale: 1 };
            if (!useBakedLayers) return { img: source, scale: 1 };

            // If adjustments are hidden, bypass working copies and return raw source
            if (!state.adjustmentsVisible) return { img: source, scale: 1 };

            const working = slot === 'A' ? state.workingA : state.workingB;
            const workingVersion = slot === 'A' ? state.workingVersionA : state.workingVersionB;
            if (allowRebuild && (!working || workingVersion !== state.adjustmentsVersion)) {
                rebuildWorkingCopyForSlot(slot);
            }

            const previewVersion = slot === 'A' ? state.previewWorkingVersionA : state.previewWorkingVersionB;
            const previewLayer = slot === 'A' ? state.previewWorkingA : state.previewWorkingB;
            const previewScale = slot === 'A' ? state.previewScaleA : state.previewScaleB;

            if (preferPreview && working && previewVersion !== state.adjustmentsVersion) {
                rebuildPreviewLayerForSlot(slot, allowRebuild);
            }

            if (preferPreview && working && previewLayer && (previewVersion === state.adjustmentsVersion || !allowRebuild)) {
                return { img: previewLayer, scale: previewScale };
            }

            return {
                img: slot === 'A' ? state.workingA || source : state.workingB || source,
                scale: 1
            };
        }

        function isUserInteracting() {
            return state.isDrawing || state.isAdjusting || state.isPanning || state.isPolylineStart || !!state.cropDrag;
        }

        function rebuildWorkingCopyForSlot(slot) {
            const source = slot === 'A' ? state.sourceA : state.sourceB;
            if (!source) {
                if (slot === 'A') { state.workingA = null; state.workingVersionA = 0; }
                else { state.workingB = null; state.workingVersionB = 0; }
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const layerCtx = canvas.getContext('2d');
            layerCtx.drawImage(source, 0, 0);

            if (hasActiveAdjustments()) {
                const imgData = layerCtx.getImageData(0, 0, canvas.width, canvas.height);
                applyMasterLUT(imgData);
                applyColorOps(imgData);
                applySelectiveColor(imgData);
                layerCtx.putImageData(imgData, 0, 0);
            }

            if (slot === 'A') { state.workingA = canvas; state.workingVersionA = state.adjustmentsVersion; }
            else { state.workingB = canvas; state.workingVersionB = state.adjustmentsVersion; }

            rebuildPreviewLayerForSlot(slot);
        }

        function rebuildWorkingCopies(forceVersionBump = false) {
            if (forceVersionBump) markAdjustmentsDirty();
            rebuildWorkingCopyForSlot('A');
            rebuildWorkingCopyForSlot('B');
        }

        function updateWorkingCopiesAfterAdjustments() {
            markAdjustmentsDirty();
            rebuildWorkingCopies();
        }

        async function loadLayerWithSmartSlotting(source, name) {
             bakeRotation();
             log(`Loading ${name}...`, "info");
             try {
                 const img = await loadImageSource(source);

                 // 0 loaded -> Slot A (Front)
                 if (!state.imgA && !state.imgB) {
                     assignLayer(img, 'A', name);
                     return;
                 }

                 // If Both Occupied -> Ask User
                 if (state.imgA && state.imgB) {
                     const choice = await showModal(
                         "Both slots are already occupied. Where would you like to load the image?",
                         [
                             { label: "Load to Front", value: 'A' },
                             { label: "Load to Back", value: 'B' }
                         ],
                         true
                     );

                     if (!choice) {
                         log("Load cancelled", "info");
                         return;
                     }

                     assignLayer(img, choice, name);
                     return;
                 }

                 // 1 Loaded
                 // If A is loaded, we want New to be A. So move A to B, then New to A.
                 if (state.imgA) {
                     // Swap A to B
                     state.imgB = state.imgA; state.sourceB = state.sourceA; state.nameB = state.nameA;
                     state.workingB = state.workingA; state.workingVersionB = state.workingVersionA;
                     // Clear A state before assigning new
                     state.imgA = null; state.sourceA = null; state.workingA = null; state.nameA = "";

                     // Update buttons for the move
                     updateLoadButton(els.btnB, truncate(state.nameB), "back");
                     els.btnB.classList.add('border-accent-strong', 'text-accent');
                     updateLoadButton(els.btnA, "Load", "front"); // Temp clear visual
                     els.btnA.classList.remove('border-accent-strong', 'text-accent');

                     // Now Load New into A
                     assignLayer(img, 'A', name);
                 } else {
                     // B is loaded. A is empty. Load into A.
                     assignLayer(img, 'A', name);
                 }
             } catch(e) {
                 log("Failed to load image: " + e.message);
                 Logger.error("Smart load failed", e);
             }
        }

        function setupDragAndDrop() {
            const body = document.body;
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => body.addEventListener(eventName, preventDefaults, false));
            function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
            body.addEventListener('dragenter', () => body.classList.add('dragging'));
            body.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) body.classList.remove('dragging'); });
            body.addEventListener('drop', (e) => {
                body.classList.remove('dragging');

                // Check for URI list first (fallback for browsers/apps that drag URLs as files/text)
                const uriList = e.dataTransfer.getData('text/uri-list');
                const text = e.dataTransfer.getData('text/plain');

                const processUrl = async (url) => {
                    try {
                        const blob = await fetchImage(url);
                        loadLayerWithSmartSlotting(blob, "Dropped Image");
                    } catch(err) {
                        Logger.error("Failed to load dropped URL", err);
                    }
                };

                const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));

                if (files.length > 0) {
                    if (files.length === 1) {
                        loadLayerWithSmartSlotting(files[0], files[0].name);
                    } else if (files.length >= 2) {
                        // Standard load 2
                        handleFileLoad(files[0], 'A');
                        handleFileLoad(files[1], 'B');
                    }
                } else if (uriList) {
                    const lines = uriList.split(/\r?\n/);
                    if(lines[0] && !lines[0].startsWith('#')) processUrl(lines[0]);
                } else if (text && (text.startsWith('http') || text.startsWith('file'))) {
                    processUrl(text);
                }
            });
        }

        function commitAdjustments() {
             if (!state.pendingAdjustmentCommit) return;
             scheduleHeavyTask(() => {
                 updateWorkingCopiesAfterAdjustments();
                 render();
                 state.pendingAdjustmentCommit = false;
             });
        }

        function updateLoadButton(btn, text, label) {
             btn.innerHTML = '';

             // Filename Wrapper (Truncated)
             const textSpan = document.createElement('span');
             textSpan.className = "w-full overflow-hidden text-ellipsis whitespace-nowrap block relative z-10";
             textSpan.textContent = text;
             btn.appendChild(textSpan);

             // Label (Hanging out)
             const span = document.createElement('span');
             span.className = "absolute bottom-[-11px] left-0 right-0 text-center text-[8px] text-gray-600 font-normal leading-none pointer-events-none";
             span.textContent = label;
             btn.appendChild(span);

             btn.style.overflow = 'visible';
        }

        function clearLayer(slot) {
             if (slot === 'A') {
                 state.imgA = null; state.sourceA = null; state.workingA = null;
                 state.assetIdA = null;
                 state.nameA = "";
                 updateLoadButton(els.btnA, "Load", "front");
                 els.btnA.classList.remove('border-accent-strong', 'text-accent');
             } else {
                 state.imgB = null; state.sourceB = null; state.workingB = null;
                 state.assetIdB = null;
                 state.nameB = "";
                 updateLoadButton(els.btnB, "Load", "back");
                 els.btnB.classList.remove('border-accent-strong', 'text-accent');
             }

             if (!state.imgA && !state.imgB) {
                 // Full Reset
                 resetAllAdjustments();
                 // saveSnapshot('clear_all');
                 resetView();
                 els.mainCanvas.classList.add('hidden');
                 els.emptyState.style.display = '';
                 els.viewport.classList.add('disabled');
                 state.cropRect = null;
                 updateUI();
             } else {
                 // One remains
                 markAdjustmentsDirty();
                 rebuildWorkingCopies();
                 updateCanvasDimensions(true); // Preserve view
                 render();
                 updateUI();
             }

             if (window.dispatchAction) dispatchAction({ type: 'CLEAR_LAYER', payload: { slot } });
        }

        function syncDrawerHeights() {
             const inners = document.querySelectorAll('.drawer-inner');
             let maxH = 0;
             inners.forEach(el => {
                 maxH = Math.max(maxH, el.offsetHeight);
             });

             // Add 2px for borders to prevent unnecessary scrollbars
             const finalH = maxH + 2;

             const outers = document.querySelectorAll('.drawer-content');
             outers.forEach(el => {
                 if (maxH > 0) el.style.height = finalH + 'px';
             });
        }

        function initDrawerSync() {
            const inners = document.querySelectorAll('.drawer-inner');
            const ro = new ResizeObserver(() => {
                requestAnimationFrame(syncDrawerHeights);
            });
            inners.forEach(el => ro.observe(el));
            window.addEventListener('resize', () => requestAnimationFrame(syncDrawerHeights));

            // Initial sync
            setTimeout(syncDrawerHeights, 100);
        }

        function init() {
            Logger.info("OkazuStudio Initializing...");
            Logger.info(`System Info: User Agent: ${navigator.userAgent}`);
            Logger.info(`System Info: Platform: ${navigator.platform} | Language: ${navigator.language}`);
            Logger.info(`System Info: Screen: ${window.screen.width}x${window.screen.height} @ ${window.devicePixelRatio}x`);
            Logger.info(`System Info: Viewport: ${window.innerWidth}x${window.innerHeight} | Touch: ${'ontouchstart' in window ? 'yes' : 'no'} | Cores: ${navigator.hardwareConcurrency || 'n/a'} | Memory: ${navigator.deviceMemory || 'n/a'}GB`);

            // Ensure previewFrontLayer is initialized
            if (!state.previewFrontLayer) {
                state.previewFrontLayer = document.createElement('canvas');
            }

            initAdjustments();
            initDrawerSync();

            // Drawer Logging
            if (els.adjDrawer) els.adjDrawer.addEventListener('mouseenter', () => Logger.info("Drawer Opened: Adjustments"));
            if (els.adjDrawer) els.adjDrawer.addEventListener('mouseleave', () => Logger.info("Drawer Closed: Adjustments"));
            if (els.colorTuningDrawer) els.colorTuningDrawer.addEventListener('mouseenter', () => Logger.info("Drawer Opened: Color Tuning"));
            if (els.colorTuningDrawer) els.colorTuningDrawer.addEventListener('mouseleave', () => Logger.info("Drawer Closed: Color Tuning"));

            // Check if drawer is being hovered to commit changes on exit
            setInterval(() => {
                const isHoveringAdj = els.adjDrawer && els.adjDrawer.matches(':hover');
                const isHoveringTools = els.colorTuningDrawer && els.colorTuningDrawer.matches(':hover');
                const isHovering = isHoveringAdj || isHoveringTools;

                if (state.pendingAdjustmentCommit && !isHovering) {
                    if (!state.drawerCloseTimer) {
                         state.drawerCloseTimer = setTimeout(() => {
                             const stillHovering = (els.adjDrawer && els.adjDrawer.matches(':hover')) ||
                                                   (els.colorTuningDrawer && els.colorTuningDrawer.matches(':hover'));
                             if (state.pendingAdjustmentCommit && !stillHovering) {
                                 Logger.info("Drawer closed, committing adjustments.");
                                 commitAdjustments();
                             }
                             state.drawerCloseTimer = null;
                         }, 350);
                    }
                }
            }, 200);

            els.fileA.addEventListener('change', (e) => {
                Logger.interaction("File Input A", "selected file");
                handleFileLoad(e.target.files[0], 'A');
            });
            els.fileB.addEventListener('change', (e) => {
                Logger.interaction("File Input B", "selected file");
                handleFileLoad(e.target.files[0], 'B');
            });

            els.btnTrashA.addEventListener('click', () => clearLayer('A'));
            els.btnTrashB.addEventListener('click', () => clearLayer('B'));

            // Paste Handler
            window.addEventListener('paste', handlePaste);

            setupDragAndDrop();

            els.swapBtn.addEventListener('click', () => {
                Logger.interaction("Swap Button", "clicked");

                const preFront = state.isAFront ? state.imgA : state.imgB;
                const preBack = state.isAFront ? state.imgB : state.imgA;
                Logger.info(`[Swap] Pre-Swap Resolution - Front: ${preFront ? preFront.width + 'x' + preFront.height : 'None'}, Back: ${preBack ? preBack.width + 'x' + preBack.height : 'None'}`);

                // Determine Auto-Zoom Condition
                let shouldAutoZoom = false;
                if (preFront && preBack) {
                    const vpW = els.viewport.clientWidth;
                    const vpH = els.viewport.clientHeight;
                    const cW = els.mainCanvas.width;
                    const cH = els.mainCanvas.height;
                    const fitScale = Math.min((vpW - 40) / cW, (vpH - 40) / cH);

                    const isZoomedOut = state.view.scale <= (fitScale + 0.001);
                    const dimsChanged = (preFront.width !== preBack.width) || (preFront.height !== preBack.height);

                    if (isZoomedOut && dimsChanged) {
                        shouldAutoZoom = true;
                    }
                }

                [state.imgA, state.imgB] = [state.imgB, state.imgA];
                [state.sourceA, state.sourceB] = [state.sourceB, state.sourceA];
                [state.assetIdA, state.assetIdB] = [state.assetIdB, state.assetIdA];
                [state.workingA, state.workingB] = [state.workingB, state.workingA];
                [state.workingVersionA, state.workingVersionB] = [state.workingVersionB, state.workingVersionA];
                [state.previewWorkingA, state.previewWorkingB] = [state.previewWorkingB, state.previewWorkingA];
                [state.previewWorkingVersionA, state.previewWorkingVersionB] = [state.previewWorkingVersionB, state.previewWorkingVersionA];
                [state.previewScaleA, state.previewScaleB] = [state.previewScaleB, state.previewScaleA];
                [state.nameA, state.nameB] = [state.nameB, state.nameA];
                updateLoadButton(els.btnA, truncate(state.nameA || "Load"), "front");
                updateLoadButton(els.btnB, truncate(state.nameB || "Load"), "back");
                if(state.imgA) els.btnA.classList.add('border-accent-strong', 'text-accent');
                else els.btnA.classList.remove('border-accent-strong', 'text-accent');
                if(state.imgB) els.btnB.classList.add('border-accent-strong', 'text-accent');
                else els.btnB.classList.remove('border-accent-strong', 'text-accent');
                markAdjustmentsDirty();
                rebuildWorkingCopies();

                // Recalculate crop for new front image
                if (state.imgA) {
                    const aspect = state.imgA.width / state.imgA.height;
                    state.cropRect = { x: 0, y: 0, w: aspect, h: 1.0 };
                }

                // Update dimensions but PRESERVE history so we can replay the mask strokes
                updateCanvasDimensions(false, true);

                // Replay history to redraw mask at new scale
                if (replayEngine) {
                    replayEngine.replayTo(window.ActionHistory.cursor);
                }

                updateUI();
                render();
                if (window.dispatchAction) dispatchAction({ type: 'SWAP_LAYERS', payload: {} });

                const postFront = state.isAFront ? state.imgA : state.imgB;
                const postBack = state.isAFront ? state.imgB : state.imgA;
                Logger.info(`[Swap] Post-Swap Resolution - Front: ${postFront ? postFront.width + 'x' + postFront.height : 'None'}, Back: ${postBack ? postBack.width + 'x' + postBack.height : 'None'}`);

                if (shouldAutoZoom) {
                    resetView();
                }
            });

            let opacityRenderTimer = null;
            let lastOpacityRender = 0;
            let isOpacityDragging = false;
            const scheduleOpacityRender = (force = false) => {
                if (force) {
                    if (opacityRenderTimer) {
                        clearTimeout(opacityRenderTimer);
                        opacityRenderTimer = null;
                    }
                    lastOpacityRender = performance.now();
                    render();
                    return;
                }
                const now = performance.now();
                const elapsed = now - lastOpacityRender;
                if (elapsed >= 50) {
                    lastOpacityRender = now;
                    render();
                    return;
                }
                if (opacityRenderTimer) {
                    return;
                }
                opacityRenderTimer = setTimeout(() => {
                    opacityRenderTimer = null;
                    lastOpacityRender = performance.now();
                    render();
                }, 50 - elapsed);
            };

            els.opacitySlider.addEventListener('input', (e) => {
                state.opacity = e.target.value / 100;
                els.opacityVal.textContent = Math.round(state.opacity * 100) + '%';
                scheduleOpacityRender();
            });
            const finalizeOpacityRender = () => {
                if (!isOpacityDragging) return;
                isOpacityDragging = false;
                scheduleOpacityRender(true);
                if (window.dispatchAction) dispatchAction({ type: 'SET_OPACITY', payload: { value: state.opacity } });
            };
            els.opacitySlider.addEventListener('pointerdown', () => {
                isOpacityDragging = true;
            });
            els.opacitySlider.addEventListener('pointerup', finalizeOpacityRender);
            els.opacitySlider.addEventListener('pointercancel', finalizeOpacityRender);
            els.opacitySlider.addEventListener('touchend', finalizeOpacityRender);
            els.opacitySlider.addEventListener('change', () => scheduleOpacityRender(true));
            els.brushSize.addEventListener('input', (e) => {
                setBrushPercentFromSlider(e.target.value);
            });
            els.feather.addEventListener('input', (e) => {
                setFeatherFromSlider(e.target.value);
            });
            els.featherModeBtn.addEventListener('click', () => {
                setFeatherMode(!state.featherMode);
            });
            els.eraseMode.addEventListener('click', () => setMode('erase'));
            els.repairMode.addEventListener('click', () => setMode('repair'));
            els.patchMode.addEventListener('click', () => setMode('patch'));
            
            els.clearMask.addEventListener('click', () => {
                maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                state.maskVisible = true;
                state.backVisible = true;
                state.adjustmentsVisible = true;
                resetAllAdjustments();
                // saveSnapshot('full_reset');
                resetView(); 
                updateVisibilityToggles();
                render();
                log("Reset All", "info");
                if (window.dispatchAction) dispatchAction({ type: 'RESET_ALL', payload: {} });
            });

            els.saveBtn.addEventListener('click', saveImage);
            els.mergeBtn.addEventListener('click', mergeDown);
            els.censorBtn.addEventListener('click', applyCensor);

            els.undoBtn.addEventListener('click', () => {
                if (state.isCropping) return;
                // Double check root policy
                const h = window.ActionHistory;
                let min = -1;
                const log = h ? h.getLog() : [];
                for (let i = 0; i < log.length; i++) {
                    if (log[i].type === 'LOAD_IMAGE') min = i;
                    else break;
                }
                if (h && h.cursor <= min) return;

                if (replayEngine) replayEngine.undo();
            });

            els.redoBtn.addEventListener('click', () => {
                if (state.isCropping) return;
                if (replayEngine) replayEngine.redo();
            });
            
            els.cropBtn.addEventListener('click', toggleCropMode);
            els.rotateBtn.addEventListener('click', rotateView);

            els.toggleMaskBtn.addEventListener('click', () => {
                state.maskVisible = !state.maskVisible;
                Logger.interaction("Toggle Mask Visibility", state.maskVisible ? "Show" : "Hide");
                updateVisibilityToggles();
                render();
                if (window.dispatchAction) dispatchAction({ type: 'TOGGLE_MASK', payload: { visible: state.maskVisible } });
            });
            els.toggleBackBtn.addEventListener('click', () => {
                state.backVisible = !state.backVisible;
                Logger.interaction("Toggle Back Visibility", state.backVisible ? "Show" : "Hide");
                updateVisibilityToggles();
                render();
                if (window.dispatchAction) dispatchAction({ type: 'TOGGLE_BACK', payload: { visible: state.backVisible } });
            });
            els.toggleAdjBtn.addEventListener('click', () => {
                state.adjustmentsVisible = !state.adjustmentsVisible;
                Logger.interaction("Toggle Adjustments Visibility", state.adjustmentsVisible ? "Show" : "Hide");
                updateVisibilityToggles();
                render();
                if (window.dispatchAction) dispatchAction({ type: 'TOGGLE_ADJUSTMENTS', payload: { visible: state.adjustmentsVisible } });
            });

            attachInputHandlers();

            setBrushPercent(state.brushSize);
            setFeatherMode(state.featherMode);
            setFeather(state.feather);

            log("Ready. Load images to begin.", "info");
            showHints();
            updateWorkspaceLabel();
            updateVisibilityToggles();
            updateUI();
        }

        function updateWorkspaceLabel() {
            if (!els.workspaceResolution) return;
            if (!canDraw()) {
                els.workspaceResolution.style.display = 'none';
                return;
            }

            els.workspaceResolution.textContent = `${els.mainCanvas.width}×${els.mainCanvas.height}`;
            els.workspaceResolution.style.display = '';
        }

        // --- Core Rendering & Helper ---
        function renderToContext(targetCtx, w, h, forceOpacity = false, useBakedLayers = true, preferPreview = false, allowRebuild = true) {
            targetCtx.clearRect(0, 0, w, h);
            if (!state.cropRect && !state.isCropping) return;

            // Enforce adjustments visibility for nested renders
            const effectiveBaked = useBakedLayers && state.adjustmentsVisible;

            const frontLayer = state.isAFront ? getLayerForRender('A', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild }) : getLayerForRender('B', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild });
            const backLayer = state.isAFront ? getLayerForRender('B', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild }) : getLayerForRender('A', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild });
            const frontImg = frontLayer.img;
            const backImg = backLayer.img;

            // Adjust draw args for crop logic
            // cropRect is now Proportional. Convert to Pixels relative to state.fullDims.h (Truth Height)
            // But wait, fullDims tracks source image dims.
            // If cropping (state.isCropping), we draw full source (sX=0, sY=0, sW=fullW, sH=fullH).
            // If not cropping (state.cropRect valid), we draw cropped region.

            const fullH = state.fullDims.h || 1;
            const fullW = state.fullDims.w || 1;

            const sX = state.isCropping ? 0 : (state.cropRect.x * fullH);
            const sY = state.isCropping ? 0 : (state.cropRect.y * fullH);
            const sW = state.isCropping ? fullW : (state.cropRect.w * fullH);
            const sH = state.isCropping ? fullH : (state.cropRect.h * fullH);

            const isRotated = state.rotation % 180 !== 0;
            // Determine effective draw dimensions (Truth space)
            const drawW = isRotated ? h : w;
            const drawH = isRotated ? w : h;

            targetCtx.save();
            applyRotation(targetCtx, w, h, state.rotation);

            // Draw Back
            if (backImg && state.backVisible) {
                targetCtx.globalAlpha = 1.0;
                targetCtx.globalCompositeOperation = 'source-over';

                const scale = state.fullDims.h / backImg.height;
                const backW = backImg.width * scale;
                const backH = state.fullDims.h;
                const backX = (state.fullDims.w - backW) / 2;

                const bSrcX = (sX - backX) / scale;
                const bSrcY = sY / scale;
                const bSrcW = sW / scale;
                const bSrcH = sH / scale;

                targetCtx.drawImage(backImg, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, drawW, drawH);
            }

            // Draw Front
            if (frontImg) {
                const fCtx = state.previewFrontLayer.getContext('2d');

                // Safety check for invalid dimensions before resize/draw
                if (drawW > 0 && drawH > 0) {
                    if (state.previewFrontLayer.width !== drawW || state.previewFrontLayer.height !== drawH) {
                        state.previewFrontLayer.width = drawW;
                        state.previewFrontLayer.height = drawH;
                    }

                    fCtx.clearRect(0, 0, drawW, drawH);

                    fCtx.globalCompositeOperation = 'source-over';
                    const frontScale = frontLayer.scale || 1;
                    fCtx.drawImage(frontImg, sX * frontScale, sY * frontScale, sW * frontScale, sH * frontScale, 0, 0, drawW, drawH);

                    if (state.maskVisible) {
                        fCtx.globalCompositeOperation = 'destination-out';
                        const maskScale = state.isPreviewing && state.previewMaskCanvas ? (state.previewMaskScale || state.fastMaskScale || 1) : 1;
                        const maskSource = state.isPreviewing && state.previewMaskCanvas ? state.previewMaskCanvas : maskCanvas;

                        // Guard against drawing 0-size mask source
                        if (maskSource.width > 0 && maskSource.height > 0) {
                            fCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, drawW, drawH);
                        }
                    }

                    targetCtx.globalCompositeOperation = 'source-over';
                    // Use forceOpacity for adjustments preview (so we see true pixels)
                    // Also force opacity if only one layer is present
                    const singleLayer = !state.imgA || !state.imgB;
                    const effectiveOpacity = (singleLayer || !state.backVisible || forceOpacity) ? 1.0 : state.opacity;
                    targetCtx.globalAlpha = effectiveOpacity;
                    targetCtx.drawImage(state.previewFrontLayer, 0, 0);
                }
            }
            targetCtx.restore();
        }
        
        function render(finalOutput = false, skipAdjustments = false) {
            if (state.isAdjusting && !finalOutput) {
                 if (Date.now() - state.previewThrottle > 500) state.isAdjusting = false;
                 else return;
            }

            if (!state.cropRect && !state.isCropping) return;

            // Dimensions logic
            // Visual Dims (rotated) are set on els.mainCanvas by updateCanvasDimensions or resizeMainCanvas calls
            // Truth Dims are in sX, sY, sW, sH
            const isRotated = state.rotation % 180 !== 0;
            const cw = els.mainCanvas.width;
            const ch = els.mainCanvas.height;

            // When rotating, visual dims are swapped vs Truth dims.
            // sW/sH are truth dims.
            // renderToContext below (via inline logic here) needs to handle rotation.

            const useBakedLayers = !skipAdjustments;
            // Determine if 'Full' mode applies to the current interaction
            const isAdjusting = state.isAdjusting;
            const resSetting = isAdjusting ? state.settings.adjustmentPreviewResolution : state.settings.brushPreviewResolution;
            const preferPreview = state.useFastPreview && !finalOutput && resSetting !== 'Full';

            const allowRebuild = !isUserInteracting();

            // If cropping, draw full source image, then overlay
            // When !isCropping, the main canvas is sized to cropRect, so sX/Y is just cropRect.x/y

            const fullH = state.fullDims.h || 1;
            const fullW = state.fullDims.w || 1;

            const sX = state.isCropping ? 0 : (state.cropRect.x * fullH);
            const sY = state.isCropping ? 0 : (state.cropRect.y * fullH);
            const sW = state.isCropping ? fullW : (state.cropRect.w * fullH);
            const sH = state.isCropping ? fullH : (state.cropRect.h * fullH);

            // Effective Draw Dimensions (Truth Space)
            const drawW = isRotated ? ch : cw;
            const drawH = isRotated ? cw : ch;

            const frontLayer = state.isAFront ? getLayerForRender('A', { useBakedLayers, preferPreview, allowRebuild }) : getLayerForRender('B', { useBakedLayers, preferPreview, allowRebuild });
            const backLayer = state.isAFront ? getLayerForRender('B', { useBakedLayers, preferPreview, allowRebuild }) : getLayerForRender('A', { useBakedLayers, preferPreview, allowRebuild });
            const frontImg = frontLayer.img;
            const backImg = backLayer.img;
            const maskScale = state.isPreviewing && state.previewMaskCanvas ? (state.previewMaskScale || state.fastMaskScale || 1) : 1;

            const shouldUseDownscaledComposite = preferPreview && (frontImg || backImg);

            if (shouldUseDownscaledComposite) {
                els.mainCanvas.style.visibility = 'hidden';
                els.previewCanvas.classList.remove('hidden');

                const targetH = state.settings.brushPreviewResolution === 'Full' ? 100000 : (state.settings.brushPreviewResolution || 1080);
                // Calculate scale based on Truth dimensions, but targetH is a visual constraint usually?
                // Let's assume targetH is max dimension constraint.
                let fastScale = Math.min(1, targetH / sH);
                if (state.isPreviewing && state.previewMaskCanvas) fastScale = maskScale;

                // Visual sizes for preview
                // If rotated: sW/sH swapped visually.
                const visualSW = isRotated ? sH : sW;
                const visualSH = isRotated ? sW : sH;
                const pw = Math.max(1, Math.round(visualSW * fastScale));
                const ph = Math.max(1, Math.round(visualSH * fastScale));
                
                const pCtx = els.previewCanvas.getContext('2d');
                if (els.previewCanvas.width !== pw || els.previewCanvas.height !== ph) {
                    els.previewCanvas.width = pw;
                    els.previewCanvas.height = ph;
                }
                pCtx.clearRect(0, 0, pw, ph);

                // Effective Draw (Truth) dimensions for the scaled buffer
                // If rotated, pw/ph are swapped relative to truth.
                const pDrawW = isRotated ? ph : pw;
                const pDrawH = isRotated ? pw : ph;

                pCtx.save();
                applyRotation(pCtx, pw, ph, state.rotation);

                // Modified export logic: Only render back if state.backVisible is true
                const shouldRenderBack = backImg && state.backVisible;
                if (shouldRenderBack) {
                    pCtx.globalAlpha = 1.0;
                    pCtx.globalCompositeOperation = 'source-over';

                    const scale = state.fullDims.h / backImg.height;
                    const backW = backImg.width * scale;
                    const backH = state.fullDims.h;
                    const backX = (state.fullDims.w - backW) / 2;

                    const bSrcX = (sX - backX) / scale;
                    const bSrcY = sY / scale;
                    const bSrcW = sW / scale;
                    const bSrcH = sH / scale;

                    pCtx.drawImage(backImg, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, pDrawW, pDrawH);
                }

                if (frontImg) {
                    if (frontLayerCanvas.width !== pDrawW || frontLayerCanvas.height !== pDrawH) {
                        frontLayerCanvas.width = pDrawW;
                        frontLayerCanvas.height = pDrawH;
                    }
                    frontLayerCtx.clearRect(0, 0, pDrawW, pDrawH);
                    frontLayerCtx.globalCompositeOperation = 'source-over';
                    const frontScale = frontLayer.scale || 1;
                    frontLayerCtx.drawImage(frontImg, sX * frontScale, sY * frontScale, sW * frontScale, sH * frontScale, 0, 0, pDrawW, pDrawH);

                    let maskSource = maskCanvas;
                    if (state.isPreviewing && state.previewMaskCanvas) {
                        maskSource = state.previewMaskCanvas;
                    }

                    if (state.maskVisible) {
                        frontLayerCtx.globalCompositeOperation = 'destination-out';
                        frontLayerCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, pDrawW, pDrawH);
                    }

                    frontLayerCtx.globalCompositeOperation = 'source-over';
                    // Force opacity if only one layer
                    const singleLayer = !state.imgA || !state.imgB;
                    const effectiveOpacity = (finalOutput || !state.backVisible || singleLayer) ? 1.0 : state.opacity;
                    pCtx.globalAlpha = effectiveOpacity;
                    pCtx.drawImage(frontLayerCanvas, 0, 0);
                }
                pCtx.restore();
            } else {
                els.mainCanvas.style.visibility = 'visible';
                els.previewCanvas.classList.add('hidden');
                
                ctx.clearRect(0, 0, cw, ch);

                ctx.save();
                applyRotation(ctx, cw, ch, state.rotation);

                // 1. Draw Back
                // Modified export logic: Only render back if state.backVisible is true
                const shouldRenderBack = backImg && state.backVisible;

                if (shouldRenderBack) {
                    ctx.globalAlpha = 1.0;
                    ctx.globalCompositeOperation = 'source-over';

                    const scale = state.fullDims.h / backImg.height;
                    const backW = backImg.width * scale;
                    const backH = state.fullDims.h;
                    const backX = (state.fullDims.w - backW) / 2;

                    // Mapping crop rect to back image source rect
                    const bSrcX = (sX - backX) / scale;
                    const bSrcY = sY / scale;
                    const bSrcW = sW / scale;
                    const bSrcH = sH / scale;

                    ctx.drawImage(backImg, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, drawW, drawH);
                }

                // 2. Prepare Front Layer
                if (frontImg) {
                    if (frontLayerCanvas.width !== drawW || frontLayerCanvas.height !== drawH) {
                        frontLayerCanvas.width = drawW;
                        frontLayerCanvas.height = drawH;
                    }
                    frontLayerCtx.clearRect(0, 0, drawW, drawH);
                    frontLayerCtx.globalCompositeOperation = 'source-over';
                    // Draw clipped portion of front image
                    const frontScale = frontLayer.scale || 1;
                    frontLayerCtx.drawImage(frontImg, sX * frontScale, sY * frontScale, sW * frontScale, sH * frontScale, 0, 0, drawW, drawH);

                    let maskSource = maskCanvas;
                    if (state.isPreviewing && state.previewMaskCanvas) {
                        maskSource = state.previewMaskCanvas;
                    }

                    if (state.maskVisible) {
                        frontLayerCtx.globalCompositeOperation = 'destination-out';
                        frontLayerCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, drawW, drawH);
                    }

                    // 3. Composite Front to Main
                    frontLayerCtx.globalCompositeOperation = 'source-over';
                    // Force opacity if only one layer
                    const singleLayer = !state.imgA || !state.imgB;
                    const effectiveOpacity = (finalOutput || !state.backVisible || singleLayer) ? 1.0 : state.opacity;
                    ctx.globalAlpha = effectiveOpacity;
                    ctx.drawImage(frontLayerCanvas, 0, 0);
                }
                ctx.restore();
            }
            
            // 4. Update Crop DOM Overlay
            if (state.isCropping) {
                els.cropOverlayDom.style.display = 'block';
                const r = state.cropRect;

                // r is Prop. Convert to Truth Pixels.
                const truthW = state.fullDims.w;
                const truthH = state.fullDims.h;

                const tRect = {
                    x: r.x * truthH,
                    y: r.y * truthH,
                    w: r.w * truthH,
                    h: r.h * truthH
                };

                let vx = tRect.x, vy = tRect.y, vw = tRect.w, vh = tRect.h;

                if (state.rotation === 90) {
                    vx = truthH - (tRect.y + tRect.h);
                    vy = tRect.x;
                    vw = tRect.h;
                    vh = tRect.w;
                } else if (state.rotation === 180) {
                    vx = truthW - (tRect.x + tRect.w);
                    vy = truthH - (tRect.y + tRect.h);
                } else if (state.rotation === 270) {
                    vx = tRect.y;
                    vy = truthW - (tRect.x + tRect.w);
                    vw = tRect.h;
                    vh = tRect.w;
                }

                els.cropBox.style.left = vx + 'px';
                els.cropBox.style.top = vy + 'px';
                els.cropBox.style.width = vw + 'px';
                els.cropBox.style.height = vh + 'px';
                
                const invScale = 1 / state.view.scale;
                els.cropBox.style.setProperty('--inv-scale', invScale);
                document.querySelectorAll('.crop-handle').forEach(el => {
                    el.style.setProperty('--inv-scale', invScale);
                });
            } else {
                els.cropOverlayDom.style.display = 'none';
            }
            
        }

        // --- Crop Logic ---
        function acceptCrop() {
            if (!state.isCropping) return;
            state.cropRectSnapshot = null;
            const finalRect = { ...state.cropRect };
            toggleCropMode();
            if (window.dispatchAction) dispatchAction({ type: 'CROP', payload: { rect: finalRect } });
        }

        function cancelCrop() {
            if (!state.isCropping) return;
            if (state.cropRectSnapshot) {
                state.cropRect = { ...state.cropRectSnapshot };
            }
            state.cropRectSnapshot = null;
            state.cropDrag = null;
            toggleCropMode();
        }

        function toggleCropMode() {
            if (!canDraw()) return;
            state.isCropping = !state.isCropping;
            
            if (state.isCropping) {
                if (state.cropRect) {
                    Logger.info("Crop mode entered", {
                        x: state.cropRect.x,
                        y: state.cropRect.y,
                        w: state.cropRect.w,
                        h: state.cropRect.h
                    });
                }
                state.cropRectSnapshot = state.cropRect ? { ...state.cropRect } : null;
                els.cropBtn.classList.add('active', 'text-yellow-400');
                updateCanvasDimensions(true);
                els.viewport.classList.add('cropping');
            } else {
                state.cropRectSnapshot = null;
                els.cropBtn.classList.remove('active', 'text-yellow-400');
                updateCanvasDimensions(true);
                els.viewport.classList.remove('cropping');
                if (state.cropRect) {
                    Logger.info("Crop mode exited", {
                        x: state.cropRect.x,
                        y: state.cropRect.y,
                        w: state.cropRect.w,
                        h: state.cropRect.h
                    });
                }
            }
            resetView();
            render();
            updateUI(); // disable other tools
        }

        function resizeMainCanvas(w, h) {
            els.mainCanvas.width = w;
            els.mainCanvas.height = h;
            frontLayerCanvas.width = w;
            frontLayerCanvas.height = h;
            updateWorkspaceLabel();
        }

        // --- Standard App Functions ---
        
        function updateUI() {
            const enable = canDraw();
            els.mergeBtn.disabled = !enable;
            els.censorBtn.disabled = !state.imgA && !state.imgB;

            if (replayEngine) replayEngine.isEnabled = true;
            const cursor = window.ActionHistory ? window.ActionHistory.cursor : -1;
            const total = window.ActionHistory ? window.ActionHistory.actions.length : 0;

            // Root Undo Policy: Prevent undoing the setup phase (contiguous LOAD_IMAGE actions at start)
            let minCursor = -1;
            const history = window.ActionHistory ? window.ActionHistory.getLog() : [];
            for (let i = 0; i < history.length; i++) {
                if (history[i].type === 'LOAD_IMAGE') {
                    minCursor = i;
                } else {
                    break;
                }
            }

            els.undoBtn.disabled = cursor <= minCursor || state.isCropping;
            els.redoBtn.disabled = cursor >= total - 1 || state.isCropping;

            if (!state.imgA && !state.imgB) {
                els.mainCanvas.classList.add('hidden');
                els.emptyState.style.display = '';
            } else {
                els.mainCanvas.classList.remove('hidden');
                els.emptyState.style.display = 'none';
            }

            // Sync Button Text with State
            updateLoadButton(els.btnA, state.nameA ? truncate(state.nameA) : "Load", "front");
            if (state.imgA) els.btnA.classList.add('border-accent-strong', 'text-accent');
            else els.btnA.classList.remove('border-accent-strong', 'text-accent');

            updateLoadButton(els.btnB, state.nameB ? truncate(state.nameB) : "Load", "back");
            if (state.imgB) els.btnB.classList.add('border-accent-strong', 'text-accent');
            else els.btnB.classList.remove('border-accent-strong', 'text-accent');
            
            // Trash Buttons
            els.btnTrashA.disabled = !state.imgA;
            els.btnTrashB.disabled = !state.imgB;
            // Visual dimming handled by disabled attribute CSS,
            // but ensuring opacity if global CSS isn't covering all cases
            els.btnTrashA.style.opacity = state.imgA ? '1' : '0.5';
            els.btnTrashB.style.opacity = state.imgB ? '1' : '0.5';

            // Disable drawers if no image
            const drawerInputs = document.querySelectorAll('.side-drawer input, .side-drawer button');
            drawerInputs.forEach(el => {
                if (el.classList.contains('section-reset')) {
                    // Reset buttons logic is handled internally, but we should disable them if no image
                    el.disabled = !enable;
                } else {
                    el.disabled = !enable;
                }
            });

            // Note: We deliberately do NOT change drawer opacity here as it causes visual glitches/transparency issues.
            // Rely on disabled inputs to prevent interaction.

            // Disable tools while cropping
            if (state.isCropping) {
                 els.eraseMode.disabled = true;
                 els.repairMode.disabled = true;
                 els.patchMode.disabled = true;
                 els.brushSize.disabled = true;
                 els.censorBtn.disabled = true;
                 els.mergeBtn.disabled = true;
                 els.featherModeBtn.disabled = true;
            } else {
                 els.eraseMode.disabled = false;
                 els.repairMode.disabled = false;
                 els.patchMode.disabled = false;
                 els.brushSize.disabled = false;
                 els.featherModeBtn.disabled = false;
            }

            const swapEnabled = state.imgA && state.imgB;
            els.swapBtn.disabled = !swapEnabled;
            if (swapEnabled) {
                els.swapBtn.classList.add('bg-accent-dark', 'border-accent-strong');
                els.swapBtn.classList.remove('bg-gray-800', 'border-gray-600');
            } else {
                els.swapBtn.classList.remove('bg-accent-dark', 'border-accent-strong');
                els.swapBtn.classList.add('bg-gray-800', 'border-gray-600');
            }
            
            // Opacity slider logic
            const bothLoaded = state.imgA && state.imgB;
            els.opacitySlider.disabled = !bothLoaded;
            if(els.opacitySlider.parentElement) {
                els.opacitySlider.parentElement.style.opacity = bothLoaded ? '1' : '0.5';
            }

            if (enable) {
                els.viewport.classList.remove('disabled');
            } else {
                els.viewport.classList.add('disabled');
                els.cursor.style.display = 'none';
            }

            updateWorkspaceLabel();
            updateVisibilityToggles();
        }

        function updateVisibilityToggles() {
            const maskHidden = !state.maskVisible;
            els.toggleMaskBtn.classList.toggle('bg-accent-dark', maskHidden);
            els.toggleMaskBtn.classList.toggle('border-accent-strong', maskHidden);
            els.toggleMaskBtn.classList.toggle('accent-icon', maskHidden);
            els.maskEyeOpen.classList.toggle('hidden', maskHidden);
            els.maskEyeClosed.classList.toggle('hidden', !maskHidden);

            const backHidden = !state.backVisible;
            els.toggleBackBtn.classList.toggle('bg-accent-dark', backHidden);
            els.toggleBackBtn.classList.toggle('border-accent-strong', backHidden);
            els.toggleBackBtn.classList.toggle('accent-icon', backHidden);
            els.rearEyeOpen.classList.toggle('hidden', backHidden);
            els.rearEyeClosed.classList.toggle('hidden', !backHidden);

            const adjHidden = !state.adjustmentsVisible;
            els.toggleAdjBtn.classList.toggle('bg-accent-dark', adjHidden);
            els.toggleAdjBtn.classList.toggle('border-accent-strong', adjHidden);
            els.toggleAdjBtn.classList.toggle('accent-icon', adjHidden);
            els.adjEyeOpen.classList.toggle('hidden', adjHidden);
            els.adjEyeClosed.classList.toggle('hidden', !adjHidden);
        }

        function truncate(str) {
            if(str.length > 8) return str.substring(0, 6) + '..';
            return str;
        }

        function setMode(mode) {
            if (state.brushMode === mode) return;
            state.brushMode = mode;
            els.eraseMode.classList.toggle('active', mode === 'erase');
            els.repairMode.classList.toggle('active', mode === 'repair');
            els.patchMode.classList.toggle('active', mode === 'patch');
            syncBrushUIToActive();
            const hardness = Math.round(100 - (state.feather / HARDNESS_MAX * 100));
            Logger.info(`Brush mode switched: ${mode}`, {
                sizePercent: Number(state.brushPercent.toFixed(1)),
                hardnessPercent: hardness,
                featherMode: state.featherMode
            });
        }

        function loadImageSource(source) {
            return new Promise((resolve, reject) => {
                if (source instanceof Blob) {
                    const url = URL.createObjectURL(source);
                    const img = new Image();
                    img.onload = () => {
                        URL.revokeObjectURL(url);
                        resolve(img);
                    };
                    img.onerror = (e) => {
                        URL.revokeObjectURL(url);
                        reject(e);
                    };
                    img.src = url;
                } else if (typeof source === 'string') {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = (e) => reject(e);
                    img.src = source;
                } else if (source instanceof Image) {
                    if (source.complete) resolve(source);
                    else {
                        source.onload = () => resolve(source);
                        source.onerror = (e) => reject(e);
                    }
                } else {
                    reject(new Error("Unknown source type"));
                }
            });
        }

        function assignLayer(img, slot, name) {
             let assetId = null;
             if (window.AssetManager) {
                 assetId = window.AssetManager.addAsset(img, name);
             }
             if (slot === 'A') state.assetIdA = assetId;
             else state.assetIdB = assetId;

             Logger.info(`Assigning Image to ${slot}: ${img.width}x${img.height} (Asset: ${assetId})`);
             if (slot === 'A') {
                setLayerSource('A', img);
                state.nameA = name;
                updateLoadButton(els.btnA, truncate(name), "front");
                els.btnA.classList.add('border-accent-strong', 'text-accent');
             } else {
                setLayerSource('B', img);
                state.nameB = name;
                updateLoadButton(els.btnB, truncate(name), "back");
                els.btnB.classList.add('border-accent-strong', 'text-accent');
             }
             markAdjustmentsDirty();
             rebuildWorkingCopies();
             updateCanvasDimensions();
             render();
             updateUI();

             if (window.dispatchAction) dispatchAction({ type: 'LOAD_IMAGE', payload: { slot, name, width: img.width, height: img.height, assetId } });
        }

        function handleFileLoad(file, slot) {
            if (!file) return;
            bakeRotation();
            log(`Loading ${file.name}...`, "info");
            Logger.info(`Loading file into Slot ${slot}: ${file.name} (${file.size} bytes)`);

            loadImageSource(file)
                .then(img => assignLayer(img, slot, file.name))
                .catch(e => {
                    log("Failed to load image: " + e.message);
                    Logger.error("Image load failed", e);
                });
        }

        function fetchImage(url) {
            const tryFetch = (targetUrl) => {
                return fetch(targetUrl)
                    .then(res => {
                        if (!res.ok) throw new Error("Status " + res.status);
                        return res.blob();
                    })
                    .then(blob => {
                        if (!blob.type.startsWith('image/')) throw new Error("Not an image");
                        return blob;
                    });
            };

            // 1. Try Direct
            return tryFetch(url)
                .catch(err => {
                    Logger.info("Direct fetch failed, trying proxy if available...", err);
                    if (state.settings.proxyUrl) {
                        const proxy = state.settings.proxyUrl.replace('{url}', encodeURIComponent(url));
                        // Some proxies like corsproxy.io simply append the URL
                        const target = proxy.includes('?url=') || proxy.includes('?http') || proxy.includes('/?')
                                       ? proxy
                                       : (proxy.endsWith('/') ? proxy + url : proxy + '/?' + url);

                        // We will rely on user provided proxy URL structure mostly, but fallback to simple concatenation
                        // The default is https://corsproxy.io/?https://...
                        // If user hasn't changed it:
                        let finalUrl = state.settings.proxyUrl;
                        if (finalUrl === "https://corsproxy.io/?https://api.replicate.com") {
                            // Default is for Replicate, let's just use corsproxy.io generic
                             finalUrl = "https://corsproxy.io/?" + url;
                        } else {
                             // Naive substitution if they have {url}, else append
                             if (finalUrl.includes('{url}')) finalUrl = finalUrl.replace('{url}', encodeURIComponent(url));
                             else finalUrl = finalUrl + url;
                        }
                        return tryFetch(finalUrl);
                    }
                    throw err;
                });
        }

        function handlePaste(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // --- 1. Snapshot Clipboard for Debugging (Lossless) ---
            const clipboardDump = {
                timestamp: new Date().toISOString(),
                types: [...(e.clipboardData.types || [])],
                files: [],
                items: [],
                manualText: {}
            };

            // Files Metadata
            if (e.clipboardData.files) {
                for (let i = 0; i < e.clipboardData.files.length; i++) {
                    const f = e.clipboardData.files[i];
                    clipboardDump.files.push({
                        name: f.name,
                        type: f.type,
                        size: f.size,
                        lastModified: f.lastModified
                    });
                }
            }

            // Items Processing
            const items = e.clipboardData.items;
            const blobPromises = [];
            const stringPromises = [];
            const debugStringPromises = [];

            // Add direct files to blob promises
            if (e.clipboardData.files) {
                for (let i = 0; i < e.clipboardData.files.length; i++) {
                    blobPromises.push(Promise.resolve(e.clipboardData.files[i]));
                }
            }

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const itemDump = { kind: item.kind, type: item.type, content: "<pending>" };
                clipboardDump.items.push(itemDump);

                if (item.kind === 'file') {
                    // Try FileSystemEntry API first (Better for Hydrus/Electron/Complex drops)
                    if (typeof item.webkitGetAsEntry === 'function') {
                        const entry = item.webkitGetAsEntry();
                        if (entry && entry.isFile) {
                            const p = new Promise((resolve) => {
                                entry.file(f => resolve(f), err => resolve(null));
                            });
                            blobPromises.push(p);
                            itemDump.content = "FileSystemEntry";
                        } else {
                            // Fallback to standard getAsFile
                            const blob = item.getAsFile();
                            if (blob) {
                                blobPromises.push(Promise.resolve(blob));
                                itemDump.content = `Blob(${blob.type}, ${blob.size})`;
                            } else {
                                itemDump.content = "null blob";
                            }
                        }
                    } else {
                        const blob = item.getAsFile();
                        if (blob) {
                            blobPromises.push(Promise.resolve(blob));
                            itemDump.content = `Blob(${blob.type}, ${blob.size})`;
                        } else {
                            itemDump.content = "null blob";
                        }
                    }
                } else if (item.kind === 'string') {
                    const p = new Promise(resolve => {
                        item.getAsString(s => {
                            itemDump.content = s;
                            resolve(s);
                        });
                    });
                    debugStringPromises.push(p);

                    if (item.type === 'text/plain' || item.type === 'text/uri-list' || item.type === 'text/html') {
                        stringPromises.push(p);
                    }
                }
            }

            // Force retrieval of text formats even if not in 'items' (Browser quirk workaround)
            const manualFormats = ['text/plain', 'text/uri-list', 'text/html'];
            manualFormats.forEach(fmt => {
                const val = e.clipboardData.getData(fmt);
                if (val) {
                    clipboardDump.manualText[fmt] = val;
                    stringPromises.push(Promise.resolve(val));
                }
            });

            // --- 2. Process ---
            Promise.all([
                Promise.all(blobPromises),
                Promise.all(stringPromises),
                Promise.all(debugStringPromises)
            ]).then(async ([blobs, strings, _]) => {
                const uniqueBlobs = [...new Set(blobs)];
                const uniqueStrings = [...new Set(strings)];

                // Filter out 0-byte files (broken handles) and nulls
                const validBlobs = uniqueBlobs.filter(b => b && b.size > 0);

                // Priority 1: Valid Binaries
                if (validBlobs.length > 0) {
                    Logger.info(`Paste: Found ${validBlobs.length} valid blob(s)`, clipboardDump);
                    loadLayerWithSmartSlotting(validBlobs[0], "Pasted Image");
                    return;
                }

                if (uniqueBlobs.length > 0 && validBlobs.length === 0) {
                    Logger.warn("Paste: Found blobs but all were 0 bytes. Falling back to text search...", clipboardDump);
                }

                // Priority 2: URLs / Paths
                const urls = [];
                uniqueStrings.forEach(s => {
                     // 1. Standard URLs
                     if (s.match(/^https?:\/\//) || s.match(/^file:\/\//)) {
                         urls.push(s);
                     }
                     // 2. Windows Path
                     else if (s.match(/^[a-zA-Z]:\\/)) {
                         urls.push('file:///' + s.replace(/\\/g, '/'));
                     }
                     // 3. Unix Path
                     else if (s.startsWith('/')) {
                          urls.push('file://' + s);
                     }
                     // 4. HTML Source (Img tags)
                     else if (s.includes('<img')) {
                         const match = s.match(/src=["'](.*?)["']/);
                         if (match && match[1]) urls.push(match[1]);
                     }
                });

                if (urls.length > 0) {
                     Logger.info("Paste: Found URL(s)", { ...clipboardDump, extractedUrls: urls });
                     try {
                         const blob = await fetchImage(urls[0]);
                         loadLayerWithSmartSlotting(blob, "Pasted URL");
                     } catch(e) {
                         Logger.error("Failed to fetch pasted URL", { error: e.message, stack: e.stack, clipboard: clipboardDump });
                     }
                } else {
                    Logger.warn("Paste ignored: No image data or URLs found.", clipboardDump);
                }
            });
        }

        function updateCanvasDimensions(preserveView = false, preserveMask = false) {
            if (!state.imgA && !state.imgB) return;
            const frontImg = state.isAFront ? state.imgA : state.imgB;
            const activeImg = frontImg || (state.isAFront ? state.imgB : state.imgA);
            if (!activeImg) return;
            const targetW = activeImg.width;
            const targetH = activeImg.height;
            
            // Set Full Dims
            state.fullDims = { w: targetW, h: targetH };
            if (!preserveView || !state.cropRect) {
                 // Default Crop is Full Image.
                 // In Proportions: x=0, y=0, w=Aspect, h=1
                 state.cropRect = { x: 0, y: 0, w: targetW / targetH, h: 1.0 };
            }

            if (maskCanvas.width !== targetW || maskCanvas.height !== targetH) {
                maskCanvas.width = targetW;
                maskCanvas.height = targetH;
                maskCtx.clearRect(0,0,targetW,targetH); 
                // Only reset history if we are NOT preserving the mask (e.g. new load)
                if (!preserveMask) {
                    resetMaskAndHistory();
                }
            }

            const isRotated = state.rotation % 180 !== 0;

            // Calculate Base Pixels for View
            // If cropping: Full Dims
            // If normal: CropRect * Height
            const baseW = state.isCropping ? state.fullDims.w : (state.cropRect.w * state.fullDims.h);
            const baseH = state.isCropping ? state.fullDims.h : (state.cropRect.h * state.fullDims.h);

            const visualW = isRotated ? baseH : baseW;
            const visualH = isRotated ? baseW : baseH;

            // Note: Resize canvas takes integer pixels
            resizeMainCanvas(Math.max(1, Math.round(visualW)), Math.max(1, Math.round(visualH)));

            els.mainCanvas.classList.remove('hidden');
            els.emptyState.style.display = 'none';
            els.canvasWrapper.style.width = visualW + 'px';
            els.canvasWrapper.style.height = visualH + 'px';
            
            if (!preserveView) resetView(); 
        }

        function applyRotation(ctx, w, h, rotation) {
            if (rotation === 0) return;
            if (rotation === 90) {
                ctx.translate(w, 0);
                ctx.rotate(90 * Math.PI / 180);
            } else if (rotation === 180) {
                ctx.translate(w, h);
                ctx.rotate(180 * Math.PI / 180);
            } else if (rotation === 270) {
                ctx.translate(0, h);
                ctx.rotate(270 * Math.PI / 180);
            }
        }

        // --- Censor, Merge, Save (Remaining) ---
        function applyCensor() {
             if (!state.imgA && !state.imgB) { log("Need at least one image"); return; }

             scheduleHeavyTask(async () => {
                 bakeRotation();
                 log("Generating Censor layer...", "info");

                 // Ensure any fast/preview mask state is cleared so the final render uses the full-resolution mask
                 state.isPreviewing = false;
                 state.previewMaskCanvas = null;
                 state.previewMaskScale = 1;
                 state.useFastPreview = false;
                 state.fastPreviewLastPoint = null;

                 // Temporarily render full, uncropped frame for processing
                 const wasCropping = state.isCropping;
                 const prevCropRect = state.cropRect ? { ...state.cropRect } : null;

                 // Full Frame Proportions
                 const fullAspect = state.fullDims.w / state.fullDims.h;
                 const fullFrameProp = { x: 0, y: 0, w: fullAspect, h: 1.0 };

                 state.isCropping = true;
                 state.cropRect = fullFrameProp;
                 // Resize canvas to full pixels
                 resizeMainCanvas(state.fullDims.w, state.fullDims.h);

                 render(true, true); // Final, Skip Adjustments
                 const baseData = els.mainCanvas.toDataURL('image/png');

                 // Restore crop state before building layers
                 state.isCropping = wasCropping;
                 state.cropRect = prevCropRect;
                 if (wasCropping) resizeMainCanvas(state.fullDims.w, state.fullDims.h);
                 else if (prevCropRect) {
                     // Convert prop rect back to pixels for resizing
                     const rw = Math.round(prevCropRect.w * state.fullDims.h);
                     const rh = Math.round(prevCropRect.h * state.fullDims.h);
                     resizeMainCanvas(rw, rh);
                 }

                 const imgBase = await loadImageSource(baseData);

                 setLayerSource('A', imgBase); state.nameA = "Base Layer";
                 const w = imgBase.width; const h = imgBase.height;
                 const blurRadius = Math.max(1, h * 0.01);
                 const pad = Math.ceil(blurRadius * 3);
                 const paddedCanvas = document.createElement('canvas');
                 paddedCanvas.width = w + pad * 2; paddedCanvas.height = h + pad * 2;
                 const pCtx = paddedCanvas.getContext('2d');
                 pCtx.drawImage(imgBase, pad, pad);
                 pCtx.drawImage(imgBase, 0, 0, w, 1, pad, 0, w, pad);
                 pCtx.drawImage(imgBase, 0, h-1, w, 1, pad, h+pad, w, pad);
                 pCtx.drawImage(imgBase, 0, 0, 1, h, 0, pad, pad, h);
                 pCtx.drawImage(imgBase, w-1, 0, 1, h, w+pad, pad, pad, h);
                 const blurCanvas = document.createElement('canvas');
                 blurCanvas.width = w; blurCanvas.height = h;
                 const bCtx = blurCanvas.getContext('2d');
                 bCtx.filter = `blur(${blurRadius}px)`;
                 bCtx.drawImage(paddedCanvas, -pad, -pad);
                 bCtx.filter = 'none';
                 const blockSize = Math.max(1, h * 0.025);
                 const sw = Math.ceil(w / blockSize); const sh = Math.ceil(h / blockSize);
                 const tinyCanvas = document.createElement('canvas');
                 tinyCanvas.width = sw; tinyCanvas.height = sh;
                 const tinyCtx = tinyCanvas.getContext('2d');
                 tinyCtx.drawImage(blurCanvas, 0, 0, sw, sh);
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = w; tempCanvas.height = h;
                 const tCtx = tempCanvas.getContext('2d');
                 tCtx.imageSmoothingEnabled = false;
                 tCtx.drawImage(tinyCanvas, 0, 0, sw, sh, 0, 0, w, h);

                 const imgCensored = await loadImageSource(tempCanvas.toDataURL('image/png'));

                 let assetId = null;
                 if (window.AssetManager) {
                     assetId = window.AssetManager.addAsset(imgCensored, "Censored Layer");
                 }
                 state.assetIdB = assetId;

                 setLayerSource('B', imgCensored); state.nameB = "Censored Layer";

                 // Re-init full dims
                 const newW = imgCensored.width;
                 const newH = imgCensored.height;
                 state.fullDims = { w: newW, h: newH };

                 // Preserve Crop if valid, else reset
                 // Check if cropRect (props) is valid for new aspect?
                 // Usually Censor/Merge keeps same aspect.
                 // If cropRect is null, set to Full.
                 if (!state.cropRect) {
                     state.cropRect = { x: 0, y: 0, w: newW/newH, h: 1.0 };
                 }

                 resetMaskOnly(); // Don't reset adjustments

                 // Restore view state
                 state.isCropping = wasCropping;
                 if (!wasCropping) {
                     const rw = Math.round(state.cropRect.w * newH);
                     const rh = Math.round(state.cropRect.h * newH);
                     resizeMainCanvas(rw, rh);
                 } else {
                     resizeMainCanvas(newW, newH);
                 }

                 state.maskVisible = true;
                 els.maskEyeOpen.classList.remove('hidden'); els.maskEyeClosed.classList.add('hidden');
                 state.backVisible = true;
                 els.rearEyeOpen.classList.remove('hidden'); els.rearEyeClosed.classList.add('hidden');
                 state.brushSettings = {
                     erase: { brushSize: DEFAULT_BRUSH_SIZE, feather: DEFAULT_FEATHER, featherSize: DEFAULT_FEATHER_SIZE },
                     repair: { brushSize: DEFAULT_REPAIR_BRUSH_SIZE, feather: DEFAULT_FEATHER, featherSize: DEFAULT_FEATHER_SIZE }
                 };
                 setMode('erase');
                 setFeatherMode(true, { value: DEFAULT_FEATHER_SIZE, applyToAll: true });
                 syncBrushUIToActive();
                 state.opacity = 1.0; els.opacitySlider.value = 100; els.opacityVal.textContent = "100%";
                 state.isAFront = true;
                 updateLoadButton(els.btnA, "Base", "front");
                 els.btnA.classList.add('border-accent-strong', 'text-accent');
                 updateLoadButton(els.btnB, "Censored", "back");
                 els.btnB.classList.add('border-accent-strong', 'text-accent');

                 rebuildWorkingCopies(true);

                 render(); updateUI();
                 log("Censor setup complete", "info");
                 if (window.dispatchAction) dispatchAction({ type: 'APPLY_CENSOR', payload: { assetId } });
             });
        }

        function mergeDown() {
            if (!canDraw()) return;
            scheduleHeavyTask(async () => {
                bakeRotation();
                log("Merging...", "info");

                // Render Full Image temporarily
                const wasCropping = state.isCropping;
                state.isCropping = false;
                resizeMainCanvas(state.fullDims.w, state.fullDims.h);

                render(true, true); // Final, Skip Adjustments
                const dataURL = els.mainCanvas.toDataURL('image/png');

                const newImg = await loadImageSource(dataURL);

                let assetId = null;
                if (window.AssetManager) {
                    assetId = window.AssetManager.addAsset(newImg, "Merged Layer");
                }
                state.assetIdA = assetId;
                state.assetIdB = null;

                setLayerSource('A', newImg); state.imgB = null; state.sourceB = null; state.workingVersionB = 0;
                state.nameA = "Merged Layer"; state.nameB = "";

                // Update dims
                const newW = newImg.width;
                const newH = newImg.height;
                state.fullDims = { w: newW, h: newH };

                // Preserve Crop
                if (!state.cropRect) {
                        state.cropRect = { x: 0, y: 0, w: newW/newH, h: 1.0 };
                }

                resetMaskOnly(); // Don't reset adjustments

                // Restore view
                state.isCropping = wasCropping;
                if (!wasCropping) {
                    const rw = Math.round(state.cropRect.w * newH);
                    const rh = Math.round(state.cropRect.h * newH);
                    resizeMainCanvas(rw, rh);
                }
                else resizeMainCanvas(newW, newH);

                maskCanvas.width = newW; maskCanvas.height = newH;
                frontLayerCanvas.width = newW; frontLayerCanvas.height = newH;
                maskCtx.clearRect(0, 0, newW, newH);

                rebuildWorkingCopies(true);

                state.isAFront = true; state.opacity = 1.0;
                els.opacitySlider.value = 100; els.opacityVal.textContent = "100%";
                updateLoadButton(els.btnA, "Merged", "front");
                els.btnA.classList.add('border-accent-strong', 'text-accent');
                updateLoadButton(els.btnB, "Load", "back");
                els.btnB.classList.remove('border-accent-strong', 'text-accent');

                render(); updateUI();
                log("Merge successful", "info");
                if (window.dispatchAction) dispatchAction({ type: 'MERGE_LAYERS', payload: { assetId, targetSlot: 'A' } });
            });
        }

        function saveImage() {
            if (!state.imgA && !state.imgB) return;
            bakeRotation();
            Logger.info("Exporting image...");
            try {
                // Render CROP area for export
                const wasCropping = state.isCropping;
                state.isCropping = false; 

                // Calculate Pixel Crop
                const rw = Math.round(state.cropRect.w * state.fullDims.h);
                const rh = Math.round(state.cropRect.h * state.fullDims.h);

                resizeMainCanvas(rw, rh);
                
                render(true); // Final render with adjustments
                
                const now = new Date();
                const pad = (n) => n.toString().padStart(2, '0');
                const timeString = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
                const filename = `${timeString}.png`; // Removed FanArt_ prefix

                const link = document.createElement('a');
                link.download = filename;
                link.href = els.mainCanvas.toDataURL('image/png');
                link.click();
                
                // Restore state
                if (wasCropping) {
                    state.isCropping = true;
                    resizeMainCanvas(state.fullDims.w, state.fullDims.h);
                }
                
                render();
                log("Image saved", "info");
                Logger.info(`Export Complete: ${filename}`);
            } catch (e) {
                log("Save failed");
                Logger.error("Export Failed", e);
            }
        }

        init();
    
