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
            const legend = state.isCropping ? document.getElementById('crop-hint-legend') : document.getElementById('hint-legend');
            if (legend) {
                legend.style.opacity = '1';
                if (hintTimer) clearTimeout(hintTimer);

                // Only auto-hide standard legend. Crop legend stays persistent.
                if (!state.isCropping) {
                    hintTimer = setTimeout(() => {
                        legend.style.opacity = '0';
                    }, 3000);
                }
            }
        }
        window.checkResolutionOverlap = checkResolutionOverlap;

        const DEFAULT_BRUSH_SIZE = 0.1;
        const DEFAULT_FEATHER = 1;
        const DEFAULT_FEATHER_SIZE = 0.0012; // ~0.12% (5px at 4320p)
        const DEFAULT_REPAIR_BRUSH_SIZE = DEFAULT_BRUSH_SIZE / 2;
        const DEFAULT_PATCH_FEATHER = 10; // For Hardness mode
        const HARDNESS_MAX = 20;

        const state = {
            imgA: null, imgB: null, assetIdA: null, assetIdB: null, nameA: '', nameB: '', formatA: '', formatB: '', sourceA: null, sourceB: null, thumbA: null, thumbB: null, isAFront: true,
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
            activeDrawerTab: null,
            mode: 'master',
            cropRotation: 0
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
            eraseMode: document.getElementById('eraseMode'),
            repairMode: document.getElementById('repairMode'), patchMode: document.getElementById('patchMode'), clearMask: document.getElementById('clearMask'),
            saveBtn: document.getElementById('saveBtn'), dragOverlay: document.getElementById('drag-overlay'),
            toggleMaskBtn: document.getElementById('toggleMaskBtn'), maskEyeOpen: document.getElementById('maskEyeOpen'), maskEyeClosed: document.getElementById('maskEyeClosed'),
            toggleBackBtn: document.getElementById('toggleBackBtn'), rearEyeOpen: document.getElementById('rearEyeOpen'), rearEyeClosed: document.getElementById('rearEyeClosed'),
            toggleAdjBtn: document.getElementById('toggleAdjBtn'), adjEyeOpen: document.getElementById('adjEyeOpen'), adjEyeClosed: document.getElementById('adjEyeClosed'),
            mergeBtn: document.getElementById('mergeBtn'), censorBtn: document.getElementById('censorBtn'),
            undoBtn: document.getElementById('undoBtn'), redoBtn: document.getElementById('redoBtn'),
            rotateBtn: document.getElementById('rotateBtn'),
            cropBtn: document.getElementById('cropBtn'), newBtn: document.getElementById('newBtn'),
            cursor: document.getElementById('brush-cursor'),
            resetAdjBtn: document.getElementById('resetAdjBtn'), resetLevelsBtn: document.getElementById('resetLevelsBtn'),
            resetColorBtn: document.getElementById('resetColorBtn'), resetSatBtn: document.getElementById('resetSatBtn'),
            adjGamma: document.getElementById('adj-gamma'), valGamma: document.getElementById('val-gamma'),
            cropOverlayDom: document.getElementById('crop-overlay-dom'), cropBox: document.getElementById('crop-box'),
            workspaceResolution: document.getElementById('workspace-resolution'),
            colorTuningDrawer: document.getElementById('drawer-tools'),
            verticalToolbox: document.getElementById('vertical-toolbox'),
            modeMaster: document.getElementById('modeMaster'),
            modeCensor: document.getElementById('modeCensor'),
            modeComposite: document.getElementById('modeComposite')
        };

        const ctx = els.mainCanvas.getContext('2d');
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
        const frontLayerCanvas = document.createElement('canvas');
        const frontLayerCtx = frontLayerCanvas.getContext('2d');
        let replayEngine = null;

        function setAppMode(mode) {
            if (!mode) return;
            state.mode = mode;
            document.body.classList.toggle('mode-non-master', mode !== 'master');
            setFeatherMode(mode === 'censor');
            const modeButtons = [
                { mode: 'master', el: els.modeMaster },
                { mode: 'censor', el: els.modeCensor },
                { mode: 'composite', el: els.modeComposite }
            ];
            modeButtons.forEach(({ mode: buttonMode, el }) => {
                if (!el) return;
                el.classList.toggle('active', buttonMode === mode);
            });
        }

        function bindModeSwitcher() {
            if (els.modeMaster) {
                els.modeMaster.addEventListener('click', () => setAppMode('master'));
            }
            if (els.modeCensor) {
                els.modeCensor.addEventListener('click', () => setAppMode('censor'));
            }
            if (els.modeComposite) {
                els.modeComposite.addEventListener('click', () => setAppMode('composite'));
            }
            setAppMode(state.mode);
        }

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

        function showModal(title, message, choices, cancellable = true) {
            return new Promise((resolve) => {
                const overlay = document.getElementById('modal-overlay');
                const titleEl = document.getElementById('modal-title');
                const closeBtn = document.getElementById('modal-close');
                const msg = document.getElementById('modal-message');
                const choiceContainer = document.getElementById('modal-choices');

                titleEl.textContent = title || "Confirm";
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
                    if (isCancel) {
                         // Fallback for cancel style if used in future
                         btn.className = "w-full py-1 px-4 bg-transparent border-accent text-accent hover:bg-[var(--accent-strong)] hover:text-[var(--accent-ink)] hover:border-accent-strong rounded-sm transition-all text-base font-bold shadow-sm";
                    } else {
                         // Using accent-action style (Export button style) with text-base
                         btn.className = "w-full py-1 px-4 accent-action rounded-sm transition-all text-base font-bold shadow-sm";
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
                    closeBtn.style.display = '';
                    closeBtn.onclick = () => {
                        cleanup();
                        resolve(null);
                    };
                } else {
                    closeBtn.style.display = 'none';
                    closeBtn.onclick = null;
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

        function generateThumbnail(img, targetH = 512) {
             if (!img) return null;

             let cur = img;
             let curW = img.width;
             let curH = img.height;

             if (curH <= targetH) {
                 return cloneToCanvas(img);
             }

             // Step down by half until < 2x target
             while (curH > targetH * 2) {
                 const nextW = Math.floor(curW * 0.5);
                 const nextH = Math.floor(curH * 0.5);
                 const canvas = document.createElement('canvas');
                 canvas.width = nextW;
                 canvas.height = nextH;
                 const ctx = canvas.getContext('2d');
                 ctx.imageSmoothingEnabled = true;
                 ctx.imageSmoothingQuality = 'high';
                 ctx.drawImage(cur, 0, 0, nextW, nextH);
                 cur = canvas;
                 curW = nextW;
                 curH = nextH;
             }

             // Final Draw
             const scale = targetH / curH;
             const finalW = Math.floor(curW * scale);
             const canvas = document.createElement('canvas');
             canvas.width = finalW;
             canvas.height = targetH;
             const ctx = canvas.getContext('2d');
             ctx.imageSmoothingEnabled = true;
             ctx.imageSmoothingQuality = 'high';
             ctx.drawImage(cur, 0, 0, finalW, targetH);
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
            // Generate Thumbnail (512p) for high quality preview
            const thumb = generateThumbnail(base);

            if (slot === 'A') {
                state.imgA = base;
                state.sourceA = base;
                state.thumbA = thumb;
                state.workingVersionA = 0;
                state.previewWorkingVersionA = 0;
            } else {
                state.imgB = base;
                state.sourceB = base;
                state.thumbB = thumb;
                state.workingVersionB = 0;
                state.previewWorkingVersionB = 0;
            }
        }

        function rotatePoint(p, cx, cy, angleDeg) {
            if (angleDeg === 0) return { ...p };
            const rad = angleDeg * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dx = p.x - cx;
            const dy = p.y - cy;
            return {
                x: cx + (dx * cos - dy * sin),
                y: cy + (dx * sin + dy * cos)
            };
        }

        function truthToVisualPoint(p, rotation, fullW, fullH) {
            if (rotation === 0) return { ...p };
            if (rotation === 90) return { x: fullH - p.y, y: p.x };
            if (rotation === 180) return { x: fullW - p.x, y: fullH - p.y };
            if (rotation === 270) return { x: p.y, y: fullW - p.x };
            return { ...p };
        }

        function visualToTruthPoint(p, rotation, fullW, fullH) {
            if (rotation === 0) return { ...p };
            if (rotation === 90) return { x: p.y, y: fullH - p.x };
            if (rotation === 180) return { x: fullW - p.x, y: fullH - p.y };
            if (rotation === 270) return { x: fullW - p.y, y: p.x };
            return { ...p };
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
            if (typeof recalculateColorTuning === 'function') recalculateColorTuning();
            if (typeof updateAllAdjustmentUI === 'function') updateAllAdjustmentUI();
            markAdjustmentsDirty();
            rebuildWorkingCopies();
        }

        // Logic extracted from applyCensor for reuse in Project Restoration
        async function generateCensorLayer() {
             log("Generating Censor layer...", "info");
             const imgBase = state.imgA;
             if (!imgBase) return;

             const w = imgBase.width; const h = imgBase.height;
             const blurRadius = Math.max(1, h * 0.01);
             const pad = Math.ceil(blurRadius * 3);

             const paddedCanvas = document.createElement('canvas');
             paddedCanvas.width = w + pad * 2; paddedCanvas.height = h + pad * 2;
             const pCtx = paddedCanvas.getContext('2d');
             pCtx.drawImage(imgBase, pad, pad);

             // Edge clamping for blur
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

             setLayerSource('B', imgCensored);
             state.nameB = "Censored Layer";

             // Init Dims
             state.fullDims = { w, h };
             // Use user's crop if restored (set later by caller), else full
             if (!state.cropRect) state.cropRect = { x: 0, y: 0, w: w/h, h: 1.0 };

             // Setup UI for Censor Mode
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
        }

        async function resolveStegoLoad(source, name) {
             const sourceType = (source instanceof Blob) ? 'File' : 'URL';
             Logger.info(`[SmartLoad] Init '${name}'. SourceType: ${sourceType}. Kakushi: ${!!window.kakushi}, Watermark: ${!!window.Watermark}`);

             const applyAndLogAction = (action) => {
                 if (!replayEngine) return;
                 replayEngine.applyAction(action.type, action.payload);
                 replayEngine.logAction(action);
             };

             const logRestoreAdjustments = (adjustments) => {
                 if (!replayEngine || !adjustments) return;
                 replayEngine.logAction({
                     type: 'RESTORE_ADJUSTMENTS',
                     payload: { adjustments: JSON.parse(JSON.stringify(adjustments)) }
                 });
             };

             const finalizeRestoreHistory = () => {
                 if (!replayEngine) return;
                 if (typeof replayEngine.saveKeyframeAtCursor === 'function') {
                     replayEngine.saveKeyframeAtCursor();
                 }
                 if (typeof replayEngine.setUndoFloor === 'function') {
                     replayEngine.setUndoFloor(replayEngine.history.cursor);
                 }
             };

             const img = await loadImageSource(source);
             Logger.info(`[SmartLoad] Image Loaded. Dims: ${img.width}x${img.height} (Natural: ${img.naturalWidth}x${img.naturalHeight})`);

             const watermarkMask = window.Watermark?.buildMask?.(img.width, img.height);
             const maskData = watermarkMask ? watermarkMask.data : null;

             // Steganography Detection (Active Interception)
             Logger.info("[SmartLoad] Attempting Standard Peek...");
             let isStego = window.kakushi && window.kakushi.peek(img, { mask: maskData });
             Logger.info(`[SmartLoad] Standard Peek Result: ${isStego}`);

             let cleanImg = img;

             // Fallback: Check for Watermark Interference
             if (!isStego && window.Watermark && window.kakushi) {
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = img.width;
                 tempCanvas.height = img.height;
                 const tCtx = tempCanvas.getContext('2d');
                 tCtx.drawImage(img, 0, 0);

                 // Attempt blind removal (XOR)
                 window.Watermark.checkAndRemove(tempCanvas);

                 if (window.kakushi.peek(tempCanvas, { mask: maskData })) {
                     isStego = true;
                     // Update source to the clean version
                     cleanImg = await loadImageSource(tempCanvas.toDataURL());
                     log("Detected and removed watermark.", "info");
                     Logger.info("[SmartLoad] Detected and removed watermark (Peek success after blind removal).");
                 }
             }

             if (isStego) {
                 try {
                     const result = await window.kakushi.reveal(cleanImg, { mask: maskData });

                     if (result.headerFound && !result.secret) {
                         log("Detected save file, but data is corrupt/incompatible.", "error");
                         // Fall through to load as standard image
                     }

                     if (result.secret) {
                         const payload = JSON.parse(result.secret);
                         const info = payload.info || {};
                         const packets = Object.keys(payload).filter(k => k !== 'info');
                         const hasImages = state.imgA || state.imgB;
                         let decodedImg = result.cleanImage;

                         if (payload.watermarked && window.Watermark) {
                             window.Watermark.checkAndRemove(decodedImg);
                         }

                         Logger.info(`[Stego] Detected v${info.version} payload: ${info.type}. Packets: ${packets.join(', ')}`);

                         // Case 1: Mask Export
                         if (info.type === 'mask') {
                             // Check if we have images loaded to apply mask TO
                             if (hasImages) {
                                 log("Importing Mask...", "info");
                                 resetMaskOnly();
                                 if (payload.mask && Array.isArray(payload.mask)) {
                                     payload.mask.forEach(action => {
                                         applyAndLogAction(action);
                                     });
                                 }
                                 render();
                                 return { handled: true };
                             }
                         }
                         // Case 2: Save (Project Restore)
                         else if (info.type === 'save') {
                             // Check for Censor Project Flag
                             if (payload.censor) {
                                 const confirm = await showModal(
                                     "Restore Censor Project?",
                                     "This image is a saved Censor Project. Restoring it will clear your current workspace.",
                                     [{ label: "Restore Project", value: true }],
                                     true
                                 );
                                 if (!confirm) return { handled: true };

                                 log("Restoring Censor Project...", "info");

                                 // Manual Clear
                                 state.imgA = null; state.imgB = null;
                                 state.history = [];
                                 if (replayEngine && replayEngine.clear) replayEngine.clear();
                                 resetMaskOnly();

                                 // Load Base (img is the decoded Image object)
                                 assignLayer(decodedImg, 'A', "Base Layer");

                                 // Generate Censor Layer (Slot B)
                                 await generateCensorLayer();

                                 // Apply Metadata
                                 if (payload.adjustments) {
                                     state.adjustments = payload.adjustments;
                                     if (typeof recalculateColorTuning === 'function') recalculateColorTuning();
                                     if (typeof updateAllAdjustmentUI === 'function') updateAllAdjustmentUI();
                                     logRestoreAdjustments(payload.adjustments);
                                 }

                                 if (payload.crop) {
                                     state.cropRect = payload.crop;
                                     state.cropRotation = payload.crop.rotation || 0;
                                     updateCanvasDimensions(true); // Preserve view (don't reset crop)
                                     state.isCropping = false;
                                 }

                                 if (payload.mask && Array.isArray(payload.mask)) {
                                     els.loadingOverlay.classList.remove('hidden');
                                     // Force paint
                                     await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

                                     try {
                                         resetMaskOnly();
                                         payload.mask.forEach(action => {
                                             applyAndLogAction(action);
                                         });
                                     } finally {
                                         els.loadingOverlay.classList.add('hidden');
                                     }
                                 }

                                 rebuildWorkingCopies(true);
                                 render();
                                 resetView();
                                 finalizeRestoreHistory();
                                 return { handled: true };
                             }

                             // Standard Project Save
                             const choice = hasImages
                                 ? await showModal(
                                     "Load Save?",
                                     "This is a Save file. Restore original workspace or load as image?",
                                     [
                                         { label: "Restore Save", value: 'project' },
                                         { label: "Load Image", value: 'image' }
                                     ],
                                     true
                                 )
                                 : 'project';

                             if (choice === 'project') {
                                 // Clear Workspace
                                 state.imgA = null; state.imgB = null;
                                 state.history = [];
                                 if (replayEngine && replayEngine.clear) replayEngine.clear();
                                 resetMaskOnly();
                                 resetAllAdjustments();

                                 assignLayer(decodedImg, 'A', "Restored Save");

                                 if (payload.adjustments) {
                                     state.adjustments = payload.adjustments;
                                     if (typeof recalculateColorTuning === 'function') recalculateColorTuning();
                                     if (typeof updateAllAdjustmentUI === 'function') updateAllAdjustmentUI();
                                     logRestoreAdjustments(payload.adjustments);
                                 }

                                 if (payload.crop) {
                                     state.cropRect = payload.crop;
                                     state.cropRotation = payload.crop.rotation || 0;
                                     updateCanvasDimensions(true); // Preserve view
                                     state.isCropping = false;
                                 }

                                 if (payload.mask && Array.isArray(payload.mask)) {
                                     els.loadingOverlay.classList.remove('hidden');
                                     await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                                     try {
                                         resetMaskOnly();
                                         payload.mask.forEach(action => {
                                             applyAndLogAction(action);
                                         });
                                     } finally {
                                         els.loadingOverlay.classList.add('hidden');
                                     }
                                 }

                                 rebuildWorkingCopies(true);
                                 render();
                                 resetView();
                                 finalizeRestoreHistory();
                                 return { handled: true };
                             }

                             if (choice === null) return { handled: true };
                             // else fall through to load as image
                         }
                         // Case 3: Merged / Front / Back Export
                         // Only prompt if we already have images loaded (to apply settings TO)
                         else if (['merged', 'front', 'back'].includes(info.type) && hasImages) {
                             const message = `This image contains OkazuStudio metadata (${packets.join(', ')}).`;
                             const choice = await showModal(
                                 "Load Metadata?",
                                 message,
                                 [
                                     { label: "Load Settings", value: 'settings' },
                                     { label: "Load Original Image", value: 'original' }
                                 ],
                                 true
                             );

                             if (choice === 'settings') {
                                 log("Applying settings...", "info");

                                 // Apply Adjustments
                                 if (payload.adjustments) {
                                     state.adjustments = payload.adjustments;
                                     // Trigger LUT regeneration for Color Tuning
                                     if (typeof recalculateColorTuning === 'function') recalculateColorTuning();
                                     if (typeof updateAllAdjustmentUI === 'function') updateAllAdjustmentUI();
                                     logRestoreAdjustments(payload.adjustments);
                                 }

                                 // Apply Crop
                                 if (payload.crop) {
                                     state.cropRect = payload.crop;
                                     state.cropRotation = payload.crop.rotation || 0;
                                     updateCanvasDimensions(); // Apply crop dims
                                 }

                                 // Apply Mask (if present in merged)
                                 if (payload.mask && Array.isArray(payload.mask)) {
                                     resetMaskOnly();
                                     payload.mask.forEach(action => {
                                         applyAndLogAction(action);
                                     });
                                 }

                                 rebuildWorkingCopies(true);
                                 render();
                                 resetView();
                                 return { handled: true };
                             }

                             if (choice === null) {
                                 log("Load cancelled", "info");
                                 return { handled: true };
                             }

                             // If 'original', fall through to normal load
                         }

                         cleanImg = decodedImg;
                     }
                 } catch (e) {
                     Logger.error("[Stego] Failed to process payload", e);
                 }
             }

             return { handled: false, image: cleanImg };
        }

        async function loadLayerWithSmartSlotting(source, name) {
             bakeRotation();
             log(`Loading ${name}...`, "info");
             try {
                 const result = await resolveStegoLoad(source, name);
                 if (result.handled) return;
                 const cleanImg = result.image;

                 // 0 loaded -> Slot A (Front)
                 if (!state.imgA && !state.imgB) {
                     assignLayer(cleanImg, 'A', name);
                     return;
                 }

                 // If Both Occupied -> Ask User
                 if (state.imgA && state.imgB) {
                     const choice = await showModal(
                         "Slot Conflict",
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

                     assignLayer(cleanImg, choice, name);
                     return;
                 }

                 // 1 Loaded
                 // If A is loaded, we want New to be A. So move A to B, then New to A.
                 if (state.imgA) {
                     // Swap A to B
                     state.imgB = state.imgA; state.sourceB = state.sourceA; state.nameB = state.nameA;
                     state.thumbB = state.thumbA;
                     state.workingB = state.workingA; state.workingVersionB = state.workingVersionA;
                     // Clear A state before assigning new
                     state.imgA = null; state.sourceA = null; state.workingA = null; state.nameA = "";
                     state.thumbA = null;

                     // Update buttons for the move
                     updateLoadButton(els.btnB, truncate(state.nameB), "back");
                     els.btnB.classList.add('border-accent-strong', 'text-accent');
                     updateLoadButton(els.btnA, "Load", "front"); // Temp clear visual
                     els.btnA.classList.remove('border-accent-strong', 'text-accent');

                     // Record the implicit swap in history so replay works correctly
                     if (window.dispatchAction) dispatchAction({ type: 'SWAP_LAYERS', payload: {} });

                     // Now Load New into A
                     assignLayer(cleanImg, 'A', name);
                 } else {
                     // B is loaded. A is empty. Load into A.
                     assignLayer(cleanImg, 'A', name);
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
            body.addEventListener('drop', async (e) => {
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
                        if (state.imgA && state.imgB) {
                             const confirm = await showModal(
                                 "Overwrite All?",
                                 "Both slots are occupied. Do you want to overwrite them with the dragged images?",
                                 [{ label: "Overwrite", value: true }],
                                 true
                             );
                             if (!confirm) return;
                        }

                        // Standard load 2
                        await handleFileLoad(files[0], 'A');
                        await handleFileLoad(files[1], 'B');
                        resetView();
                    } else if (files.length === 3) {
                         // Smart Multi-Load (3 Files)
                         // Scenarios:
                         // 1. Save + Front + Back
                         // 2. Front + Back + Mask

                         // Identify files by suffix
                         const getRole = (name) => {
                             const n = name.toLowerCase();
                             if (n.includes('_save') || n.includes('_project')) return 'save';
                             if (n.includes('_mask')) return 'mask';
                             if (n.includes('_front') || n.includes('_a.') || n.includes('(a)')) return 'front';
                             if (n.includes('_back') || n.includes('_b.') || n.includes('(b)')) return 'back';
                             return 'unknown';
                         };

                         let saveFile = files.find(f => getRole(f.name) === 'save');
                         let maskFile = files.find(f => getRole(f.name) === 'mask');
                         let frontFile = files.find(f => getRole(f.name) === 'front');
                         let backFile = files.find(f => getRole(f.name) === 'back');

                         const others = files.filter(f => f !== saveFile && f !== maskFile && f !== frontFile && f !== backFile);

                         // Fill gaps in Front/Back if not explicit
                         if (!frontFile && others.length > 0) frontFile = others.shift();
                         if (!backFile && others.length > 0) backFile = others.shift();

                         // Scenario 1: Save + Front + Back
                         if (saveFile && frontFile && backFile) {
                             log("Detected Save + Front + Back drop", "info");

                             // 1. Restore Save (Automated)
                             // Use loadLayerWithSmartSlotting with autoRestore
                             await loadLayerWithSmartSlotting(saveFile, saveFile.name, { autoRestore: true });

                             // 2. Overwrite Front and Back (Automated)
                             // Use handleFileLoad (which wraps assignLayer)
                             await handleFileLoad(frontFile, 'A');
                             await handleFileLoad(backFile, 'B');

                             resetView();
                             return;
                         }

                         // Scenario 2: Front + Back + Mask
                         if (maskFile && frontFile && backFile) {
                             log("Detected Front + Back + Mask drop", "info");

                             await handleFileLoad(frontFile, 'A');
                             await handleFileLoad(backFile, 'B');

                             // Load Mask
                             const maskImg = await loadImageSource(maskFile);

                             // Update dims first
                             updateCanvasDimensions(true);

                             maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                             maskCtx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);

                             // Peek Adjustments
                             if (window.kakushi) {
                                 let adjFound = false;
                                 try {
                                     const frontImg = await loadImageSource(frontFile);
                                     const res = await window.kakushi.reveal(frontImg);
                                     if (res.secret) {
                                         const p = JSON.parse(res.secret);
                                         if (p.adjustments) {
                                             state.adjustments = p.adjustments;
                                             adjFound = true;
                                         }
                                     }
                                 } catch(e) {}

                                 if (!adjFound) {
                                     try {
                                         const backImg = await loadImageSource(backFile);
                                         const res = await window.kakushi.reveal(backImg);
                                         if (res.secret) {
                                             const p = JSON.parse(res.secret);
                                             if (p.adjustments) {
                                                 state.adjustments = p.adjustments;
                                             }
                                         }
                                     } catch(e) {}
                                 }

                                 if (typeof updateAllAdjustmentUI === 'function') updateAllAdjustmentUI();
                                 recalculateColorTuning();
                                 rebuildWorkingCopies();
                             }

                             render();
                         }
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
                 state.thumbA = null;
                 state.assetIdA = null;
                 state.nameA = ""; state.formatA = "";
                 updateLoadButton(els.btnA, "Load", "front");
                 els.btnA.classList.remove('border-accent-strong', 'text-accent');
             } else {
                 state.imgB = null; state.sourceB = null; state.workingB = null;
                 state.thumbB = null;
                 state.assetIdB = null;
                 state.nameB = ""; state.formatB = "";
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
            bindModeSwitcher();

            window.addEventListener('resize', checkResolutionOverlap);

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

            // Preview Panel Logic
            const previewPanel = document.getElementById('preview-panel-overlay');
            const previewText = document.getElementById('preview-panel-text');
            const toolbox = document.getElementById('vertical-toolbox');

            const showPreview = (slot, btn) => {
                const img = slot === 'A' ? state.imgA : state.imgB;
                if (!img) return;
                const source = slot === 'A' ? state.sourceA : state.sourceB;
                const thumb = slot === 'A' ? state.thumbA : state.thumbB;

                // Use stored thumbnail (512p) or fallback to source
                const effectiveImg = thumb || source;

                // Layout Calculation (based on Source aspect ratio)
                // Target 20% of viewport height to match CSS
                const h = Math.round(window.innerHeight * 0.2);
                const scale = h / source.height;
                const w = Math.round(source.width * scale);

                // Create display canvas containing the high-quality image
                // We use the full resolution of the thumbnail (e.g. 512p)
                // and let CSS scale it down to the target box (20vh).
                // This prevents aliasing from canvas drawImage downscaling.
                const displayCanvas = document.createElement('canvas');
                displayCanvas.width = effectiveImg.width;
                displayCanvas.height = effectiveImg.height;
                const dCtx = displayCanvas.getContext('2d');
                dCtx.drawImage(effectiveImg, 0, 0);

                // Swap image in panel
                const container = previewPanel.querySelector('.relative');
                container.innerHTML = '';

                // Force canvas to fill container exactly (CSS Scaling)
                displayCanvas.style.width = '100%';
                displayCanvas.style.height = '100%';
                displayCanvas.className = "object-contain block";
                container.appendChild(displayCanvas);

                // Enforce tight packing to prevent letterboxing
                // Add 2px to width to account for the border width of the container itself
                container.style.width = (w + 2) + 'px';
                container.style.height = (h + 2) + 'px';

                const dims = `${source.width}x${source.height}`;
                const fmt = slot === 'A' ? (state.formatA || 'IMG') : (state.formatB || 'IMG');
                previewText.textContent = `${dims} ${fmt}`;

                // Constrain text width to image width
                previewText.style.maxWidth = w + 'px';
                previewText.style.whiteSpace = 'normal';
                previewText.style.overflowWrap = 'break-word';

                previewPanel.classList.remove('hidden');

                // Calculate Position
                const btnRect = btn.getBoundingClientRect();
                const topBarEl = document.querySelector('.h-12');
                const topBarBottom = topBarEl ? topBarEl.getBoundingClientRect().bottom : 48;
                const margin = 12;

                const panelTop = topBarBottom + margin;

                // Center horizontally under button initially
                const panelRect = previewPanel.getBoundingClientRect();
                let left = btnRect.left + (btnRect.width / 2) - (panelRect.width / 2);

                // Collision Check
                if (toolbox) {
                    const toolboxRect = toolbox.getBoundingClientRect();
                    if (panelTop + panelRect.height > toolboxRect.top) {
                         if (left < toolboxRect.right + margin) {
                             left = toolboxRect.right + margin;
                         }
                    }
                }

                previewPanel.style.top = panelTop + 'px';
                previewPanel.style.left = left + 'px';
            };

            const hidePreview = () => {
                previewPanel.classList.add('hidden');
            };

            els.btnA.addEventListener('mouseenter', () => showPreview('A', els.btnA));
            els.btnA.addEventListener('mouseleave', hidePreview);
            els.btnB.addEventListener('mouseenter', () => showPreview('B', els.btnB));
            els.btnB.addEventListener('mouseleave', hidePreview);

            els.btnTrashA.addEventListener('click', () => clearLayer('A'));
            els.btnTrashB.addEventListener('click', () => clearLayer('B'));

            // Paste Handler
            window.addEventListener('paste', handlePaste);

            setupDragAndDrop();

            els.swapBtn.addEventListener('click', async () => {
                Logger.interaction("Swap Button", "clicked");

                const preFront = state.isAFront ? state.imgA : state.imgB;
                const preBack = state.isAFront ? state.imgB : state.imgA;
                Logger.info(`[Swap] Pre-Swap Resolution - Front: ${preFront ? preFront.width + 'x' + preFront.height : 'None'}, Back: ${preBack ? preBack.width + 'x' + preBack.height : 'None'}`);

                if (replayEngine) {
                    // Phase 6: Delegate Swap to ReplayEngine to ensure consistency
                    // Dispatch first to log and increment cursor
                    dispatchAction({ type: 'SWAP_LAYERS', payload: {} });

                    // Then replay to apply the action (and any previous state including crop reset)
                    await replayEngine.replayTo(window.ActionHistory.cursor);
                } else {
                    // Legacy manual swap logic
                    [state.imgA, state.imgB] = [state.imgB, state.imgA];
                    [state.sourceA, state.sourceB] = [state.sourceB, state.sourceA];
                    [state.thumbA, state.thumbB] = [state.thumbB, state.thumbA];
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
                }

                updateUI();
                render();

                const postFront = state.isAFront ? state.imgA : state.imgB;
                const postBack = state.isAFront ? state.imgB : state.imgA;
                Logger.info(`[Swap] Post-Swap Resolution - Front: ${postFront ? postFront.width + 'x' + postFront.height : 'None'}, Back: ${postBack ? postBack.width + 'x' + postBack.height : 'None'}`);

                resetView();
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
            els.newBtn.addEventListener('click', resetWorkspace);

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
            updateAllAdjustmentUI();
            updateUI();
        }

        function checkResolutionOverlap() {
            if (!els.workspaceResolution || els.workspaceResolution.style.display === 'none') return;

            // Reset to check natural position overlap
            els.workspaceResolution.style.transform = '';

            const resRect = els.workspaceResolution.getBoundingClientRect();
            if (!els.verticalToolbox) return;
            const boxRect = els.verticalToolbox.getBoundingClientRect();

            // Check vertical overlap
            // Toolbox is fixed width on left. Resolution is on left.
            const overlapsVertically = (boxRect.bottom > resRect.top) && (boxRect.top < resRect.bottom);

            if (overlapsVertically) {
                // Check horizontal overlap
                const overlapsHorizontally = (boxRect.right > resRect.left);

                if (overlapsHorizontally) {
                    els.workspaceResolution.style.transform = `translateX(${boxRect.width}px)`;
                }
            }
        }

        function updateWorkspaceLabel() {
            if (!els.workspaceResolution) return;
            if (!canDraw()) {
                els.workspaceResolution.style.display = 'none';
                return;
            }

            els.workspaceResolution.textContent = `${els.mainCanvas.width}×${els.mainCanvas.height}`;
            els.workspaceResolution.style.display = '';
            checkResolutionOverlap();
        }

        // --- Core Rendering & Helper ---
        function renderToContext(targetCtx, w, h, options = {}, arg2, arg3, arg4) {
            // Backward Compatibility: Handle positional arguments if 'options' is boolean (forceOpacity legacy)
            let opts = {};
            if (typeof options === 'boolean') {
                opts = {
                    forceOpacity: options,
                    useBakedLayers: arg2 !== undefined ? arg2 : true,
                    preferPreview: arg3 !== undefined ? arg3 : false,
                    allowRebuild: arg4 !== undefined ? arg4 : true,
                    renderBack: state.backVisible,
                    renderFront: true,
                    applyMask: state.maskVisible,
                    renderMode: 'composite'
                };
            } else {
                opts = { ...options };
            }

            // Options Normalization
            const {
                forceOpacity = false,
                useBakedLayers = true,
                preferPreview = false,
                allowRebuild = true,
                renderBack = state.backVisible,
                renderFront = true,
                applyMask = state.maskVisible,
                renderMode = 'composite' // 'composite', 'mask_alpha', 'mask_grayscale'
            } = opts;

            targetCtx.clearRect(0, 0, w, h);
            if (!state.cropRect && !state.isCropping) return;

            // Enforce adjustments visibility for nested renders
            const effectiveBaked = useBakedLayers && state.adjustmentsVisible;

            const frontLayer = state.isAFront ? getLayerForRender('A', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild }) : getLayerForRender('B', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild });
            const backLayer = state.isAFront ? getLayerForRender('B', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild }) : getLayerForRender('A', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild });
            const frontImg = frontLayer.img;
            const backImg = backLayer.img;

            const fullH = state.fullDims.h || 1;
            const fullW = state.fullDims.w || 1;

            const sX = state.isCropping ? 0 : (state.cropRect.x * fullH);
            const sY = state.isCropping ? 0 : (state.cropRect.y * fullH);
            const sW = state.isCropping ? fullW : (state.cropRect.w * fullH);
            const sH = state.isCropping ? fullH : (state.cropRect.h * fullH);

            const isRotated = state.rotation % 180 !== 0;
            const drawW = isRotated ? h : w;
            const drawH = isRotated ? w : h;

            targetCtx.save();
            applyRotation(targetCtx, w, h, state.rotation);

            // Helpers for crop rotation transform
            const useCropRotation = state.cropRotation !== 0;
            const cx = sX + sW / 2;
            const cy = sY + sH / 2;
            const dx = drawW / 2;
            const dy = drawH / 2;
            const renderScale = drawW / sW; // Assuming uniform scaling

            const applyCropTransform = (ctx) => {
                if (!useCropRotation) return false;
                ctx.save();
                ctx.translate(dx, dy);
                ctx.rotate(state.cropRotation * Math.PI / 180);
                ctx.scale(renderScale, renderScale);
                ctx.translate(-cx, -cy);
                return true;
            };

            // Special Render Modes (Mask Export)
            if (renderMode.startsWith('mask_')) {
                // Background: White
                targetCtx.fillStyle = '#FFFFFF';
                targetCtx.fillRect(0, 0, drawW, drawH);

                // Prepare Mask Source
                const maskScale = state.isPreviewing && state.previewMaskCanvas ? (state.previewMaskScale || state.fastMaskScale || 1) : 1;
                const maskSource = state.isPreviewing && state.previewMaskCanvas ? state.previewMaskCanvas : maskCanvas;

                if (maskSource.width > 0 && maskSource.height > 0) {
                    const transformed = applyCropTransform(targetCtx);

                    if (renderMode === 'mask_alpha') {
                        // Alpha Mode: Destination Out (Transparent where Masked)
                        targetCtx.globalCompositeOperation = 'destination-out';
                        if (transformed) {
                             targetCtx.drawImage(maskSource, 0, 0, maskSource.width / maskScale, maskSource.height / maskScale);
                        } else {
                             targetCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, drawW, drawH);
                        }
                    } else {
                         // Grayscale Mode: White Visible, Black Masked
                         // 1. Cut holes (Transparent) where mask exists
                         targetCtx.globalCompositeOperation = 'destination-out';
                         if (transformed) {
                             targetCtx.drawImage(maskSource, 0, 0, maskSource.width / maskScale, maskSource.height / maskScale);
                         } else {
                             targetCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, drawW, drawH);
                         }

                         if (transformed) targetCtx.restore();

                         // 2. Fill holes with Black (Behind)
                         targetCtx.globalCompositeOperation = 'destination-over';
                         targetCtx.fillStyle = '#000000';
                         targetCtx.fillRect(0, 0, drawW, drawH);
                    }
                    if (transformed && renderMode === 'mask_alpha') targetCtx.restore();
                }
                targetCtx.restore();
                return;
            }

            // Standard Composite Render

            // Draw Back
            if (backImg && renderBack) {
                targetCtx.globalAlpha = 1.0;
                targetCtx.globalCompositeOperation = 'source-over';

                const transformed = applyCropTransform(targetCtx);

                const scale = state.fullDims.h / backImg.height;
                const backW = backImg.width * scale;
                const backH = state.fullDims.h;
                const backX = (state.fullDims.w - backW) / 2;

                // If transformed: Draw Full Back Image, positioned at Union Origin
                // applyCropTransform sets origin to (0,0) of Union Space (since cX, cY are in Union Space).

                if (transformed) {
                    targetCtx.drawImage(backImg, backX, 0, backW, state.fullDims.h);
                    targetCtx.restore();
                } else {
                    const bSrcX = (sX - backX) / scale;
                    const bSrcY = sY / scale;
                    const bSrcW = sW / scale;
                    const bSrcH = sH / scale;
                    targetCtx.drawImage(backImg, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, drawW, drawH);
                }
            }

            // Draw Front
            if (frontImg && renderFront) {
                const fCtx = state.previewFrontLayer.getContext('2d');

                // Safety check for invalid dimensions before resize/draw
                if (drawW > 0 && drawH > 0) {
                    if (state.previewFrontLayer.width !== drawW || state.previewFrontLayer.height !== drawH) {
                        state.previewFrontLayer.width = drawW;
                        state.previewFrontLayer.height = drawH;
                    }

                    fCtx.clearRect(0, 0, drawW, drawH);

                    fCtx.globalCompositeOperation = 'source-over';

                    // Front Layer Transform
                    const fTransformed = applyCropTransform(fCtx);

                    const frontScale = (state.fullDims.h / frontImg.height) || 1; // Visual Scale
                    const frontVisualW = frontImg.width * frontScale;
                    const frontOffX = (state.fullDims.w - frontVisualW) / 2;

                    if (fTransformed) {
                        fCtx.drawImage(frontImg, frontOffX, 0, frontVisualW, state.fullDims.h);
                    } else {
                        const fSrcX = (sX - frontOffX) / frontScale;
                        const fSrcY = (sY - 0) / frontScale;
                        const fSrcW = sW / frontScale;
                        const fSrcH = sH / frontScale;
                        fCtx.drawImage(frontImg, fSrcX, fSrcY, fSrcW, fSrcH, 0, 0, drawW, drawH);
                    }

                    if (applyMask) {
                        fCtx.globalCompositeOperation = 'destination-out';
                        const maskScale = state.isPreviewing && state.previewMaskCanvas ? (state.previewMaskScale || state.fastMaskScale || 1) : 1;
                        const maskSource = state.isPreviewing && state.previewMaskCanvas ? state.previewMaskCanvas : maskCanvas;

                        if (maskSource.width > 0 && maskSource.height > 0) {
                            if (fTransformed) {
                                fCtx.drawImage(maskSource, 0, 0, maskSource.width / maskScale, maskSource.height / maskScale);
                            } else {
                                fCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, drawW, drawH);
                            }
                        }
                    }

                    if (fTransformed) fCtx.restore();

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

            // Helpers for crop rotation transform (Preview Scaled)
            const useCropRotation = state.cropRotation !== 0;
            const cx = sX + sW / 2;
            const cy = sY + sH / 2;
            const dx = pDrawW / 2;
            const dy = pDrawH / 2;
            const renderScale = pDrawW / sW;

            // Apply CSS rotation for display, Context rotation for export
            if (useCropRotation && !finalOutput && state.isCropping) {
                els.previewCanvas.style.transform = `rotate(${state.cropRotation}deg)`;
            } else {
                els.previewCanvas.style.transform = '';
            }

            const applyPreviewCropTransform = (ctx) => {
                // If not final output (display), skip context rotation because we use CSS
                if (!useCropRotation) return false;
                if (!finalOutput && state.isCropping) return false;

                ctx.save();
                ctx.translate(dx, dy);
                ctx.rotate(state.cropRotation * Math.PI / 180);
                ctx.scale(renderScale, renderScale);
                ctx.translate(-cx, -cy);
                return true;
            };

                // Modified export logic: Only render back if state.backVisible is true
                const shouldRenderBack = backImg && state.backVisible;
                if (shouldRenderBack) {
                    pCtx.globalAlpha = 1.0;
                    pCtx.globalCompositeOperation = 'source-over';

                const transformed = applyPreviewCropTransform(pCtx);

                    const scale = state.fullDims.h / backImg.height;
                    const backW = backImg.width * scale;
                    const backH = state.fullDims.h;
                    const backX = (state.fullDims.w - backW) / 2;

                if (transformed) {
                     pCtx.drawImage(backImg, backX, 0, backW, backH);
                     pCtx.restore();
                } else {
                    const bSrcX = (sX - backX) / scale;
                    const bSrcY = sY / scale;
                    const bSrcW = sW / scale;
                    const bSrcH = sH / scale;
                    pCtx.drawImage(backImg, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, pDrawW, pDrawH);
                }
                }

                if (frontImg) {
                    if (frontLayerCanvas.width !== pDrawW || frontLayerCanvas.height !== pDrawH) {
                        frontLayerCanvas.width = pDrawW;
                        frontLayerCanvas.height = pDrawH;
                    }
                    frontLayerCtx.clearRect(0, 0, pDrawW, pDrawH);
                    frontLayerCtx.globalCompositeOperation = 'source-over';

                const fTransformed = applyPreviewCropTransform(frontLayerCtx);

                    // Fast Preview: Map Union-Space Crop to Source/Buffer Coordinates
                    // frontImg might be Source (Full Res) or Buffer (Downscaled)

                    // 1. Calculate Offsets in Union Space
                    // We assume heights match (Scaling Logic)
                    // Visual Scale of Front Image relative to Union Height
                    // Note: If frontImg IS the buffer, frontLayer.scale is Source->Buffer ratio.
                    // We need Truth->Buffer ratio.

                    // Visual Height of Front Image (in Truth Space) should match fullDims.h (Union H).
                    // But Source might be smaller/larger.
                    // If Source is A. Buffer is B = A * bufScale.
                    // Truth T = A * (UnionH / A.h).
                    // So B = T * (A.h / UnionH) * bufScale.
                    // And A.h * bufScale = B.h (Buffer Height).
                    // So B = T * (B.h / UnionH).

                    const truthToBufferScale = frontImg.height / state.fullDims.h;

                    // Calculate Visual Width in Truth Space
                    // VisualW = BufferW / truthToBufferScale
                    const frontVisualW = frontImg.width / truthToBufferScale;
                    const frontOffX = (state.fullDims.w - frontVisualW) / 2;

                if (fTransformed) {
                     frontLayerCtx.drawImage(frontImg, frontOffX, 0, frontVisualW, state.fullDims.h);
                } else {
                    // 2. Map Crop Rect (sX...) to Buffer Source Rect
                    const fSrcX = (sX - frontOffX) * truthToBufferScale;
                    const fSrcY = (sY - 0) * truthToBufferScale; // Aligned Top
                    const fSrcW = sW * truthToBufferScale;
                    const fSrcH = sH * truthToBufferScale;

                    frontLayerCtx.drawImage(frontImg, fSrcX, fSrcY, fSrcW, fSrcH, 0, 0, pDrawW, pDrawH);
                }

                    let maskSource = maskCanvas;
                    if (state.isPreviewing && state.previewMaskCanvas) {
                        maskSource = state.previewMaskCanvas;
                    }

                    if (state.maskVisible) {
                        frontLayerCtx.globalCompositeOperation = 'destination-out';
                    if (fTransformed) {
                         frontLayerCtx.drawImage(maskSource, 0, 0, maskSource.width / maskScale, maskSource.height / maskScale);
                    } else {
                         frontLayerCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, pDrawW, pDrawH);
                    }
                    }

                if (fTransformed) frontLayerCtx.restore();

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

                // Helpers for crop rotation transform
                const useCropRotation = state.cropRotation !== 0;
                const cx = sX + sW / 2;
                const cy = sY + sH / 2;
                const dx = drawW / 2;
                const dy = drawH / 2;
                const renderScale = drawW / sW;

                // Apply CSS rotation for display, Context rotation for export
                if (useCropRotation && !finalOutput && state.isCropping) {
                    els.mainCanvas.style.transform = `rotate(${state.cropRotation}deg)`;
                } else {
                    els.mainCanvas.style.transform = '';
                }

                const applyCropTransform = (c) => {
                    // If not final output (display), skip context rotation because we use CSS
                    if (!useCropRotation) return false;
                    if (!finalOutput && state.isCropping) return false;

                    c.save();
                    c.translate(dx, dy);
                    c.rotate(state.cropRotation * Math.PI / 180);
                    c.scale(renderScale, renderScale);
                    c.translate(-cx, -cy);
                    return true;
                };

                // 1. Draw Back
                // Modified export logic: Only render back if state.backVisible is true
                const shouldRenderBack = backImg && state.backVisible;

                if (shouldRenderBack) {
                    ctx.globalAlpha = 1.0;
                    ctx.globalCompositeOperation = 'source-over';

                    const transformed = applyCropTransform(ctx);

                    const scale = state.fullDims.h / backImg.height;
                    const backW = backImg.width * scale;
                    const backH = state.fullDims.h;
                    const backX = (state.fullDims.w - backW) / 2;

                    if (transformed) {
                        ctx.drawImage(backImg, backX, 0, backW, backH);
                        ctx.restore();
                    } else {
                        // Mapping crop rect to back image source rect
                        const bSrcX = (sX - backX) / scale;
                        const bSrcY = sY / scale;
                        const bSrcW = sW / scale;
                        const bSrcH = sH / scale;
                        ctx.drawImage(backImg, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, drawW, drawH);
                    }
                }

                // 2. Prepare Front Layer
                if (frontImg) {
                    if (frontLayerCanvas.width !== drawW || frontLayerCanvas.height !== drawH) {
                        frontLayerCanvas.width = drawW;
                        frontLayerCanvas.height = drawH;
                    }
                    frontLayerCtx.clearRect(0, 0, drawW, drawH);
                    frontLayerCtx.globalCompositeOperation = 'source-over';

                    const fTransformed = applyCropTransform(frontLayerCtx);

                    // Render Front Image Centered in Union Dims
                    const frontScale = (state.fullDims.h / frontImg.height) || 1;
                    const frontVisualW = frontImg.width * frontScale;
                    const frontOffX = (state.fullDims.w - frontVisualW) / 2;

                    if (fTransformed) {
                         frontLayerCtx.drawImage(frontImg, frontOffX, 0, frontVisualW, state.fullDims.h);
                    } else {
                        // Map Crop Rect (sX...sH) to Front Image Source
                        // sX/Y are in Union Pixels.
                        const fSrcX = (sX - frontOffX) / frontScale;
                        const fSrcY = (sY - 0) / frontScale;
                        const fSrcW = sW / frontScale;
                        const fSrcH = sH / frontScale;
                        frontLayerCtx.drawImage(frontImg, fSrcX, fSrcY, fSrcW, fSrcH, 0, 0, drawW, drawH);
                    }

                    let maskSource = maskCanvas;
                    if (state.isPreviewing && state.previewMaskCanvas) {
                        maskSource = state.previewMaskCanvas;
                    }

                    if (state.maskVisible) {
                        frontLayerCtx.globalCompositeOperation = 'destination-out';
                        if (fTransformed) {
                             frontLayerCtx.drawImage(maskSource, 0, 0, maskSource.width / maskScale, maskSource.height / maskScale);
                        } else {
                             frontLayerCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, drawW, drawH);
                        }
                    }

                    if (fTransformed) frontLayerCtx.restore();

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

                // 1. Base Visual Rotation (0, 90, 180, 270)
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

                // 2. Free Rotation Adjustment (Visual Coordinates)
                // If rotated, the crop box needs to be positioned such that its center
                // matches the visual center of the rotated Truth Rect.
                if (state.cropRotation !== 0) {
                    // Center of Base Visual
                    const cx = vx + vw / 2;
                    const cy = vy + vh / 2;

                    const isRotated = state.rotation % 180 !== 0;
                    const visualFullW = isRotated ? truthH : truthW;
                    const visualFullH = isRotated ? truthW : truthH;
                    const canvasCx = visualFullW / 2;
                    const canvasCy = visualFullH / 2;

                    // Rotate this center point around canvas center
                    const rad = state.cropRotation * Math.PI / 180;
                    const s = Math.sin(rad);
                    const c = Math.cos(rad);
                    const dx = cx - canvasCx;
                    const dy = cy - canvasCy;
                    const newCx = canvasCx + (dx * c - dy * s);
                    const newCy = canvasCy + (dx * s + dy * c);

                    vx = newCx - vw / 2;
                    vy = newCy - vh / 2;
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
            trimCropRectToImageBounds();
            const finalRect = { ...state.cropRect };
            toggleCropMode({ applyAutoTrim: false });
            if (window.dispatchAction) dispatchAction({ type: 'CROP', payload: { rect: finalRect } });
        }

        function cancelCrop() {
            if (!state.isCropping) return;
            if (state.cropRectSnapshot) {
                state.cropRect = { ...state.cropRectSnapshot };
            }
            state.cropRectSnapshot = null;
            state.cropDrag = null;
            toggleCropMode({ applyAutoTrim: false });
        }

        function toggleCropMode({ applyAutoTrim = true } = {}) {
            if (!canDraw()) return;

            // Remove clamping logic to allow cropRect to be outside bounds (e.g. for rotated composition)
            // Sanity check only for zero dimensions
            if (!state.isCropping && state.cropRect) {
                state.cropRect.w = Math.max(0.001, state.cropRect.w);
                state.cropRect.h = Math.max(0.001, state.cropRect.h);
            }

            state.isCropping = !state.isCropping;
            
            if (state.isCropping) {
                if (state.cropRect) {
                    const r = state.cropRect;
                    Logger.info(`Crop mode entered: x=${r.x.toFixed(4)}, y=${r.y.toFixed(4)}, w=${r.w.toFixed(4)}, h=${r.h.toFixed(4)}`);
                }
                state.cropRectSnapshot = state.cropRect ? { ...state.cropRect } : null;
                els.cropBtn.classList.add('active', 'text-yellow-400');
                updateCanvasDimensions(true);
                els.viewport.classList.add('cropping');

                // Toggle legends
                const stdLegend = document.getElementById('hint-legend');
                const cropLegend = document.getElementById('crop-hint-legend');
                if (stdLegend) stdLegend.style.display = 'none';
                if (cropLegend) {
                    cropLegend.style.display = '';
                    cropLegend.style.opacity = '1';
                }
            } else {
                if (applyAutoTrim) {
                    trimCropRectToImageBounds();
                }
                state.cropRectSnapshot = null;
                els.cropBtn.classList.remove('active', 'text-yellow-400');
                updateCanvasDimensions(true);
                els.viewport.classList.remove('cropping');
                if (state.cropRect) {
                    const r = state.cropRect;
                    Logger.info(`Crop mode exited: x=${r.x.toFixed(4)}, y=${r.y.toFixed(4)}, w=${r.w.toFixed(4)}, h=${r.h.toFixed(4)}`);
                }

                // Toggle legends
                const stdLegend = document.getElementById('hint-legend');
                const cropLegend = document.getElementById('crop-hint-legend');
                if (stdLegend) stdLegend.style.display = '';
                if (cropLegend) cropLegend.style.display = 'none';
            }
            resetView();
            render();
            updateUI(); // disable other tools
        }

        function trimCropRectToImageBounds() {
            if (!state.cropRect) return;
            const fullH = state.fullDims.h || 0;
            const fullW = state.fullDims.w || 0;
            if (!fullW || !fullH) return;

            const cropRectPx = {
                x: state.cropRect.x * fullH,
                y: state.cropRect.y * fullH,
                w: state.cropRect.w * fullH,
                h: state.cropRect.h * fullH
            };
            const baseRotation = state.rotation;
            const isBaseRotated = baseRotation % 180 !== 0;
            const visualFullW = isBaseRotated ? fullH : fullW;
            const visualFullH = isBaseRotated ? fullW : fullH;
            const visualCx = visualFullW / 2;
            const visualCy = visualFullH / 2;

            const corners = [
                { x: 0, y: 0 },
                { x: fullW, y: 0 },
                { x: fullW, y: fullH },
                { x: 0, y: fullH }
            ].map((corner) => {
                const base = truthToVisualPoint(corner, baseRotation, fullW, fullH);
                return rotatePoint(base, visualCx, visualCy, state.cropRotation);
            });

            let minX = corners[0].x;
            let maxX = corners[0].x;
            let minY = corners[0].y;
            let maxY = corners[0].y;
            for (let i = 1; i < corners.length; i++) {
                minX = Math.min(minX, corners[i].x);
                maxX = Math.max(maxX, corners[i].x);
                minY = Math.min(minY, corners[i].y);
                maxY = Math.max(maxY, corners[i].y);
            }

            const cropCx = cropRectPx.x + cropRectPx.w / 2;
            const cropCy = cropRectPx.y + cropRectPx.h / 2;
            const baseCenter = truthToVisualPoint({ x: cropCx, y: cropCy }, baseRotation, fullW, fullH);
            const visualCenter = rotatePoint(baseCenter, visualCx, visualCy, state.cropRotation);

            const visualW = isBaseRotated ? cropRectPx.h : cropRectPx.w;
            const visualH = isBaseRotated ? cropRectPx.w : cropRectPx.h;
            const visualRect = {
                x: visualCenter.x - visualW / 2,
                y: visualCenter.y - visualH / 2,
                w: visualW,
                h: visualH
            };

            const cropMinX = visualRect.x;
            const cropMaxX = visualRect.x + visualRect.w;
            const cropMinY = visualRect.y;
            const cropMaxY = visualRect.y + visualRect.h;
            const epsilon = 0.25;

            let newMinX = cropMinX;
            let newMaxX = cropMaxX;
            let newMinY = cropMinY;
            let newMaxY = cropMaxY;

            if (cropMinX < minX - epsilon) newMinX = minX;
            if (cropMaxX > maxX + epsilon) newMaxX = maxX;
            if (cropMinY < minY - epsilon) newMinY = minY;
            if (cropMaxY > maxY + epsilon) newMaxY = maxY;

            const newW = Math.max(0.001, newMaxX - newMinX);
            const newH = Math.max(0.001, newMaxY - newMinY);
            const newVisualCenter = { x: newMinX + newW / 2, y: newMinY + newH / 2 };
            const baseCenterOut = rotatePoint(newVisualCenter, visualCx, visualCy, -state.cropRotation);
            const newTruthCenter = visualToTruthPoint(baseCenterOut, baseRotation, fullW, fullH);

            const truthW = isBaseRotated ? newH : newW;
            const truthH = isBaseRotated ? newW : newH;

            state.cropRect = {
                x: (newTruthCenter.x - truthW / 2) / fullH,
                y: (newTruthCenter.y - truthH / 2) / fullH,
                w: truthW / fullH,
                h: truthH / fullH
            };
        }

        function resizeMainCanvas(w, h) {
            els.mainCanvas.width = w;
            els.mainCanvas.height = h;
            frontLayerCanvas.width = w;
            frontLayerCanvas.height = h;
            updateWorkspaceLabel();
        }

        // --- Standard App Functions ---
        
        function getActionDescription(type) {
            const map = {
                'LOAD_IMAGE': 'Load Image',
                'MERGE_LAYERS': 'Merge Layers',
                'APPLY_CENSOR': 'Censor',
                'SWAP_LAYERS': 'Swap Layers',
                'STROKE': 'Brushstroke',
                'POLYLINE': 'Polyline',
                'CROP': 'Crop',
                'ROTATE_VIEW': 'Rotate',
                'ADJUST': 'Adjustment',
                'TUNE_COLOR': 'Color Tuning',
                'CLEAR_LAYER': 'Clear Layer',
                'RESET_ALL': 'Reset All',
                'RESET_ADJUSTMENTS': 'Reset Adjustments',
                'RESET_LEVELS': 'Reset Levels',
                'RESET_SATURATION': 'Reset Saturation',
                'RESET_COLOR_BALANCE': 'Reset Color Balance',
                'RESET_TUNING_BAND': 'Reset Band',
                'RESET_TUNING_ALL': 'Reset All Tuning',
                'SET_OPACITY': 'Opacity Change',
                'RESTORE_ADJUSTMENTS': 'Restore Adjustments',
                'TOGGLE_MASK': 'Toggle Mask',
                'TOGGLE_BACK': 'Toggle Back Layer',
                'TOGGLE_ADJUSTMENTS': 'Toggle Adjustments'
            };
            return map[type] || type;
        }

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
            if (replayEngine && Number.isInteger(replayEngine.undoFloor)) {
                minCursor = Math.max(minCursor, replayEngine.undoFloor);
            }

            const canUndo = cursor > minCursor && !state.isCropping;
            const canRedo = cursor < total - 1 && !state.isCropping;
            els.undoBtn.disabled = !canUndo;
            els.redoBtn.disabled = !canRedo;

            if (canUndo) {
                const action = history[cursor];
                els.undoBtn.title = `Undo ${getActionDescription(action.type)}`;
            } else {
                els.undoBtn.title = "Undo";
            }

            if (canRedo) {
                const action = history[cursor + 1];
                els.redoBtn.title = `Redo ${getActionDescription(action.type)}`;
            } else {
                els.redoBtn.title = "Redo";
            }

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
            } else {
                 els.eraseMode.disabled = false;
                 els.repairMode.disabled = false;
                 els.patchMode.disabled = false;
                 els.brushSize.disabled = false;
            }

            const swapEnabled = state.imgA || state.imgB;
            els.swapBtn.disabled = !swapEnabled;
            
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
            syncBrushUIToActive();
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
                sizePercent: Number((state.brushSize * 100).toFixed(1)),
                hardnessPercent: hardness,
                featherMode: state.featherMode
            });
        }

        function loadImageSource(source) {
            return new Promise((resolve, reject) => {
                if (source instanceof Blob) {
                    if (window.Logger) Logger.info(`[LoadImageSource] Loading Blob: ${source.type}, ${source.size} bytes`);
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
             // Check if this is the first image being loaded (both slots previously empty)
             const wasEmpty = !state.imgA && !state.imgB;

             let assetId = null;
             if (window.AssetManager) {
                 assetId = window.AssetManager.addAsset(img, name);
             }
             if (slot === 'A') state.assetIdA = assetId;
             else state.assetIdB = assetId;

             // Extract Format
             const format = (name && name.includes('.')) ? name.split('.').pop().toUpperCase() : 'PNG';

             Logger.info(`Assigning Image to ${slot}: ${img.width}x${img.height} (Asset: ${assetId})`);
             if (slot === 'A') {
                setLayerSource('A', img);
                state.nameA = name;
                state.formatA = format;
                updateLoadButton(els.btnA, truncate(name), "front");
                els.btnA.classList.add('border-accent-strong', 'text-accent');
             } else {
                setLayerSource('B', img);
                state.nameB = name;
                state.formatB = format;
                updateLoadButton(els.btnB, truncate(name), "back");
                els.btnB.classList.add('border-accent-strong', 'text-accent');
             }
             markAdjustmentsDirty();
             rebuildWorkingCopies();

             // Update Full Dims first
             const union = getUnionDims(state.imgA, state.imgB);
             state.fullDims = { w: union.w, h: union.h };

             // Frame Front Image (Preference)
             const frontImg = state.imgA || state.imgB; // Prefer A, fallback B
             if (frontImg) {
                 const h = frontImg.height || 1;
                 const scale = (state.fullDims.h / h) || 1;
                 const visW = frontImg.width * scale;
                 const offX = (state.fullDims.w - visW) / 2;

                 const propX = offX / state.fullDims.h;
                 const propW = visW / state.fullDims.h;

                 state.cropRect = { x: propX, y: 0, w: propW, h: 1.0 };
             }

             updateCanvasDimensions(true); // Preserve view state initially

             // Auto-Fit Logic
             // Requirement: Auto-fit if first load OR if current view is "more zoomed in" than auto-fit would be.
             const vpW = els.viewport.clientWidth;
             const vpH = els.viewport.clientHeight;
             const cW = els.mainCanvas.width;
             const cH = els.mainCanvas.height;

             // Calculate Fit Scale (matching resetView logic with 40px padding)
             const fitScale = Math.min((vpW - 40) / cW, (vpH - 40) / cH);

             // If we were empty, we should fit.
             // If we are currently zoomed in more than the fit scale (scale > fitScale), we should fit.
             if (wasEmpty || state.view.scale > fitScale) {
                 resetView();
             }

             render();
             updateUI();

             if (window.dispatchAction) dispatchAction({ type: 'LOAD_IMAGE', payload: { slot, name, width: img.width, height: img.height, assetId } });
        }

        function handleFileLoad(file, slot) {
            if (!file) return Promise.resolve();
            bakeRotation();
            log(`Loading ${file.name}...`, "info");
            Logger.info(`Loading file into Slot ${slot}: ${file.name} (${file.size} bytes)`);

            return resolveStegoLoad(file, file.name)
                .then(result => {
                    if (result.handled) return;
                    assignLayer(result.image, slot, file.name);
                })
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

        // Helper to calculate Union Dimensions of the composition
        function getUnionDims(imgA, imgB) {
            if (!imgA && !imgB) return { w: 0, h: 0 };
            if (!imgA) return { w: imgB.width, h: imgB.height };
            if (!imgB) return { w: imgA.width, h: imgA.height };

            // Height Match Strategy: Union Height is max height
            const unionH = Math.max(imgA.height, imgB.height);

            // Scale widths based on matching heights
            const scaleA = unionH / imgA.height;
            const scaleB = unionH / imgB.height;

            const visWA = imgA.width * scaleA;
            const visWB = imgB.width * scaleB;

            const unionW = Math.max(visWA, visWB);
            return { w: Math.round(unionW), h: unionH };
        }

        // Helper to resize mask preserving centered content
        function resizeMaskCanvas(newW, newH) {
            if (maskCanvas.width === newW && maskCanvas.height === newH) return;

            const oldW = maskCanvas.width;
            const oldH = maskCanvas.height;

            // Snapshot old mask
            const temp = document.createElement('canvas');
            temp.width = oldW;
            temp.height = oldH;
            temp.getContext('2d').drawImage(maskCanvas, 0, 0);

            // Resize
            maskCanvas.width = newW;
            maskCanvas.height = newH;

            // Draw centered
            // Assuming Height matches (or scales uniformly)
            // Vertical scale:
            const sY = newH / oldH;
            const sX = sY; // Maintain aspect

            const projW = oldW * sX;
            // Center horizontally
            const offX = (newW - projW) / 2;

            maskCtx.clearRect(0, 0, newW, newH);
            maskCtx.drawImage(temp, 0, 0, oldW, oldH, offX, 0, projW, newH);
        }

        function updateCanvasDimensions(preserveView = false, preserveMask = false) {
            if (!state.imgA && !state.imgB) return;
            
            const union = getUnionDims(state.imgA, state.imgB);
            const targetW = union.w;
            const targetH = union.h;

            // Check if dims changed
            if (state.fullDims.w !== targetW || state.fullDims.h !== targetH || maskCanvas.width !== targetW || maskCanvas.height !== targetH) {
                // If mask needs resize, do it with preservation if requested OR if standard flow
                // Note: preserveMask arg usually prevents HISTORY reset.
                // But we must preserve PIXELS if resizing due to Union change.
                if (maskCanvas.width > 0 && maskCanvas.height > 0) {
                     resizeMaskCanvas(targetW, targetH);
                } else {
                     maskCanvas.width = targetW;
                     maskCanvas.height = targetH;
                }
            }

            // Set Full Dims
            state.fullDims = { w: targetW, h: targetH };
            if (!preserveView || !state.cropRect) {
                 // Default Crop is Full Image.
                 // In Proportions: x=0, y=0, w=Aspect, h=1
                 state.cropRect = { x: 0, y: 0, w: targetW / targetH, h: 1.0 };
            }

            if (!preserveMask) {
                // Legacy: Only clear history if requested (e.g. New Load)
                // Note: maskCanvas already resized/preserved above
                if (state.history.length > 0) resetMaskAndHistory();
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

                 // Register Base Image
                 let baseId = null;
                 if (window.AssetManager) {
                     baseId = window.AssetManager.addAsset(imgBase, "Base Layer");
                 }
                 state.assetIdA = baseId;

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

                 // Reset crop rotation after bake
                 state.cropRotation = 0;

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
                 if (window.dispatchAction) dispatchAction({ type: 'APPLY_CENSOR', payload: { assetId, baseId } });
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

                // Reset crop rotation after bake
                state.cropRotation = 0;

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

        async function saveImage() {
            if (!state.imgA && !state.imgB) return;
            bakeRotation();
            Logger.info("Exporting image...");

            // Export Settings
            const format = state.settings.exportFormat || 'image/png'; // 'image/jpeg', 'image/png', 'image/webp'
            const quality = (state.settings.exportQuality || 98) / 100;
            const heightCap = state.settings.exportHeightCap || 'Full';
            const layers = state.settings.exportLayers || { merged: true };

            const pad = (n) => n.toString().padStart(2, '0');
            const now = new Date();
            const timeString = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

            // File Extension
            let ext = 'png';
            if (format === 'image/jpeg') ext = 'jpg';
            else if (format === 'image/webp') ext = 'webp';

            // --- Dimension Calculation ---
            // We need to calculate two sets of dimensions:
            // 1. Standard Dims: Based on User Crop + Height Cap
            // 2. Project Dims: Based on Full Union Dims (Uncropped, Full Res)

            const fullH = state.fullDims.h || 1;
            const fullW = state.fullDims.w || 1;
            const isRotated = state.rotation % 180 !== 0;

            // 1. Standard (User View)
            const userCropRect = state.cropRect ? { ...state.cropRect } : { x: 0, y: 0, w: fullW / fullH, h: 1.0 };
            const truthW = Math.round(userCropRect.w * fullH);
            const truthH = Math.round(userCropRect.h * fullH);
            const stdUnscaledW = isRotated ? truthH : truthW;
            const stdUnscaledH = isRotated ? truthW : truthH;

            let stdW = stdUnscaledW;
            let stdH = stdUnscaledH;

            // Apply Height Cap to Standard
            if (heightCap !== 'Full') {
                const cap = parseInt(heightCap);
                if (stdH > cap) {
                    const scale = cap / stdH;
                    stdW = Math.round(stdW * scale);
                    stdH = Math.round(stdH * scale);
                }
            }

            // 2. Project (Full Source)
            // Union Dims, Uncropped.
            // If rotated, output dims are swapped.
            const projW = isRotated ? fullH : fullW;
            const projH = isRotated ? fullW : fullH;
            const projRect = { x: 0, y: 0, w: fullW / fullH, h: 1.0 };

            // Determine Standard Res Suffix
            let stdResTag = '';
            if (heightCap === 'Full') stdResTag = 'full';
            else if (heightCap === 4320) stdResTag = '8k';
            else if (heightCap === 2160) stdResTag = '4k';
            else if (heightCap === 1080) stdResTag = 'hd';
            else stdResTag = heightCap + 'p';

            // Prepare Temporary Canvas
            const exportCanvas = document.createElement('canvas');
            const expCtx = exportCanvas.getContext('2d');

            // Queue of exports
            const jobs = [];
            if (layers.merged) jobs.push({ type: 'merged', suffix: '_merged' });
            if (layers.save)   jobs.push({ type: 'save',   suffix: '_save' });
            if (layers.mask)   jobs.push({ type: 'mask',   suffix: '_mask' });
            if (layers.front)  jobs.push({ type: 'front',  suffix: '_front' });
            if (layers.back)   jobs.push({ type: 'back',   suffix: '_back' });

            // If nothing selected (shouldn't happen with defaults, but safety)
            if (jobs.length === 0) jobs.push({ type: 'merged', suffix: '_merged' });

            // State Management for Export
            const wasCropping = state.isCropping;
            state.isCropping = false; // Drive via cropRect

            scheduleHeavyTask(async () => {
             try {
                for (const job of jobs) {
                    // Config for this job
                    let targetW, targetH, currentResTag;
                    const originalRotation = state.cropRotation; // Capture

                    if (job.type === 'save') {
                        targetW = projW;
                        targetH = projH;
                        state.cropRect = projRect;
                        state.cropRotation = 0; // Disable rotation for save to preserve raw pixels
                        currentResTag = 'full';
                    } else {
                        targetW = stdW;
                        targetH = stdH;
                        state.cropRect = userCropRect;
                        // state.cropRotation remains active for baked exports
                        currentResTag = stdResTag;
                    }

                    const filename = `${timeString}${job.suffix}_${currentResTag}.${ext}`;

                    // Resize Canvas
                    if (exportCanvas.width !== targetW || exportCanvas.height !== targetH) {
                        exportCanvas.width = targetW;
                        exportCanvas.height = targetH;
                    }

                    // Configure Render Options
                    const options = {
                        forceOpacity: true,
                        useBakedLayers: true,
                        preferPreview: false,
                        allowRebuild: true,
                        renderBack: false,
                        renderFront: false,
                        applyMask: false,
                        renderMode: 'composite'
                    };

                    if (job.type === 'save') {
                        // Project Save: Unbaked Adjustments (so they can be restored via metadata)
                        options.useBakedLayers = false;
                        options.renderBack = state.backVisible;
                        options.renderFront = true;
                        options.applyMask = false; // Do NOT bake mask into pixels. Mask is saved in metadata.

                        // Censor Project Special Case:
                        // If it is a Censor project (Back layer is 'Censored Layer'), the 'Save' export
                        // should strictly export the BASE LAYER (Slot A) pixels only.
                        // This allows full reconstruction (Base + Metadata -> Generate Censor -> Replay Mask).
                        // If we export the Merged view, we lose the clean Base under the blur.
                        if (state.nameB === "Censored Layer") {
                            options.renderBack = false; // Disable Censor Layer
                            options.renderFront = true; // Base Layer
                            options.applyMask = false;  // Raw Base (No holes)
                        }
                    } else if (job.type === 'merged') {
                        options.renderBack = state.backVisible;
                        options.renderFront = true;
                        options.applyMask = state.maskVisible;
                    } else if (job.type === 'front') {
                        options.renderFront = true;
                        // "If Mask Export is OFF, apply mask to Front. If Mask Export is ON, export front intact."
                        if (layers.mask) options.applyMask = false;
                        else options.applyMask = true;
                    } else if (job.type === 'back') {
                        options.renderBack = true;
                    } else if (job.type === 'mask') {
                         if (format === 'image/jpeg') options.renderMode = 'mask_grayscale';
                         else options.renderMode = 'mask_alpha';
                    }

                    // Render
                    renderToContext(expCtx, targetW, targetH, options);

                    // Restore User Crop & Rotation IMMEDIATELY after render, so metadata (assembled next) is correct
                    if (job.type === 'save') {
                        state.cropRect = userCropRect;
                        state.cropRotation = originalRotation;
                    }

                    // Steganography Stamping (PNG Only)
                    let finalCanvas = exportCanvas;
                    if (format === 'image/png' && window.Stego && window.kakushi) {
                         try {
                             const payload = window.Stego.assemblePayload(state, window.ActionHistory, job.type);
                             const watermarkMask = job.type === 'save' && window.Watermark?.buildMask
                                 ? window.Watermark.buildMask(exportCanvas.width, exportCanvas.height)
                                 : null;

                             // Watermark Injection for Save Files
                             if (job.type === 'save' && window.Watermark) {
                                 payload.watermarked = true;
                             }

                             if (payload) {
                                 const json = JSON.stringify(payload);
                                 finalCanvas = await window.kakushi.seal(exportCanvas, json, {
                                     mask: watermarkMask ? watermarkMask.data : null
                                 });
                                 Logger.info(`[Stego] Stamped ${job.type} payload (${json.length} chars)`);

                                 // Apply Visible Watermark (Reversible)
                                 // We apply this AFTER sealing so the stego data is buried in the pixels,
                                 // and the watermark inverts those pixels (MSB+LSB).
                                 // Restoration requires reversing watermark -> then reading stego.
                                 if (job.type === 'save' && window.Watermark) {
                                     const wCtx = finalCanvas.getContext('2d');
                                     window.Watermark.apply(wCtx, finalCanvas.width, finalCanvas.height);
                                     Logger.info(`[Watermark] Applied reversible watermark to save file`);
                                 }
                             }
                         } catch (err) {
                             Logger.error("[Stego] Failed to stamp image", err);
                             finalCanvas = exportCanvas;
                         }
                    }

                    // Blob & Download
                    await new Promise(resolve => {
                        finalCanvas.toBlob(blob => {
                            if (blob) {
                                const link = document.createElement('a');
                                link.download = filename;
                                link.href = URL.createObjectURL(blob);
                                link.click();
                                setTimeout(() => {
                                    URL.revokeObjectURL(link.href);
                                    resolve();
                                }, 100);
                            } else {
                                resolve();
                            }
                        }, format, quality);
                    });
                }

                log("Export complete", "info");
                Logger.info(`Export Batch Complete: ${jobs.map(j => j.suffix).join(', ')}`);

             } catch (e) {
                log("Save failed: " + e.message);
                Logger.error("Export Failed", e);
             } finally {
                // Restore Global State
                state.isCropping = wasCropping;
                state.cropRect = userCropRect;
             }
            });
        }

        async function resetWorkspace() {
            const confirm = await showModal("New Edit", "This will clear your canvas and edits. Are you sure?", [
                { label: "Start New Edit", value: true }
            ], true);

            if (!confirm) return;

            log("Resetting workspace...", "info");

            // 1. Clear Images & Cache
            state.imgA = null; state.sourceA = null; state.workingA = null; state.previewWorkingA = null;
            state.imgB = null; state.sourceB = null; state.workingB = null; state.previewWorkingB = null;
            state.thumbA = null; state.thumbB = null;
            state.assetIdA = null; state.assetIdB = null;
            state.nameA = ""; state.nameB = ""; state.formatA = ""; state.formatB = "";
            state.isAFront = true;
            state.opacity = 0.8;
            els.opacitySlider.value = 80;
            els.opacityVal.textContent = "80%";

            // 2. Clear History
            state.history = [];
            state.historyIndex = -1;
            if (replayEngine && replayEngine.clear) replayEngine.clear();
            // Also need to clear global ActionHistory
            if (window.ActionHistory) {
                window.ActionHistory.actions = [];
                window.ActionHistory.cursor = -1;
            }

            // 3. Reset Adjustments
            resetAllAdjustments();

            // 4. Reset Modes & Tools
            setMode('erase');
            setFeatherMode(false);

            // 5. Exit Crop
            if (state.isCropping) {
                state.isCropping = false;
                state.cropRect = null;
                state.cropRectSnapshot = null;
                state.cropDrag = null;
                els.cropBtn.classList.remove('active', 'text-yellow-400');
                els.viewport.classList.remove('cropping');
            }
            state.cropRect = null;
            state.fullDims = { w: 0, h: 0 }; // Reset dims too

            // 6. Reset Toggles
            state.maskVisible = true;
            state.backVisible = true;
            state.adjustmentsVisible = true;

            // 7. Reset Mask
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

            // 8. Reset View
            resetView();
            state.rotation = 0;
            state.cropRotation = 0;

            // 9. Update UI
            updateVisibilityToggles();
            updateUI();
            els.mainCanvas.classList.add('hidden');
            els.emptyState.style.display = '';
            els.viewport.classList.add('disabled');
            updateWorkspaceLabel();

            log("Workspace cleared.", "info");
        }

        init();
    
