export const els = {
    fileA: document.getElementById('fileA'), fileB: document.getElementById('fileB'),
    btnA: document.getElementById('btnA'), btnB: document.getElementById('btnB'),
    mainCanvas: document.getElementById('mainCanvas'), viewport: document.getElementById('viewport'),
    canvasWrapper: document.getElementById('canvas-wrapper'), emptyState: document.getElementById('empty-state'),
    swapBtn: document.getElementById('swapBtn'), opacitySlider: document.getElementById('opacitySlider'),
    opacityVal: document.getElementById('opacityVal'), brushSize: document.getElementById('brushSize'),
    brushSizeVal: document.getElementById('brushSizeVal'), feather: document.getElementById('feather'),
    featherVal: document.getElementById('featherVal'), eraseMode: document.getElementById('eraseMode'),
    repairMode: document.getElementById('repairMode'), clearMask: document.getElementById('clearMask'),
    saveBtn: document.getElementById('saveBtn'), dragOverlay: document.getElementById('drag-overlay'),
    toggleMaskBtn: document.getElementById('toggleMaskBtn'), maskEyeOpen: document.getElementById('maskEyeOpen'), maskEyeClosed: document.getElementById('maskEyeClosed'),
    toggleBackBtn: document.getElementById('toggleBackBtn'), rearEyeOpen: document.getElementById('rearEyeOpen'), rearEyeClosed: document.getElementById('rearEyeClosed'),
    mergeBtn: document.getElementById('mergeBtn'), censorBtn: document.getElementById('censorBtn'),
    undoBtn: document.getElementById('undoBtn'), redoBtn: document.getElementById('redoBtn'),
    cropBtn: document.getElementById('cropBtn'), cursor: document.getElementById('brush-cursor'),
    resetAdjBtn: document.getElementById('resetAdjBtn'), resetLevelsBtn: document.getElementById('resetLevelsBtn'),
    resetColorBtn: document.getElementById('resetColorBtn'), resetSatBtn: document.getElementById('resetSatBtn'),
    adjGamma: document.getElementById('adj-gamma'), valGamma: document.getElementById('val-gamma'),
    cropOverlayDom: document.getElementById('crop-overlay-dom'), cropBox: document.getElementById('crop-box')
};

export const ctx = els.mainCanvas.getContext('2d', { willReadFrequently: true });
export const maskCanvas = document.createElement('canvas');
export const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
export const frontLayerCanvas = document.createElement('canvas');
export const frontLayerCtx = frontLayerCanvas.getContext('2d');

export function updateViewTransform(state, canDraw, getBrushPixelSize) {
    els.canvasWrapper.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`;
    updateCursorSize(state, canDraw, getBrushPixelSize);
}

export function updateCursorStyle(state, canDraw) {
    if (!canDraw()) return;
    if (state.isSpacePressed || state.isPanning) {
        els.viewport.classList.add('panning');
        els.cursor.style.display = 'none';
    } else {
        els.viewport.classList.remove('panning');
        if (!state.isCropping) els.cursor.style.display = 'block';
    }
}

export function updateCursorSize(state, canDraw, getBrushPixelSize) {
    if (!canDraw()) return;
    const visualSize = getBrushPixelSize() * state.view.scale;
    els.cursor.style.width = visualSize + 'px';
    els.cursor.style.height = visualSize + 'px';
}

export function updateCursorPos(state, e, canDraw) {
    if (!canDraw() || state.isPanning || state.isSpacePressed || state.isCropping) {
        els.cursor.style.display = 'none';
        return;
    }
    const rect = els.viewport.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
        els.cursor.style.display = 'block';
        els.cursor.style.left = e.clientX + 'px';
        els.cursor.style.top = e.clientY + 'px';
    } else {
        els.cursor.style.display = 'none';
    }
}
