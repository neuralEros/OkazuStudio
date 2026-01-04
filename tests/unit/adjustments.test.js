
// ------------------------------------------------------------------------------------------------
// Adjustments Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping adjustments tests.');
        return;
    }

    const { register, assert, assertEqual, assertApprox, assertDeepEqual, spyOn } = window.TestRunner;

    // --- 1.1 Minimal Harness/Fixture Shape ---
    register('Adjustments: 1.1 Minimal Harness/Fixture Shape', async () => {
        // Mock State
        const state = {
            adjustments: {
                levels: { min: 0, max: 255, mid: 1.0 },
                gamma: 1.0,
                colorTuning: {},
                adjustmentsVisible: true,
                adjustmentPreviewResolution: 1080
            },
            colorTuningLUT: { hue: [], sat: [], vib: [], lum: [], shadows: [], highlights: [] },
            fullDims: { w: 100, h: 100 },
            hasActiveColorTuning: false
        };
        // Populate colorTuning state
        const bands = ['reds', 'oranges', 'yellows', 'greens', 'aquas', 'blues', 'purples', 'magentas', 'darks', 'mids', 'lights'];
        bands.forEach(b => state.adjustments.colorTuning[b] = { hue: 0, sat: 0, vib: 0, lum: 0, shadows: 0, highlights: 0 });

        // Mock Els
        const els = {};
        const sliderIds = ['adj-gamma', 'adj-levels-min', 'adj-levels-max', 'adj-levels-mid', 'adj-saturation', 'adj-vibrance', 'adj-white-balance', 'adj-color-balance-r', 'adj-color-balance-g', 'adj-color-balance-b', 'adj-contrast', 'adj-brightness', 'adj-temperature', 'adj-hue', 'adj-sepia'];
        sliderIds.forEach(id => els[id] = { addEventListener: () => {}, value: 0, dataset: {}, parentElement: { querySelector: () => ({ textContent: '' }) } });

        const tuningIds = ['adj-tune-hue', 'adj-tune-sat', 'adj-tune-vib', 'adj-tune-lum', 'adj-tune-shadows', 'adj-tune-highlights'];
        tuningIds.forEach(id => els[id] = { addEventListener: () => {}, value: 0, dataset: {}, parentElement: { querySelector: () => ({ textContent: '' }) } });

        els.mainCanvas = { style: { display: 'block' }, width: 100, height: 100 };
        els.previewCanvas = { style: { display: 'none' }, width: 100, height: 100, getContext: () => ({ clearRect: () => {}, drawImage: () => {} }) };

        // Mock Ctx
        const ctx = {
            getImageData: () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
            putImageData: () => {},
            clearRect: () => {},
            drawImage: () => {}
        };

        // Mock Dependencies
        const renderToContext = () => {};
        const render = () => {};
        const scheduleHeavyTask = async (fn) => fn();

        // Execution
        const system = window.createAdjustmentSystem({ state, els, ctx, renderToContext, render, scheduleHeavyTask });

        // Assertions
        assert(typeof system === 'function' || typeof system === 'object', 'System created');
        assert(typeof system.initAdjustments === 'function', 'initAdjustments exposed');
        assert(window.OkazuTestables.adjustments, 'Testables exposed');
        assert(typeof window.OkazuTestables.adjustments.getBandWeight === 'function', 'getBandWeight exposed');
    });

    // --- 2. Pure Helper Functions ---

    register('Adjustments: 2.1 getBandWeight', () => {
        const { getBandWeight } = window.OkazuTestables.adjustments;

        // 2.1.1 Width Selection
        // 30 and 60 use narrow width (25)
        assertApprox(getBandWeight(30+25, 30), 0, 1e-6, 'Narrow band boundary');
        assertApprox(getBandWeight(60+25, 60), 0, 1e-6, 'Narrow band boundary');
        assert(getBandWeight(30+24.9, 30) > 0, 'Inside narrow band');

        // Others use wide width (45)
        assertApprox(getBandWeight(120+45, 120), 0, 1e-6, 'Wide band boundary');
        assert(getBandWeight(120+44.9, 120) > 0, 'Inside wide band');

        // 2.1.2 Exact Values
        assertEqual(getBandWeight(120, 120), 1, 'Center weight is 1');

        // 2.1.3 Wraparound
        assertApprox(getBandWeight(350, 10), getBandWeight(30, 10), 1e-6, 'Wraparound symmetry');

        // 2.1.4 Monotonic Falloff
        const center = 200;
        const w0 = getBandWeight(center, center);
        const w10 = getBandWeight(center+10, center);
        const w20 = getBandWeight(center+20, center);
        const w30 = getBandWeight(center+30, center);
        const w40 = getBandWeight(center+40, center);
        assert(w0 >= w10 && w10 >= w20 && w20 >= w30 && w30 >= w40, 'Monotonic falloff');
    });

    register('Adjustments: 2.2 getLuminanceWeight', () => {
        const { getLuminanceWeight } = window.OkazuTestables.adjustments;

        // 2.2.1 Boundary Checks
        assertApprox(getLuminanceWeight(1.0, 'darks'), 0, 1e-6, 'Dark at 1.0');
        assertApprox(getLuminanceWeight(0.0, 'lights'), 0, 1e-6, 'Light at 0.0');
        assertApprox(getLuminanceWeight(0.5, 'mids'), 1, 1e-6, 'Mids at 0.5'); // Peak

        // 2.2.2 Peak Values
        assertApprox(getLuminanceWeight(0, 'darks'), 1, 1e-6, 'Darks peak');
        assertApprox(getLuminanceWeight(1, 'lights'), 1, 1e-6, 'Lights peak');
    });

    register('Adjustments: 2.3 RGB <-> HSL', () => {
        const { rgbToHsl, hslToRgb } = window.OkazuTestables.adjustments;

        // 2.3.1 Round Trip
        const colors = [
            [255, 0, 0], [0, 255, 0], [0, 0, 255],
            [255, 255, 0], [0, 255, 255], [255, 0, 255],
            [0, 0, 0], [128, 128, 128], [255, 255, 255],
            [12, 200, 77], [150, 10, 220]
        ];

        colors.forEach(([r, g, b]) => {
            const [h, s, l] = rgbToHsl(r, g, b);
            const [r2, g2, b2] = hslToRgb(h, s, l);
            assert(Math.abs(r - r2) <= 1, `Red mismatch for ${r},${g},${b} -> ${r2}`);
            assert(Math.abs(g - g2) <= 1, `Green mismatch for ${r},${g},${b} -> ${g2}`);
            assert(Math.abs(b - b2) <= 1, `Blue mismatch for ${r},${g},${b} -> ${b2}`);
        });

        // 2.3.2 Hue Edge Cases
        const [hR] = rgbToHsl(255, 0, 0); assertApprox(hR, 0, 0.5, 'Red hue');
        const [hG] = rgbToHsl(0, 255, 0); assertApprox(hG, 120, 0.5, 'Green hue');
        const [hB] = rgbToHsl(0, 0, 255); assertApprox(hB, 240, 0.5, 'Blue hue');
    });

    register('Adjustments: 2.4 getCurvedValue', () => {
        const { getCurvedValue } = window.OkazuTestables.adjustments;

        assert(Math.abs(getCurvedValue(80)) < Math.abs(getCurvedValue(81)), 'Slope increase check (flawed check but directionally correct)');
        // Better check:
        // 0-80 maps to 0-50. Slope 50/80 = 0.625
        // 80-100 maps to 50-100. Slope 50/20 = 2.5
        // So a step of 1 at 80 should be bigger than step of 1 at 40
        const stepLow = getCurvedValue(41) - getCurvedValue(40);
        const stepHigh = getCurvedValue(91) - getCurvedValue(90);
        assert(stepHigh > stepLow, 'Curve slope increases');

        assertEqual(getCurvedValue(100), 100, 'Max value');
        assertEqual(getCurvedValue(-100), -100, 'Min value');
        assertEqual(getCurvedValue(0), 0, 'Zero value');
    });

})();
