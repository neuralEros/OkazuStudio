const DEFAULT_BRUSH_SIZE = 0.1;
const DEFAULT_FEATHER = 1;
const DEFAULT_FEATHER_SIZE = 0.0012; // ~0.12% (5px at 4320p)
const DEFAULT_REPAIR_BRUSH_SIZE = DEFAULT_BRUSH_SIZE / 2;
const DEFAULT_PATCH_FEATHER = 10; // For Hardness mode

function createDefaultState() {
    return {
        imgA: null, imgB: null, assetIdA: null, assetIdB: null, nameA: '', nameB: '', formatA: '', formatB: '', sourceA: null, sourceB: null, thumbA: null, thumbB: null, isAFront: true,
        opacity: 0.8, brushSize: DEFAULT_BRUSH_SIZE, feather: DEFAULT_FEATHER, featherSize: DEFAULT_FEATHER_SIZE, featherMode: false, brushMode: 'erase', isDrawing: false,
        maskVisible: true, backVisible: true, adjustmentsVisible: true, history: [], historyIndex: -1, lastActionType: null,
        isSpacePressed: false, isPanning: false, lastPanX: 0, lastPanY: 0, view: { x: 0, y: 0, scale: 1 }, lastSpaceUp: 0,
        isCtrlPressed: false, isPreviewing: false, lastPreviewTime: 0, previewMaskCanvas: null, previewMaskScale: 1, previewLoopId: null,
        isPolylineStart: false, polylinePoints: [], polylineDirty: false, polylineSessionId: 0, currentPolylineAction: null, currentPointerX: null, currentPointerY: null,
        activeStroke: null, fastPreviewLastPoint: null, pointerDownTime: 0, pointerDownCoords: null,
        rotation: 0,
        brushSettings: {
            erase: { brushSize: DEFAULT_BRUSH_SIZE, feather: DEFAULT_FEATHER, featherSize: DEFAULT_FEATHER_SIZE },
            repair: { brushSize: DEFAULT_REPAIR_BRUSH_SIZE, feather: DEFAULT_FEATHER, featherSize: DEFAULT_FEATHER_SIZE },
            patch: { brushSize: DEFAULT_REPAIR_BRUSH_SIZE, feather: DEFAULT_PATCH_FEATHER, featherSize: DEFAULT_FEATHER_SIZE }
        },
        adjustments: {
            gamma: 1.0,
            levels: { black: 0, mid: 1.0, white: 255 },
            shadows: 0, highlights: 0,
            saturation: 0, vibrance: 0,
            wb: 0,
            colorBal: { r: 0, g: 0, b: 0 },
            colorTuning: {
                red: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                orange: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                yellow: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                green: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                aqua: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                blue: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                purple: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                magenta: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                lights: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                mids: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 },
                darks: { hue: 0, saturation: 0, vibrance: 0, luminance: 0, shadows: 0, highlights: 0 }
            }
        },
        activeColorBand: 'red',
        isAdjusting: false, previewCanvas: null, previewFrontLayer: null, previewThrottle: 0,
        workingA: null, workingB: null,
        previewWorkingA: null, previewWorkingB: null, previewScaleA: 1, previewScaleB: 1,
        previewWorkingVersionA: 0, previewWorkingVersionB: 0,
        previewComposite: null,
        adjustmentsVersion: 0, workingVersionA: 0, workingVersionB: 0,
        isCropping: false, cropRect: null, cropRectSnapshot: null, fullDims: { w: 0, h: 0 }, cropDrag: null,
        fastMaskCanvas: null, fastMaskCtx: null, fastMaskScale: 1, useFastPreview: false,
        settings: { brushPreviewResolution: 1080, adjustmentPreviewResolution: 1080 },
        pendingAdjustmentCommit: false, drawerCloseTimer: null,
        activeDrawerTab: null,
        mode: 'master',
        cropRotation: 0,
        hasShownSaveMergeWarning: false
    };
}

window.StateFactory = { createDefaultState };
