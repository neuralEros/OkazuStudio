(function() {
    const { register, assert, assertEqual, assertApprox, spyOn } = window.TestRunner;

    // 1. Overview & Test Harness Assumptions

    // 1.1 Minimal Harness/Fixture Shape
    register('Adjustments: createAdjustmentSystem initializes correctly', () => {
        const state = { adjustments: { colorTuning: {}, levels: {black:0, mid:1, white:255}, colorBal: {r:0,g:0,b:0} } };
        const els = {};
        const ctx = {};
        const renderToContext = () => {};
        const render = () => {};
        const scheduleHeavyTask = () => {};

        const system = window.createAdjustmentSystem({ state, els, ctx, renderToContext, render, scheduleHeavyTask });

        assert(typeof system.initAdjustments === 'function', 'initAdjustments should be a function');
        assert(typeof window.OkazuTestables.adjustments.getBandWeight === 'function', 'getBandWeight should be exposed');
    });

    // 1.2 DOM Mocking Strategy
    register('Adjustments: initAdjustments attaches listeners', () => {
        // Setup
        const listeners = {};
        const mockEl = {
            addEventListener: (evt, fn) => { listeners[evt] = fn; },
            value: '0',
            dataset: {}
        };
        const getById = spyOn(document, 'getElementById');
        getById.mockImplementation((id) => mockEl);

        const state = { adjustments: { gamma: 1.0, colorTuning: {}, levels: {black:0, mid:1, white:255}, colorBal: {r:0,g:0,b:0} } };
        const els = { resetAdjBtn: { addEventListener: () => {} }, resetLevelsBtn: { addEventListener: () => {} }, resetColorBtn: { addEventListener: () => {} } }; // minimal els

        // Mocks for color tuning
        const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta', 'lights', 'mids', 'darks'];
        bands.forEach(b => listeners[`band-${b}`] = {});

        const system = window.createAdjustmentSystem({ state, els, ctx: {}, renderToContext: () => {}, render: () => {}, scheduleHeavyTask: () => {} });

        system.initAdjustments();

        assert(getById.calls.length > 0, 'getElementById should be called');
        getById.restore();
    });

    // 2. Pure Helper Functions

    // 2.1 getBandWeight
    register('Adjustments: getBandWeight width cutoff', () => {
        const { getBandWeight } = window.OkazuTestables.adjustments;

        // Center 30 (width 25)
        assertApprox(getBandWeight(30, 30), 1, 1e-6);
        assertApprox(getBandWeight(55, 30), 0, 1e-6); // 30+25
        assert(getBandWeight(54.9, 30) > 0, 'Should be > 0 just inside width');

        // Center 120 (width 45)
        assertApprox(getBandWeight(120, 120), 1, 1e-6);
        assertApprox(getBandWeight(165, 120), 0, 1e-6); // 120+45
        assert(getBandWeight(164.9, 120) > 0, 'Should be > 0 just inside width');
    });

    register('Adjustments: getBandWeight wraparound', () => {
        const { getBandWeight } = window.OkazuTestables.adjustments;
        const w1 = getBandWeight(350, 10); // diff 20
        const w2 = getBandWeight(30, 10);  // diff 20
        assertApprox(w1, w2, 1e-6);
    });

    // 2.2 getLuminanceWeight
    register('Adjustments: getLuminanceWeight boundaries', () => {
        const { getLuminanceWeight } = window.OkazuTestables.adjustments;
        assertApprox(getLuminanceWeight(1.0, 'darks'), 0);
        assertApprox(getLuminanceWeight(0.0, 'lights'), 0);
        assertApprox(getLuminanceWeight(0.5, 'mids'), 1);
        assertApprox(getLuminanceWeight(0.0, 'darks'), 1);
        assertApprox(getLuminanceWeight(1.0, 'lights'), 1);
    });

    // 2.3 rgbToHsl and hslToRgb
    register('Adjustments: HSL <-> RGB round-trip', () => {
        const { rgbToHsl, hslToRgb } = window.OkazuTestables.adjustments;
        const inputs = [
            [255, 0, 0], [0, 255, 0], [0, 0, 255],
            [128, 128, 128], [12, 200, 77]
        ];

        inputs.forEach(rgb => {
            const [h, s, l] = rgbToHsl(...rgb);
            const [r2, g2, b2] = hslToRgb(h, s, l);
            assertApprox(r2, rgb[0], 1.5, `Red mismatch for ${rgb}`);
            assertApprox(g2, rgb[1], 1.5, `Green mismatch for ${rgb}`);
            assertApprox(b2, rgb[2], 1.5, `Blue mismatch for ${rgb}`);
        });
    });

    // 2.4 getCurvedValue
    register('Adjustments: getCurvedValue threshold behavior', () => {
        const { getCurvedValue } = window.OkazuTestables.adjustments;
        assertApprox(getCurvedValue(0), 0);
        assertApprox(getCurvedValue(100), 100);
        // Slope check
        const v80 = Math.abs(getCurvedValue(80)); // 50
        const v81 = Math.abs(getCurvedValue(81)); // 50 + (1/20)*50 = 52.5 -> 53
        // In implementation: (80/80)*50 = 50.
        // 81: 50 + (1/20)*50 = 52.5.
        // Slope below 80 is 50/80 = 0.625.
        // Slope above 80 is 50/20 = 2.5.
        // So change from 80->81 (2.5) should be > change from 79->80 (0.625).
        const v79 = Math.abs(getCurvedValue(79));
        assert((v81 - v80) > (v80 - v79), 'Slope should increase after 80');
    });

    // 3. Color Tuning LUT Generation
    register('Adjustments: updateColorTuningLUT activation', () => {
        // We need to access internal state or modify it via state object reference.
        // Since we pass state in, we can modify it.
        const state = { adjustments: {
            colorTuning: { red: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 } },
            gamma: 1, levels: {black:0, mid:1, white:255}, colorBal: {r:0,g:0,b:0}
        } };
        const system = window.createAdjustmentSystem({ state, els: {}, ctx: {}, renderToContext: () => {}, render: () => {}, scheduleHeavyTask: () => {} });

        // Initially clean
        system.recalculateColorTuning();
        // Check internals via testables if exposed (we exposed them in the previous step)
        // Wait, 'hasActiveColorTuning' variable is internal closure.
        // But we can check effect via applySelectiveColor on a pixel.

        const imgData = { data: new Uint8ClampedArray([100, 100, 100, 255]) };
        const original = new Uint8ClampedArray(imgData.data);

        window.OkazuTestables.adjustments.applySelectiveColor(imgData);
        assertDeepEqual(imgData.data, original, 'Should be no-op when inactive');

        // Make active
        state.adjustments.colorTuning.red.saturation = 10;
        system.recalculateColorTuning();

        // Now it might still be no-op on GRAY pixel (sat 0) depending on logic, but system is active.
        // Let's use a red pixel.
        const redPx = { data: new Uint8ClampedArray([255, 0, 0, 255]) };
        window.OkazuTestables.adjustments.applySelectiveColor(redPx);
        // Saturation increased -> Red channel might change or others decrease
        // Just checking it changed
        assert(redPx.data[0] !== 255 || redPx.data[1] !== 0 || redPx.data[2] !== 0, 'Should modify pixel when active');
    });

    // 4. Master LUT
    register('Adjustments: applyMasterLUT', () => {
        const state = { adjustments: { gamma: 1.0, levels: {black:0, mid:1, white:255}, colorTuning: {}, colorBal: {r:0,g:0,b:0} } };
        const system = window.createAdjustmentSystem({ state, els: {}, ctx: {}, renderToContext: () => {}, render: () => {}, scheduleHeavyTask: () => {} });

        const data = new Uint8ClampedArray([128, 128, 128, 255]);
        const imgData = { data };

        // No-op
        window.OkazuTestables.adjustments.applyMasterLUT(imgData);
        assertApprox(data[0], 128);

        // Change levels
        state.adjustments.levels.black = 128; // Clip blacks
        window.OkazuTestables.adjustments.applyMasterLUT(imgData);
        assertApprox(data[0], 0); // Should be black
    });

    // 5. Color Ops
    register('Adjustments: applyColorOps shadows/highlights', () => {
        const state = { adjustments: { gamma:1, levels:{black:0,mid:1,white:255}, shadows: 0, highlights: 0, saturation: 0, vibrance: 0, wb: 0, colorBal: {r:0,g:0,b:0}, colorTuning: {} } };
        const system = window.createAdjustmentSystem({ state, els: {}, ctx: {}, renderToContext: () => {}, render: () => {}, scheduleHeavyTask: () => {} });

        // Shadows: Affects darks
        state.adjustments.shadows = 50;
        const darkPx = { data: new Uint8ClampedArray([10, 10, 10, 255]) };
        window.OkazuTestables.adjustments.applyColorOps(darkPx);
        assert(darkPx.data[0] > 10, 'Shadows boost should brighten darks');

        // Reset
        state.adjustments.shadows = 0;
        state.adjustments.highlights = 50;
        const lightPx = { data: new Uint8ClampedArray([240, 240, 240, 255]) };
        window.OkazuTestables.adjustments.applyColorOps(lightPx);
        assert(lightPx.data[0] > 240, 'Highlights boost should brighten lights'); // Wait, highlights +50 usually brightens? Implementation: 1 + (high/100)*factor. Yes.
    });

    // 7. Preview Pipeline
    register('Adjustments: updateAdjustmentPreview throttling', async () => {
        const renderSpy = window.TestRunner.spyOn(window, 'console'); // Dummy spy container
        // Actually we need to spy on 'renderToContext' which is passed in.
        let renderCalls = 0;
        const mockRenderToContext = () => { renderCalls++; };

        const state = {
            adjustmentsVisible: true,
            previewThrottle: 0,
            settings: { adjustmentPreviewResolution: 1080 },
            adjustments: { colorTuning: {}, levels: {black:0, mid:1, white:255}, colorBal: {r:0,g:0,b:0} }
        };
        const els = {
            mainCanvas: { width: 100, height: 100, style: {} },
            previewCanvas: { width: 0, height: 0, classList: { remove: () => {} }, getContext: () => ({ getImageData: () => ({ data: [] }), putImageData: () => {} }) }
        };
        // Mock Date.now
        const dateSpy = spyOn(Date, 'now');

        const system = window.createAdjustmentSystem({ state, els, ctx: {}, renderToContext: mockRenderToContext, render: () => {}, scheduleHeavyTask: () => {} });

        // Call 1: Time 1000
        dateSpy.mockReturnValue(1000);
        system.updateAdjustmentPreview();
        assert(renderCalls === 1, 'First call should render');

        // Call 2: Time 1050 (Diff 50 < 100)
        dateSpy.mockReturnValue(1050);
        system.updateAdjustmentPreview();
        assert(renderCalls === 1, 'Throttled call should NOT render');

        // Call 3: Time 1200 (Diff 200 > 100 from last successful?)
        // Logic: if (now - state.previewThrottle < 100) return;
        // Last success set throttle to 1000.
        // 1050 - 1000 = 50. Return.
        // 1200 - 1000 = 200. Proceed.
        dateSpy.mockReturnValue(1200);
        system.updateAdjustmentPreview();
        assert(renderCalls === 2, 'Later call should render');

        dateSpy.restore();
    });

    // 8. Reset & UI Wiring
    register('Adjustments: resetAllAdjustments', () => {
        const state = { adjustments: { gamma: 0.5, levels: {black:0, mid:1, white:255}, colorTuning: {}, colorBal: {r:0,g:0,b:0} } };
        // We need real DOM elements for updateSlider to not warn/fail, or spy/mock document.getElementById.
        // Ideally we mock document.getElementById.
        const getById = spyOn(document, 'getElementById');
        const mockEl = { value: '', textContent: '' };
        getById.mockImplementation(() => mockEl);

        const system = window.createAdjustmentSystem({ state, els: {}, ctx: {}, renderToContext: () => {}, render: () => {}, scheduleHeavyTask: () => {} });

        system.resetAllAdjustments();

        assertApprox(state.adjustments.gamma, 1.0);
        getById.restore();
    });

})();
