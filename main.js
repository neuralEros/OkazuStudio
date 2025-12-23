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

        const DEFAULT_ERASE_BRUSH = 10;
        const DEFAULT_FEATHER = 1;
        const DEFAULT_FEATHER_PX = 5;
        const DEFAULT_REPAIR_BRUSH = DEFAULT_ERASE_BRUSH / 2;

        const state = {
            imgA: null, imgB: null, nameA: '', nameB: '', isAFront: true,
            opacity: 0.8, brushPercent: DEFAULT_ERASE_BRUSH, feather: DEFAULT_FEATHER, featherPx: DEFAULT_FEATHER_PX, featherMode: false, isErasing: true, isDrawing: false,
            maskVisible: true, backVisible: true, history: [], historyIndex: -1, lastActionType: null,
            isSpacePressed: false, isPanning: false, lastPanX: 0, lastPanY: 0, view: { x: 0, y: 0, scale: 1 }, lastSpaceUp: 0,
            isCtrlPressed: false, isPreviewing: false, lastPreviewTime: 0, previewMaskCanvas: null, previewMaskScale: 1, previewLoopId: null,
            isPolylineStart: false, polylinePoints: [], polylineDirty: false, polylineSessionId: 0, currentPolylineAction: null, currentPointerX: null, currentPointerY: null,
            activeStroke: null, fastPreviewLastPoint: null, pointerDownTime: 0, pointerDownCoords: null,
            brushSettings: {
                erase: { brushPercent: DEFAULT_ERASE_BRUSH, feather: DEFAULT_FEATHER, featherPx: DEFAULT_FEATHER_PX },
                repair: { brushPercent: DEFAULT_REPAIR_BRUSH, feather: DEFAULT_FEATHER, featherPx: DEFAULT_FEATHER_PX }
            },
            adjustments: { gamma: 1.0, levels: { black: 0, mid: 1.0, white: 255 }, shadows: 0, highlights: 0, saturation: 0, vibrance: 0, wb: 0, colorBal: { r: 0, g: 0, b: 0 } },
            isAdjusting: false, previewCanvas: null, previewFrontLayer: null, previewThrottle: 0,
            workingA: null, workingB: null, sourceA: null, sourceB: null,
            previewWorkingA: null, previewWorkingB: null, previewScaleA: 1, previewScaleB: 1,
            previewWorkingVersionA: 0, previewWorkingVersionB: 0,
            previewComposite: null,
            adjustmentsVersion: 0, workingVersionA: 0, workingVersionB: 0,
            isCropping: false, cropRect: null, fullDims: { w: 0, h: 0 }, cropDrag: null,
            fastMaskCanvas: null, fastMaskCtx: null, fastMaskScale: 1, useFastPreview: false,
            settings: { brushPreviewResolution: 1080, adjustmentPreviewResolution: 1080 },
            pendingAdjustmentCommit: false, drawerCloseTimer: null
        };

        const els = {
            fileA: document.getElementById('fileA'), fileB: document.getElementById('fileB'),
            btnA: document.getElementById('btnA'), btnB: document.getElementById('btnB'),
            mainCanvas: document.getElementById('mainCanvas'), previewCanvas: document.getElementById('previewCanvas'),
            loadingOverlay: document.getElementById('loading-overlay'),
            adjDrawer: document.getElementById('adj-drawer'),
            viewport: document.getElementById('viewport'),
            canvasWrapper: document.getElementById('canvas-wrapper'), emptyState: document.getElementById('empty-state'),
            swapBtn: document.getElementById('swapBtn'), opacitySlider: document.getElementById('opacitySlider'),
            opacityVal: document.getElementById('opacityVal'), brushSize: document.getElementById('brushSize'),
            brushSizeVal: document.getElementById('brushSizeVal'), feather: document.getElementById('feather'),
            featherVal: document.getElementById('featherVal'), featherLabel: document.getElementById('featherLabel'),
            featherModeBtn: document.getElementById('featherModeBtn'), eraseMode: document.getElementById('eraseMode'),
            repairMode: document.getElementById('repairMode'), clearMask: document.getElementById('clearMask'),
            saveBtn: document.getElementById('saveBtn'), dragOverlay: document.getElementById('drag-overlay'),
            toggleMaskBtn: document.getElementById('toggleMaskBtn'), maskEyeOpen: document.getElementById('maskEyeOpen'), maskEyeClosed: document.getElementById('maskEyeClosed'),
            toggleBackBtn: document.getElementById('toggleBackBtn'), rearEyeOpen: document.getElementById('rearEyeOpen'), rearEyeClosed: document.getElementById('rearEyeClosed'),
            mergeBtn: document.getElementById('mergeBtn'), censorBtn: document.getElementById('censorBtn'),
            undoBtn: document.getElementById('undoBtn'), redoBtn: document.getElementById('redoBtn'),
            cropBtn: document.getElementById('cropBtn'), cursor: document.getElementById('brush-cursor'),
            resetAdjBtn: document.getElementById('resetAdjBtn'), resetLevelsBtn: document.getElementById('resetLevelsBtn'),
            resetColorBtn: document.getElementById('resetColorBtn'), resetSatBtn: document.getElementById('resetSatBtn'),
            adjGamma: document.getElementById('adj-gamma'), valGamma: document.getElementById('val-gamma'),
            cropOverlayDom: document.getElementById('crop-overlay-dom'), cropBox: document.getElementById('crop-box'),
            workspaceResolution: document.getElementById('workspace-resolution')
        };

        const ctx = els.mainCanvas.getContext('2d');
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
        const frontLayerCanvas = document.createElement('canvas');
        const frontLayerCtx = frontLayerCanvas.getContext('2d');

        function scheduleHeavyTask(taskFn) {
            if (!els.loadingOverlay) return taskFn();
            els.loadingOverlay.classList.remove('hidden');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        try {
                            taskFn();
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

        const settingsSystem = createSettingsSystem({ state, els, render, scheduleHeavyTask });

        const {
            applyMasterLUT,
            applyColorOps,
            updateAdjustmentPreview,
            initAdjustments,
            resetAllAdjustments,
            updateSlider,
            setSaveSnapshotHandler,
            setUpdateWorkingCopiesHandler
        } = createAdjustmentSystem({
            state,
            els,
            ctx,
            renderToContext,
            render,
            scheduleHeavyTask
        });

        const { saveSnapshot, resetMaskAndHistory, resetMaskOnly, restoreState, undo, redo } = createUndoSystem({
            state,
            maskCtx,
            maskCanvas,
            updateSlider,
            resizeMainCanvas,
            render,
            resetAllAdjustments,
            log,
            updateUI,
            rebuildWorkingCopies: updateWorkingCopiesAfterAdjustments
        });

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
            saveSnapshot,
            undo,
            redo,
            showHints,
            scheduleHeavyTask
        });

        setSaveSnapshotHandler(saveSnapshot);
        setUpdateWorkingCopiesHandler(updateWorkingCopiesAfterAdjustments);

        function hasActiveAdjustments() {
            const a = state.adjustments;
            return a.gamma !== 1.0 || a.levels.black !== 0 || a.levels.mid !== 1.0 || a.levels.white !== 255 ||
                             a.saturation !== 0 || a.vibrance !== 0 || a.wb !== 0 ||
                             a.colorBal.r !== 0 || a.colorBal.g !== 0 || a.colorBal.b !== 0 ||
                             a.shadows !== 0 || a.highlights !== 0;
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

        function setupDragAndDrop() {
            const body = document.body;
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => body.addEventListener(eventName, preventDefaults, false));
            function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
            body.addEventListener('dragenter', () => body.classList.add('dragging'));
            body.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) body.classList.remove('dragging'); });
            body.addEventListener('drop', (e) => {
                body.classList.remove('dragging');
                const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
                if (files.length === 1) {
                    if (!state.imgA) handleFileLoad(files[0], 'A');
                    else handleFileLoad(files[0], 'B');
                } else if (files.length === 2) {
                    handleFileLoad(files[0], 'A');
                    handleFileLoad(files[1], 'B');
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

        function init() {
            initAdjustments();

            setInterval(() => {
                if (state.pendingAdjustmentCommit && els.adjDrawer && !els.adjDrawer.matches(':hover')) {
                    if (!state.drawerCloseTimer) {
                         state.drawerCloseTimer = setTimeout(() => {
                             if (state.pendingAdjustmentCommit && !els.adjDrawer.matches(':hover')) {
                                 commitAdjustments();
                             }
                             state.drawerCloseTimer = null;
                         }, 350);
                    }
                }
            }, 200);
            els.fileA.addEventListener('change', (e) => handleFileLoad(e.target.files[0], 'A'));
            els.fileB.addEventListener('change', (e) => handleFileLoad(e.target.files[0], 'B'));
            setupDragAndDrop();

            els.swapBtn.addEventListener('click', () => {
                [state.imgA, state.imgB] = [state.imgB, state.imgA];
                [state.sourceA, state.sourceB] = [state.sourceB, state.sourceA];
                [state.workingA, state.workingB] = [state.workingB, state.workingA];
                [state.workingVersionA, state.workingVersionB] = [state.workingVersionB, state.workingVersionA];
                [state.previewWorkingA, state.previewWorkingB] = [state.previewWorkingB, state.previewWorkingA];
                [state.previewWorkingVersionA, state.previewWorkingVersionB] = [state.previewWorkingVersionB, state.previewWorkingVersionA];
                [state.previewScaleA, state.previewScaleB] = [state.previewScaleB, state.previewScaleA];
                [state.nameA, state.nameB] = [state.nameB, state.nameA];
                els.btnA.textContent = truncate(state.nameA || "Load Img A");
                els.btnB.textContent = truncate(state.nameB || "Load Img B");
                if(state.imgA) els.btnA.classList.add('border-accent-strong', 'text-accent');
                else els.btnA.classList.remove('border-accent-strong', 'text-accent');
                if(state.imgB) els.btnB.classList.add('border-accent-strong', 'text-accent');
                else els.btnB.classList.remove('border-accent-strong', 'text-accent');
                markAdjustmentsDirty();
                rebuildWorkingCopies();
                updateCanvasDimensions(true);
                updateUI();
                render();
            });

            els.opacitySlider.addEventListener('input', (e) => {
                state.opacity = e.target.value / 100;
                els.opacityVal.textContent = Math.round(state.opacity * 100) + '%';
                render();
            });
            els.brushSize.addEventListener('input', (e) => {
                setBrushPercentFromSlider(e.target.value);
            });
            els.feather.addEventListener('input', (e) => {
                setFeatherFromSlider(e.target.value);
            });
            els.featherModeBtn.addEventListener('click', () => {
                setFeatherMode(!state.featherMode);
            });
            els.eraseMode.addEventListener('click', () => setMode(true));
            els.repairMode.addEventListener('click', () => setMode(false));
            
            els.clearMask.addEventListener('click', () => {
                maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                resetAllAdjustments();
                saveSnapshot('full_reset'); 
                resetView(); 
                render();
                log("Reset All", "info");
            });

            els.saveBtn.addEventListener('click', saveImage);
            els.mergeBtn.addEventListener('click', mergeDown);
            els.censorBtn.addEventListener('click', applyCensor);
            els.undoBtn.addEventListener('click', undo);
            els.redoBtn.addEventListener('click', redo);
            
            els.cropBtn.addEventListener('click', toggleCropMode);

            els.toggleMaskBtn.addEventListener('click', () => {
                state.maskVisible = !state.maskVisible;
                els.maskEyeOpen.classList.toggle('hidden');
                els.maskEyeClosed.classList.toggle('hidden');
                render();
            });
            els.toggleBackBtn.addEventListener('click', () => {
                state.backVisible = !state.backVisible;
                els.rearEyeOpen.classList.toggle('hidden');
                els.rearEyeClosed.classList.toggle('hidden');
                render();
            });

            attachInputHandlers();

            setBrushPercent(state.brushPercent);
            setFeatherMode(state.featherMode);
            setFeather(state.feather);

            log("Ready. Load images to begin.", "info");
            showHints();
            updateWorkspaceLabel();
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

            const frontLayer = state.isAFront ? getLayerForRender('A', { useBakedLayers, preferPreview, allowRebuild }) : getLayerForRender('B', { useBakedLayers, preferPreview, allowRebuild });
            const backLayer = state.isAFront ? getLayerForRender('B', { useBakedLayers, preferPreview, allowRebuild }) : getLayerForRender('A', { useBakedLayers, preferPreview, allowRebuild });
            const frontImg = frontLayer.img;
            const backImg = backLayer.img;

            // Adjust draw args for crop logic
            const sX = state.isCropping ? 0 : state.cropRect.x;
            const sY = state.isCropping ? 0 : state.cropRect.y;
            const sW = state.isCropping ? state.fullDims.w : state.cropRect.w;
            const sH = state.isCropping ? state.fullDims.h : state.cropRect.h;

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

                targetCtx.drawImage(backImg, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, w, h);
            }

            // Draw Front
            if (frontImg) {
                const fCtx = state.previewFrontLayer.getContext('2d');
                fCtx.clearRect(0, 0, w, h);

                fCtx.globalCompositeOperation = 'source-over';
                const frontScale = frontLayer.scale || 1;
                fCtx.drawImage(frontImg, sX * frontScale, sY * frontScale, sW * frontScale, sH * frontScale, 0, 0, w, h);

                if (state.maskVisible) {
                    fCtx.globalCompositeOperation = 'destination-out';
                    const maskScale = state.isPreviewing && state.previewMaskCanvas ? (state.previewMaskScale || state.fastMaskScale || 1) : 1;
                    const maskSource = state.isPreviewing && state.previewMaskCanvas ? state.previewMaskCanvas : maskCanvas;
                    fCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, w, h);
                }
                
                targetCtx.globalCompositeOperation = 'source-over';
                // Use forceOpacity for adjustments preview (so we see true pixels)
                const effectiveOpacity = (!state.backVisible || forceOpacity) ? 1.0 : state.opacity;
                targetCtx.globalAlpha = effectiveOpacity; 
                targetCtx.drawImage(state.previewFrontLayer, 0, 0);
            }
        }
        
        function render(finalOutput = false, skipAdjustments = false) {
            if (state.isAdjusting && !finalOutput) {
                 if (Date.now() - state.previewThrottle > 500) state.isAdjusting = false;
                 else return;
            }

            const cw = els.mainCanvas.width;
            const ch = els.mainCanvas.height;

            const useBakedLayers = !skipAdjustments;
            // Determine if 'Full' mode applies to the current interaction
            const isAdjusting = state.isAdjusting;
            const resSetting = isAdjusting ? state.settings.adjustmentPreviewResolution : state.settings.brushPreviewResolution;
            const preferPreview = state.useFastPreview && !finalOutput && resSetting !== 'Full';

            const allowRebuild = !isUserInteracting();

            // If cropping, draw full source image, then overlay
            // When !isCropping, the main canvas is sized to cropRect, so sX/Y is just cropRect.x/y
            const sX = state.isCropping ? 0 : state.cropRect.x;
            const sY = state.isCropping ? 0 : state.cropRect.y;
            const sW = state.isCropping ? state.fullDims.w : state.cropRect.w;
            const sH = state.isCropping ? state.fullDims.h : state.cropRect.h;

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
                let fastScale = Math.min(1, targetH / sH);
                if (state.isPreviewing && state.previewMaskCanvas) fastScale = maskScale;
                const pw = Math.max(1, Math.round(sW * fastScale));
                const ph = Math.max(1, Math.round(sH * fastScale));
                
                const pCtx = els.previewCanvas.getContext('2d');
                if (els.previewCanvas.width !== pw || els.previewCanvas.height !== ph) {
                    els.previewCanvas.width = pw;
                    els.previewCanvas.height = ph;
                }
                pCtx.clearRect(0, 0, pw, ph);

                const shouldRenderBack = backImg && (state.backVisible || finalOutput);
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

                    pCtx.drawImage(backImg, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, pw, ph);
                }

                if (frontImg) {
                    if (frontLayerCanvas.width !== pw || frontLayerCanvas.height !== ph) {
                        frontLayerCanvas.width = pw;
                        frontLayerCanvas.height = ph;
                    }
                    frontLayerCtx.clearRect(0, 0, pw, ph);
                    frontLayerCtx.globalCompositeOperation = 'source-over';
                    const frontScale = frontLayer.scale || 1;
                    frontLayerCtx.drawImage(frontImg, sX * frontScale, sY * frontScale, sW * frontScale, sH * frontScale, 0, 0, pw, ph);

                    let maskSource = maskCanvas;
                    if (state.isPreviewing && state.previewMaskCanvas) {
                        maskSource = state.previewMaskCanvas;
                    }

                    if (state.maskVisible) {
                        frontLayerCtx.globalCompositeOperation = 'destination-out';
                        frontLayerCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, pw, ph);
                    }

                    frontLayerCtx.globalCompositeOperation = 'source-over';
                    const effectiveOpacity = (finalOutput || !state.backVisible) ? 1.0 : state.opacity;
                    pCtx.globalAlpha = effectiveOpacity;
                    pCtx.drawImage(frontLayerCanvas, 0, 0);
                }
            } else {
                els.mainCanvas.style.visibility = 'visible';
                els.previewCanvas.classList.add('hidden');
                
                ctx.clearRect(0, 0, cw, ch);

                // 1. Draw Back
                const shouldRenderBack = backImg && (state.backVisible || finalOutput);

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

                    ctx.drawImage(backImg, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, cw, ch);
                }

                // 2. Prepare Front Layer
                if (frontImg) {
                    if (frontLayerCanvas.width !== cw || frontLayerCanvas.height !== ch) {
                        frontLayerCanvas.width = cw;
                        frontLayerCanvas.height = ch;
                    }
                    frontLayerCtx.clearRect(0, 0, cw, ch);
                    frontLayerCtx.globalCompositeOperation = 'source-over';
                    // Draw clipped portion of front image
                    const frontScale = frontLayer.scale || 1;
                    frontLayerCtx.drawImage(frontImg, sX * frontScale, sY * frontScale, sW * frontScale, sH * frontScale, 0, 0, cw, ch);

                    let maskSource = maskCanvas;
                    if (state.isPreviewing && state.previewMaskCanvas) {
                        maskSource = state.previewMaskCanvas;
                    }

                    if (state.maskVisible) {
                        frontLayerCtx.globalCompositeOperation = 'destination-out';
                        frontLayerCtx.drawImage(maskSource, sX * maskScale, sY * maskScale, sW * maskScale, sH * maskScale, 0, 0, cw, ch);
                    }

                    // 3. Composite Front to Main
                    frontLayerCtx.globalCompositeOperation = 'source-over';
                    const effectiveOpacity = (finalOutput || !state.backVisible) ? 1.0 : state.opacity;
                    ctx.globalAlpha = effectiveOpacity;
                    ctx.drawImage(frontLayerCanvas, 0, 0);
                }
            }
            
            // 4. Update Crop DOM Overlay
            if (state.isCropping) {
                els.cropOverlayDom.style.display = 'block';
                const r = state.cropRect;
                els.cropBox.style.left = r.x + 'px';
                els.cropBox.style.top = r.y + 'px';
                els.cropBox.style.width = r.w + 'px';
                els.cropBox.style.height = r.h + 'px';
                
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
        function toggleCropMode() {
            if (!canDraw()) return;
            state.isCropping = !state.isCropping;
            
            if (state.isCropping) {
                els.cropBtn.classList.add('active', 'text-yellow-400');
                // Resize main canvas to full dims
                resizeMainCanvas(state.fullDims.w, state.fullDims.h);
                els.viewport.classList.add('cropping');
            } else {
                els.cropBtn.classList.remove('active', 'text-yellow-400');
                // Resize main canvas to crop rect
                resizeMainCanvas(state.cropRect.w, state.cropRect.h);
                els.viewport.classList.remove('cropping');
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
            els.undoBtn.disabled = state.historyIndex <= 0;
            els.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
            
            // Disable tools while cropping
            if (state.isCropping) {
                 els.eraseMode.disabled = true;
                 els.repairMode.disabled = true;
                 els.brushSize.disabled = true;
                 els.censorBtn.disabled = true;
                 els.mergeBtn.disabled = true;
                 els.featherModeBtn.disabled = true;
            } else {
                 els.eraseMode.disabled = false;
                 els.repairMode.disabled = false;
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
            
            if (enable) {
                els.viewport.classList.remove('disabled');
            } else {
                els.viewport.classList.add('disabled');
                els.cursor.style.display = 'none';
            }

            updateWorkspaceLabel();
        }

        function truncate(str) {
            if(str.length > 8) return str.substring(0, 6) + '..';
            return str;
        }

        function setMode(isErasing) {
            state.isErasing = isErasing;
            if(isErasing) {
                els.eraseMode.classList.add('active');
                els.repairMode.classList.remove('active');
            } else {
                els.eraseMode.classList.remove('active');
                els.repairMode.classList.add('active');
            }
            syncBrushUIToActive();
        }

        function handleFileLoad(file, slot) {
            if (!file) return;
            log(`Loading ${file.name}...`, "info");
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    if (slot === 'A') {
                        setLayerSource('A', img);
                        state.nameA = file.name;
                        els.btnA.textContent = truncate(file.name);
                        els.btnA.classList.add('border-accent-strong', 'text-accent');
                    } else {
                        setLayerSource('B', img);
                        state.nameB = file.name;
                        els.btnB.textContent = truncate(file.name);
                        els.btnB.classList.add('border-accent-strong', 'text-accent');
                    }
                    markAdjustmentsDirty();
                    rebuildWorkingCopies();
                    updateCanvasDimensions(); // Re-inits cropRect
                    render();
                    updateUI();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }

        function updateCanvasDimensions(preserveView = false) {
            if (!state.imgA && !state.imgB) return;
            const frontImg = state.isAFront ? state.imgA : state.imgB;
            const activeImg = frontImg || (state.isAFront ? state.imgB : state.imgA);
            if (!activeImg) return;
            const targetW = activeImg.width;
            const targetH = activeImg.height;
            
            // Set Full Dims
            state.fullDims = { w: targetW, h: targetH };
            if (!preserveView || !state.cropRect) {
                 state.cropRect = { x: 0, y: 0, w: targetW, h: targetH };
            }

            if (maskCanvas.width !== targetW || maskCanvas.height !== targetH) {
                maskCanvas.width = targetW;
                maskCanvas.height = targetH;
                maskCtx.clearRect(0,0,targetW,targetH); 
                resetMaskAndHistory(); 
            }

            resizeMainCanvas(state.cropRect.w, state.cropRect.h);

            els.mainCanvas.classList.remove('hidden');
            els.emptyState.style.display = 'none';
            els.canvasWrapper.style.width = state.cropRect.w + 'px';
            els.canvasWrapper.style.height = state.cropRect.h + 'px';
            
            if (!preserveView) resetView(); 
        }

        // --- Censor, Merge, Save (Remaining) ---
        function applyCensor() {
             if (!state.imgA && !state.imgB) { log("Need at least one image"); return; }
             log("Generating Censor layer...", "info");
             setTimeout(() => {
                try {
                    // Ensure any fast/preview mask state is cleared so the final render uses the full-resolution mask
                    state.isPreviewing = false;
                    state.previewMaskCanvas = null;
                    state.previewMaskScale = 1;
                    state.useFastPreview = false;
                    state.fastPreviewLastPoint = null;

                    // Temporarily render full, uncropped frame for processing
                    const wasCropping = state.isCropping;
                    const prevCropRect = state.cropRect ? { ...state.cropRect } : null;
                    const fullFrame = { x: 0, y: 0, w: state.fullDims.w, h: state.fullDims.h };

                    state.isCropping = true;
                    state.cropRect = fullFrame;
                    resizeMainCanvas(fullFrame.w, fullFrame.h);

                    render(true, true); // Final, Skip Adjustments
                    const baseData = els.mainCanvas.toDataURL('image/png');

                    // Restore crop state before building layers
                    state.isCropping = wasCropping;
                    state.cropRect = prevCropRect;
                    if (wasCropping) resizeMainCanvas(state.fullDims.w, state.fullDims.h);
                    else if (prevCropRect) resizeMainCanvas(prevCropRect.w, prevCropRect.h);
                    const imgBase = new Image();
                    imgBase.onload = () => {
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
                        const imgCensored = new Image();
                        imgCensored.onload = () => {
                            setLayerSource('B', imgCensored); state.nameB = "Censored Layer";

                            // Re-init full dims
                            const newW = imgCensored.width;
                            const newH = imgCensored.height;
                            state.fullDims = { w: newW, h: newH };
                            // Preserve Crop if valid, else reset
                            if (!state.cropRect || state.cropRect.w > newW || state.cropRect.h > newH) {
                                state.cropRect = { x: 0, y: 0, w: newW, h: newH };
                            }

                            resetMaskOnly(); // Don't reset adjustments
                            
                            // Restore view state
                            state.isCropping = wasCropping;
                            if (!wasCropping) resizeMainCanvas(state.cropRect.w, state.cropRect.h);
                            else resizeMainCanvas(newW, newH);
                            
                            state.maskVisible = true;
                            els.maskEyeOpen.classList.remove('hidden'); els.maskEyeClosed.classList.add('hidden');
                            state.backVisible = true;
                            els.rearEyeOpen.classList.remove('hidden'); els.rearEyeClosed.classList.add('hidden');
                            state.brushSettings = {
                                erase: { brushPercent: DEFAULT_ERASE_BRUSH, feather: DEFAULT_FEATHER, featherPx: DEFAULT_FEATHER_PX },
                                repair: { brushPercent: DEFAULT_REPAIR_BRUSH, feather: DEFAULT_FEATHER, featherPx: DEFAULT_FEATHER_PX }
                            };
                            setMode(true);
                            setFeatherMode(true, { value: 5, applyToAll: true });
                            syncBrushUIToActive();
                            state.opacity = 1.0; els.opacitySlider.value = 100; els.opacityVal.textContent = "100%";
                            state.isAFront = true;
                            els.btnA.textContent = "Base"; els.btnA.classList.add('border-accent-strong', 'text-accent');
                            els.btnB.textContent = "Censored"; els.btnB.classList.add('border-accent-strong', 'text-accent');

                            rebuildWorkingCopies(true);

                            render(); updateUI();
                            log("Censor setup complete", "info");
                        };
                        imgCensored.src = tempCanvas.toDataURL('image/png');
                    };
                    imgBase.src = baseData;
                } catch(e) { console.error(e); }
             }, 50);
        }

        function mergeDown() {
            if (!canDraw()) return;
            log("Merging...", "info");
            setTimeout(() => {
                try {
                    // Render Full Image temporarily
                    const wasCropping = state.isCropping;
                    state.isCropping = false;
                    resizeMainCanvas(state.fullDims.w, state.fullDims.h);
                    
                    render(true, true); // Final, Skip Adjustments
                    const dataURL = els.mainCanvas.toDataURL('image/png');
                    const newImg = new Image();
                    newImg.onload = () => {
                        setLayerSource('A', newImg); state.imgB = null; state.sourceB = null; state.workingVersionB = 0;
                        state.nameA = "Merged Layer"; state.nameB = "";
                        
                        // Update dims
                        const newW = newImg.width;
                        const newH = newImg.height;
                        state.fullDims = { w: newW, h: newH };
                        
                        // Preserve Crop
                        if (!state.cropRect || state.cropRect.w > newW || state.cropRect.h > newH) {
                             state.cropRect = { x: 0, y: 0, w: newW, h: newH };
                        }

                        resetMaskOnly(); // Don't reset adjustments
                        
                        // Restore view
                        state.isCropping = wasCropping;
                        if (!wasCropping) resizeMainCanvas(state.cropRect.w, state.cropRect.h);
                        else resizeMainCanvas(newW, newH);

                        maskCanvas.width = newW; maskCanvas.height = newH;
                        frontLayerCanvas.width = newW; frontLayerCanvas.height = newH;
                        maskCtx.clearRect(0, 0, newW, newH);

                        rebuildWorkingCopies(true);

                        state.isAFront = true; state.opacity = 1.0;
                        els.opacitySlider.value = 100; els.opacityVal.textContent = "100%";
                        els.btnA.textContent = "Merged"; els.btnA.classList.add('border-accent-strong', 'text-accent');
                        els.btnB.textContent = "Load Img B"; els.btnB.classList.remove('border-accent-strong', 'text-accent');
                        
                        render(); updateUI();
                        log("Merge successful", "info");
                    };
                    newImg.src = dataURL;
                } catch (e) { console.error(e); }
            }, 50);
        }

        function saveImage() {
            if (!state.imgA && !state.imgB) return;
            try {
                // Render CROP area for export
                const wasCropping = state.isCropping;
                state.isCropping = false; 
                resizeMainCanvas(state.cropRect.w, state.cropRect.h);
                
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
            } catch (e) { log("Save failed"); }
        }

        init();
    
