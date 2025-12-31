// scripts/watermark.js
(function() {
    // Mini 5x5 Bitmap Font
    const FONT = {
        'A': [0,1,1,1,0, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1],
        'B': [1,1,1,1,0, 1,0,0,0,1, 1,1,1,1,0, 1,0,0,0,1, 1,1,1,1,0],
        'C': [0,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 0,1,1,1,0],
        'D': [1,1,1,0,0, 1,0,0,1,0, 1,0,0,1,0, 1,0,0,1,0, 1,1,1,0,0],
        'E': [1,1,1,1,1, 1,0,0,0,0, 1,1,1,1,0, 1,0,0,0,0, 1,1,1,1,1],
        'F': [1,1,1,1,1, 1,0,0,0,0, 1,1,1,0,0, 1,0,0,0,0, 1,0,0,0,0],
        'G': [0,1,1,1,0, 1,0,0,0,0, 1,0,0,1,1, 1,0,0,0,1, 0,1,1,1,0],
        'H': [1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1],
        'I': [0,1,1,1,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,1,1,1,0],
        'J': [0,0,1,1,1, 0,0,0,1,0, 0,0,0,1,0, 1,0,0,1,0, 0,1,1,0,0],
        'K': [1,0,0,0,1, 1,0,0,1,0, 1,1,1,0,0, 1,0,0,1,0, 1,0,0,0,1],
        'L': [1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,1],
        'M': [1,0,0,0,1, 1,1,0,1,1, 1,0,1,0,1, 1,0,0,0,1, 1,0,0,0,1],
        'N': [1,0,0,0,1, 1,1,0,0,1, 1,0,1,0,1, 1,0,0,1,1, 1,0,0,0,1],
        'O': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
        'P': [1,1,1,1,0, 1,0,0,0,1, 1,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0],
        'Q': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,1,0, 0,1,1,0,1],
        'R': [1,1,1,1,0, 1,0,0,0,1, 1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1],
        'S': [0,1,1,1,1, 1,0,0,0,0, 0,1,1,1,0, 0,0,0,0,1, 1,1,1,1,0],
        'T': [1,1,1,1,1, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0],
        'U': [1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
        'V': [1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0],
        'W': [1,0,0,0,1, 1,0,0,0,1, 1,0,1,0,1, 1,1,0,1,1, 1,0,0,0,1],
        'X': [1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0, 0,1,0,1,0, 1,0,0,0,1],
        'Y': [1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0],
        'Z': [1,1,1,1,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 1,1,1,1,1],
        '・': [0,0,0,0,0, 0,1,1,1,0, 0,1,1,1,0, 0,1,1,1,0, 0,0,0,0,0],
        ' ': [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0]
    };

    const GLYPH_SIZE = 5;
    const SPACING = 2; // base spacing

    // Helper: Manual 2D Rotation
    // Rotates point (x,y) around (cx, cy) by angle (radians)
    function rotatePoint(x, y, cx, cy, sin, cos) {
        // Translate to origin
        const dx = x - cx;
        const dy = y - cy;

        // Rotate
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        // Translate back and round to nearest integer for deterministic pixel grid
        return {
            x: Math.round(rx + cx),
            y: Math.round(ry + cy)
        };
    }

    function drawTextRotated(ctx, text, startX, startY, scale, cx, cy, sin, cos) {
        let curX = startX;
        // Optimization: Pre-calculate scaled size
        const scaledSize = scale; // 1x1 block scaled

        for (let i = 0; i < text.length; i++) {
            const char = text[i].toUpperCase();
            const glyph = FONT[char] || FONT[' '];

            for (let row = 0; row < GLYPH_SIZE; row++) {
                for (let col = 0; col < GLYPH_SIZE; col++) {
                    if (glyph[row * GLYPH_SIZE + col]) {
                        // Original unrotated coordinates (top-left of the pixel block)
                        const px = curX + (col * scale);
                        const py = startY + (row * scale);

                        // Rotate the position of this block
                        const p = rotatePoint(px, py, cx, cy, sin, cos);

                        // Draw the block at the rotated position
                        // Note: We are drawing axis-aligned rectangles at rotated coordinates.
                        // This approximates rotation for small blocks (like pixels) without anti-aliasing.
                        // Since 'scale' might be > 1, we are technically rotating the GRID, but drawing squares.
                        // For a pure pixel-art rotation, we should rotate the center of the block.
                        // Ideally, we'd rotate all 4 corners and fill, but that re-introduces anti-aliasing via canvas fill.
                        // To remain deterministic, we must stick to integer rects.
                        // Valid strategy: Rotate the top-left corner, draw an axis-aligned rect.
                        // This introduces a "staircase" effect which is fine for a mask/watermark style.
                        ctx.fillRect(p.x, p.y, scaledSize, scaledSize);
                    }
                }
            }
            curX += (GLYPH_SIZE * scale) + (SPACING * scale);
        }
    }

    function buildMaskCanvas(width, height) {
        // 1. Setup Scaled Buffer
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tCtx = tempCanvas.getContext('2d');

        // 2. Configuration
        const scale = Math.max(1, Math.floor((height * 0.016) / 5));

        // Text Config
        const text = "OKAZUSTUDIO SAVE FILE ・ DO NOT ALTER ・ ";

        const charWidth = (GLYPH_SIZE * scale);
        const spaceWidth = (SPACING * scale);
        const singleCharAdvance = charWidth + spaceWidth;
        const totalTextWidth = text.length * singleCharAdvance;
        const textHeight = GLYPH_SIZE * scale;
        const lineSpacing = textHeight * 4;

        // Rotation: ~20 degrees
        const angle = 20 * Math.PI / 180;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const cx = width / 2;
        const cy = height / 2;

        // 3. Draw Rotated & Tiled Text Manually
        tCtx.fillStyle = '#FFFFFF';

        // Determine bounds to cover
        const diag = Math.sqrt(width*width + height*height);
        const rangeX = diag * 1.2;
        const rangeY = diag * 1.2;

        let rowIndex = 0;
        // Draw from top to bottom (simulated rotated grid)
        for (let y = -rangeY; y < rangeY; y += lineSpacing) {
            let x = Math.floor(-rangeX / totalTextWidth) * totalTextWidth;

            // Offset Odd Rows
            if (rowIndex % 2 !== 0) {
                const brickOffset = (totalTextWidth / 2) * 2.5;
                x -= brickOffset;
            }

            // Fill the line
            while (x < rangeX) {
                // Manually rotate each glyph block
                drawTextRotated(tCtx, text, x, y, scale, cx, cy, sin, cos);
                x += totalTextWidth;
            }
            rowIndex++;
        }

        // 4. Binarize (Threshold)
        // Even with integer coordinates, we ensure strict binary alpha just in case
        const imageData = tCtx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            // Threshold Alpha
            const alpha = data[i + 3];
            const binary = alpha >= 128 ? 255 : 0;

            // Force White + Binary Alpha
            data[i] = 255;
            data[i+1] = 255;
            data[i+2] = 255;
            data[i+3] = binary;
        }
        tCtx.putImageData(imageData, 0, 0);

        return tempCanvas;
    }

    const Watermark = {
        apply: function(ctx, width, height) {
            const tempCanvas = buildMaskCanvas(width, height);

            // Apply to Destination
            ctx.save();
            ctx.globalCompositeOperation = 'difference';
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
        },

        buildMask: function(width, height) {
            const tempCanvas = buildMaskCanvas(width, height);
            const tCtx = tempCanvas.getContext('2d');
            return tCtx.getImageData(0, 0, width, height);
        },

        checkAndRemove: function(sourceCanvas) {
            // Apply the exact same logic. XOR cancels out.
            const ctx = sourceCanvas.getContext('2d');
            this.apply(ctx, sourceCanvas.width, sourceCanvas.height);
        }
    };

    window.Watermark = Watermark;
})();
