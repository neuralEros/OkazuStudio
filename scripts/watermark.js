// scripts/watermark.js
(function() {
    // Mini 5x5 Bitmap Font for deterministic, cross-platform bit-exact rendering
    // 1 = set pixel, 0 = empty
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
        '・': [0,0,0,0,0, 0,1,1,1,0, 0,1,1,1,0, 0,1,1,1,0, 0,0,0,0,0], // Katakana Middle Dot (using 3x3 box)
        ' ': [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0]
    };

    const SCALE = 3;
    const SPACING = 2;
    const GLYPH_SIZE = 5;

    function drawText(ctx, text, x, y) {
        let curX = x;
        for (let i = 0; i < text.length; i++) {
            const char = text[i].toUpperCase();
            const glyph = FONT[char] || FONT[' '];

            for (let row = 0; row < GLYPH_SIZE; row++) {
                for (let col = 0; col < GLYPH_SIZE; col++) {
                    if (glyph[row * GLYPH_SIZE + col]) {
                        ctx.fillRect(
                            curX + (col * SCALE),
                            y + (row * SCALE),
                            SCALE,
                            SCALE
                        );
                    }
                }
            }
            curX += (GLYPH_SIZE * SCALE) + (SPACING * SCALE);
        }
        return curX - x;
    }

    function createPattern() {
        // Text configuration for Pythagorean Tiling
        const baseText = "OKAZUSTUDIO SAVE FILE ・ DO NOT ALTER ・ "; // Using U+30FB
        const text = baseText + " "; // Pad to 40 chars

        const charWidth = (GLYPH_SIZE * SCALE);
        const spaceWidth = (SPACING * SCALE);
        const charSlot = charWidth + spaceWidth;
        const totalWidth = text.length * charSlot;

        const tileSize = 4200;
        const lineSpacing = 30;

        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d');

        // 1. Draw Rotated Text
        // Clear
        ctx.clearRect(0, 0, tileSize, tileSize);
        ctx.fillStyle = '#FFFFFF';

        ctx.save();
        ctx.translate(tileSize / 2, tileSize / 2);
        ctx.transform(0.8, 0.6, -0.6, 0.8, 0, 0); // Rotation

        const range = 3200;
        for (let y = -range; y < range; y += lineSpacing) {
            let x = Math.floor(-range / totalWidth) * totalWidth;
            while (x < range) {
                drawText(ctx, text, x, y);
                x += totalWidth;
            }
        }
        ctx.restore();

        // 2. Enforce Binary Values (Thresholding) to fix Reversibility
        // The rotated fillRects will have anti-aliased edges (gray values).
        // We must quantize them to 0 or 255.
        const imageData = ctx.getImageData(0, 0, tileSize, tileSize);
        const data = imageData.data;

        // Loop through pixels. Each pixel is r, g, b, a (4 bytes).
        // We drew White (255, 255, 255) with variable Alpha (or fully opaque but AA'd on RGB?)
        // Standard fillStyle='#FFFFFF' on transparent canvas usually results in
        // R=255, G=255, B=255, A=alpha_value.
        // We'll threshold Alpha.
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            // Threshold at 128 (middle grey)
            const binary = alpha >= 128 ? 255 : 0;

            // Force pure white + binary alpha, or purely clear.
            // Let's just set alpha. R,G,B are already 255 (if drawn white).
            // Actually, if AA occurred on RGB (unlikely on transparent bg), force white too.
            data[i] = 255;     // R
            data[i + 1] = 255; // G
            data[i + 2] = 255; // B
            data[i + 3] = binary; // A
        }

        ctx.putImageData(imageData, 0, 0);

        return ctx.createPattern(canvas, 'repeat');
    }

    const Watermark = {
        apply: function(ctx, width, height) {
            ctx.save();
            ctx.globalCompositeOperation = 'difference';

            const pattern = createPattern();
            ctx.fillStyle = pattern;

            ctx.fillRect(0, 0, width, height);

            ctx.restore();
        },

        checkAndRemove: function(sourceCanvas) {
            const ctx = sourceCanvas.getContext('2d');
            this.apply(ctx, sourceCanvas.width, sourceCanvas.height);
        }
    };

    window.Watermark = Watermark;
})();
