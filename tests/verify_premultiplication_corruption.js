const { createCanvas, Image } = require('canvas');

// Simulation of Premultiplication Corruption
// When loading an image with alpha < 255, browsers often perform premultiplication
// (R*A, G*A, B*A). When retrieving data, they un-premultiply (R/A, etc).
// This round trip involves floating point math and rounding, which destroys LSBs.

function simulateBrowserRoundTrip(r, g, b, a) {
    if (a === 0) return { r:0, g:0, b:0, a:0 };

    // Premultiply (0-255 range mapped to 0-1 float)
    const alpha = a / 255;
    let pr = (r / 255) * alpha;
    let pg = (g / 255) * alpha;
    let pb = (b / 255) * alpha;

    // Quantize to 8-bit (Simulate storage in buffer)
    let ir = Math.round(pr * 255);
    let ig = Math.round(pg * 255);
    let ib = Math.round(pb * 255);

    // Un-premultiply (Simulate getImageData)
    // Note: Browsers might have higher precision internally, but storage is 8-bit.
    // If stored as premultiplied ints, we lose precision.

    let ur = Math.round((ir / 255) / alpha * 255);
    let ug = Math.round((ig / 255) / alpha * 255);
    let ub = Math.round((ib / 255) / alpha * 255);

    // Clamp
    ur = Math.max(0, Math.min(255, ur));
    ug = Math.max(0, Math.min(255, ug));
    ub = Math.max(0, Math.min(255, ub));

    return { r: ur, g: ug, b: ub, a: a };
}

function testLSBStability() {
    console.log("Testing LSB Stability across Premultiplication Round Trip...");

    // Test Case 1: Fully Opaque (Alpha 255)
    // 255 / 255 = 1. No loss.
    const resOpaque = simulateBrowserRoundTrip(101, 102, 103, 255);
    if (resOpaque.r === 101) console.log("PASS: Alpha 255 preserves values.");
    else console.error(`FAIL: Alpha 255 corrupted: 101 -> ${resOpaque.r}`);

    // Test Case 2: Semi-Transparent (Alpha 128 ~ 0.5)
    // r=101 (binary ...101) -> LSB is 1.
    const resSemi = simulateBrowserRoundTrip(101, 102, 103, 128);
    // 101 * 0.5 = 50.5 -> 51.
    // 51 / 0.5 = 102.
    // 101 changed to 102. LSB flipped!
    if (resSemi.r === 101) console.log("PASS: Alpha 128 preserves values.");
    else console.log(`CONFIRMED: Alpha 128 corrupted LSB: 101 -> ${resSemi.r}`);

    // Test Case 3: Mostly Opaque (Alpha 254)
    const resAlmost = simulateBrowserRoundTrip(101, 102, 103, 254);
    if (resAlmost.r === 101) console.log("PASS: Alpha 254 preserves values.");
    else console.log(`CONFIRMED: Alpha 254 corrupted LSB: 101 -> ${resAlmost.r}`);
}

testLSBStability();
