(function() {
    const { register, assert, assertEqual, assertApprox, assertDeepEqual, spyOn } = window.TestRunner;

    function createAdjustmentsFixture() {
        const created = [];
        const container = document.createElement('div');
        container.setAttribute('data-test-fixture', 'adjustments');
        document.body.appendChild(container);

        const ensureElement = (tag, id, options = {}) => {
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement(tag);
                el.id = id;
                if (options.type) el.type = options.type;
                if (options.step) el.step = options.step;
                if (options.value !== undefined) el.value = options.value;
                container.appendChild(el);
                created.push(el);
            }
            return el;
        };

        const sliderIds = [
            'adj-gamma', 'adj-shadows', 'adj-highlights',
            'adj-l-black', 'adj-l-mid', 'adj-l-white',
            'adj-sat', 'adj-vib', 'adj-wb',
            'adj-cb-r', 'adj-cb-g', 'adj-cb-b'
        ];

        sliderIds.forEach(id => {
            const step = ['adj-gamma', 'adj-l-mid'].includes(id) ? '0.01' : '1';
            ensureElement('input', id, { type: 'range', step, value: '0' });
            ensureElement('span', `val-${id.replace('adj-', '')}`);
        });

        const tuningSliders = ['tune-hue', 'tune-sat', 'tune-vib', 'tune-lum', 'tune-shadows', 'tune-highlights'];
        tuningSliders.forEach(id => {
            ensureElement('input', id, { type: 'range', step: '1', value: '0' });
            ensureElement('span', `val-${id}`);
        });

        const bandButtons = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta', 'lights', 'mids', 'darks'];
        bandButtons.forEach(band => ensureElement('button', `band-${band}`));

        const resetSatBtn = ensureElement('button', 'resetSatBtn');
        const resetBandBtn = ensureElement('button', 'resetBandBtn');
        const resetTuningBtn = ensureElement('button', 'resetTuningBtn');

        return {
            resetSatBtn,
            resetBandBtn,
            resetTuningBtn,
            cleanup: () => {
                created.forEach(el => el.remove());
                if (container.childElementCount === 0) {
                    container.remove();
                }
            }
        };
    }

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

    register('Adjustments: DOM wiring for sliders, resets, and tabs', () => {
        const fixture = createAdjustmentsFixture();
        const state = {
            adjustments: {
                gamma: 1.0,
                levels: { black: 0, mid: 1.0, white: 255 },
                saturation: 0,
                vibrance: 0,
                wb: 0,
                colorBal: { r: 0, g: 0, b: 0 },
                shadows: 0,
                highlights: 0,
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
            },
            settings: { adjustmentPreviewResolution: 1080 }
        };
        const els = {
            resetAdjBtn: document.createElement('button'),
            resetLevelsBtn: document.createElement('button'),
            resetColorBtn: document.createElement('button')
        };

        const gammaEl = document.getElementById('adj-gamma');
        const tuningHueEl = document.getElementById('tune-hue');
        const bandRedBtn = document.getElementById('band-red');
        const resetSatBtn = fixture.resetSatBtn;

        const gammaSpy = spyOn(gammaEl, 'addEventListener');
        const tuneSpy = spyOn(tuningHueEl, 'addEventListener');
        const bandSpy = spyOn(bandRedBtn, 'addEventListener');
        const resetSatSpy = spyOn(resetSatBtn, 'addEventListener');
        const resetAdjSpy = spyOn(els.resetAdjBtn, 'addEventListener');

        const system = createAdjustmentSystem({
            state,
            els,
            ctx: {},
            renderToContext: () => {},
            render: () => {},
            scheduleHeavyTask: () => {}
        });

        try {
            system.initAdjustments();

            const gammaEvents = gammaSpy.calls.map(args => args[0]);
            assert(gammaEvents.includes('pointerdown'), 'Gamma slider pointerdown wired');
            assert(gammaEvents.includes('focus'), 'Gamma slider focus wired');
            assert(gammaEvents.includes('input'), 'Gamma slider input wired');
            assert(gammaEvents.includes('change'), 'Gamma slider change wired');

            const tuningEvents = tuneSpy.calls.map(args => args[0]);
            assert(tuningEvents.includes('input'), 'Tuning slider input wired');
            assert(tuningEvents.includes('change'), 'Tuning slider change wired');

            const bandEvents = bandSpy.calls.map(args => args[0]);
            assert(bandEvents.includes('click'), 'Band tab click wired');

            assert(resetSatSpy.calls.some(args => args[0] === 'click'), 'Reset saturation wired');
            assert(resetAdjSpy.calls.some(args => args[0] === 'click'), 'Reset adjustments wired');
        } finally {
            gammaSpy.restore();
            tuneSpy.restore();
            bandSpy.restore();
            resetSatSpy.restore();
            resetAdjSpy.restore();
            fixture.cleanup();
        }
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

    register('Adjustments: Master LUT deterministic output', () => {
        const state = {
            adjustments: { gamma: 2.0, levels: { black: 10, mid: 0.8, white: 245 } }
        };
        const system = createAdjustmentSystem({ state, els: {}, ctx: {}, renderToContext: () => {}, render: () => {}, scheduleHeavyTask: () => {} });

        const original = new Uint8ClampedArray([10, 60, 200, 255, 120, 180, 240, 255]);
        const imgDataA = { data: new Uint8ClampedArray(original) };
        const imgDataB = { data: new Uint8ClampedArray(original) };

        system.applyMasterLUT(imgDataA);
        system.applyMasterLUT(imgDataB);

        assertDeepEqual(Array.from(imgDataA.data), Array.from(imgDataB.data), 'Master LUT deterministic for fixed inputs');
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

    register('Adjustments: updateAdjustmentPreview throttling', () => {
        const state = {
            imgA: {},
            imgB: null,
            adjustmentsVisible: true,
            previewThrottle: -1000,
            settings: { adjustmentPreviewResolution: 'Full' }
        };

        const ctx = {
            getImageData: () => ({ data: new Uint8ClampedArray(4) }),
            putImageData: () => {}
        };
        const els = {
            mainCanvas: { width: 200, height: 100, style: {} },
            previewCanvas: { classList: { add: () => {} } }
        };

        let renderCalls = 0;
        const system = createAdjustmentSystem({
            state,
            els,
            ctx,
            renderToContext: () => { renderCalls += 1; },
            render: () => {},
            scheduleHeavyTask: () => {}
        });

        const originalNow = Date.now;
        let nowCalls = 0;
        Date.now = () => {
            const times = [0, 50, 120];
            return times[nowCalls++] || times[times.length - 1];
        };

        try {
            system.updateAdjustmentPreview();
            system.updateAdjustmentPreview();
            system.updateAdjustmentPreview();
        } finally {
            Date.now = originalNow;
        }

        assertEqual(renderCalls, 2, 'Throttled to two renders over 120ms');
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

    register('Adjustments: selective color tuning on small buffer', () => {
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

        state.adjustments.colorTuning.blue = { hue: -30, saturation: -50, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
        system.recalculateColorTuning();

        const buffer = new Uint8ClampedArray([0, 0, 255, 255, 128, 128, 128, 255]);
        const imgData = { data: buffer };
        system.applySelectiveColor(imgData);

        const { hslToRgb } = window.OkazuTestables.adjustments;
        const [expR, expG, expB] = hslToRgb(210, 0.5, 0.5);

        assertApprox(buffer[0], expR, 1, 'Blue hue shifted towards cyan');
        assertApprox(buffer[1], expG, 1, 'Blue green channel increased');
        assertApprox(buffer[2], expB, 1, 'Blue channel reduced with saturation drop');
        assertEqual(buffer[4], 128, 'Gray pixel unchanged');
        assertEqual(buffer[5], 128, 'Gray pixel unchanged');
        assertEqual(buffer[6], 128, 'Gray pixel unchanged');
    });

    register('Adjustments: color tuning LUT accumulation deterministic', () => {
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

        state.adjustments.colorTuning.red = { hue: 15, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 };
        state.adjustments.colorTuning.lights = { hue: 0, saturation: 0, vibrance: 0, luminance: 20, shadows: 0, highlights: 0 };
        system.recalculateColorTuning();

        const pixel = new Uint8ClampedArray([255, 128, 128, 255]);
        const imgDataA = { data: new Uint8ClampedArray(pixel) };
        const imgDataB = { data: new Uint8ClampedArray(pixel) };

        system.applySelectiveColor(imgDataA);
        system.applySelectiveColor(imgDataB);

        assertDeepEqual(Array.from(imgDataA.data), Array.from(imgDataB.data), 'Color tuning deterministic for fixed inputs');

        const { rgbToHsl } = window.OkazuTestables.adjustments;
        const [hBefore, , lBefore] = rgbToHsl(255, 128, 128);
        const [hAfter, , lAfter] = rgbToHsl(imgDataA.data[0], imgDataA.data[1], imgDataA.data[2]);

        assert(hAfter > hBefore, 'Hue shifted by red tuning band');
        assert(lAfter > lBefore, 'Luminance increased by lights band');
    });

    register('Adjustments: Logger warnings/errors for tuning UI', () => {
        const fixture = createAdjustmentsFixture();
        const missingTuning = document.getElementById('tune-vib');
        if (missingTuning) missingTuning.remove();

        const state = {
            adjustments: {
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
            },
            settings: { adjustmentPreviewResolution: 1080 },
            activeColorBand: null
        };
        const els = {
            resetAdjBtn: document.createElement('button'),
            resetLevelsBtn: document.createElement('button'),
            resetColorBtn: document.createElement('button')
        };

        const warnSpy = spyOn(Logger, 'warn');
        const errorSpy = spyOn(Logger, 'error');

        const system = createAdjustmentSystem({
            state,
            els,
            ctx: {},
            renderToContext: () => {},
            render: () => {},
            scheduleHeavyTask: () => {}
        });

        try {
            system.initAdjustments();

            assert(warnSpy.calls.some(args => String(args[0]).includes('tune-vib')), 'Warns for missing tuning slider');

            const tuneHue = document.getElementById('tune-hue');
            tuneHue.value = '10';
            tuneHue.dispatchEvent(new Event('input'));

            assert(errorSpy.calls.some(args => String(args[0]).includes('Missing activeColorBand')), 'Errors on missing active band');
        } finally {
            warnSpy.restore();
            errorSpy.restore();
            fixture.cleanup();
        }
    });

})();
