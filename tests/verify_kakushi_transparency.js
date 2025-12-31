// Mock Canvas Environment
const { createCanvas, Image } = require('canvas');

// Load kakushi (we need to evaluate it in this context or mock it)
// Since kakushi.js is an IIFE that returns an object, we can require it if we modify it slightly
// or just copy-paste the logic for testing.
// Let's copy-paste the RELEVANT logic to isolate it.

const MAGIC = new Uint8Array([0x4f, 0x4b, 0x5a, 0x31]); // "OKZ1"
const HEADER_BYTES = 8;

// Helper: Embeds bytes into pixels, skipping transparent ones
function embedBytes(data, bytes) {
    let byteIndex = 0;
    let bitIndex = 0;

    for (let i = 0; i < data.length; i += 4) {
        // Skip transparent pixels
        if (data[i + 3] === 0) continue;

        for (let c = 0; c < 3; c++) {
            if (byteIndex >= bytes.length) return;

            const bit = (bytes[byteIndex] >> (7 - bitIndex)) & 1;
            data[i + c] = (data[i + c] & 0xFE) | bit;

            bitIndex++;
            if (bitIndex === 8) {
                bitIndex = 0;
                byteIndex++;
            }
        }
    }
}

// Helper: Extracts bytes from pixels, skipping transparent ones
function extractBytes(data, byteCount) {
    const bytes = new Uint8Array(byteCount);
    let byteIndex = 0;
    let bitIndex = 0;

    for (let i = 0; i < data.length; i += 4) {
        // Skip transparent pixels
        if (data[i + 3] === 0) continue;

        for (let c = 0; c < 3; c++) {
            const bit = data[i + c] & 1;
            bytes[byteIndex] = (bytes[byteIndex] << 1) | bit;

            bitIndex++;
            if (bitIndex === 8) {
                bitIndex = 0;
                byteIndex++;
                if (byteIndex >= byteCount) return bytes;
            }
        }
    }
    return bytes;
}

function hasMagic(header) {
    if (header.length < MAGIC.length) return false;
    for (let i = 0; i < MAGIC.length; i++) {
        if (header[i] !== MAGIC[i]) return false;
    }
    return true;
}

// --- TEST CASE ---
function testTransparencySkip() {
    console.log("Test: Transparency Skip Logic");

    const width = 10;
    const height = 10;
    const totalPixels = width * height;

    // Create a buffer: RGBA (4 bytes per pixel)
    const data = new Uint8Array(totalPixels * 4);

    // Fill with generic data
    for(let i=0; i<data.length; i++) data[i] = 255;

    // Make first 5 pixels Transparent (Alpha = 0)
    // 0, 4, 8, 12, 16
    for(let i=0; i<5; i++) {
        data[i*4 + 3] = 0;
    }

    // Embed Magic Header
    // Magic "OKZ1" + 4 bytes length = 8 bytes total
    // 8 bytes * 8 bits = 64 bits.
    // 3 channels per pixel.
    // 64 / 3 = 21.33 pixels needed.
    // If first 5 are skipped, it should start writing at pixel 5.

    const header = new Uint8Array(8);
    header.set(MAGIC, 0);
    // Length = 0 for this test

    console.log("Embedding header...");
    embedBytes(data, header);

    // Verify first 5 pixels are UNTOUCHED (still 255, 255, 255, 0)
    // Note: embedBytes modifies RGB even if Alpha is 0?
    // Wait, the logic is: if (data[i+3] === 0) continue;
    // So RGB should be untouched.

    for(let i=0; i<5; i++) {
        if (data[i*4] !== 255) console.error(`FAIL: Pixel ${i} Red modified!`);
    }

    // Extract
    console.log("Extracting header...");
    const extracted = extractBytes(data, 8);

    if (hasMagic(extracted)) {
        console.log("PASS: Header found after skipping transparent pixels.");
    } else {
        console.error("FAIL: Magic mismatch.", extracted);
    }
}

testTransparencySkip();
