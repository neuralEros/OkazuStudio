function createAdjustmentSystem({ state, els, ctx, renderToContext, render, scheduleHeavyTask }) {
    let gammaLUT = new Uint8Array(256);
    let currentGammaLUTValue = -1;
    let masterLUT = new Uint8Array(256);
    let currentLUTHash = "";
    let saveSnapshot = () => {};
    let updateWorkingCopies = () => {};

    function setSaveSnapshotHandler(handler) {
        if (typeof handler === 'function') {
            saveSnapshot = handler;
        }
    }

    function setUpdateWorkingCopiesHandler(handler) {
        if (typeof handler === 'function') {
            updateWorkingCopies = handler;
        }
    }

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

        const useShadows = shad !== 0;
        const useHighlights = high !== 0;
        const useSat = sat !== 0;
        const useVib = vib !== 0;
        const useWb = wb !== 0;
        const useColorBal = crSlider !== 0 || cgSlider !== 0 || cbSlider !== 0;

        if (!useShadows && !useHighlights && !useSat && !useVib && !useWb && !useColorBal) return;

        const data = imageData.data;
        const satMult = useSat ? 1 + (sat / 100) : 1;
        const cr = useColorBal ? getCurvedValue(crSlider) : 0;
        const cg = useColorBal ? getCurvedValue(cgSlider) : 0;
        const cb = useColorBal ? getCurvedValue(cbSlider) : 0;
        const wbR = useWb ? (wb > 0 ? 1 + (wb/200) : 1 - (Math.abs(wb)/400)) : 1;
        const wbB = useWb ? (wb < 0 ? 1 + (Math.abs(wb)/200) : 1 - (wb/400)) : 1;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i]; let g = data[i+1]; let b = data[i+2];
            const lum = 0.299*r + 0.587*g + 0.114*b;
            const normLum = lum / 255;

            if (useShadows || useHighlights) {
                if (useShadows) {
                     const sFactor = (1.0 - normLum) * (1.0 - normLum);
                     const sMult = 1 + (shad / 100) * sFactor;
                     r *= sMult; g *= sMult; b *= sMult;
                }
                if (useHighlights) {
                     const hFactor = normLum * normLum;
                     const hMult = 1 + (high / 100) * hFactor;
                     r *= hMult; g *= hMult; b *= hMult;
                }
            }

            if (useSat || useVib) {
                const gray = 0.299*r + 0.587*g + 0.114*b;
                if (useSat) {
                    r = gray + (r - gray) * satMult;
                    g = gray + (g - gray) * satMult;
                    b = gray + (b - gray) * satMult;
                }
                if (useVib) {
                    const max = Math.max(r, g, b);
                    const satVal = (max - gray) / 255;
                    const vMult = (vib / 100) * 2.0 * (1 - satVal);
                    const scale = 1 + vMult;
                    r = gray + (r - gray) * scale;
                    g = gray + (g - gray) * scale;
                    b = gray + (b - gray) * scale;
                }
            }

            if (useWb) {
                const oldLum = 0.299*r + 0.587*g + 0.114*b;
                r *= wbR; b *= wbB;
                const newLum = 0.299*r + 0.587*g + 0.114*b;
                if (newLum > 0.01) {
                     const scale = oldLum / newLum;
                     r *= scale; g *= scale; b *= scale;
                }
            }

            if (useColorBal) {
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

        const w = els.mainCanvas.width;
        const h = els.mainCanvas.height;

        // If Full resolution, render directly to main canvas context
        if (state.settings.adjustmentPreviewResolution === 'Full') {
             els.mainCanvas.style.visibility = 'visible';
             els.previewCanvas.classList.add('hidden');

             // Render source (raw) to main canvas
             renderToContext(ctx, w, h, true, false);

             // Apply adjustments live
             const imgData = ctx.getImageData(0, 0, w, h);
             applyMasterLUT(imgData);
             applyColorOps(imgData);
             ctx.putImageData(imgData, 0, 0);
             return;
        }

        if (!state.previewFrontLayer) state.previewFrontLayer = document.createElement('canvas');

        const targetH = state.settings.adjustmentPreviewResolution || 1080;
        const scale = Math.min(1, targetH / h);
        const pw = Math.floor(w * scale);
        const ph = Math.floor(h * scale);

        const pCanvas = els.previewCanvas;
        if (pCanvas.width !== pw || pCanvas.height !== ph) {
            pCanvas.width = pw;
            pCanvas.height = ph;
            state.previewFrontLayer.width = pw;
            state.previewFrontLayer.height = ph;
        }

        els.mainCanvas.style.visibility = 'hidden';
        pCanvas.classList.remove('hidden');

        const pCtx = pCanvas.getContext('2d');
        renderToContext(pCtx, pw, ph, true, false);
        const imgData = pCtx.getImageData(0, 0, pw, ph);
        applyMasterLUT(imgData);
        applyColorOps(imgData);
        pCtx.putImageData(imgData, 0, 0);
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
         updateWorkingCopies();
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
                state.pendingAdjustmentCommit = true;
                saveSnapshot(actionKey);
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
            state.pendingAdjustmentCommit = true;
            updateAdjustmentPreview();
            saveSnapshot('adjustments_reset');
        });

        els.resetLevelsBtn.addEventListener('click', () => {
            const l = state.adjustments.levels;
            if (l.black === 0 && l.mid === 1.0 && l.white === 255) return;
            state.adjustments.levels = { black: 0, mid: 1.0, white: 255 };
            updateSlider('adj-l-black', 0);
            updateSlider('adj-l-mid', 1.0);
            updateSlider('adj-l-white', 255);
            state.pendingAdjustmentCommit = true;
            updateAdjustmentPreview();
            saveSnapshot('levels_reset');
        });

        document.getElementById('resetSatBtn').addEventListener('click', () => {
             if (state.adjustments.saturation === 0 && state.adjustments.vibrance === 0) return;
             state.adjustments.saturation = 0;
             state.adjustments.vibrance = 0;
             updateSlider('adj-sat', 0);
             updateSlider('adj-vib', 0);
             state.pendingAdjustmentCommit = true;
             updateAdjustmentPreview();
             saveSnapshot('sat_reset');
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
             state.pendingAdjustmentCommit = true;
             updateAdjustmentPreview();
             saveSnapshot('color_reset');
        });
    }

    return { applyMasterLUT, applyColorOps, updateAdjustmentPreview, initAdjustments, resetAllAdjustments, updateSlider, setSaveSnapshotHandler, setUpdateWorkingCopiesHandler };
}
