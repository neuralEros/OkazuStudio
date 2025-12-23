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

        const state = {
            imgA: null, imgB: null, nameA: '', nameB: '', isAFront: true, 
            opacity: 0.8, brushPercent: 10, feather: 1, isErasing: true, isDrawing: false,
            maskVisible: true, backVisible: true, history: [], historyIndex: -1, lastActionType: null,
            isSpacePressed: false, isPanning: false, lastPanX: 0, lastPanY: 0, view: { x: 0, y: 0, scale: 1 }, lastSpaceUp: 0,
            isCtrlPressed: false, isPreviewing: false, lastPreviewTime: 0, previewMaskCanvas: null, previewLoopId: null,
            isPolylineStart: false, polylinePoints: [], polylineDirty: false, polylineSessionId: 0, currentPolylineAction: null, currentPointerX: null, currentPointerY: null,
            adjustments: { gamma: 1.0, levels: { black: 0, mid: 1.0, white: 255 }, shadows: 0, highlights: 0, saturation: 0, vibrance: 0, wb: 0, colorBal: { r: 0, g: 0, b: 0 } },
            isAdjusting: false, previewCanvas: null, previewFrontLayer: null, previewThrottle: 0,
            isCropping: false, cropRect: null, fullDims: { w: 0, h: 0 }, cropDrag: null
        };

        const els = {
            fileA: document.getElementById('fileA'), fileB: document.getElementById('fileB'),
            btnA: document.getElementById('btnA'), btnB: document.getElementById('btnB'),
            mainCanvas: document.getElementById('mainCanvas'), viewport: document.getElementById('viewport'),
            canvasWrapper: document.getElementById('canvas-wrapper'), emptyState: document.getElementById('empty-state'),
            swapBtn: document.getElementById('swapBtn'), opacitySlider: document.getElementById('opacitySlider'),
            opacityVal: document.getElementById('opacityVal'), brushSize: document.getElementById('brushSize'),
            brushSizeVal: document.getElementById('brushSizeVal'), feather: document.getElementById('feather'),
            featherVal: document.getElementById('featherVal'), eraseMode: document.getElementById('eraseMode'),
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
            cropOverlayDom: document.getElementById('crop-overlay-dom'), cropBox: document.getElementById('crop-box')
        };

        const ctx = els.mainCanvas.getContext('2d', { willReadFrequently: true });
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
        const frontLayerCanvas = document.createElement('canvas');
        const frontLayerCtx = frontLayerCanvas.getContext('2d');

        const {
            applyMasterLUT,
            applyColorOps,
            updateAdjustmentPreview,
            initAdjustments,
            resetAllAdjustments,
            updateSlider,
            setSaveSnapshotHandler
        } = createAdjustmentSystem({
            state,
            els,
            ctx,
            renderToContext,
            render
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
            updateUI
        });

        const {
            canDraw,
            resetView,
            updateCursorSize,
            attachInputHandlers
        } = createInputSystem({
            state,
            els,
            maskCtx,
            maskCanvas,
            render,
            saveSnapshot,
            undo,
            redo,
            showHints
        });

        setSaveSnapshotHandler(saveSnapshot);

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

        function init() {
            initAdjustments();
            window.addEventListener('pointerup', () => {
                if(state.isAdjusting) {
                    state.isAdjusting = false;
                    render();
                }
            });
            els.fileA.addEventListener('change', (e) => handleFileLoad(e.target.files[0], 'A'));
            els.fileB.addEventListener('change', (e) => handleFileLoad(e.target.files[0], 'B'));
            setupDragAndDrop();

            els.swapBtn.addEventListener('click', () => {
                [state.imgA, state.imgB] = [state.imgB, state.imgA];
                [state.nameA, state.nameB] = [state.nameB, state.nameA];
                els.btnA.textContent = truncate(state.nameA || "Load Img A");
                els.btnB.textContent = truncate(state.nameB || "Load Img B");
                if(state.imgA) els.btnA.classList.add('border-blue-500', 'text-blue-400');
                else els.btnA.classList.remove('border-blue-500', 'text-blue-400');
                if(state.imgB) els.btnB.classList.add('border-blue-500', 'text-blue-400');
                else els.btnB.classList.remove('border-blue-500', 'text-blue-400');
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
                state.brushPercent = parseInt(e.target.value);
                els.brushSizeVal.textContent = state.brushPercent;
                updateCursorSize();
            });
            els.feather.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                state.feather = val; 
                const hardness = Math.round(100 - (val / 20 * 100));
                els.featherVal.textContent = hardness + '%';
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

            log("Ready. Load images to begin.", "info");
            showHints();
        }

        // --- Core Rendering & Helper ---
        function renderToContext(targetCtx, w, h, forceOpacity = false) {
            targetCtx.clearRect(0, 0, w, h);

            const frontImg = state.isAFront ? state.imgA : state.imgB;
            const backImg = state.isAFront ? state.imgB : state.imgA;
            
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
                fCtx.drawImage(frontImg, sX, sY, sW, sH, 0, 0, w, h);

                if (state.maskVisible) {
                    fCtx.globalCompositeOperation = 'destination-out';
                    fCtx.drawImage(maskCanvas, sX, sY, sW, sH, 0, 0, w, h);
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
            
            ctx.clearRect(0, 0, cw, ch);
            
            // If cropping, draw full source image, then overlay
            // When !isCropping, the main canvas is sized to cropRect, so sX/Y is just cropRect.x/y
            const sX = state.isCropping ? 0 : state.cropRect.x;
            const sY = state.isCropping ? 0 : state.cropRect.y;
            const sW = state.isCropping ? state.fullDims.w : state.cropRect.w;
            const sH = state.isCropping ? state.fullDims.h : state.cropRect.h;

            const frontImg = state.isAFront ? state.imgA : state.imgB;
            const backImg = state.isAFront ? state.imgB : state.imgA;

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
                frontLayerCtx.clearRect(0, 0, cw, ch);
                frontLayerCtx.globalCompositeOperation = 'source-over';
                // Draw clipped portion of front image
                frontLayerCtx.drawImage(frontImg, sX, sY, sW, sH, 0, 0, cw, ch);

                let maskSource = maskCanvas;
                if (state.isPreviewing && state.previewMaskCanvas) {
                    maskSource = state.previewMaskCanvas;
                }

                if (state.maskVisible) {
                    frontLayerCtx.globalCompositeOperation = 'destination-out';
                    if (state.isPreviewing && state.previewMaskCanvas) {
                         // Scale logic for preview mask not needed here since we render 1:1 on main canvas usually
                         // But we need to clip the mask too
                         frontLayerCtx.drawImage(maskSource, sX, sY, sW, sH, 0, 0, cw, ch);
                    } else {
                         frontLayerCtx.drawImage(maskSource, sX, sY, sW, sH, 0, 0, cw, ch);
                    }
                }
                
                // 3. Composite Front to Main
                frontLayerCtx.globalCompositeOperation = 'source-over';
                const effectiveOpacity = (finalOutput || !state.backVisible) ? 1.0 : state.opacity;
                ctx.globalAlpha = effectiveOpacity;
                ctx.drawImage(frontLayerCanvas, 0, 0);
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
                document.querySelectorAll('.crop-handle').forEach(el => {
                    el.style.setProperty('--inv-scale', invScale);
                });
            } else {
                els.cropOverlayDom.style.display = 'none';
            }
            
            // 5. Apply Global Adjustments (Non-Destructive) - Only if NOT cropping (cropping shows raw)
            const a = state.adjustments;
            const needsAdj = a.gamma !== 1.0 || a.levels.black !== 0 || a.levels.mid !== 1.0 || a.levels.white !== 255 || 
                             a.saturation !== 0 || a.vibrance !== 0 || a.wb !== 0 ||
                             a.colorBal.r !== 0 || a.colorBal.g !== 0 || a.colorBal.b !== 0 ||
                             a.shadows !== 0 || a.highlights !== 0;

            if (needsAdj && !skipAdjustments && !state.isCropping) {
                const imgData = ctx.getImageData(0, 0, cw, ch);
                applyMasterLUT(imgData); 
                applyColorOps(imgData); 
                ctx.putImageData(imgData, 0, 0);
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
            } else {
                 els.eraseMode.disabled = false;
                 els.repairMode.disabled = false;
                 els.brushSize.disabled = false;
            }

            if(state.isAFront) {
                els.swapBtn.classList.remove('bg-blue-900', 'border-blue-500');
                els.swapBtn.classList.add('bg-gray-800', 'border-gray-600');
            } else {
                els.swapBtn.classList.add('bg-blue-900', 'border-blue-500');
                els.swapBtn.classList.remove('bg-gray-800', 'border-gray-600');
            }
            
            if (enable) {
                els.viewport.classList.remove('disabled');
            } else {
                els.viewport.classList.add('disabled');
                els.cursor.style.display = 'none';
            }
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
        }

        function handleFileLoad(file, slot) {
            if (!file) return;
            log(`Loading ${file.name}...`, "info");
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    if (slot === 'A') {
                        state.imgA = img;
                        state.nameA = file.name;
                        els.btnA.textContent = truncate(file.name);
                        els.btnA.classList.add('border-blue-500', 'text-blue-400');
                    } else {
                        state.imgB = img;
                        state.nameB = file.name;
                        els.btnB.textContent = truncate(file.name);
                        els.btnB.classList.add('border-blue-500', 'text-blue-400');
                    }
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
                    // Temporarily reset crop to full size for processing
                    const wasCropping = state.isCropping;
                    state.isCropping = false;
                    resizeMainCanvas(state.fullDims.w, state.fullDims.h);
                    
                    render(true, true); // Final, Skip Adjustments
                    const baseData = els.mainCanvas.toDataURL('image/png');
                    const imgBase = new Image();
                    imgBase.onload = () => {
                        state.imgA = imgBase; state.nameA = "Base Layer";
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
                            state.imgB = imgCensored; state.nameB = "Censored Layer";
                            
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
                            state.feather = 2; els.feather.value = 2; els.featherVal.textContent = "90%";
                            state.opacity = 1.0; els.opacitySlider.value = 100; els.opacityVal.textContent = "100%";
                            state.isAFront = true;
                            els.btnA.textContent = "Base"; els.btnA.classList.add('border-blue-500', 'text-blue-400');
                            els.btnB.textContent = "Censored"; els.btnB.classList.add('border-blue-500', 'text-blue-400');
                            
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
                        state.imgA = newImg; state.imgB = null;
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
                        
                        state.isAFront = true; state.opacity = 1.0;
                        els.opacitySlider.value = 100; els.opacityVal.textContent = "100%";
                        els.btnA.textContent = "Merged"; els.btnA.classList.add('border-blue-500', 'text-blue-400');
                        els.btnB.textContent = "Load Img B"; els.btnB.classList.remove('border-blue-500', 'text-blue-400');
                        
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
    
