
/**
 * Splits an image into tiles, upscales them using the Replicate API, and stitches them back together.
 * @param {Blob|HTMLImageElement|ImageBitmap|HTMLCanvasElement} inputImage - The source image.
 * @param {object} options - Configuration options.
 * @param {string} options.token - Replicate API Token.
 * @param {number} [options.tileSize=256] - The size of the square tiles to send to the scaler.
 * @param {number} [options.overlap=32] - The size of the overlapping feather area.
 * @returns {Promise<Blob>} - The upscaled image as a Blob.
 */
async function tileAndUpscale(inputImage, options) {
    const { token, tileSize = 256, overlap = 32 } = options;
    if (!token) throw new Error("API Token is required for tiling.");

    // 1. Prepare Input Canvas
    const srcCanvas = await toCanvas(inputImage);
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const width = srcCanvas.width;
    const height = srcCanvas.height;

    // 2. Generate Tile Grid
    const tiles = [];
    const stride = tileSize - overlap; // Step size

    for (let y = 0; y < height; y += stride) {
        for (let x = 0; x < width; x += stride) {
            // Adjust dimensions for edge cases
            const w = Math.min(tileSize, width - x);
            const h = Math.min(tileSize, height - y);

            tiles.push({
                x, y, w, h,
                // Identify edges for feathering
                isLeft: x === 0,
                isRight: (x + w) >= width,
                isTop: y === 0,
                isBottom: (y + h) >= height
            });

            if (x + w >= width) break;
        }
        if (y + tileSize >= height) break;
    }

    if (tiles.length === 0) throw new Error("No tiles generated. Image might be empty.");

    // 3. Process Tiles
    // We must process the first tile strictly sequentially to determine the scale factor
    // and initialize the final canvas. This prevents race conditions.

    let scaleFactor = null;
    let finalCanvas = null;
    let finalCtx = null;

    // Helper to process a single tile (returns { index, bmp })
    const processTile = async (tile, index) => {
        // Extract tile data
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = tile.w;
        tileCanvas.height = tile.h;
        const tileCtx = tileCanvas.getContext('2d');
        tileCtx.drawImage(srcCanvas, tile.x, tile.y, tile.w, tile.h, 0, 0, tile.w, tile.h);

        const blob = await new Promise(r => tileCanvas.toBlob(r));

        // Upscale
        const upscaledBlob = await upscaleChunk(blob, token);
        const bmp = await createImageBitmap(upscaledBlob);

        return { index, bmp };
    };

    // Helper to draw a processed tile to the final canvas
    const drawTile = (tileIndex, bitmap) => {
        const tile = tiles[tileIndex];
        const s = scaleFactor;

        // Destination coords
        const dx = tile.x * s;
        const dy = tile.y * s;
        const dw = tile.w * s;
        const dh = tile.h * s;

        // Feather parameters (scaled)
        const f = overlap * s;

        // Create feathered bitmap if needed
        if (tile.isLeft && tile.isRight && tile.isTop && tile.isBottom) {
             // Single tile image, just draw
             finalCtx.drawImage(bitmap, dx, dy, dw, dh);
        } else {
             const feathered = featherBitmap(bitmap, f, {
                 left: !tile.isLeft,    // Feather left if NOT left edge
                 right: !tile.isRight,
                 top: !tile.isTop,
                 bottom: !tile.isBottom
             });
             finalCtx.drawImage(feathered, dx, dy, dw, dh);
        }
    };

    // --- Step A: Process First Tile Sequentially ---
    const firstTile = tiles[0];
    try {
        const { bmp } = await processTile(firstTile, 0);

        // Calculate Scale Factor
        scaleFactor = bmp.width / firstTile.w;

        // Initialize Final Canvas
        finalCanvas = document.createElement('canvas');
        finalCanvas.width = width * scaleFactor;
        finalCanvas.height = height * scaleFactor;
        finalCtx = finalCanvas.getContext('2d');

        // Draw the first tile
        drawTile(0, bmp);

    } catch (e) {
        throw new Error(`Failed to process initial tile: ${e.message}`);
    }

    // --- Step B: Process Remaining Tiles Concurrently ---
    const remainingTiles = tiles.slice(1).map((t, i) => ({ ...t, index: i + 1 }));

    if (remainingTiles.length > 0) {
        const MAX_CONCURRENCY = 4;
        const queue = [...remainingTiles];

        const next = () => {
            if (queue.length === 0) return null;
            const tile = queue.shift();

            return processTile(tile, tile.index)
                .then(({ index, bmp }) => {
                    drawTile(index, bmp);
                })
                .catch(err => {
                    console.error(`Tile ${tile.index} failed`, err);
                    // Failing silently leaves a hole.
                })
                .finally(() => {
                    return next();
                });
        };

        const pool = Array(Math.min(remainingTiles.length, MAX_CONCURRENCY)).fill(0).map(() => next());
        await Promise.all(pool);
    }

    // 4. Return Result
    return new Promise(resolve => finalCanvas.toBlob(resolve));
}

// Helpers

async function toCanvas(source) {
    if (source instanceof HTMLCanvasElement) return source;
    const canvas = document.createElement('canvas');
    let width, height, drawable;

    if (source instanceof Blob) {
        drawable = await createImageBitmap(source);
        width = drawable.width;
        height = drawable.height;
    } else if (source instanceof HTMLImageElement) {
        drawable = source;
        width = source.naturalWidth || source.width;
        height = source.naturalHeight || source.height;
    } else if (source instanceof ImageBitmap) {
        drawable = source;
        width = source.width;
        height = source.height;
    } else {
        drawable = source;
        width = source.width;
        height = source.height;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(drawable, 0, 0);
    return canvas;
}

function featherBitmap(bitmap, featherSize, edges) {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');

    // Draw image
    ctx.drawImage(bitmap, 0, 0);

    // Prepare mask
    ctx.globalCompositeOperation = 'destination-out';

    // Gradients for fading edges
    // If 'edges.left' is true, we want to fade the left side.
    // 'destination-out' removes paint.
    // So we draw a gradient from Opaque (remove all) to Transparent (remove none).

    if (edges.left) {
        const g = ctx.createLinearGradient(0, 0, featherSize, 0);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, featherSize, canvas.height);
    }

    if (edges.right) {
        const g = ctx.createLinearGradient(canvas.width - featherSize, 0, canvas.width, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = g;
        ctx.fillRect(canvas.width - featherSize, 0, featherSize, canvas.height);
    }

    if (edges.top) {
        const g = ctx.createLinearGradient(0, 0, 0, featherSize);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, featherSize);
    }

    if (edges.bottom) {
        const g = ctx.createLinearGradient(0, canvas.height - featherSize, 0, canvas.height);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, canvas.height - featherSize, canvas.width, featherSize);
    }

    return canvas;
}
