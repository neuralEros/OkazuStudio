// Mock Browser Globals
global.window = {};
global.console = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    groupCollapsed: console.log,
    groupEnd: () => {}
};

// Mock Dependencies
const Stego = require('../scripts/stego.js');

// Mock State
const DEFAULT_STATE = {
    adjustments: {
        gamma: 1.0,
        levels: { black: 0, mid: 1.0, white: 255 },
        shadows: 0, highlights: 0,
        saturation: 0, vibrance: 0,
        wb: 0,
        colorBal: { r: 0, g: 0, b: 0 },
        colorTuning: {
            red: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
            // ... assuming iteration works on keys present
        }
    },
    cropRect: null, // Full
    fullDims: { w: 1000, h: 1000 },
    nameB: "Some Image"
};

const DIRTY_STATE = JSON.parse(JSON.stringify(DEFAULT_STATE));
DIRTY_STATE.adjustments.gamma = 1.2;

const CROP_STATE = JSON.parse(JSON.stringify(DEFAULT_STATE));
CROP_STATE.cropRect = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };

const MASK_ACTIONS = {
    actions: [
        { type: 'LOAD_IMAGE' },
        { type: 'STROKE', payload: { foo: 'bar' } }
    ],
    cursor: 1
};

const EMPTY_HISTORY = { actions: [], cursor: -1 };

// --- Tests ---

function testDefaults() {
    console.log("Test: Defaults (Merged Export)");
    const payload = Stego.assemblePayload(DEFAULT_STATE, EMPTY_HISTORY, 'merged');

    if (payload.adjustments) console.error("FAIL: Found adjustments in default state");
    else console.log("PASS: No adjustments");

    if (payload.crop) console.error("FAIL: Found crop in default state");
    else console.log("PASS: No crop");

    if (payload.mask) console.error("FAIL: Found mask in default state");
    else console.log("PASS: No mask");

    // Check info
    if (payload.info && payload.info.type === 'merged') console.log("PASS: Info correct");
    else console.error("FAIL: Info missing or wrong");
}

function testAdjustments() {
    console.log("\nTest: Adjustments (Merged Export)");
    const payload = Stego.assemblePayload(DIRTY_STATE, EMPTY_HISTORY, 'merged');

    if (payload.adjustments && payload.adjustments.gamma === 1.2) console.log("PASS: Adjustments found");
    else console.error("FAIL: Adjustments missing or wrong");
}

function testCrop() {
    console.log("\nTest: Crop (Merged Export)");
    const payload = Stego.assemblePayload(CROP_STATE, EMPTY_HISTORY, 'merged');

    if (payload.crop && payload.crop.x === 0.1) console.log("PASS: Crop found");
    else console.error("FAIL: Crop missing");
}

function testMask() {
    console.log("\nTest: Mask (Merged Export)");
    const payload = Stego.assemblePayload(DEFAULT_STATE, MASK_ACTIONS, 'merged');

    if (payload.mask && payload.mask.length === 1) console.log("PASS: Mask found");
    else console.error("FAIL: Mask missing or wrong length");
}

function testExportTypes() {
    console.log("\nTest: Export Types");

    // Front - Should have Adj, No Mask
    const pFront = Stego.assemblePayload(DIRTY_STATE, MASK_ACTIONS, 'front');
    if (pFront.adjustments && !pFront.mask) console.log("PASS: Front (Adj Yes, Mask No)");
    else console.error("FAIL: Front logic wrong");

    // Mask - Should have Mask, No Adj
    const pMask = Stego.assemblePayload(DIRTY_STATE, MASK_ACTIONS, 'mask');
    if (!pMask.adjustments && pMask.mask) console.log("PASS: Mask (Adj No, Mask Yes)");
    else console.error("FAIL: Mask logic wrong");
}

function run() {
    try {
        testDefaults();
        testAdjustments();
        testCrop();
        testMask();
        testExportTypes();
        console.log("\nALL TESTS COMPLETED");
    } catch(e) {
        console.error("Test Crashed:", e);
    }
}

run();
