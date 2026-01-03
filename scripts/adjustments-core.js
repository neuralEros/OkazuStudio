(function() {
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

    function getBandWeight(hue, centerHue) {
        let diff = Math.abs(hue - centerHue);
        if (diff > 180) diff = 360 - diff;

        let width = 45;
        if (centerHue === 30 || centerHue === 60) width = 25;

        if (diff >= width) return 0;

        const t = diff / width;
        const weight = 1 - t;
        return weight * weight * (3 - 2 * weight);
    }

    function getLuminanceWeight(lum, band) {
        if (band === 'darks') {
            if (lum >= 0.5) return 0;
            const t = lum / 0.5;
            const w = 1 - t;
            return w * w * (3 - 2 * w);
        }
        if (band === 'lights') {
            if (lum <= 0.5) return 0;
            const t = (lum - 0.5) / 0.5;
            const w = t;
            return w * w * (3 - 2 * w);
        }
        if (band === 'mids') {
            const diff = Math.abs(lum - 0.5);
            if (diff >= 0.5) return 0;
            const t = diff / 0.5;
            const w = 1 - t;
            return w * w * (3 - 2 * w);
        }
        return 0;
    }

    function buildColorTuningLUTs(tuning) {
        const hueLUT = new Array(360);
        const luminanceLUT = new Array(256);
        let anyActive = false;

        for (let band in tuning) {
            const t = tuning[band];
            if (t.hue !== 0 || t.saturation !== 0 || t.vibrance !== 0 || t.luminance !== 0 || t.shadows !== 0 || t.highlights !== 0) {
                anyActive = true;
                break;
            }
        }

        if (!anyActive) {
            return { hueLUT, luminanceLUT, hasActive: false };
        }

        for (let h = 0; h < 360; h++) {
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
                }
            }

            hueLUT[h] = { hue: dHue, sat: dSat, vib: dVib, lum: dLum, shad: dShadows, high: dHighlights };
        }

        for (let i = 0; i < 256; i++) {
            const lumVal = i / 255;
            let dHue = 0;
            let dSat = 0;
            let dVib = 0;
            let dLum = 0;
            let dShadows = 0;
            let dHighlights = 0;

            ['darks', 'mids', 'lights'].forEach(band => {
                const w = getLuminanceWeight(lumVal, band);
                if (w > 0) {
                    const t = tuning[band];
                    if (t) {
                        dHue += t.hue * w;
                        dSat += t.saturation * w;
                        dVib += t.vibrance * w;
                        dLum += t.luminance * w;
                        if (!['lights', 'mids', 'darks'].includes(band)) {
                            dShadows += t.shadows * w;
                            dHighlights += t.highlights * w;
                        }
                    }
                }
            });

            luminanceLUT[i] = { hue: dHue, sat: dSat, vib: dVib, lum: dLum, shad: dShadows, high: dHighlights };
        }

        return { hueLUT, luminanceLUT, hasActive: true };
    }

    function buildMasterLUT({ gamma, levels }) {
        const hash = `${gamma}-${levels.black}-${levels.mid}-${levels.white}`;
        const lut = new Uint8Array(256);
        const invGamma = 1 / gamma;
        const invMid = 1 / levels.mid;
        const blackNorm = levels.black / 255;
        const whiteNorm = levels.white / 255;
        const range = whiteNorm - blackNorm;

        for (let i = 0; i < 256; i++) {
            let n = i / 255;
            if (range <= 0.001) n = (n > blackNorm) ? 1.0 : 0.0;
            else n = (n - blackNorm) / range;
            if (n < 0) n = 0;
            if (n > 1) n = 1;
            n = Math.pow(n, invMid);
            n = Math.pow(n, invGamma);
            if (n < 0) n = 0;
            if (n > 1) n = 1;
            lut[i] = n * 255;
        }

        return { lut, hash };
    }

    window.AdjustmentsCore = {
        getBandWeight,
        getLuminanceWeight,
        buildColorTuningLUTs,
        buildMasterLUT
    };
})();
