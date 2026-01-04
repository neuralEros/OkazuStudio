(function() {
    const { register, assert, assertEqual, assertApprox } = window.TestRunner;

    // 1. Test Harness Assumptions
    // 1.1 Minimal Harness/Fixture Shape
    register('Adjustments: Initialization & API Structure', () => {
        // Setup minimal mock state
        const state = {
            adjustments: {
                gamma: 1.0,
                levels: { black: 0, mid: 1.0, white: 255 },
                saturation: 0, vibrance: 0, wb: 0, colorBal: { r: 0, g: 0, b: 0 },
                shadows: 0, highlights: 0,
                colorTuning: {}
            }
        };
        // Mock elements
        const els = {
            mainCanvas: { width: 100, height: 100, style: {} },
            previewCanvas: { width: 100, height: 100, classList: { remove: () => {} }, getContext: () => ({ getImageData: () => ({data: []}), putImageData: () => {} }) },
            resetAdjBtn: { addEventListener: () => {} },
            resetLevelsBtn: { addEventListener: () => {} },
            resetColorBtn: { addEventListener: () => {} }
        };
        // Mock context and functions
        const ctx = { getImageData: () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }), putImageData: () => {} };
        const renderToContext = () => {};
        const render = () => {};
        const scheduleHeavyTask = () => {};

        // 1.1.1 Setup: Initialize createAdjustmentSystem
        const system = createAdjustmentSystem({ state, els, ctx, renderToContext, render, scheduleHeavyTask });

        // 1.1.4 Exact assertions
        assert(typeof createAdjustmentSystem === 'function', 'createAdjustmentSystem is a function');
        assert(typeof system.initAdjustments === 'function', 'initAdjustments is a function');
        assert(window.OkazuTestables && window.OkazuTestables.adjustments, 'OkazuTestables.adjustments is exposed');
        assert(typeof window.OkazuTestables.adjustments.getBandWeight === 'function', 'getBandWeight is exposed');
    });

    // 2. Pure Helper Functions (OkazuTestables.adjustments)
    // 2.1 getBandWeight(hue, centerHue)
    register('Adjustments: getBandWeight', () => {
        const { getBandWeight } = window.OkazuTestables.adjustments;

        // 2.1.1 Width Selection
        // Center 30/60 -> Width 25, else 45
        assertApprox(getBandWeight(30 + 25, 30), 0, 1e-6, 'Width 25 for hue 30');
        assert(getBandWeight(30 + 24.9, 30) > 0, 'Weight > 0 just inside width 25');
        assertApprox(getBandWeight(120 + 45, 120), 0, 1e-6, 'Width 45 for hue 120');
        assert(getBandWeight(120 + 44.9, 120) > 0, 'Weight > 0 just inside width 45');

        // 2.1.2 Exact-Value Assertions
        assertApprox(getBandWeight(120, 120), 1, 1e-6, 'Weight 1 at center');
        assertApprox(getBandWeight(120 + 45 + 1e-6, 120), 0, 1e-6, 'Weight 0 outside width');

        // 2.1.3 Wraparound
        assertApprox(getBandWeight(350, 10), getBandWeight(30, 10), 1e-6, 'Wraparound 350 vs 10 equivalent to diff 20');

        // 2.1.4 Monotonic Falloff and Symmetry
        const w0 = getBandWeight(200, 200);
        const w10 = getBandWeight(210, 200);
        const w20 = getBandWeight(220, 200);
        assert(w0 >= w10, 'Monotonic falloff 0->10');
        assert(w10 >= w20, 'Monotonic falloff 10->20');
        assertApprox(getBandWeight(220, 200), getBandWeight(180, 200), 1e-6, 'Symmetry');
    });

    // 2.2 getLuminanceWeight(lum, band)
    register('Adjustments: getLuminanceWeight', () => {
        const { getLuminanceWeight } = window.OkazuTestables.adjustments;

        // 2.2.1 Boundary Checks
        assertApprox(getLuminanceWeight(1.0, 'darks'), 0, 1e-6, 'Darks 0 at 1.0');
        assertApprox(getLuminanceWeight(0, 'lights'), 0, 1e-6, 'Lights 0 at 0');
        assertApprox(getLuminanceWeight(0.5 - 1e-6, 'lights'), 0, 1e-6, 'Lights 0 below 0.5');

        // 2.2.2 Peak Values
        assertApprox(getLuminanceWeight(0, 'darks'), 1, 1e-6, 'Darks peak at 0');
        assertApprox(getLuminanceWeight(0.5, 'mids'), 1, 1e-6, 'Mids peak at 0.5');
        assertApprox(getLuminanceWeight(1, 'lights'), 1, 1e-6, 'Lights peak at 1');
    });

    // 2.3 rgbToHsl and hslToRgb
    register('Adjustments: RGB <-> HSL Round-trip', () => {
        const { rgbToHsl, hslToRgb } = window.OkazuTestables.adjustments;

        // 2.3.1 Round-Trip Fidelity
        const colors = [
            [255, 0, 0], [0, 255, 0], [0, 0, 255], // Primaries
            [255, 255, 0], [0, 255, 255], [255, 0, 255], // Secondaries
            [0, 0, 0], [128, 128, 128], [255, 255, 255], // Grayscale
            [12, 200, 77], [150, 10, 220] // Random
        ];

        colors.forEach(([r, g, b]) => {
            const [h, s, l] = rgbToHsl(r, g, b);
            const [r2, g2, b2] = hslToRgb(h, s, l);
            assert(Math.abs(r2 - r) <= 1, `Red mismatch: ${r} vs ${r2}`);
            assert(Math.abs(g2 - g) <= 1, `Green mismatch: ${g} vs ${g2}`);
            assert(Math.abs(b2 - b) <= 1, `Blue mismatch: ${b} vs ${b2}`);
        });

        // 2.3.2 Hue Edge Cases
        const [hRed] = rgbToHsl(255, 0, 0);
        assert(Math.abs(hRed - 0) <= 0.5 || Math.abs(hRed - 360) <= 0.5, 'Red hue approx 0/360');

        const [hGreen] = rgbToHsl(0, 255, 0);
        assert(Math.abs(hGreen - 120) <= 0.5, 'Green hue approx 120');

        const [hBlue] = rgbToHsl(0, 0, 255);
        assert(Math.abs(hBlue - 240) <= 0.5, 'Blue hue approx 240');

        // 2.3.3 Saturation/Lightness Boundaries
        const [grayR, grayG, grayB] = hslToRgb(100, 0, 0.5);
        assert(grayR === grayG && grayG === grayB, 'Saturation 0 yields grayscale');

        const [blackR, blackG, blackB] = hslToRgb(100, 0.5, 0);
        assert(blackR === 0 && blackG === 0 && blackB === 0, 'Lightness 0 yields black');

        const [whiteR, whiteG, whiteB] = hslToRgb(100, 0.5, 1);
        assert(whiteR === 255 && whiteG === 255 && whiteB === 255, 'Lightness 1 yields white');
    });

    // 2.4 getCurvedValue(sliderVal)
    register('Adjustments: getCurvedValue', () => {
        const { getCurvedValue } = window.OkazuTestables.adjustments;

        // 2.4.1 Threshold Behavior
        assertEqual(getCurvedValue(0), 0, '0 -> 0');
        assertEqual(getCurvedValue(100), 100, '100 -> 100');
        assertEqual(getCurvedValue(-100), -100, '-100 -> -100');

        // Slope check
        const val80 = Math.abs(getCurvedValue(80));
        const val81 = Math.abs(getCurvedValue(81));
        const val79 = Math.abs(getCurvedValue(79));

        // Linear below 80: slope approx 50/80 = 0.625
        // Above 80: slope approx 50/20 = 2.5
        const slopeLow = val80 - val79; // Approx 0.625
        const slopeHigh = val81 - val80; // Approx 2.5
        assert(slopeHigh > slopeLow, 'Slope increases after |80|');
    });

    // 4. Master LUT (Levels + Gamma)
    register('Adjustments: applyMasterLUT', () => {
        // Mock state with defaults
        const state = {
            adjustments: { gamma: 1.0, levels: { black: 0, mid: 1.0, white: 255 } }
        };
        const system = createAdjustmentSystem({ state, els: {}, ctx: {}, renderToContext: () => {}, render: () => {}, scheduleHeavyTask: () => {} });

        // 4.4.1 Early Return
        const dataOrig = new Uint8ClampedArray([10, 20, 30, 255]);
        const imgData = { data: dataOrig }; // Use same ref to check mutation (though here we check values)
        system.applyMasterLUT(imgData);
        assertEqual(imgData.data[0], 10, 'No change on defaults');

        // 4.4.2 Exact Pixel Mapping
        state.adjustments.levels.black = 51; // 0.2 * 255
        state.adjustments.levels.white = 204; // 0.8 * 255
        // Range 0.2 - 0.8.
        // Input 0 (0.0) -> <0.2 -> 0
        // Input 51 (0.2) -> 0
        // Input 128 (0.5) -> (0.5-0.2)/(0.8-0.2) = 0.3/0.6 = 0.5 -> 128
        // Input 255 (1.0) -> >0.8 -> 1.0 -> 255

        const dataTest = new Uint8ClampedArray([0, 51, 128, 255]);
        // Use separate buffer since applyMasterLUT loops over 4-byte chunks (RGBA)
        const imgDataTest = { data: new Uint8ClampedArray([0,0,0,255, 51,51,51,255, 128,128,128,255, 255,255,255,255]) };
        system.applyMasterLUT(imgDataTest);

        assertEqual(imgDataTest.data[0], 0, 'Value <= black maps to 0');
        assertEqual(imgDataTest.data[4], 0, 'Value == black maps to 0');
        assertApprox(imgDataTest.data[8], 128, 2, 'Mid value maps linearly'); // Tolerance 2 for LUT rounding
        assertEqual(imgDataTest.data[12], 255, 'Value >= white maps to 255');

        // 4.4.3 Alpha Unchanged
        assertEqual(imgDataTest.data[3], 255, 'Alpha unchanged');
    });

    // 5. Color Operations (applyColorOps)
    register('Adjustments: applyColorOps', () => {
         const state = {
            adjustments: {
                saturation: 0, vibrance: 0, wb: 0, colorBal: { r:0, g:0, b:0 }, shadows: 0, highlights: 0
            }
        };
        const system = createAdjustmentSystem({ state, els: {}, ctx: {}, renderToContext: () => {}, render: () => {}, scheduleHeavyTask: () => {} });

        // 5.1 Early Return
        const data = new Uint8ClampedArray([100, 100, 100, 255]);
        system.applyColorOps({ data });
        assertEqual(data[0], 100, 'No op when all 0');

        // 5.3 Saturation
        state.adjustments.saturation = -100; // Desaturate
        const colData = new Uint8ClampedArray([255, 0, 0, 255]);
        system.applyColorOps({ data: colData });
        // Grayscale value of red: 0.299*255 ~= 76
        assertApprox(colData[0], 76, 2, 'Desaturated R');
        assertApprox(colData[1], 76, 2, 'Desaturated G');
        assertApprox(colData[2], 76, 2, 'Desaturated B');

        // 5.6 Color Balance
        state.adjustments.saturation = 0;
        state.adjustments.colorBal.r = 100; // Curve 100 -> 100
        const balData = new Uint8ClampedArray([100, 100, 100, 255]);
        system.applyColorOps({ data: balData });
        // Adds 100 to Red, then re-scales luminance.
        // Old Lum = 100. New R = 200, G=100, B=100.
        // New Lum approx 0.3*200 + 0.59*100 + 0.11*100 = 60 + 59 + 11 = 130.
        // Scale = 100/130 ~= 0.77.
        // Final R ~= 200 * 0.77 = 154.
        assert(balData[0] > 100, 'Red increased');
        assert(balData[1] < 100, 'Green decreased to compensate lum');
        assert(balData[2] < 100, 'Blue decreased to compensate lum');
    });

    // 6. Selective Color Application (applySelectiveColor)
    register('Adjustments: applySelectiveColor', () => {
        // Mock State
        // Ensure all bands are fully initialized to avoid undefined !== 0 checks triggering active state
        const zeroBand = { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
        const state = {
             adjustments: { colorTuning: {
                 red: { ...zeroBand },
                 orange: { ...zeroBand }, yellow: { ...zeroBand }, green: { ...zeroBand },
                 aqua: { ...zeroBand }, blue: { ...zeroBand }, purple: { ...zeroBand }, magenta: { ...zeroBand },
                 lights: { ...zeroBand }, mids: { ...zeroBand }, darks: { ...zeroBand }
             } }
        };
        const system = createAdjustmentSystem({ state, els: {}, ctx: {}, renderToContext: () => {}, render: () => {}, scheduleHeavyTask: () => {} });

        // Init LUTs
        system.recalculateColorTuning(); // Should result in hasActiveColorTuning = false

        // 6.1 No-Op When Inactive
        const data = new Uint8ClampedArray([255, 0, 0, 255]);
        system.applySelectiveColor({ data });
        assertEqual(data[0], 255, 'No op when inactive');

        // 6.2 Single Pixel Adjustment
        state.adjustments.colorTuning.red = { hue: 20, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
        // Any nonzero value activates it
        system.recalculateColorTuning();

        const redPixel = new Uint8ClampedArray([255, 0, 0, 255]);
        system.applySelectiveColor({ data: redPixel });

        // Red (0 deg) shifted +20 deg -> Orange (20 deg).
        // RGB for H=20, S=1, L=0.5 -> R=255, G=85, B=0
        assertEqual(redPixel[0], 255, 'Red component high');
        assert(redPixel[1] > 0, 'Green component increased (Hue shift)');
        assertEqual(redPixel[2], 0, 'Blue component low');
    });

})();
