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

        let gammaLUT = new Uint8Array(256);
        let currentGammaLUTValue = -1;
        let masterLUT = new Uint8Array(256);
        let currentLUTHash = "";

        function getCurvedValue(sliderVal) {
            const abs = Math.abs(sliderVal);
            const sign = Math.sign(sliderVal);
            let effective = 0;
            if (abs <= 80) effective = (abs / 80) * 50;
            else effective = 50 + ((abs - 80) / 20) * 50;
            return Math.round(sign * effective);
        }

        function updateMasterLUT() {
            const g = state.adjustments.gamma;
            const l = state.adjustments.levels;
            const hash = `${g}-${l.black}-${l.mid}-${l.white}`;
            if (hash === currentLUTHash) return;
            const invGamma = 1 / g; 
            const invMid = 1 / l.mid;
            const blackNorm = l.black / 255;
            const whiteNorm = l.white / 255;
            const range = whiteNorm - blackNorm;
            for (let i = 0; i < 256; i++) {
                let n = i / 255;
                if (range <= 0.001) n = (n > blackNorm) ? 1.0 : 0.0;
                else n = (n - blackNorm) / range;
                if (n < 0) n = 0; if (n > 1) n = 1;
                n = Math.pow(n, invMid);
                n = Math.pow(n, invGamma);
                if (n < 0) n = 0; if (n > 1) n = 1;
                masterLUT[i] = n * 255;
            }
            currentLUTHash = hash;
        }

        function applyMasterLUT(imageData) {
            const data = imageData.data;
            const g = state.adjustments.gamma;
            const l = state.adjustments.levels;
            if (Math.abs(g - 1.0) < 0.01 && l.black === 0 && Math.abs(l.mid - 1.0) < 0.01 && l.white === 255) return;
            updateMasterLUT();
            for (let i = 0; i < data.length; i += 4) {
                data[i] = masterLUT[data[i]]; data[i+1] = masterLUT[data[i+1]]; data[i+2] = masterLUT[data[i+2]]; 
            }
        }

        function applyColorOps(imageData) {
            const a = state.adjustments;
            const sat = a.saturation; const vib = a.vibrance; const wb = a.wb;
            const shad = a.shadows; const high = a.highlights;
            const crSlider = a.colorBal.r; const cgSlider = a.colorBal.g; const cbSlider = a.colorBal.b;
            if (sat === 0 && vib === 0 && wb === 0 && shad === 0 && high === 0 && crSlider === 0 && cgSlider === 0 && cbSlider === 0) return;
            const data = imageData.data;
            const satMult = 1 + (sat / 100);
            const cr = getCurvedValue(crSlider); const cg = getCurvedValue(cgSlider); const cb = getCurvedValue(cbSlider);
            const wbR = wb > 0 ? 1 + (wb/200) : 1 - (Math.abs(wb)/400); 
            const wbB = wb < 0 ? 1 + (Math.abs(wb)/200) : 1 - (wb/400);

            for (let i = 0; i < data.length; i += 4) {
                let r = data[i]; let g = data[i+1]; let b = data[i+2];
                const lum = 0.299*r + 0.587*g + 0.114*b;
                const normLum = lum / 255;
                if (shad !== 0 || high !== 0) {
                    if (shad !== 0) {
                         const sFactor = (1.0 - normLum) * (1.0 - normLum);
                         const sMult = 1 + (shad / 100) * sFactor;
                         r *= sMult; g *= sMult; b *= sMult;
                    }
                    if (high !== 0) {
                         const hFactor = normLum * normLum;
                         const hMult = 1 + (high / 100) * hFactor;
                         r *= hMult; g *= hMult; b *= hMult;
                    }
                }
                if (sat !== 0 || vib !== 0) {
                    const gray = 0.299*r + 0.587*g + 0.114*b;
                    if (sat !== 0) {
                        r = gray + (r - gray) * satMult;
                        g = gray + (g - gray) * satMult;
                        b = gray + (b - gray) * satMult;
                    }
                    if (vib !== 0) {
                        const max = Math.max(r, g, b);
                        const satVal = (max - gray) / 255; 
                        const vMult = (vib / 100) * 2.0 * (1 - satVal); 
                        const scale = 1 + vMult;
                        r = gray + (r - gray) * scale;
                        g = gray + (g - gray) * scale;
                        b = gray + (b - gray) * scale;
                    }
                }
                if (wb !== 0) {
                    const oldLum = 0.299*r + 0.587*g + 0.114*b;
                    r *= wbR; b *= wbB;
                    const newLum = 0.299*r + 0.587*g + 0.114*b;
                    if (newLum > 0.01) {
                         const scale = oldLum / newLum;
                         r *= scale; g *= scale; b *= scale;
                    }
                }
                if (cr !== 0 || cg !== 0 || cb !== 0) {
                    const oldLum = 0.299*r + 0.587*g + 0.114*b;
                    r += cr; g += cg; b += cb;
                    const rClamped = Math.max(0, r); const gClamped = Math.max(0, g); const bClamped = Math.max(0, b);
                    const newLum = 0.299*rClamped + 0.587*gClamped + 0.114*bClamped;
                    if (newLum > 0.01) {
                        const scale = oldLum / newLum;
                        r = rClamped * scale; g = gClamped * scale; b = bClamped * scale;
                    } else {
                        r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
                    }
                }
                data[i] = Math.min(255, Math.max(0, r));
                data[i+1] = Math.min(255, Math.max(0, g));
                data[i+2] = Math.min(255, Math.max(0, b));
            }
        }

        function updateAdjustmentPreview() {
            if (!state.imgA && !state.imgB) return;
            const now = Date.now();
            if (now - state.previewThrottle < 100) return; 
            state.previewThrottle = now;
            if (!state.previewCanvas) state.previewCanvas = document.createElement('canvas');
            if (!state.previewFrontLayer) state.previewFrontLayer = document.createElement('canvas');
            
            // Adjust to use current view size (cropped or full)
            const w = els.mainCanvas.width;
            const h = els.mainCanvas.height;
            const scale = Math.min(1, 1920 / Math.max(w, h));
            const pw = Math.floor(w * scale);
            const ph = Math.floor(h * scale);

            if (state.previewCanvas.width !== pw || state.previewCanvas.height !== ph) {
                state.previewCanvas.width = pw;
                state.previewCanvas.height = ph;
                state.previewFrontLayer.width = pw;
                state.previewFrontLayer.height = ph;
            }
            const pCtx = state.previewCanvas.getContext('2d');
            renderToContext(pCtx, pw, ph, true); 
            const imgData = pCtx.getImageData(0, 0, pw, ph);
            applyMasterLUT(imgData); 
            applyColorOps(imgData);  
            pCtx.putImageData(imgData, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = false; 
            ctx.globalAlpha = 1.0; 
            ctx.drawImage(state.previewCanvas, 0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
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

            els.viewport.addEventListener('pointerdown', handlePointerDown);
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            els.viewport.addEventListener('wheel', handleWheel, { passive: false });
            els.viewport.addEventListener('contextmenu', e => e.preventDefault());

            window.addEventListener('keydown', (e) => {
                showHints(); 
                if (e.code === 'Space' && !e.repeat) {
                    e.preventDefault(); 
                    state.isSpacePressed = true;
                    updateCursorStyle();
                    const now = Date.now();
                    if (now - state.lastSpaceUp < 250) resetView();
                }
                if ((e.ctrlKey || e.metaKey) && !e.repeat && !state.isCropping) {
                    state.isCtrlPressed = true;
                    state.polylineSessionId += 1;
                    state.currentPolylineAction = `polyline-${state.polylineSessionId}`;
                    state.isPolylineStart = true;
                    state.lastDrawX = null;
                    state.polylinePoints = [];
                    state.polylineDirty = false;
                    startPreviewLoop();
                }
                if (e.key === '[' || e.key === ']') {
                    const delta = e.key === '[' ? -1 : 1;
                    let newSize = state.brushPercent + delta;
                    newSize = Math.max(1, Math.min(30, newSize));
                    state.brushPercent = newSize;
                    els.brushSize.value = newSize;
                    els.brushSizeVal.textContent = newSize;
                    updateCursorSize();
                }
                if ((e.ctrlKey || e.metaKey)) {
                    if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
                    else if (e.key === 'y') { e.preventDefault(); redo(); }
                }
            });

            window.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    state.isSpacePressed = false;
                    state.isPanning = false; 
                    state.lastSpaceUp = Date.now();
                    updateCursorStyle();
                }
                if (e.key === 'Control' || e.key === 'Meta') {
                    if (state.polylineDirty) {
                        const actionType = state.currentPolylineAction || 'mask';
                        saveSnapshot(actionType);
                        state.polylineDirty = false;
                    }
                    state.isCtrlPressed = false;
                    state.currentPolylineAction = null;
                    state.isPreviewing = false;
                    state.isPolylineStart = false;
                    state.lastDrawX = null;
                    state.polylinePoints = [];
                    stopPreviewLoop();
                    render(); 
                }
            });
            
            log("Ready. Load images to begin.", "info");
            showHints(); 
        }

        // --- Adjustment UI Logic ---
        function initAdjustments() {
            function attach(id, key, subkey, type='float') {
                const el = document.getElementById(id);
                const label = document.getElementById('val-' + id.replace('adj-', ''));
                const actionKey = `adjustment-${id}`;
                if(!el) return;
                
                el.addEventListener('input', (e) => {
                    let val = parseFloat(e.target.value);
                    if (subkey) state.adjustments[key][subkey] = val;
                    else state.adjustments[key] = val;

                    if (type === 'curve') label.textContent = getCurvedValue(val);
                    else if (type === 'float') label.textContent = val.toFixed(2);
                    else if (type === 'K') label.textContent = (6500 + val*30) + 'K';
                    else label.textContent = val;

                    state.isAdjusting = true;
                    updateAdjustmentPreview();
                });

                el.addEventListener('change', (e) => {
                    state.isAdjusting = false;
                    saveSnapshot(actionKey);
                    render();
                });
            }

            attach('adj-gamma', 'gamma');
            attach('adj-shadows', 'shadows', null, 'int');
            attach('adj-highlights', 'highlights', null, 'int');
            attach('adj-l-black', 'levels', 'black', 'int');
            attach('adj-l-mid', 'levels', 'mid', 'float');
            attach('adj-l-white', 'levels', 'white', 'int');
            attach('adj-sat', 'saturation', null, 'int');
            attach('adj-vib', 'vibrance', null, 'int');
            attach('adj-wb', 'wb', null, 'K');
            attach('adj-cb-r', 'colorBal', 'r', 'curve');
            attach('adj-cb-g', 'colorBal', 'g', 'curve');
            attach('adj-cb-b', 'colorBal', 'b', 'curve');

            els.resetAdjBtn.addEventListener('click', () => {
                const a = state.adjustments;
                if (a.gamma === 1.0 && a.levels.black === 0 && a.levels.mid === 1.0 && a.levels.white === 255 &&
                    a.saturation === 0 && a.vibrance === 0 && a.wb === 0 && 
                    a.colorBal.r === 0 && a.colorBal.g === 0 && a.colorBal.b === 0 &&
                    a.shadows === 0 && a.highlights === 0) return;

                resetAllAdjustments();
                saveSnapshot('adjustments_reset');
                render();
            });

            els.resetLevelsBtn.addEventListener('click', () => {
                const l = state.adjustments.levels;
                if (l.black === 0 && l.mid === 1.0 && l.white === 255) return;
                state.adjustments.levels = { black: 0, mid: 1.0, white: 255 };
                updateSlider('adj-l-black', 0);
                updateSlider('adj-l-mid', 1.0);
                updateSlider('adj-l-white', 255);
                saveSnapshot('levels_reset');
                render();
            });

            document.getElementById('resetSatBtn').addEventListener('click', () => {
                 if (state.adjustments.saturation === 0 && state.adjustments.vibrance === 0) return;
                 state.adjustments.saturation = 0;
                 state.adjustments.vibrance = 0;
                 updateSlider('adj-sat', 0);
                 updateSlider('adj-vib', 0);
                 saveSnapshot('sat_reset');
                 render();
            });
            
            els.resetColorBtn.addEventListener('click', () => {
                 const a = state.adjustments;
                 if (a.wb === 0 && a.colorBal.r === 0 && a.colorBal.g === 0 && a.colorBal.b === 0) return;
                 state.adjustments.wb = 0;
                 state.adjustments.colorBal = { r:0, g:0, b:0 };
                 updateSlider('adj-wb', 0);
                 updateSlider('adj-cb-r', 0);
                 updateSlider('adj-cb-g', 0);
                 updateSlider('adj-cb-b', 0);
                 saveSnapshot('color_reset');
                 render();
            });
        }

        function resetAllAdjustments() {
             state.adjustments = { 
                 gamma: 1.0, 
                 levels: { black: 0, mid: 1.0, white: 255 },
                 saturation: 0, vibrance: 0,
                 wb: 0, colorBal: { r:0, g:0, b:0 },
                 shadows: 0, highlights: 0
             };
             updateSlider('adj-gamma', 1.0);
             updateSlider('adj-l-black', 0);
             updateSlider('adj-l-mid', 1.0);
             updateSlider('adj-l-white', 255);
             updateSlider('adj-sat', 0);
             updateSlider('adj-vib', 0);
             updateSlider('adj-wb', 0);
             updateSlider('adj-cb-r', 0);
             updateSlider('adj-cb-g', 0);
             updateSlider('adj-cb-b', 0);
             updateSlider('adj-shadows', 0);
             updateSlider('adj-highlights', 0);
        }

        function updateSlider(id, val) {
            const el = document.getElementById(id);
            if(el) {
                el.value = val;
                const label = document.getElementById('val-' + id.replace('adj-', ''));
                if (label) {
                     if (id.startsWith('adj-cb')) label.textContent = getCurvedValue(val);
                     else if (id === 'adj-wb') label.textContent = (6500 + val*30) + 'K';
                     else if (el.step === '0.01' || el.step === '0.1') label.textContent = parseFloat(val).toFixed(2);
                     else label.textContent = val;
                }
            }
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

        function resetView() {
            // Relaxed check: allow view manipulation with just one image
            if (!state.imgA && !state.imgB) return;
            const vpW = els.viewport.clientWidth;
            const vpH = els.viewport.clientHeight;
            const cW = els.mainCanvas.width;
            const cH = els.mainCanvas.height;
            const scale = Math.min((vpW - 40) / cW, (vpH - 40) / cH);
            const x = (vpW - cW * scale) / 2;
            const y = (vpH - cH * scale) / 2;
            state.view = { x, y, scale };
            updateViewTransform();
        }

        function updateViewTransform() {
            els.canvasWrapper.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`;
            updateCursorSize();
        }

        function updateCursorSize() {
            if(!canDraw()) return;
            const visualSize = getBrushPixelSize() * state.view.scale;
            els.cursor.style.width = visualSize + 'px';
            els.cursor.style.height = visualSize + 'px';
        }

        function updateCursorPos(e) {
            if (!canDraw() || state.isPanning || state.isSpacePressed || state.isCropping) {
                els.cursor.style.display = 'none';
                return;
            }
            const rect = els.viewport.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && 
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                els.cursor.style.display = 'block';
                els.cursor.style.left = e.clientX + 'px';
                els.cursor.style.top = e.clientY + 'px';
            } else {
                els.cursor.style.display = 'none';
            }
        }

        function getCanvasCoordinates(e) {
            const rect = els.viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Canvas coordinates in current display canvas (could be cropped)
            const canvasX = (mouseX - state.view.x) / state.view.scale;
            const canvasY = (mouseY - state.view.y) / state.view.scale;
            
            // If NOT cropping, we need to add the offset
            if (!state.isCropping) {
                 // Check if cropRect exists
                 if (state.cropRect) {
                     return { x: canvasX + state.cropRect.x, y: canvasY + state.cropRect.y };
                 }
            }
            return { x: canvasX, y: canvasY };
        }

        function canDraw() { return (state.imgA || state.imgB) && state.cropRect; }
        function getBrushPixelSize() {
            if (state.fullDims.h === 0) return 20;
            return (state.brushPercent / 100) * state.fullDims.h;
        }

        // --- Drawing / Input Logic ---
        
        function handlePointerDown(e) {
            if (!canDraw()) return;
            const coords = getCanvasCoordinates(e);
            state.currentPointerX = coords.x;
            state.currentPointerY = coords.y;

            if (state.isSpacePressed || e.button === 1) { 
                state.isPanning = true;
                state.lastPanX = e.clientX;
                state.lastPanY = e.clientY;
                updateCursorStyle();
                return;
            } 
            
            // Crop Interaction with DOM
            // Mouse events on crop handles/box are handled by DOM listeners below to be cleaner
            if (state.isCropping) return;

            if (e.button === 0 && !state.isCropping) {
                if (state.isCtrlPressed) {
                    // Polyline
                    if (state.isPolylineStart) {
                        state.lastDrawX = coords.x;
                        state.lastDrawY = coords.y;
                        state.isPolylineStart = false; 
                        state.polylinePoints = [{x: coords.x, y: coords.y}]; 
                    } else {
                        // Loop Check
                        const threshold = getBrushPixelSize();
                        const startPt = state.polylinePoints[0];
                        const dist = Math.hypot(coords.x - startPt.x, coords.y - startPt.y);
                        
                        if (state.polylinePoints.length > 2 && dist < threshold) {
                            // Close Loop
                            drawStrokeDistance(coords.x, coords.y);
                            state.polylinePoints.push({x: coords.x, y: coords.y});
                            state.lastDrawX = coords.x;
                            state.lastDrawY = coords.y;
                            drawStrokeDistance(startPt.x, startPt.y);
                            maskCtx.beginPath();
                            maskCtx.moveTo(state.polylinePoints[0].x, state.polylinePoints[0].y);
                            for(let i=1; i<state.polylinePoints.length; i++) maskCtx.lineTo(state.polylinePoints[i].x, state.polylinePoints[i].y);
                            maskCtx.closePath();
                            if (state.isErasing) {
                                maskCtx.globalCompositeOperation = 'source-over';
                                maskCtx.fillStyle = 'white';
                            } else {
                                maskCtx.globalCompositeOperation = 'destination-out';
                                maskCtx.fillStyle = 'black';
                            }
                            maskCtx.fill();
                            state.isPolylineStart = true;
                            state.polylinePoints = [];
                            state.lastDrawX = null;
                            const actionType = state.currentPolylineAction || 'draw';
                            saveSnapshot(actionType);
                            state.polylineDirty = false;
                            render();
                            return;
                        }
                        if(state.polylinePoints.length === 1) drawBrushStamp(state.lastDrawX, state.lastDrawY);
                        drawStrokeDistance(coords.x, coords.y); 
                        state.lastDrawX = coords.x;
                        state.lastDrawY = coords.y;
                        state.polylinePoints.push({x: coords.x, y: coords.y});
                        state.polylineDirty = true; 
                    }
                    render();
                    return;
                }

                state.isDrawing = true;
                state.lastDrawX = null;
                state.lastDrawY = null;
                drawBrushStamp(coords.x, coords.y);
                state.lastDrawX = coords.x;
                state.lastDrawY = coords.y;
                render();
            }
        }

        // DOM Crop Listeners
        const cropHandlers = () => {
             const getScale = () => state.view.scale;
             const handles = document.querySelectorAll('.crop-handle');
             let dragStart = null;
             
             handles.forEach(h => {
                 h.addEventListener('pointerdown', (e) => {
                     e.stopPropagation();
                     const rect = els.viewport.getBoundingClientRect();
                     // Mouse X in canvas space (full image space because mainCanvas = full size in crop mode)
                     const mx = (e.clientX - rect.left - state.view.x) / state.view.scale;
                     const my = (e.clientY - rect.top - state.view.y) / state.view.scale;
                     state.cropDrag = { type: 'handle', h: h.dataset.handle };
                 });
             });
             
             els.cropBox.addEventListener('pointerdown', (e) => {
                 if (e.target !== els.cropBox) return; // ignore handles
                 e.stopPropagation();
                 const rect = els.viewport.getBoundingClientRect();
                 const mx = (e.clientX - rect.left - state.view.x) / state.view.scale;
                 const my = (e.clientY - rect.top - state.view.y) / state.view.scale;
                 state.cropDrag = { 
                     type: 'box', 
                     startX: mx, 
                     startY: my, 
                     startRect: { ...state.cropRect } 
                 };
             });
        }
        // Call in init
        
        function handlePointerMove(e) {
            updateCursorPos(e);
            if (!state.cropRect) return; 
            const coords = getCanvasCoordinates(e);
            state.currentPointerX = coords.x;
            state.currentPointerY = coords.y;

            if (state.isPanning) {
                const dx = e.clientX - state.lastPanX;
                const dy = e.clientY - state.lastPanY;
                let newX = state.view.x + dx;
                let newY = state.view.y + dy;
                // Boundaries relative to viewport size
                const overlap = 50;
                const vpW = els.viewport.clientWidth;
                const vpH = els.viewport.clientHeight;
                // Width depends on current canvas size (crop vs full)
                const cW = els.mainCanvas.width * state.view.scale;
                const cH = els.mainCanvas.height * state.view.scale;

                if (newX > vpW - overlap) newX = vpW - overlap;
                if (newX < overlap - cW) newX = overlap - cW;
                if (newY > vpH - overlap) newY = vpH - overlap;
                if (newY < overlap - cH) newY = overlap - cH;

                state.view.x = newX;
                state.view.y = newY;
                state.lastPanX = e.clientX;
                state.lastPanY = e.clientY;
                updateViewTransform();
            } else if (state.isCropping && state.cropDrag) {
                 // Raw mouse coords converted to full image space
                 const rect = els.viewport.getBoundingClientRect();
                 const mx = (e.clientX - rect.left - state.view.x) / state.view.scale;
                 const my = (e.clientY - rect.top - state.view.y) / state.view.scale;
                 
                 const r = state.cropRect;
                 
                 if (state.cropDrag.type === 'box') {
                     const dx = mx - state.cropDrag.startX;
                     const dy = my - state.cropDrag.startY;
                     const sr = state.cropDrag.startRect;
                     r.x = Math.max(0, Math.min(state.fullDims.w - r.w, sr.x + dx));
                     r.y = Math.max(0, Math.min(state.fullDims.h - r.h, sr.y + dy));
                 } else {
                     const h = state.cropDrag.h;
                     // Simple handle logic (min size 10x10)
                     if (h === 'nw') {
                         const oldR = r.x + r.w; const oldB = r.y + r.h;
                         r.x = Math.min(mx, oldR - 10);
                         r.x = Math.max(0, r.x);
                         r.y = Math.min(my, oldB - 10);
                         r.y = Math.max(0, r.y);
                         r.w = oldR - r.x;
                         r.h = oldB - r.y;
                     } else if (h === 'se') {
                         r.w = Math.max(10, Math.min(state.fullDims.w - r.x, mx - r.x));
                         r.h = Math.max(10, Math.min(state.fullDims.h - r.y, my - r.y));
                     } else if (h === 'ne') {
                         const oldB = r.y + r.h;
                         r.y = Math.min(my, oldB - 10);
                         r.y = Math.max(0, r.y);
                         r.h = oldB - r.y;
                         r.w = Math.max(10, Math.min(state.fullDims.w - r.x, mx - r.x));
                     } else if (h === 'sw') {
                         const oldR = r.x + r.w;
                         r.x = Math.min(mx, oldR - 10);
                         r.x = Math.max(0, r.x);
                         r.w = oldR - r.x;
                         r.h = Math.max(10, Math.min(state.fullDims.h - r.y, my - r.y));
                     }
                 }
                 render();
            } else if (state.isDrawing) {
                drawStrokeDistance(coords.x, coords.y);
                render();
            }
        }

        function handlePointerUp() {
            if (state.isDrawing) saveSnapshot('draw');
            if (state.isCropping && state.cropDrag) {
                state.cropDrag = null;
                saveSnapshot('crop');
            }
            state.isPanning = false;
            state.isDrawing = false;
            updateCursorStyle();
        }

        function drawStrokeDistance(x, y, context = maskCtx, isPreview = false) {
            const startX = state.lastDrawX;
            const startY = state.lastDrawY;
            if (startX === null || startY === null) {
                drawBrushStamp(x, y, context);
                if (!isPreview) {
                    state.lastDrawX = x;
                    state.lastDrawY = y;
                }
                return;
            }
            const dx = x - startX;
            const dy = y - startY;
            const dist = Math.hypot(dx, dy);
            const size = getBrushPixelSize();
            const spacing = Math.max(1, size * 0.15);
            // Always stamp the endpoints so short moves still render visible circles.
            drawBrushStamp(startX, startY, context);
            if (dist >= spacing) {
                const steps = dist / spacing;
                const stepX = dx / steps;
                const stepY = dy / steps;
                for (let i = 1; i <= steps; i++) {
                    const drawX = startX + stepX * i;
                    const drawY = startY + stepY * i;
                    drawBrushStamp(drawX, drawY, context);
                }
            }
            drawBrushStamp(x, y, context);
            if (!isPreview) {
                state.lastDrawX = x;
                state.lastDrawY = y;
            }
        }

        function drawBrushStamp(x, y, context = maskCtx) {
            const size = getBrushPixelSize();
            const radius = size / 2;
            const softness = state.feather / 20; 
            if (state.isErasing) {
                context.globalCompositeOperation = 'source-over';
                if (softness === 0) {
                    context.fillStyle = 'white';
                    context.beginPath();
                    context.arc(x, y, radius, 0, Math.PI * 2);
                    context.fill();
                } else {
                    const grad = context.createRadialGradient(x, y, radius * (1 - softness), x, y, radius);
                    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
                    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    context.fillStyle = grad;
                    context.beginPath();
                    context.arc(x, y, radius, 0, Math.PI * 2);
                    context.fill();
                }
            } else {
                context.globalCompositeOperation = 'destination-out';
                if (softness === 0) {
                    context.fillStyle = 'black'; 
                    context.beginPath();
                    context.arc(x, y, radius, 0, Math.PI * 2);
                    context.fill();
                } else {
                    const grad = context.createRadialGradient(x, y, radius * (1 - softness), x, y, radius);
                    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    context.fillStyle = grad;
                    context.beginPath();
                    context.arc(x, y, radius, 0, Math.PI * 2);
                    context.fill();
                }
            }
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

        function updateCursorStyle() {
            if (!canDraw()) return;
            if (state.isSpacePressed || state.isPanning) {
                els.viewport.classList.add('panning');
                els.cursor.style.display = 'none'; 
            } else {
                els.viewport.classList.remove('panning');
                if(!state.isCropping) els.cursor.style.display = 'block';
            }
        }
        
        // Ctrl preview loop
        function startPreviewLoop() {
            if (state.previewLoopId) return;
            const loop = () => {
                if (!state.isCtrlPressed) return;
                const now = Date.now();
                if (now - state.lastPreviewTime > 50) { 
                     updateLinePreview();
                     state.lastPreviewTime = now;
                }
                state.previewLoopId = requestAnimationFrame(loop);
            };
            state.previewLoopId = requestAnimationFrame(loop);
        }
        function stopPreviewLoop() {
            if (state.previewLoopId) {
                cancelAnimationFrame(state.previewLoopId);
                state.previewLoopId = null;
            }
        }
        function updateLinePreview() {
            if (state.lastDrawX === null || state.currentPointerX === null) return;
            const maxDim = 1920; 
            const w = maskCanvas.width; const h = maskCanvas.height;
            const scale = Math.min(1, maxDim / Math.max(w, h));
            if (!state.previewMaskCanvas) state.previewMaskCanvas = document.createElement('canvas');
            const pw = Math.floor(w * scale); const ph = Math.floor(h * scale);
            if(state.previewMaskCanvas.width !== pw || state.previewMaskCanvas.height !== ph) {
                state.previewMaskCanvas.width = pw; state.previewMaskCanvas.height = ph;
            }
            const pCtx = state.previewMaskCanvas.getContext('2d');
            pCtx.clearRect(0, 0, pw, ph);
            pCtx.drawImage(maskCanvas, 0, 0, pw, ph);
            pCtx.save(); pCtx.scale(scale, scale);
            if (state.isPolylineStart && state.lastDrawX !== null) {
                 drawBrushStamp(state.lastDrawX, state.lastDrawY, pCtx);
            }
            drawStrokeDistance(state.currentPointerX, state.currentPointerY, pCtx, true);
            pCtx.restore();
            state.isPreviewing = true;
            render();
        }

        function handleWheel(e) {
            if (!canDraw()) return;
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const delta = -Math.sign(e.deltaY); 
                let newSize = state.brushPercent + delta; 
                newSize = Math.max(1, Math.min(30, newSize));
                state.brushPercent = newSize;
                els.brushSize.value = newSize;
                els.brushSizeVal.textContent = newSize;
                updateCursorSize();
                return;
            }
            const zoomSpeed = 0.1;
            const delta = -Math.sign(e.deltaY) * zoomSpeed;
            const newScale = Math.max(0.1, Math.min(10, state.view.scale * (1 + delta)));
            const rect = els.viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const canvasX = (mouseX - state.view.x) / state.view.scale;
            const canvasY = (mouseY - state.view.y) / state.view.scale;
            state.view.scale = newScale;
            state.view.x = mouseX - canvasX * newScale;
            state.view.y = mouseY - canvasY * newScale;
            updateViewTransform();
            updateCursorPos(e);
        }

        init();
        cropHandlers(); // Attach DOM listeners
    
