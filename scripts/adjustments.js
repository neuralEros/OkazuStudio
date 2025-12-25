function createAdjustmentSystem({ state, els, ctx, renderToContext, render, scheduleHeavyTask }) {
    let gammaLUT = new Uint8Array(256);
    let currentGammaLUTValue = -1;
    let masterLUT = new Uint8Array(256);
    let currentLUTHash = "";
    let hueCorrectionLUT = [];
    let hasActiveColorTuning = false;
    let saveSnapshot = () => {};
    let updateWorkingCopies = () => {};

    const BAND_CENTERS = {
        red: 0,
        orange: 30,
        yellow: 60,
        green: 120,
        aqua: 180,
        blue: 240,
        purple: 280,
        magenta: 315
    };

    // Precompute a smooth falloff weight for a given hue relative to a target center
    function getBandWeight(hue, centerHue) {
        let diff = Math.abs(hue - centerHue);
        if (diff > 180) diff = 360 - diff;

        // Simple linear falloff over +/- 30 degrees for narrow bands (orange/yellow)
        // and wider for others. Lightroom bands are somewhat dynamic.
        // Let's approximate:
        // Red (0) <-> Orange (30) <-> Yellow (60) : 30 deg sep
        // Yellow (60) <-> Green (120): 60 deg sep
        // Green (120) <-> Aqua (180): 60 deg sep
        // Aqua (180) <-> Blue (240): 60 deg sep
        // Blue (240) <-> Purple (280): 40 deg sep
        // Purple (280) <-> Magenta (315): 35 deg sep
        // Magenta (315) <-> Red (0): 45 deg sep

        // A standard Gaussian or Cosine lobe works well for smooth blending.
        // Let's use a dynamic width based on the band.
        let width = 45;
        if (centerHue === 30 || centerHue === 60) width = 25; // Narrower for Orange/Yellow

        if (diff >= width) return 0;

        // Cubic smoothstep for nice falloff
        const t = diff / width;
        const weight = 1 - t;
        return weight * weight * (3 - 2 * weight);
    }

    function updateColorTuningLUT() {
        const tuning = state.adjustments.colorTuning;
        hueCorrectionLUT = new Array(360);
        let anyActive = false;

        // Check if anything is active first to possibly skip logic
        for (let band in tuning) {
            const t = tuning[band];
            if (t.hue !== 0 || t.saturation !== 0 || t.vibrance !== 0 || t.luminance !== 0 || t.shadows !== 0 || t.highlights !== 0) {
                anyActive = true;
                break;
            }
        }
        hasActiveColorTuning = anyActive;
        if (!anyActive) return;

        for (let h = 0; h < 360; h++) {
            let totalWeight = 0;
            let dHue = 0;
            let dSat = 0;
            let dVib = 0;
            let dLum = 0;
            let dShadows = 0;
            let dHighlights = 0;

            for (let bandName in BAND_CENTERS) {
                const w = getBandWeight(h, BAND_CENTERS[bandName]);
                if (w > 0) {
                    const t = tuning[bandName];
                    dHue += t.hue * w;
                    dSat += t.saturation * w;
                    dVib += t.vibrance * w;
                    dLum += t.luminance * w;
                    dShadows += t.shadows * w;
                    dHighlights += t.highlights * w;
                    totalWeight += w;
                }
            }

            // Normalize if overlapping weights > 1 (though our falloffs are designed to sum reasonably well,
            // strict normalization prevents over-boosting in overlap regions).
            // However, typical color engines simply accumulate. If we have > 1 weight sum, effects compound.
            // Let's clamp the blended values effectively by not normalizing but designing widths to not overlap excessively.
            // Actually, normalization is safer for smooth blending.
            if (totalWeight > 0.001) {
                // If we normalize, we might dilute the effect if only one band is active but weight is small?
                // No, standard interpolation: result = (val1*w1 + val2*w2) / (w1+w2).
                // But here we are summing *deltas* from zero.
                // If Red has +10 sat, and we are at Red center, weight is 1 -> +10.
                // If between Red and Orange, Red w=0.5, Orange w=0.5. If Orange is 0, sum is +5. Correct.
                // So no division by totalWeight needed for additive deltas.
            }

            hueCorrectionLUT[h] = {
                hue: dHue,
                sat: dSat,
                vib: dVib,
                lum: dLum,
                shad: dShadows,
                high: dHighlights
            };
        }
    }

    function applySelectiveColor(imageData) {
        if (!hasActiveColorTuning) return;
        const data = imageData.data;
        const w = imageData.width;
        const h = imageData.height;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2];
            const [hVal, sVal, lVal] = rgbToHsl(r, g, b); // h: 0-360, s: 0-1, l: 0-1

            const hueInt = Math.round(hVal) % 360;
            const idx = hueInt < 0 ? hueInt + 360 : hueInt;

            const adj = hueCorrectionLUT[idx];
            if (!adj) continue; // Should effectively mean weight was 0 for all bands

            // 1. Hue Shift
            let newH = hVal + adj.hue;
            if (newH < 0) newH += 360;
            if (newH >= 360) newH -= 360;

            // 2. Saturation & Vibrance
            // Saturation is simple multiplier
            // Vibrance weighs less on already saturated pixels
            let satMult = 1 + (adj.sat / 100);

            // Vibrance logic adapted from applyColorOps but for single pixel HSL
            if (adj.vib !== 0) {
                 // In HSL, 'sVal' is the saturation.
                 // Vibrance boosts low sat more.
                 const vibFactor = 2.0 * (1 - sVal);
                 satMult += (adj.vib / 100) * vibFactor;
            }

            let newS = sVal * satMult;
            if (newS < 0) newS = 0;
            if (newS > 1) newS = 1;

            // 3. Luminance
            // L is 0-1. adj.lum is +/- 100. Map to +/- 0.5 or similar range?
            // Lightroom luminance is quite strong. +/- 100 usually maps to full black/white shift potential?
            // Let's scale it gently: +/- 0.5 luminance shift for full slider
            let newL = lVal + (adj.lum / 200);

            // 4. Shadows / Highlights
            // These depend on the PIXEL'S luminance.
            // If pixel is dark, shadows slider affects it.
            // If pixel is bright, highlights slider affects it.
            if (adj.shad !== 0 || adj.high !== 0) {
                 // Shadows target lVal < 0.5 mostly
                 if (adj.shad !== 0) {
                     const sFactor = (1.0 - lVal) * (1.0 - lVal); // stronger on blacks
                     // shadows usually brightens them, so +val -> lighter
                     // adj.shad is +/- 100.
                     // Let's say +100 adds up to 0.3 luminance to blacks
                     newL += (adj.shad / 300) * sFactor;
                 }
                 if (adj.high !== 0) {
                     const hFactor = lVal * lVal; // stronger on whites
                     // highlights usually darkens them to recover detail? Or boosts them?
                     // In standard EQ, slider moves value up/down.
                     // Usually highlights slider: -100 (recover) to +100 (blow out).
                     newL += (adj.high / 300) * hFactor;
                 }
            }

            if (newL < 0) newL = 0;
            if (newL > 1) newL = 1;

            const [newR, newG, newB] = hslToRgb(newH, newS, newL);
            data[i] = newR;
            data[i+1] = newG;
            data[i+2] = newB;
        }
    }

    // RGB <-> HSL Helpers
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        }
        return [h, s, l];
    }

    function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h / 360 + 1 / 3);
            g = hue2rgb(p, q, h / 360);
            b = hue2rgb(p, q, h / 360 - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

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
        applySelectiveColor(imgData);
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

    function initColorTuning() {
        const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];

        // 1. Band Selection
        bands.forEach(band => {
            const btn = document.getElementById(`band-${band}`);
            if(!btn) return;
            btn.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.active-band').forEach(el => el.classList.remove('active-band'));
                btn.classList.add('active-band');
                state.activeColorBand = band;

                // Update sliders to reflect this band's values
                refreshTuningSliders();
            });
        });

        function refreshTuningSliders() {
            const band = state.activeColorBand;
            if(!band || !state.adjustments.colorTuning[band]) return;
            const vals = state.adjustments.colorTuning[band];

            updateTuningSliderUI('tune-hue', vals.hue);
            updateTuningSliderUI('tune-sat', vals.saturation);
            updateTuningSliderUI('tune-vib', vals.vibrance);
            updateTuningSliderUI('tune-lum', vals.luminance);
            updateTuningSliderUI('tune-shadows', vals.shadows);
            updateTuningSliderUI('tune-highlights', vals.highlights);
        }

        function updateTuningSliderUI(id, val) {
            const el = document.getElementById(id);
            if(!el) return;
            el.value = val;
            const label = document.getElementById('val-' + id);
            if(label) label.textContent = val;
        }

        // 2. Slider Inputs
        const tuningParams = [
            { id: 'tune-hue', key: 'hue' },
            { id: 'tune-sat', key: 'saturation' },
            { id: 'tune-vib', key: 'vibrance' },
            { id: 'tune-lum', key: 'luminance' },
            { id: 'tune-shadows', key: 'shadows' },
            { id: 'tune-highlights', key: 'highlights' }
        ];

        tuningParams.forEach(param => {
            const el = document.getElementById(param.id);
            const label = document.getElementById('val-' + param.id);
            if(!el) return;

            el.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                state.adjustments.colorTuning[state.activeColorBand][param.key] = val;
                if(label) label.textContent = val;

                updateColorTuningLUT(); // Rebuild LUT

                state.isAdjusting = true;
                updateAdjustmentPreview();
            });

            el.addEventListener('change', () => {
                state.isAdjusting = false;
                state.pendingAdjustmentCommit = true;
                // Coalesce logic: unique action key per band + param
                // e.g. "tuning-red-hue"
                saveSnapshot(`tuning-${state.activeColorBand}-${param.key}`);
            });
        });

        // 3. Resets
        const resetBandBtn = document.getElementById('resetBandBtn');
        if (resetBandBtn) {
            resetBandBtn.addEventListener('click', () => {
                const band = state.activeColorBand;
                state.adjustments.colorTuning[band] = { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
                refreshTuningSliders();
                updateColorTuningLUT();
                state.pendingAdjustmentCommit = true;
                updateAdjustmentPreview();
                saveSnapshot(`tuning-reset-${band}`);
            });
        }

        const resetTuningBtn = document.getElementById('resetTuningBtn');
        if (resetTuningBtn) {
            resetTuningBtn.addEventListener('click', () => {
                for (let b of bands) {
                    state.adjustments.colorTuning[b] = { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
                }
                refreshTuningSliders();
                updateColorTuningLUT();
                state.pendingAdjustmentCommit = true;
                updateAdjustmentPreview();
                saveSnapshot('tuning-reset-all');
            });
        }
    }

    // Call initColorTuning inside initAdjustments (hooked below)
    const originalInit = initAdjustments;
    initAdjustments = function() {
        originalInit();
        initColorTuning();
    };

    return { applyMasterLUT, applyColorOps, applySelectiveColor, updateAdjustmentPreview, initAdjustments, resetAllAdjustments, updateSlider, setSaveSnapshotHandler, setUpdateWorkingCopiesHandler };
}
