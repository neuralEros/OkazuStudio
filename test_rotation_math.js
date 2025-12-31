
function rotatePoint(p, cx, cy, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const dx = p.x - cx;
    const dy = p.y - cy;
    return {
        x: cx + (dx * c - dy * s),
        y: cy + (dx * s + dy * c)
    };
}

const state = {
    fullDims: { w: 1000, h: 2000 },
    rotation: 0,
    cropRotation: 45 // Free rotation
};

// Visual Canvas Dims (matches FullDims because rotation=0)
const vW = 1000;
const vH = 2000;
const vCx = 500;
const vCy = 1000;

// Mouse Click at Center of Visual Canvas (500, 1000)
const mouseX = 500;
const mouseY = 1000;

// Inverse Rotation Logic
// We want "Unrotated Visual Point"
const unrotatedP = rotatePoint({x: mouseX, y: mouseY}, vCx, vCy, -state.cropRotation);

console.log("Click:", mouseX, mouseY);
console.log("Unrotated P:", unrotatedP);

// Since we clicked center, and rotated around center, it should be center.
if (Math.abs(unrotatedP.x - 500) < 0.01 && Math.abs(unrotatedP.y - 1000) < 0.01) {
    console.log("Center Rotation OK");
} else {
    console.log("Center Rotation FAILED");
}

// Case 2: Click Top-Left of Visual Canvas (0, 0)
// This point is visually at top-left.
// But the image is rotated 45 deg clockwise around center.
// So the "Unrotated Visual Point" (Point on the unrotated image that is now at 0,0)
// should be somewhere else.
const p2 = { x: 0, y: 0 };
const unrotatedP2 = rotatePoint(p2, vCx, vCy, -state.cropRotation);
console.log("Top-Left Click unrotated:", unrotatedP2);

// Inverse check: If we have point UnrotatedP2, and rotate it by +45, we should get 0,0.
const rotatedBack = rotatePoint(unrotatedP2, vCx, vCy, state.cropRotation);
console.log("Rotated Back:", rotatedBack);

if (Math.abs(rotatedBack.x - 0) < 0.01 && Math.abs(rotatedBack.y - 0) < 0.01) {
    console.log("Rotation Inverse Logic OK");
} else {
    console.log("Rotation Inverse Logic FAILED");
}
