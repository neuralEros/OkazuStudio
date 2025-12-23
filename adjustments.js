function createAdjustmentSystem({ state, els, ctx, renderToContext, render }) {
    let saveSnapshot = () => {};

    function setSaveSnapshotHandler(handler) {
        if (typeof handler === 'function') {
            saveSnapshot = handler;
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

    function updateAdjustmentPreview() {
        // WebGL is fast enough for real-time preview
        render();
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

    return {
        applyMasterLUT: () => {},
        applyColorOps: () => {},
        updateAdjustmentPreview,
        initAdjustments,
        resetAllAdjustments,
        updateSlider,
        setSaveSnapshotHandler
    };
}
