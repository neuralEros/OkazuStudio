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
        const DEFAULT_PATCH_FEATHER = 10;
        const HARDNESS_MAX = 20;

        const state = {
            imgA: null, imgB: null, nameA: '', nameB: '', isAFront: true,
            opacity: 0.8, brushPercent: DEFAULT_ERASE_BRUSH, feather: DEFAULT_FEATHER, featherPx: DEFAULT_FEATHER_PX, featherMode: false, brushMode: 'erase', isDrawing: false,
            maskVisible: true, backVisible: true, adjustmentsVisible: true, history: [], historyIndex: -1, lastActionType: null,
            isSpacePressed: false, isPanning: false, lastPanX: 0, lastPanY: 0, view: { x: 0, y: 0, scale: 1 }, lastSpaceUp: 0,
            isCtrlPressed: false, isPreviewing: false, lastPreviewTime: 0, previewMaskCanvas: null, previewMaskScale: 1, previewLoopId: null,
            isPolylineStart: false, polylinePoints: [], polylineDirty: false, polylineSessionId: 0, currentPolylineAction: null, currentPointerX: null, currentPointerY: null,
            activeStroke: null, fastPreviewLastPoint: null, pointerDownTime: 0, pointerDownCoords: null,
            brushSettings: {
                erase: { brushPercent: DEFAULT_ERASE_BRUSH, feather: DEFAULT_FEATHER, featherPx: DEFAULT_FEATHER_PX },
                repair: { brushPercent: DEFAULT_REPAIR_BRUSH, feather: DEFAULT_FEATHER, featherPx: DEFAULT_FEATHER_PX },
                patch: { brushPercent: DEFAULT_REPAIR_BRUSH, feather: DEFAULT_PATCH_FEATHER, featherPx: DEFAULT_FEATHER_PX }
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
            rotation: 0,
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
            rotateBtn: document.getElementById('rotateBtn'), cropBtn: document.getElementById('cropBtn'), cursor: document.getElementById('brush-cursor'),
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

        const { saveSnapshot, resetMaskAndHistory, resetMaskOnly, restoreState, undo, redo } = createUndoSystem({
            state,
            maskCtx,
            maskCanvas,
            resizeMainCanvas,
            render,
            resetAllAdjustments,
            log,
            updateUI,
            rebuildWorkingCopies: updateWorkingCopiesAfterAdjustments,
            recalculateColorTuning,
            updateAllAdjustmentUI,
            Logger
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
            scheduleHeavyTask,
            acceptCrop,
            cancelCrop,
            setBrushMode: setMode,
            coordinateHelpers: {
                visualToTruthCoords,
                truthToVisualRect,
                getRotatedHandle
            }
        });

        setSaveSnapshotHandler(saveSnapshot);
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

        function bakeRotation() {
            if (state.rotation === 0) return;
            const rot = state.rotation;

            // Dimensions
            const tW = state.fullDims.w;
            const tH = state.fullDims.h;
            // New Dims (swapped if 90/270)
            const nW = (rot === 90 || rot === 270) ? tH : tW;
            const nH = (rot === 90 || rot === 270) ? tW : tH;

            log("Baking Rotation: " + rot + "°", "info");

            // Helper to rotate a canvas
            const rotateCanvas = (source) => {
                if (!source) return null;
                const c = document.createElement('canvas');
                c.width = nW; c.height = nH;
                const ctx = c.getContext('2d');
                ctx.translate(nW/2, nH/2);
                ctx.rotate(rot * Math.PI / 180);
                ctx.translate(-source.width/2, -source.height/2);
                ctx.drawImage(source, 0, 0);
                return c;
            };

            // Rotate Images
            if (state.imgA) {
                const newA = rotateCanvas(state.imgA);
                state.imgA = newA;
                state.sourceA = newA;
            }
            if (state.imgB) {
                const newB = rotateCanvas(state.imgB);
                state.imgB = newB;
                state.sourceB = newB;
            }

            // Rotate Mask
            const newMask = rotateCanvas(maskCanvas);
            maskCanvas.width = nW;
            maskCanvas.height = nH;
            maskCtx.clearRect(0, 0, nW, nH);
            if (newMask) maskCtx.drawImage(newMask, 0, 0);

            // Rotate Front Layer Buffer (if sized)
            if (frontLayerCanvas.width > 0) {
                 frontLayerCanvas.width = nW;
                 frontLayerCanvas.height = nH;
            }

            // Update Dimensions
            state.fullDims = { w: nW, h: nH };

            // Transform CropRect (Truth to New Truth)
            // Note: truthToVisualRect handles "Truth to Rotated Screen".
            // Since we are baking the rotation, the "New Truth" IS the "Rotated Screen" dims.
            // So we can reuse that logic to calculate the new crop rect coordinates.
            state.cropRect = truthToVisualRect(state.cropRect);

            // Reset Rotation
            state.rotation = 0;

            // Clean state
            state.history = []; // Clear history as undoing across bake is hard
            state.historyIndex = -1;

            // Trigger Rebuilds
            rebuildWorkingCopies(true);
            saveSnapshot('bake_rotation');
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
             log(`Loading ${name}...`, "info");
             try {
                 // Bake any existing rotation before loading new content
                 if (state.rotation !== 0) bakeRotation();

                 const img = await loadImageSource(source);

                 // 0 loaded -> Slot A (Front)
                 if (!state.imgA && !state.imgB) {
                     assignLayer(img, 'A', name);
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
                 state.nameA = "";
                 updateLoadButton(els.btnA, "Load", "front");
                 els.btnA.classList.remove('border-accent-strong', 'text-accent');
             } else {
                 state.imgB = null; state.sourceB = null; state.workingB = null;
                 state.nameB = "";
                 updateLoadButton(els.btnB, "Load", "back");
                 els.btnB.classList.remove('border-accent-strong', 'text-accent');
             }

             if (!state.imgA && !state.imgB) {
                 // Full Reset
                 resetAllAdjustments();
                 saveSnapshot('clear_all');
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
                [state.imgA, state.imgB] = [state.imgB, state.imgA];
                [state.sourceA, state.sourceB] = [state.sourceB, state.sourceA];
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
                updateCanvasDimensions(true);
                updateUI();
                render();
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
                saveSnapshot('full_reset'); 
                resetView(); 
                updateVisibilityToggles();
                render();
                log("Reset All", "info");
            });

            els.saveBtn.addEventListener('click', saveImage);
            els.mergeBtn.addEventListener('click', mergeDown);
            els.censorBtn.addEventListener('click', applyCensor);
            els.undoBtn.addEventListener('click', undo);
            els.redoBtn.addEventListener('click', redo);
            
            els.rotateBtn.addEventListener('click', () => {
                state.rotation = (state.rotation + 90) % 360;
                // Reset view fit? Maybe?
                // Adjust view so center remains center?
                // For simplicity, just render.
                saveSnapshot('rotate');
                render();
            });

            els.cropBtn.addEventListener('click', toggleCropMode);

            els.toggleMaskBtn.addEventListener('click', () => {
                state.maskVisible = !state.maskVisible;
                Logger.interaction("Toggle Mask Visibility", state.maskVisible ? "Show" : "Hide");
                updateVisibilityToggles();
                render();
            });
            els.toggleBackBtn.addEventListener('click', () => {
                state.backVisible = !state.backVisible;
                Logger.interaction("Toggle Back Visibility", state.backVisible ? "Show" : "Hide");
                updateVisibilityToggles();
                render();
            });
            els.toggleAdjBtn.addEventListener('click', () => {
                state.adjustmentsVisible = !state.adjustmentsVisible;
                Logger.interaction("Toggle Adjustments Visibility", state.adjustmentsVisible ? "Show" : "Hide");
                updateVisibilityToggles();
                render();
            });

            attachInputHandlers();

            setBrushPercent(state.brushPercent);
            setFeatherMode(state.featherMode);
            setFeather(state.feather);

            log("Ready. Load images to begin.", "info");
            showHints();
            updateWorkspaceLabel();
            updateVisibilityToggles();
            updateUI();
        }

        function getVisualDims() {
            if (state.rotation === 90 || state.rotation === 270) {
                return { w: state.fullDims.h, h: state.fullDims.w };
            }
            return { w: state.fullDims.w, h: state.fullDims.h };
        }

        function visualToTruthCoords(vx, vy) {
            const rot = state.rotation;
            if (rot === 0) return { x: vx, y: vy };
            // Visual dims (swapped if needed) are irrelevant for logic,
            // we use truth dims to reverse map.
            // But we need the dimensions of the "box" we are in.
            // Visual Width/Height
            const vW = (rot === 90 || rot === 270) ? state.fullDims.h : state.fullDims.w;
            const vH = (rot === 90 || rot === 270) ? state.fullDims.w : state.fullDims.h;

            // 90 CW: x' = h - y, y' = x
            // Reverse: y = h - x', x = y'
            // where h is Truth Height (which is Visual Width)

            if (rot === 90) {
                return { x: vy, y: vW - vx };
            }
            // 180: x' = w - x, y' = h - y
            // Reverse: x = w - x', y = h - y'
            if (rot === 180) {
                return { x: vW - vx, y: vH - vy };
            }
            // 270 (90 CCW): x' = y, y' = w - x
            // Reverse: y = x', x = w - y'
            // w is Truth Width (Visual Height)
            if (rot === 270) {
                return { x: vH - vy, y: vx };
            }
            return { x: vx, y: vy };
        }

        function truthToVisualRect(r) {
            // Transform a rect (x,y,w,h) in Truth Space to Visual Space
            const rot = state.rotation;
            if (rot === 0) return { ...r };

            const tW = state.fullDims.w;
            const tH = state.fullDims.h;

            if (rot === 90) {
                // (x, y) -> (H - y, x). Since y is top, H-y is distance from right.
                // But rect origin needs to be top-left of the new rect.
                // Old Top-Right (x+w, y) -> (H-y, x+w) -> Bottom-Right visually?
                // Let's transform all 4 corners and find bounding box.
                // TL: (x, y) -> (H - y, x)
                // TR: (x+w, y) -> (H - y, x+w)
                // BL: (x, y+h) -> (H - (y+h), x)
                // BR: (x+w, y+h) -> (H - (y+h), x+w)
                // Min X: H - (y+h). Max X: H - y. Width: h.
                // Min Y: x. Max Y: x+w. Height: w.
                return { x: tH - (r.y + r.h), y: r.x, w: r.h, h: r.w };
            }
            if (rot === 180) {
                // (x, y) -> (W - x, H - y)
                // BR corner becomes new TL?
                // TL: (W-x, H-y). BR: (W-(x+w), H-(y+h))
                // Min X: W - x - w. Min Y: H - y - h.
                return { x: tW - r.x - r.w, y: tH - r.y - r.h, w: r.w, h: r.h };
            }
            if (rot === 270) {
                // (x, y) -> (y, W - x)
                // TL: (y, W-x). TR: (y, W-(x+w))
                // BL: (y+h, W-x). BR: (y+h, W-(x+w))
                // Min X: y. Max X: y+h.
                // Min Y: W - x - w. Max Y: W - x.
                return { x: r.y, y: tW - r.x - r.w, w: r.h, h: r.w };
            }
            return { ...r };
        }

        function getRotatedHandle(h) {
            const rot = state.rotation;
            if (rot === 0) return h;

            const map = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
            const shifts = rot / 45; // 90=2 steps.
            // But handle list is circular.
            // 90 CW: N -> E?
            // Visual North handle modifies Visual Top.
            // Visual Top is Truth Right (at 90 deg? wait).
            // Let's re-verify:
            // 90 CW. Top of screen is Left of Image.
            // So Visual North -> Truth West (Left).
            // Let's check rotation:
            // N (0) -> W (-90 / +270).
            // So shift is -2 steps.
            // 90 CW = -2 indices.

            const index = map.indexOf(h);
            if (index === -1) return h; // 'box' etc

            // Steps: 90 -> -2. 180 -> -4. 270 -> -6 (+2).
            const step = - (rot / 45);
            let newIndex = (index + step) % 8;
            if (newIndex < 0) newIndex += 8;

            return map[newIndex];
        }

        function updateWorkspaceLabel() {
            if (!els.workspaceResolution) return;
            if (!canDraw()) {
                els.workspaceResolution.style.display = 'none';
                return;
            }
            // Show Visual dimensions
            els.workspaceResolution.textContent = `${els.mainCanvas.width}×${els.mainCanvas.height}`;
            els.workspaceResolution.style.display = '';
        }

        // --- Core Rendering & Helper ---
        function renderToContext(targetCtx, w, h, forceOpacity = false, useBakedLayers = true, preferPreview = false, allowRebuild = true) {
            targetCtx.clearRect(0, 0, w, h);
            if (!state.cropRect && !state.isCropping) return;

            // Apply Rotation Transform
            targetCtx.save();
            const rot = state.rotation;
            if (rot !== 0) {
                targetCtx.translate(w / 2, h / 2);
                targetCtx.rotate(rot * Math.PI / 180);
                // Inverse translate based on Truth Dims?
                // If w/h are Visual Dims.
                // Center is same.
                // But we need to translate back by Truth dims / 2?
                // Visual W = Truth H (at 90).
                // Center is (H/2, W/2).
                // We rotate.
                // We need to draw Truth at (-TW/2, -TH/2).
                const tW = (rot === 90 || rot === 270) ? h : w;
                const tH = (rot === 90 || rot === 270) ? w : h;
                targetCtx.translate(-tW / 2, -tH / 2);
            }

            // Enforce adjustments visibility for nested renders
            const effectiveBaked = useBakedLayers && state.adjustmentsVisible;

            const frontLayer = state.isAFront ? getLayerForRender('A', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild }) : getLayerForRender('B', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild });
            const backLayer = state.isAFront ? getLayerForRender('B', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild }) : getLayerForRender('A', { useBakedLayers: effectiveBaked, preferPreview, allowRebuild });
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

                // When rotated, fullDims refers to Truth. BackImg is drawn to Truth Rect.
                // The context is transformed, so we draw normally using Truth coords.
                // BUT: renderToContext takes w, h which are destination dims (Visual).
                // If we are drawing to the full canvas (w, h), we are drawing the "View".
                // If cropRect is active, sX/sY/sW/sH are Truth Crop.
                // We draw the cropped portion of Truth Image onto the 0,0,w,h of destination.
                // WAIT. If we have a transform applied, (0,0) is Truth Top-Left.
                // But we want to fill the "Visual Canvas" (w,h).
                // The transform maps Truth Coords to Visual Coords.
                // So we should draw to (0,0, tW, tH) in Truth Space?
                // No, renderToContext is used for "Export" logic usually, OR preview buffer.
                // If we are just rendering the cropped view:
                // We want to draw the content defined by sX, sY, sW, sH.
                // If we apply rotation, we are rotating the viewport.
                // So we should draw the content at (sX, sY, sW, sH) ???
                // NO. sX is the crop rect in Truth.
                // We want to draw that specific rect from the source.
                // `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`
                // Source rect is sX...sH.
                // Dest rect is 0, 0, w, h (Visual Canvas).
                // If we rely on the context transform to do the rotation:
                // We draw at destination (0, 0, w, h)?
                // No. If context is rotated, drawing at (0,0) draws at rotated location.
                // Actually, `renderToContext` is generic.
                // If we are rotated, `w` and `h` are Visual Dims.
                // If we draw image source sX..sH to 0..w/h, we get a stretched/skewed image if we simply rotate the context?
                // If we simply draw the source rect to the destination rect, we get the unrotated pixels.
                // Rotation must happen *after*?
                // Or we rotate the *source*?

                // Let's reconsider.
                // CropRect defines what we see.
                // If rotation is 90. Visual Canvas is HxW.
                // We want to see the content of CropRect, rotated.
                // If we blindly copy pixels from Source(CropRect) to Dest(0,0), it's unrotated.
                // So we DO need the context transform.
                // BUT `drawImage` draws an aligned rectangle.
                // If context is rotated 90, drawing a rectangle results in a rotated rectangle.
                // So we need to draw the source image (Full) to the context such that the CropRect portion falls onto the Visual Canvas area.
                // This is complicated.
                // Easier approach:
                // 1. We are rendering the "View".
                // 2. The View is the CropRect.
                // 3. We transform the Context to align Visual (0,0) with Truth CropRect Top-Left (rotated).
                // 4. We draw the *Entire* source image?
                //    Yes, but clipped to viewport?
                //    Or we use `drawImage` with source parameters?
                //    `drawImage` source params are axis-aligned to the image.
                //    So we can pick the source pixels easily.
                //    But we can't draw them axis-aligned to the destination if rotation is 90.
                //    So we MUST use the context transform.
                //    If we use the context transform, we cannot use `drawImage` destination (0,0, w, h) because that would draw a rotated box that might not align?
                //    Wait. If we rotate 90.
                //    We draw the image at (dx, dy).
                //    We need to position the image so that sX, sY is at Visual 0,0.
                //    Logic:
                //    Context is rotated.
                //    We draw the Full Image at (0,0) [Truth Space]?
                //    And we translate the context so that (sX, sY) is at (0,0) [Visual Space]?
                //    Yes.
                //    Transform:
                //    1. Translate Center of Visual to Origin?
                //    2. Rotate.
                //    3. Translate back?
                //    Actually:
                //    We want Visual (0,0) to map to Truth (sX, sY) [conceptually].
                //    So we draw the image at (-sX, -sY).
                //    Then we rotate?
                //    No, rotation center matters.

                // Let's stick to the "Visual Dims" strategy.
                // Visual Canvas is WxH.
                // We Translate(W/2, H/2). Rotate(deg). Translate(-tW/2, -tH/2). [Where tW/tH is Truth Crop Dims].
                // Now (0,0) Visual is (0,0) Truth Crop (rotated).
                // We draw the *Cropped* Source?
                // No, we assume `sX, sY` is the top-left of the crop in Truth.
                // So we Translate(-sX, -sY).
                // Then draw Full Image at (0,0).
                // Net result: The portion of the image at sX,sY is at the origin of the rotated context.
                // Let's verify center rotation.
                // We want center of CropRect to be center of Visual Canvas.
                // Visual Center: (w/2, h/2).
                // Truth Center: (sX + sW/2, sY + sH/2).
                // Transform:
                // Translate(w/2, h/2).
                // Rotate(deg).
                // Translate(-(sX + sW/2), -(sY + sH/2)).
                // Draw Image at (0,0).

                // Is sW/sH == tW/tH (Truth Crop Dims)?
                // sW, sH are from `state.cropRect`.
                // w, h are passed to function (Visual Dims).
                // If 90 deg: w = sH, h = sW.
                // Center matches.

                // Correct Transform Pipeline:
                // targetCtx.translate(w/2, h/2);
                // targetCtx.rotate(rot * Math.PI / 180);
                // targetCtx.translate(-(sX + sW/2), -(sY + sH/2));

                // Reset standard translate/rotate block above and replace with this.
                // But wait, `renderToContext` is used for `render()` (View) AND `saveImage` (Export).
                // For Export, w/h matches crop rect size.
                // For Render (View), w/h matches canvas size (Visual Dims).
                // So this logic holds.

                // What about drawing the Background?
                // BackImg has its own scaling to fit `fullDims` (Truth).
                // `const scale = state.fullDims.h / backImg.height`
                // `backX = (state.fullDims.w - backW) / 2`
                // The `drawImage` call for Back uses `bSrcX...` to map crop rect to back image.
                // If we use the Full Draw + Transform method, we need to draw the Back Image
                // scaled and positioned in Truth Space.
                // Back Image in Truth Space:
                // Drawn at (backX, 0) with size (backW, backH).

                // So:
                // 1. Setup Transform (Center to Center).
                // 2. Draw Back Image at (backX, 0, backW, backH).
                // 3. Draw Front Image at (0, 0, fullW, fullH) [Assuming Front is full size].

                // This replaces the complex `drawImage(subrect)` logic?
                // The existing logic calculated `bSrcX` etc to draw *only* the visible part.
                // This is efficient.
                // Drawing the full image and letting canvas clip is easier but might be slower?
                // The existing logic `ctx.drawImage(img, bSrcX, bSrcY, bSrcW, bSrcH, 0, 0, w, h)`
                // explicitly maps the source rect to the destination rect (0..w).
                // If we rotate, we can't map rect-to-rect easily.
                // So we MUST use the Transform method and draw the *relevant* part.
                // Or we can just draw the Full Image (clipped by browser) if performance allows.
                // Given we are zooming/panning, drawing full image is bad (drawing 4k image when zoomed in).

                // Hybrid:
                // We use the Transform.
                // But we `drawImage` only a roughly computed source rect?
                // Or just draw full for now? The app handles large images.
                // The existing code was careful about `bSrcX`.
                // Let's stick to Transform + Full Draw for simplicity in this complexity?
                // No, large images will lag.
                // We can calculate the bounding box of the Visual Rect in Truth Space.
                // `truthToVisualRect` inverse?
                // We have `visualToTruthCoords`.
                // Visual Rect is (0,0, w, h).
                // Truth Polygon (rotated rect) corners.
                // Bounding Box of that polygon in Truth Space.
                // Use that as Source Rect.
                // Destination Rect?
                // We are drawing into a transformed context.
                // So we draw at the Truth Coordinates.
                // So `drawImage(img, srcX, srcY, srcW, srcH, srcX, srcY, srcW, srcH)`.

                // Let's refine the Transform again.
                // targetCtx.translate(w/2, h/2);
                // targetCtx.rotate(rot * Math.PI / 180);
                // targetCtx.translate(-(sX + sW/2), -(sY + sH/2));

                // Now we are in Truth Coordinates.
                // We want to draw Back Image.
                // It lives at (backX, 0, backW, backH).
                // We can just `drawImage(backImg, 0, 0, backImg.w, backImg.h, backX, 0, backW, backH)`.
                // The browser will clip it to the canvas.
                // Is this slow?
                // The canvas is `w` x `h`.
                // If we are zoomed in, we are drawing a huge image off-screen?
                // Yes.
                // But `drawImage` is usually optimized for off-screen clipping.
                // The previous code was manual clipping.
                // I will use the Transform method + Full Draw (or simpler mapped draw) for now.
                // It is much safer for correctness.

                // Wait, Front Image:
                // `frontImg` (full source).
                // Drawn at (0, 0, fullW, fullH).
                // Mask: (0, 0, fullW, fullH).

                // So the plan:
                // 1. Apply Transform.
                // 2. Draw Back (positioned).
                // 3. Draw Front (positioned).
                // 4. Draw Mask (positioned).

                // One catch: `frontLayer` logic creates a `state.previewFrontLayer`.
                // The existing code clears `previewFrontLayer` (w, h) and draws into it.
                // `previewFrontLayer` is a buffer of size (w, h) [Visual].
                // If we use it, we must render into it *with rotation* too?
                // Yes. `fCtx` needs the same transform.

                // Wait, `previewFrontLayer` is reused.
                // `fCtx.clearRect(0, 0, w, h)`.
                // Then draws front/mask.
                // Then `targetCtx` draws `previewFrontLayer` identity.
                // So:
                // `targetCtx` gets identity draw.
                // `fCtx` gets the Transform + Scene Draw.
                // This seems consistent.

                // Override `targetCtx` transform logic for the *Back* image since it draws directly to target.
                // The Front draws to buffer, then buffer to target.
                // Buffer is w x h.
                // So Buffer acts as the viewport.

                // Let's restructure `renderToContext`.
                // It needs to apply transform to whatever context is receiving the "Scene".

                // Back: targetCtx.
                // Front: fCtx.

                // So I will calculate the transform matrix/params once.
                // Apply to targetCtx. Draw Back.
                // Reset targetCtx transform?
                // No, Front buffer `previewFrontLayer` is size w, h.
                // If we draw Front Buffer to TargetCtx, we want 1:1 pixel mapping (it's already rendered view).
                // So:
                // 1. Draw Back to TargetCtx (Transformed).
                // 2. Reset TargetCtx Transform.
                // 3. Render Front to `previewFrontLayer` (Transformed).
                // 4. Draw `previewFrontLayer` to TargetCtx (Identity).

                // This preserves opacity/compositing logic.

                // Transform Params:
                const tCenterX = sX + sW/2;
                const tCenterY = sY + sH/2;

                // Helper to apply
                const applyTransform = (ctx) => {
                    ctx.save();
                    ctx.translate(w/2, h/2);
                    ctx.rotate(rot * Math.PI / 180);
                    ctx.translate(-tCenterX, -tCenterY);
                };

                // Draw Back
                if (backImg && state.backVisible) {
                     targetCtx.save(); // Save opacity etc
                     applyTransform(targetCtx); // Apply Geometry
                     targetCtx.globalAlpha = 1.0;
                     targetCtx.globalCompositeOperation = 'source-over';

                     const scale = state.fullDims.h / backImg.height;
                     const backW = backImg.width * scale;
                     const backH = state.fullDims.h;
                     const backX = (state.fullDims.w - backW) / 2;

                     targetCtx.drawImage(backImg, backX, 0, backW, backH);
                     targetCtx.restore(); // Restore Geometry & Opacity
                }

                // Draw Front
                if (frontImg) {
                    const fCtx = state.previewFrontLayer.getContext('2d');
                    fCtx.clearRect(0, 0, w, h);

                    fCtx.save();
                    applyTransform(fCtx);

                    fCtx.globalCompositeOperation = 'source-over';
                    // Front Layer Scale? Usually 1 unless previewing downscaled.
                    // If frontLayer.scale != 1, we are drawing a downscaled working copy.
                    // That working copy represents the full image (0,0, fullW, fullH).
                    // So we draw it at (0,0) with size (fullW, fullH).
                    // `frontLayer.img` is the image.
                    // `frontLayer.scale` is how much it was downscaled FROM fullDims?
                    // No. `rebuildPreviewLayerForSlot` creates `pw` = `working.width * scale`.
                    // So `img` is size `pw x ph`.
                    // It represents `working` which is size `fullDims` (roughly).
                    // So we need to draw `img` to fill `fullDims`.
                    // `drawImage(img, 0, 0, state.fullDims.w, state.fullDims.h)`

                    // Wait, existing code:
                    // `drawImage(img, sX*scale, sY*scale, sW*scale, sH*scale, 0, 0, w, h)`
                    // It was mapping source-rect to dest-rect.
                    // Now we are using Transform.
                    // We draw the *Whole* image at (0,0) scaled to Truth Size.
                    // Truth Size = `state.fullDims`.
                    // `img` Size = `img.width`.
                    // We draw `drawImage(img, 0, 0, state.fullDims.w, state.fullDims.h)`.

                    const fImg = frontImg;
                    // Note: frontLayer.scale is helpful if we need to map input coords,
                    // but here we just stretch it to Truth Size.
                    fCtx.drawImage(fImg, 0, 0, state.fullDims.w, state.fullDims.h);

                    if (state.maskVisible) {
                        fCtx.globalCompositeOperation = 'destination-out';
                        // Mask Source
                        const maskSource = state.isPreviewing && state.previewMaskCanvas ? state.previewMaskCanvas : maskCanvas;
                        // Mask is always Full Resolution Truth (except previewMaskCanvas which might be scaled?)
                        // `state.previewMaskCanvas` logic in `input.js`:
                        // `pw = w * scale`.
                        // So if we use preview mask, we must draw it stretched to `state.fullDims`.
                         fCtx.drawImage(maskSource, 0, 0, state.fullDims.w, state.fullDims.h);
                    }

                    fCtx.restore(); // Restore Transform

                    // Composite Buffer to Target
                    targetCtx.globalCompositeOperation = 'source-over';
                    const singleLayer = !state.imgA || !state.imgB;
                    const effectiveOpacity = (singleLayer || !state.backVisible || forceOpacity) ? 1.0 : state.opacity;
                    targetCtx.globalAlpha = effectiveOpacity;
                    targetCtx.drawImage(state.previewFrontLayer, 0, 0);
                }
            } else {
                 // Nothing happened (restore transform if I polluted it? No, I used save/restore inside)
            }

            targetCtx.restore(); // Restore the save() I added at top?
            // I removed the top-level transform and pushed it down.
        }
        
        function render(finalOutput = false, skipAdjustments = false) {
            if (state.isAdjusting && !finalOutput) {
                 if (Date.now() - state.previewThrottle > 500) state.isAdjusting = false;
                 else return;
            }

            if (!state.cropRect && !state.isCropping) return;

            // Set Visual Dimensions (swapping if needed)
            const vDims = getVisualDims();
            // If cropping (full view), use full visual dims.
            // If not cropping (cropped view), use visual crop dims.
            let canvasW, canvasH;

            if (state.isCropping) {
                // Full Dims Swapped
                canvasW = vDims.w;
                canvasH = vDims.h;
            } else {
                // Crop Rect Swapped
                const vr = truthToVisualRect(state.cropRect);
                canvasW = vr.w;
                canvasH = vr.h;
            }

            if (els.mainCanvas.width !== canvasW || els.mainCanvas.height !== canvasH) {
                resizeMainCanvas(canvasW, canvasH);
            }

            const useBakedLayers = !skipAdjustments;
            const isAdjusting = state.isAdjusting;
            const resSetting = isAdjusting ? state.settings.adjustmentPreviewResolution : state.settings.brushPreviewResolution;
            const preferPreview = state.useFastPreview && !finalOutput && resSetting !== 'Full';
            const allowRebuild = !isUserInteracting();

            // We use renderToContext to handle all the complex rotation/transform logic now
            if (preferPreview) {
                 els.mainCanvas.style.visibility = 'hidden';
                 els.previewCanvas.classList.remove('hidden');

                 // Calculate Preview Size
                 // sH is Visual Height of viewport
                 const sH = canvasH;
                 const targetH = state.settings.brushPreviewResolution === 'Full' ? 100000 : (state.settings.brushPreviewResolution || 1080);
                 const fastScale = Math.min(1, targetH / sH);

                 const pw = Math.max(1, Math.round(canvasW * fastScale));
                 const ph = Math.max(1, Math.round(canvasH * fastScale));

                 if (els.previewCanvas.width !== pw || els.previewCanvas.height !== ph) {
                    els.previewCanvas.width = pw;
                    els.previewCanvas.height = ph;
                 }
                 const pCtx = els.previewCanvas.getContext('2d');

                 // Render to Preview (Visual Dims)
                 renderToContext(pCtx, pw, ph, false, useBakedLayers, preferPreview, allowRebuild);
            } else {
                els.mainCanvas.style.visibility = 'visible';
                els.previewCanvas.classList.add('hidden');
                
                // Render to Main (Visual Dims)
                renderToContext(ctx, canvasW, canvasH, false, useBakedLayers, preferPreview, allowRebuild);
            }
            
            // Update Crop DOM Overlay
            if (state.isCropping) {
                els.cropOverlayDom.style.display = 'block';
                // Transform Truth Crop Rect to Visual
                const r = truthToVisualRect(state.cropRect);
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
        function acceptCrop() {
            if (!state.isCropping) return;
            state.cropRectSnapshot = null;
            toggleCropMode();
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
                // Resize main canvas to full dims
                resizeMainCanvas(state.fullDims.w, state.fullDims.h);
                els.viewport.classList.add('cropping');
            } else {
                state.cropRectSnapshot = null;
                els.cropBtn.classList.remove('active', 'text-yellow-400');
                // Resize main canvas to crop rect
                resizeMainCanvas(state.cropRect.w, state.cropRect.h);
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
            els.undoBtn.disabled = state.historyIndex <= 0;
            els.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
            
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
             Logger.info(`Assigning Image to ${slot}: ${img.width}x${img.height}`);
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
        }

        function handleFileLoad(file, slot) {
            if (!file) return;
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

            // Bake rotation before processing paste
            if (state.rotation !== 0) bakeRotation();

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

                // Determine target state
                const hasA = !!state.imgA;
                const hasB = !!state.imgB;
                if (hasA && hasB) {
                    Logger.info("Paste ignored: Both slots full.", clipboardDump);
                    return;
                }

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
             if (state.rotation !== 0) bakeRotation();
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
                            updateLoadButton(els.btnA, "Base", "front");
                            els.btnA.classList.add('border-accent-strong', 'text-accent');
                            updateLoadButton(els.btnB, "Censored", "back");
                            els.btnB.classList.add('border-accent-strong', 'text-accent');

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
            if (state.rotation !== 0) bakeRotation();
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
                        updateLoadButton(els.btnA, "Merged", "front");
                        els.btnA.classList.add('border-accent-strong', 'text-accent');
                        updateLoadButton(els.btnB, "Load", "back");
                        els.btnB.classList.remove('border-accent-strong', 'text-accent');
                        
                        render(); updateUI();
                        log("Merge successful", "info");
                    };
                    newImg.src = dataURL;
                } catch (e) { console.error(e); }
            }, 50);
        }

        function saveImage() {
            if (!state.imgA && !state.imgB) return;
            if (state.rotation !== 0) bakeRotation();
            Logger.info("Exporting image...");
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
                Logger.info(`Export Complete: ${filename}`);
            } catch (e) {
                log("Save failed");
                Logger.error("Export Failed", e);
            }
        }

        init();
    
