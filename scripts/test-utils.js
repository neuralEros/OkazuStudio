(() => {
  const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

  const normalizeRgba = (rgba) => {
    if (Array.isArray(rgba)) {
      const [r, g, b, a = 255] = rgba;
      return [clampByte(r), clampByte(g), clampByte(b), clampByte(a)];
    }

    if (rgba && typeof rgba === "object") {
      const {
        r = 0,
        g = 0,
        b = 0,
        a = 255,
      } = rgba;
      return [clampByte(r), clampByte(g), clampByte(b), clampByte(a)];
    }

    return [0, 0, 0, 255];
  };

  const createCanvasContext = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas 2D context unavailable");
    }

    return { canvas, ctx };
  };

  const createImageData = (width, height, fillFn) => {
    const { ctx } = createCanvasContext(1, 1);
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        const [r, g, b, a] = normalizeRgba(fillFn(x, y));
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    return imageData;
  };

  const createSolidCanvas = (width, height, rgba) => {
    const { canvas, ctx } = createCanvasContext(width, height);
    const imageData = createImageData(width, height, () => rgba);
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  const createCheckerCanvas = (width, height, rgbaA, rgbaB, cellSize) => {
    const { canvas, ctx } = createCanvasContext(width, height);
    const imageData = createImageData(width, height, (x, y) => {
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      const useA = (cellX + cellY) % 2 === 0;
      return useA ? rgbaA : rgbaB;
    });
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  const createGradientCanvas = (width, height, direction = "horizontal") => {
    const { canvas, ctx } = createCanvasContext(width, height);
    const maxX = Math.max(1, width - 1);
    const maxY = Math.max(1, height - 1);
    const imageData = createImageData(width, height, (x, y) => {
      let t = 0;
      if (direction === "vertical") {
        t = y / maxY;
      } else if (direction === "diagonal") {
        t = (x / maxX + y / maxY) / 2;
      } else {
        t = x / maxX;
      }
      const value = clampByte(t * 255);
      return [value, value, value, 255];
    });

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  window.TestUtils = {
    createSolidCanvas,
    createCheckerCanvas,
    createGradientCanvas,
    createImageData,
  };
})();
