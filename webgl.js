(function() {
const vsSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0, 1);
        v_texCoord = a_texCoord;
    }
`;

const fsSource = `
    precision mediump float;
    varying vec2 v_texCoord;

    uniform sampler2D u_imgFront;
    uniform sampler2D u_imgBack;
    uniform sampler2D u_mask;

    uniform int u_hasFront;
    uniform int u_hasBack;
    uniform int u_useMask;

    uniform float u_opacity;

    // Crop & Layout Uniforms
    uniform vec4 u_cropRect; // x, y, w, h (in full image coordinates)
    uniform vec2 u_fullDims; // w, h (of the full composition)
    uniform vec2 u_backDims; // w, h (of the back image actual size)

    // Adjustment Uniforms
    uniform float u_gamma;
    uniform float u_levelsBlack;
    uniform float u_levelsInvMid; // 1.0 / mid
    uniform float u_levelsWhite;
    uniform float u_invGamma; // 1.0 / gamma

    uniform float u_shadows;
    uniform float u_highlights;
    uniform float u_satMult;
    uniform float u_vibVal;

    uniform vec2 u_wbFactors; // x: red scale, y: blue scale
    uniform vec3 u_colorBal; // r, g, b offsets (-1 to 1 range approx)

    void main() {
        // v_texCoord is 0..1 representing the viewport (crop area).

        // Calculate coordinate in Full Canvas Space
        vec2 fullPos = vec2(
            u_cropRect.x + v_texCoord.x * u_cropRect.z,
            u_cropRect.y + v_texCoord.y * u_cropRect.w
        );

        // --- 1. Fetch Back Pixel ---
        vec4 colorBack = vec4(0.0);
        if (u_hasBack == 1) {
            // Back image is scaled to fit Full Canvas Height
            float scale = u_fullDims.y / u_backDims.y;
            float backW = u_backDims.x * scale;
            float backX = (u_fullDims.x - backW) * 0.5;

            // Map fullPos to Back Image UV
            // P_back_pixels = (fullPos.x - backX) / scale, fullPos.y / scale
            // UV_back = P_back_pixels / u_backDims
            //         = (fullPos.x - backX) / (scale * u_backDims.x) ... but scale*u_backDims.x = backW

            float backU = (fullPos.x - backX) / backW;
            float backV = fullPos.y / u_fullDims.y; // since backH = u_fullDims.y

            if (backU >= 0.0 && backU <= 1.0 && backV >= 0.0 && backV <= 1.0) {
                 colorBack = texture2D(u_imgBack, vec2(backU, backV));
            }
        }

        // --- 2. Fetch Front Pixel & Composite ---
        vec4 colorFront = vec4(0.0);
        vec4 composite = colorBack;

        if (u_hasFront == 1) {
             // Front Image is 1:1 with Full Canvas Space
             vec2 frontUV = fullPos / u_fullDims;
             if (frontUV.x >= 0.0 && frontUV.x <= 1.0 && frontUV.y >= 0.0 && frontUV.y <= 1.0) {
                 colorFront = texture2D(u_imgFront, frontUV);

                 // Apply Mask
                 if (u_useMask == 1) {
                     vec4 maskVal = texture2D(u_mask, frontUV);
                     // Mask white = transparent hole.
                     // Assuming mask draws white for holes.
                     colorFront.a *= (1.0 - maskVal.a);
                 }

                 colorFront.a *= u_opacity;

                 // Standard Alpha Blending: SrcOver
                 // out = src * srcA + dst * (1 - srcA)
                 // But we want to treat colorFront as the layer on top of colorBack

                 // If using premultiplied alpha in webgl (usually defaults to false for textures unless configured),
                 // we do:
                 vec3 outRGB = colorFront.rgb * colorFront.a + colorBack.rgb * (1.0 - colorFront.a);
                 // Assuming colorBack is opaque (or we just blend alphas too)
                 float outA = colorFront.a + colorBack.a * (1.0 - colorFront.a);

                 composite = vec4(outRGB, outA);
             }
        }

        // --- 3. Adjustments ---
        // Adjustments apply to the composited result (per main.js logic)

        vec3 rgb = composite.rgb;

        // Gamma / Levels (Optimized: combined or similar)
        // JS: n = (n - black) / range; pow(invMid); pow(invGamma);

        // Levels Input
        float range = u_levelsWhite - u_levelsBlack;
        if (range < 0.001) range = 0.001;

        rgb = (rgb - vec3(u_levelsBlack)) / range;
        rgb = clamp(rgb, 0.0, 1.0);

        // Levels Midtone & Gamma
        if (u_levelsInvMid != 1.0 || u_invGamma != 1.0) {
            float exp = u_levelsInvMid * u_invGamma;
            rgb = pow(rgb, vec3(exp));
        }

        // Shadows / Highlights
        // JS uses luminance to mask.
        float lum = dot(rgb, vec3(0.299, 0.587, 0.114));

        if (u_shadows != 0.0) {
            float sFactor = (1.0 - lum) * (1.0 - lum);
            float sMult = 1.0 + u_shadows * sFactor;
            rgb *= sMult;
        }
        if (u_highlights != 0.0) {
            float hFactor = lum * lum;
            float hMult = 1.0 + u_highlights * hFactor;
            rgb *= hMult;
        }

        // Saturation / Vibrance
        if (u_satMult != 1.0 || u_vibVal != 0.0) {
            float gray = dot(rgb, vec3(0.299, 0.587, 0.114));

            // Saturation
            if (u_satMult != 1.0) {
                rgb = vec3(gray) + (rgb - vec3(gray)) * u_satMult;
            }

            // Vibrance
            if (u_vibVal != 0.0) {
                float maxComp = max(rgb.r, max(rgb.g, rgb.b));
                float satVal = maxComp - gray; // Approximate saturation
                float vMult = u_vibVal * (1.0 - satVal);
                rgb = vec3(gray) + (rgb - vec3(gray)) * (1.0 + vMult);
            }
        }

        // White Balance
        // JS: r *= wbR; b *= wbB; then preserve lum
        if (u_wbFactors.x != 1.0 || u_wbFactors.y != 1.0) {
            float oldLum = dot(rgb, vec3(0.299, 0.587, 0.114));
            rgb.r *= u_wbFactors.x;
            rgb.b *= u_wbFactors.y;
            float newLum = dot(rgb, vec3(0.299, 0.587, 0.114));
            if (newLum > 0.001) {
                rgb *= (oldLum / newLum);
            }
        }

        // Color Balance
        if (u_colorBal.x != 0.0 || u_colorBal.y != 0.0 || u_colorBal.z != 0.0) {
             float oldLum = dot(rgb, vec3(0.299, 0.587, 0.114));
             rgb += u_colorBal;

             // Clamp before lum check to match JS behavior
             // JS: rClamped = max(0, r); ... newLum calculation ... if newLum > 0.01 scale else just clamp

             vec3 clamped = max(vec3(0.0), rgb);
             float newLum = dot(clamped, vec3(0.299, 0.587, 0.114));

             if (newLum > 0.001) {
                 rgb = clamped * (oldLum / newLum);
             } else {
                 rgb = max(vec3(0.0), rgb);
             }
        }

        gl_FragColor = vec4(rgb, composite.a);
    }
`;

let gl = null;
let program = null;
let positionBuffer = null;
let texCoordBuffer = null;

const textures = {
    front: null,
    back: null,
    mask: null
};

// State cache to avoid redundant uploads
let textureCache = {
    frontSrc: null,
    backSrc: null,
    maskSrc: null
};

function initWebGL(canvas) {
    gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, alpha: true }) ||
         canvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: true });

    if (!gl) {
        console.error("WebGL not supported");
        return null;
    }

    // Shaders
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    program = createProgram(gl, vs, fs);

    // Buffers (Full Quad)
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
    ]), gl.STATIC_DRAW);

    texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 1,
        1, 1,
        0, 0,
        0, 0,
        1, 1,
        1, 0,
    ]), gl.STATIC_DRAW);

    // Init Textures
    textures.front = createTexture(gl);
    textures.back = createTexture(gl);
    textures.mask = createTexture(gl);

    return gl;
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(p));
        return null;
    }
    return p;
}

function createTexture(gl) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Set parameters so we can render any size image
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
}

function uploadTexture(tex, source) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

// Same curve logic as adjustments.js to replicate values
function getCurvedValue(sliderVal) {
    const abs = Math.abs(sliderVal);
    const sign = Math.sign(sliderVal);
    let effective = 0;
    if (abs <= 80) effective = (abs / 80) * 50;
    else effective = 50 + ((abs - 80) / 20) * 50;
    return sign * effective;
}

function renderWebGL(state, maskSourceCanvas = null, skipAdjustments = false) {
    if (!gl || !program) return;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0); // Transparent background
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // --- Attributes ---
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texLoc = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // --- Texture Management ---
    const frontImg = state.isAFront ? state.imgA : state.imgB;
    const backImg = state.isAFront ? state.imgB : state.imgA;

    // Update Front
    if (frontImg && textureCache.frontSrc !== frontImg) {
        uploadTexture(textures.front, frontImg);
        textureCache.frontSrc = frontImg;
    }
    // Update Back
    if (backImg && textureCache.backSrc !== backImg) {
        uploadTexture(textures.back, backImg);
        textureCache.backSrc = backImg;
    }

    // Update Mask - Always update if provided (canvases change content)
    // Note: maskSourceCanvas is usually maskCanvas or previewMaskCanvas
    if (maskSourceCanvas) {
        uploadTexture(textures.mask, maskSourceCanvas);
    }

    // --- Uniforms ---
    function setInt(name, val) { gl.uniform1i(gl.getUniformLocation(program, name), val); }
    function setFloat(name, val) { gl.uniform1f(gl.getUniformLocation(program, name), val); }
    function setVec2(name, x, y) { gl.uniform2f(gl.getUniformLocation(program, name), x, y); }
    function setVec3(name, x, y, z) { gl.uniform3f(gl.getUniformLocation(program, name), x, y, z); }
    function setVec4(name, x, y, z, w) { gl.uniform4f(gl.getUniformLocation(program, name), x, y, z, w); }

    // Textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures.front);
    setInt("u_imgFront", 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures.back);
    setInt("u_imgBack", 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textures.mask);
    setInt("u_mask", 2);

    // Flags
    setInt("u_hasFront", frontImg ? 1 : 0);
    setInt("u_hasBack", (backImg && state.backVisible) ? 1 : 0);
    setInt("u_useMask", (state.maskVisible && maskSourceCanvas) ? 1 : 0);

    setFloat("u_opacity", state.opacity);

    // Dimensions & Crop
    // sX, sY, sW, sH
    const sX = state.isCropping ? 0 : (state.cropRect ? state.cropRect.x : 0);
    const sY = state.isCropping ? 0 : (state.cropRect ? state.cropRect.y : 0);
    const sW = state.isCropping ? state.fullDims.w : (state.cropRect ? state.cropRect.w : 0);
    const sH = state.isCropping ? state.fullDims.h : (state.cropRect ? state.cropRect.h : 0);

    setVec4("u_cropRect", sX, sY, sW, sH);
    setVec2("u_fullDims", state.fullDims.w, state.fullDims.h);

    if (backImg) setVec2("u_backDims", backImg.width, backImg.height);
    else setVec2("u_backDims", 1, 1); // safe dummy

    // Adjustments
    // If skipAdjustments is true (or cropping), we use identity values
    const useAdj = !skipAdjustments && !state.isCropping;
    const a = useAdj ? state.adjustments : {
        gamma: 1.0,
        levels: { black: 0, mid: 1.0, white: 255 },
        shadows: 0, highlights: 0,
        saturation: 0, vibrance: 0,
        wb: 0,
        colorBal: { r:0, g:0, b:0 }
    };

    // Gamma / Levels
    setFloat("u_gamma", a.gamma);
    setFloat("u_invGamma", 1.0 / (a.gamma || 0.01));
    setFloat("u_levelsBlack", a.levels.black / 255.0);
    setFloat("u_levelsWhite", a.levels.white / 255.0);
    setFloat("u_levelsInvMid", 1.0 / (a.levels.mid || 0.01));

    // Shadows / Highlights
    setFloat("u_shadows", a.shadows / 100.0);
    setFloat("u_highlights", a.highlights / 100.0);

    // Saturation / Vibrance
    setFloat("u_satMult", 1.0 + (a.saturation / 100.0));
    setFloat("u_vibVal", (a.vibrance / 100.0) * 2.0);

    // White Balance
    let wbR = 1.0;
    let wbB = 1.0;
    if (a.wb > 0) wbR = 1.0 + (a.wb / 200.0);
    else if (a.wb < 0) wbB = 1.0 + (Math.abs(a.wb) / 200.0);

    if (a.wb > 0) wbB = 1.0 - (a.wb / 400.0);
    else if (a.wb < 0) wbR = 1.0 - (Math.abs(a.wb) / 400.0);

    setVec2("u_wbFactors", wbR, wbB);

    // Color Balance
    // Calculate curved values
    const cr = getCurvedValue(a.colorBal.r) / 255.0;
    const cg = getCurvedValue(a.colorBal.g) / 255.0;
    const cb = getCurvedValue(a.colorBal.b) / 255.0;
    setVec3("u_colorBal", cr, cg, cb);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

window.WebGLEngine = {
    initWebGL,
    renderWebGL
};
})();
