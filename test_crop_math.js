const state = {
    fullDims: { w: 1000, h: 2000 },
    cropRect: { x: 0.25, y: 0.25, w: 0.5, h: 0.25 }, // (250, 500) w=500, h=500
    rotation: 0,
    cropRotation: 0,
    view: { x: 0, y: 0, scale: 1 }
};

// Simulation of Truth P (Center of Image)
const imageCx = 0.5; // Prop
const imageCy = 0.5; // Prop

// Assume we start a drag at Image Center
const originTruth = { x: imageCx, y: imageCy };

// Current Rect
const startRect = { ...state.cropRect };

// Factor = 0.5 (Zoom In 2x)
const factor = 0.5;

console.log("Start Rect:", startRect);
console.log("Origin Truth:", originTruth);
console.log("Factor:", factor);

// Proposed Math:
// NewCenter = P + (StartCenter - P) * factor

const startCx = startRect.x + startRect.w / 2;
const startCy = startRect.y + startRect.h / 2;

const newCx = originTruth.x + (startCx - originTruth.x) * factor;
const newCy = originTruth.y + (startCy - originTruth.y) * factor;

// New Size
const newW = startRect.w * factor;
const newH = startRect.h * factor;

const newRect = {
    x: newCx - newW / 2,
    y: newCy - newH / 2,
    w: newW,
    h: newH
};

console.log("New Rect:", newRect);

// Verify Point P is at same relative position?
// Relative Position UV = (P - TL) / Size
const startUVx = (originTruth.x - startRect.x) / startRect.w;
const startUVy = (originTruth.y - startRect.y) / startRect.h;

const newUVx = (originTruth.x - newRect.x) / newRect.w;
const newUVy = (originTruth.y - newRect.y) / newRect.h;

console.log("Start UV:", startUVx, startUVy);
console.log("New UV:", newUVx, newUVy);

if (Math.abs(startUVx - newUVx) < 0.0001 && Math.abs(startUVy - newUVy) < 0.0001) {
    console.log("SUCCESS: Point P remains at same relative position.");
} else {
    console.log("FAILURE: Point P moved relatively.");
}
