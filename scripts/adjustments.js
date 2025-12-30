function createAdjustmentSystem({ state, els, ctx, renderToContext, render, scheduleHeavyTask }) {
    let gammaLUT = new Uint8Array(256);
    let currentGammaLUTValue = -1;
    let masterLUT = new Uint8Array(256);
    let currentLUTHash = "";
    let hueCorrectionLUT = [];
    let luminanceCorrectionLUT = [];
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

        let width = 45;
        if (centerHue === 30 || centerHue === 60) width = 25; // Narrower for Orange/Yellow

        if (diff >= width) return 0;

        // Cubic smoothstep for nice falloff
        const t = diff / width;
        const weight = 1 - t;
        return weight * weight * (3 - 2 * weight);
    }

    function getLuminanceWeight(lum, band) {
        // lum is 0.0 - 1.0
        // Darks: Peak at 0, falloff to 0.5
        // Mids: Peak at 0.5, falloff to 0 and 1
        // Lights: Peak at 1, falloff to 0.5

        if (band === 'darks') {
            if (lum >= 0.5) return 0;
            const t = lum / 0.5; // 0->0, 0.5->1
            const w = 1 - t;
            return w * w * (3 - 2 * w);
        } else if (band === 'lights') {
            if (lum <= 0.5) return 0;
            const t = (lum - 0.5) / 0.5; // 0.5->0, 1.0->1
            const w = t;
            return w * w * (3 - 2 * w);
        } else if (band === 'mids') {
            // Peak at 0.5
            const diff = Math.abs(lum - 0.5); // 0 -> 0.5, 0.5 -> 0, 1 -> 0.5
            if (diff >= 0.5) return 0;
            const t = diff / 0.5;
            const w = 1 - t;
            return w * w * (3 - 2 * w);
        }
        return 0;
    }

    function updateColorTuningLUT() {
        const tuning = state.adjustments.colorTuning;
        hueCorrectionLUT = new Array(360);
        luminanceCorrectionLUT = new Array(256);
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

        // Build Hue LUT
        for (let h = 0; h < 360; h++) {
            let totalWeight = 0;
            let dHue = 0, dSat = 0, dVib = 0, dLum = 0, dShadows = 0, dHighlights = 0;

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

            hueCorrectionLUT[h] = { hue: dHue, sat: dSat, vib: dVib, lum: dLum, shad: dShadows, high: dHighlights };
        }

        // Build Luminance LUT
        for (let i = 0; i < 256; i++) {
            const lumVal = i / 255;
            let dHue = 0, dSat = 0, dVib = 0, dLum = 0, dShadows = 0, dHighlights = 0;

            ['darks', 'mids', 'lights'].forEach(band => {
                const w = getLuminanceWeight(lumVal, band);
                if (w > 0) {
                    const t = tuning[band];
                    if (t) {
                         dHue += t.hue * w;
                         dSat += t.saturation * w;
                         dVib += t.vibrance * w;
                         dLum += t.luminance * w;
                         // Ignore shadows/highlights for luminance bands, but process them for color bands
                         if (!['lights', 'mids', 'darks'].includes(band)) {
                             dShadows += t.shadows * w;
                             dHighlights += t.highlights * w;
                         }
                    }
                }
            });

            luminanceCorrectionLUT[i] = { hue: dHue, sat: dSat, vib: dVib, lum: dLum, shad: dShadows, high: dHighlights };
        }
    }

    function applySelectiveColor(imageData) {
        if (!hasActiveColorTuning) return;
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const rRaw = data[i], gRaw = data[i+1], bRaw = data[i+2];

            // Inline RGB -> HSL (avoid array allocation)
            const r = rRaw / 255;
            const g = gRaw / 255;
            const b = bRaw / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let hVal, sVal, lVal = (max + min) / 2;

            if (max === min) {
                hVal = sVal = 0; // achromatic
            } else {
                const d = max - min;
                sVal = lVal > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: hVal = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: hVal = (b - r) / d + 2; break;
                    case b: hVal = (r - g) / d + 4; break;
                }
                hVal *= 60;
            }

            const hueInt = Math.round(hVal) % 360;
            const hIdx = hueInt < 0 ? hueInt + 360 : hueInt;
            const lIdx = Math.floor(lVal * 255);

            const hueAdj = hueCorrectionLUT[hIdx];
            const lumAdj = luminanceCorrectionLUT[lIdx];

            if (!hueAdj && !lumAdj) continue;

            // Accumulate adjustments
            let dHue = (hueAdj ? hueAdj.hue : 0) + (lumAdj ? lumAdj.hue : 0);
            let dSat = (hueAdj ? hueAdj.sat : 0) + (lumAdj ? lumAdj.sat : 0);
            let dVib = (hueAdj ? hueAdj.vib : 0) + (lumAdj ? lumAdj.vib : 0);
            let dLum = (hueAdj ? hueAdj.lum : 0) + (lumAdj ? lumAdj.lum : 0);
            let dShad = (hueAdj ? hueAdj.shad : 0) + (lumAdj ? lumAdj.shad : 0);
            let dHigh = (hueAdj ? hueAdj.high : 0) + (lumAdj ? lumAdj.high : 0);

            // 1. Hue Shift
            let newH = hVal + dHue;
            if (newH < 0) newH += 360;
            if (newH >= 360) newH -= 360;

            // 2. Saturation & Vibrance
            let satMult = 1 + (dSat / 100);

            if (dVib !== 0) {
                 const vibFactor = 2.0 * (1 - sVal);
                 satMult += (dVib / 100) * vibFactor;
            }

            let newS = sVal * satMult;
            if (newS < 0) newS = 0;
            if (newS > 1) newS = 1;

            // 3. Luminance
            let newL = lVal + (dLum / 200);

            // 4. Shadows / Highlights
            if (dShad !== 0 || dHigh !== 0) {
                 if (dShad !== 0) {
                     const sFactor = (1.0 - lVal) * (1.0 - lVal); // stronger on blacks
                     newL += (dShad / 300) * sFactor;
                 }
                 if (dHigh !== 0) {
                     const hFactor = lVal * lVal; // stronger on whites
                     newL += (dHigh / 300) * hFactor;
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
        }
        if (state.previewFrontLayer.width !== pw || state.previewFrontLayer.height !== ph) {
            state.previewFrontLayer.width = pw;
            state.previewFrontLayer.height = ph;
        }

        els.mainCanvas.style.visibility = 'hidden';
        pCanvas.classList.remove('hidden');

        const pCtx = pCanvas.getContext('2d');
        renderToContext(pCtx, pw, ph, true, false);

        if (state.adjustmentsVisible) {
            const imgData = pCtx.getImageData(0, 0, pw, ph);
            applyMasterLUT(imgData);
            applyColorOps(imgData);
            applySelectiveColor(imgData);
            pCtx.putImageData(imgData, 0, 0);
        }
    }

    function resetAllAdjustments() {
         state.adjustments = {
             gamma: 1.0,
             levels: { black: 0, mid: 1.0, white: 255 },
             saturation: 0, vibrance: 0,
             wb: 0, colorBal: { r:0, g:0, b:0 },
             shadows: 0, highlights: 0,
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

         if (typeof refreshTuningSliders === 'function') refreshTuningSliders();
         updateColorTuningLUT();

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

            el.addEventListener('pointerdown', () => {
                el.dataset.startVal = el.value;
            });

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
                const oldVal = parseFloat(el.dataset.startVal || 0);
                state.isAdjusting = false;
                state.pendingAdjustmentCommit = true;
                if (window.dispatchAction) dispatchAction({ type: 'ADJUST', payload: { id, key, subkey, value: parseFloat(e.target.value), oldValue: oldVal } });
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
            if (window.dispatchAction) dispatchAction({ type: 'RESET_ADJUSTMENTS', payload: {} });
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
            if (window.dispatchAction) dispatchAction({ type: 'RESET_LEVELS', payload: {} });
        });

        document.getElementById('resetSatBtn').addEventListener('click', () => {
             if (state.adjustments.saturation === 0 && state.adjustments.vibrance === 0) return;
             state.adjustments.saturation = 0;
             state.adjustments.vibrance = 0;
             updateSlider('adj-sat', 0);
             updateSlider('adj-vib', 0);
             state.pendingAdjustmentCommit = true;
             updateAdjustmentPreview();
             if (window.dispatchAction) dispatchAction({ type: 'RESET_SATURATION', payload: {} });
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
             if (window.dispatchAction) dispatchAction({ type: 'RESET_COLOR_BALANCE', payload: {} });
        });
    }

    function updateTuningSliderUI(id, val, disabled = false) {
        const el = document.getElementById(id);
        if(!el) {
            console.warn(`[Tuning UI] Element not found: ${id}`);
            return;
        }

        el.disabled = disabled;
        if (disabled) {
            el.value = 0;
            if(el.parentElement) el.parentElement.style.opacity = '0.5';
        } else {
            el.value = val;
            if(el.parentElement) el.parentElement.style.opacity = '1';
        }

        // console.log(`[Tuning UI] Update ${id}: DOM value (${el.value}) -> New value (${val})`);

        const label = document.getElementById('val-' + id);
        if(label) label.textContent = disabled ? 0 : val;
    }

    function refreshTuningSliders() {
        const band = state.activeColorBand;
        if(!band || !state.adjustments.colorTuning[band]) {
            console.warn(`[Tuning UI] Invalid band or data missing for: ${band}`);
            return;
        }
        const vals = state.adjustments.colorTuning[band];
        // console.log(`[Tuning UI] Refreshing ${band} sliders with values:`, JSON.stringify(vals));

        const isLumBand = ['lights', 'mids', 'darks'].includes(band);

        updateTuningSliderUI('tune-hue', vals.hue);
        updateTuningSliderUI('tune-sat', vals.saturation);
        updateTuningSliderUI('tune-vib', vals.vibrance);
        updateTuningSliderUI('tune-lum', vals.luminance);
        updateTuningSliderUI('tune-shadows', vals.shadows, isLumBand);
        updateTuningSliderUI('tune-highlights', vals.highlights, isLumBand);
    }

    function refreshColorTuningUI() {
        console.log(`[Tuning UI] Refreshing Full UI. Active Band: ${state.activeColorBand}`);
        // Update the active band visual state (border)
        if (state.activeColorBand) {
             document.querySelectorAll('.active-band').forEach(el => el.classList.remove('active-band'));
             const btn = document.getElementById(`band-${state.activeColorBand}`);
             if (btn) btn.classList.add('active-band');
        }
        refreshTuningSliders();
    }

    function updateAllAdjustmentUI() {
        console.log("[UI] Updating All Adjustment Sliders");
        updateSlider('adj-gamma', state.adjustments.gamma);
        updateSlider('adj-l-black', state.adjustments.levels.black);
        updateSlider('adj-l-mid', state.adjustments.levels.mid);
        updateSlider('adj-l-white', state.adjustments.levels.white);
        updateSlider('adj-sat', state.adjustments.saturation);
        updateSlider('adj-vib', state.adjustments.vibrance);
        updateSlider('adj-wb', state.adjustments.wb);
        updateSlider('adj-cb-r', state.adjustments.colorBal.r);
        updateSlider('adj-cb-g', state.adjustments.colorBal.g);
        updateSlider('adj-cb-b', state.adjustments.colorBal.b);
        updateSlider('adj-shadows', state.adjustments.shadows);
        updateSlider('adj-highlights', state.adjustments.highlights);

        refreshColorTuningUI();
    }

    function initColorTuning() {
        const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta', 'lights', 'mids', 'darks'];

        // 1. Band Selection
        bands.forEach(band => {
            const btn = document.getElementById(`band-${band}`);
            if(!btn) {
                console.warn(`Band button band-${band} not found`);
                return;
            }
            btn.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.active-band').forEach(el => el.classList.remove('active-band'));
                btn.classList.add('active-band');
                state.activeColorBand = band;

                // Update sliders to reflect this band's values
                refreshTuningSliders();
            });
        });

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
            if(!el) {
                Logger.warn(`Tuning param element ${param.id} not found`);
                return;
            }

            el.addEventListener('pointerdown', () => {
                el.dataset.startVal = el.value;
            });

            el.addEventListener('input', (e) => {
                try {
                    const val = parseFloat(e.target.value);
                    if (!state.activeColorBand || !state.adjustments.colorTuning[state.activeColorBand]) {
                         Logger.error("Missing activeColorBand or tuning data");
                         return;
                    }
                    state.adjustments.colorTuning[state.activeColorBand][param.key] = val;
                    if(label) label.textContent = val;

                    updateColorTuningLUT(); // Rebuild LUT

                    state.isAdjusting = true;
                    updateAdjustmentPreview();
                } catch(err) {
                    console.error("Color Tuning Input Error:", err);
                }
            });

            el.addEventListener('change', (e) => {
                const val = e.target.value;
                const oldVal = el.dataset.startVal || "unknown";
                Logger.interaction(`Tuning ${state.activeColorBand} ${param.key}`, "changed", `${oldVal} -> ${val}`);
                state.isAdjusting = false;
                state.pendingAdjustmentCommit = true;
                if (window.dispatchAction) dispatchAction({ type: 'TUNE_COLOR', payload: { band: state.activeColorBand, key: param.key, value: parseFloat(val), oldValue: parseFloat(oldVal || 0) } });
            });
        });

        console.log("Color Tuning Initialized");
        updateColorTuningLUT(); // Ensure LUT is primed

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
                if (window.dispatchAction) dispatchAction({ type: 'RESET_TUNING_BAND', payload: { band } });
            });
        }

        const resetTuningBtn = document.getElementById('resetTuningBtn');
        if (resetTuningBtn) {
            resetTuningBtn.addEventListener('click', () => {
                for (let b of bands) {
                    if (state.adjustments.colorTuning[b]) {
                         state.adjustments.colorTuning[b] = { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
                    }
                }
                refreshTuningSliders();
                updateColorTuningLUT();
                state.pendingAdjustmentCommit = true;
                updateAdjustmentPreview();
                if (window.dispatchAction) dispatchAction({ type: 'RESET_TUNING_ALL', payload: {} });
            });
        }
    }

    // Call initColorTuning inside initAdjustments (hooked below)
    const originalInit = initAdjustments;
    initAdjustments = function() {
        originalInit();
        initColorTuning();
    };

    return {
        applyMasterLUT,
        applyColorOps,
        applySelectiveColor,
        updateAdjustmentPreview,
        initAdjustments,
        resetAllAdjustments,
        updateSlider,
        setSaveSnapshotHandler,
        setUpdateWorkingCopiesHandler,
        recalculateColorTuning: updateColorTuningLUT,
        refreshColorTuningUI,
        updateAllAdjustmentUI
    };
}
