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

    function drawText(ctx, text, x, y, scale) {
        let curX = x;
        for (let i = 0; i < text.length; i++) {
            const char = text[i].toUpperCase();
            const glyph = FONT[char] || FONT[' '];

            for (let row = 0; row < GLYPH_SIZE; row++) {
                for (let col = 0; col < GLYPH_SIZE; col++) {
                    if (glyph[row * GLYPH_SIZE + col]) {
                        ctx.fillRect(
                            curX + (col * scale),
                            y + (row * scale),
                            scale,
                            scale
                        );
                    }
                }
            }
            curX += (GLYPH_SIZE * scale) + (SPACING * scale);
        }
    }

    const Watermark = {
        apply: function(ctx, width, height) {
            // 1. Setup Scaled Buffer
            // We draw to a temporary canvas matching the target dimensions
            // so we can apply global binarization (thresholding) at the end.
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tCtx = tempCanvas.getContext('2d');

            // 2. Configuration
            // Scale: Reduced by 60% from previous 4% -> 1.6% of image height
            // Glyph is 5 units high.
            // targetPx = height * 0.016
            // scale = targetPx / 5
            const scale = Math.max(1, Math.floor((height * 0.016) / 5));

            // Text Config
            // Removed spaces around bullets to prevent uneven gaps
            // "FILE・DO" and "ALTER・"
            const text = "OKAZUSTUDIO SAVE FILE・DO NOT ALTER・";

            const charWidth = (GLYPH_SIZE * scale);
            const spaceWidth = (SPACING * scale);
            const singleCharAdvance = charWidth + spaceWidth;
            const totalTextWidth = text.length * singleCharAdvance;
            const textHeight = GLYPH_SIZE * scale;
            const lineSpacing = textHeight * 2; // "Double the distance" -> 100% gap

            // Rotation: ~20 degrees
            const angle = 20 * Math.PI / 180;

            // 3. Draw Rotated & Tiled Text
            tCtx.fillStyle = '#FFFFFF';
            tCtx.save();

            // Rotate around center
            tCtx.translate(width / 2, height / 2);
            tCtx.rotate(angle);

            // Determine bounds to cover after rotation
            const diag = Math.sqrt(width*width + height*height);
            const rangeX = diag * 1.2; // slight buffer
            const rangeY = diag * 1.2;

            let rowIndex = 0;
            // Draw from top to bottom
            for (let y = -rangeY; y < rangeY; y += lineSpacing) {
                // Determine X Start Position
                // We calculate a base start position that is far to the left (-rangeX)
                // but aligned to the text grid to ensure continuity.

                // Base grid alignment (snap to totalTextWidth)
                let x = Math.floor(-rangeX / totalTextWidth) * totalTextWidth;

                // Offset Odd Rows (Brick Pattern)
                // Shift by half width
                if (rowIndex % 2 !== 0) {
                    x -= (totalTextWidth / 2);
                }

                // Fill the line
                while (x < rangeX) {
                    drawText(tCtx, text, x, y, scale);
                    x += totalTextWidth;
                }
                rowIndex++;
            }

            tCtx.restore();

            // 4. Binarize (Threshold) to ensure Reversibility
            // Remove anti-aliasing artifacts from rotation
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

            // 5. Apply to Destination
            ctx.save();
            ctx.globalCompositeOperation = 'difference';
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
        },

        checkAndRemove: function(sourceCanvas) {
            // Apply the exact same logic. XOR cancels out.
            const ctx = sourceCanvas.getContext('2d');
            this.apply(ctx, sourceCanvas.width, sourceCanvas.height);
        }
    };

    window.Watermark = Watermark;
})();