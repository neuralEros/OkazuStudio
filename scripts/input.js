function createInputSystem({ state, els, maskCtx, maskCanvas, render, saveSnapshot, undo, redo, showHints, scheduleHeavyTask, acceptCrop, cancelCrop, setBrushMode }) {
    // Brush Size as Proportion of Height
    const BRUSH_MIN = 0.002; // 0.2%
    const BRUSH_MAX = 0.3;   // 30%
    const BRUSH_SLIDER_STEPS = 1000;

    // Feather Size as Proportion of Height (Fixed Mode)
    // Range: 0.02% to 1.0% (Target 5px at 4320p is ~0.12%)
    const FEATHER_SIZE_MIN = 0.0002;
    const FEATHER_SIZE_MAX = 0.01;

    // Hardness (Legacy Abstract Units 0-20)
    const HARDNESS_MIN = 0;
    const HARDNESS_MAX = 20;

    function toProportion(val, total) {
        if (!total || total === 0) return 0;
        return val / total;
    }

    function toPixels(prop, total) {
        return prop * total;
    }

    function canDraw() { return (state.imgA || state.imgB) && state.cropRect; }

    // --- Math Helpers for Rotation ---
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

    function getRotatedAABB(w, h, angleDeg) {
        const cx = w / 2;
        const cy = h / 2;
        // Corners: TL, TR, BR, BL
        const corners = [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: 0, y: h }
        ].map(p => rotatePoint(p, cx, cy, angleDeg));

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        corners.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
    }

    function forceCropHandleUpdate() {
        if (!els.cropBox) return;
        const invScale = 1 / state.view.scale;
        els.cropBox.style.setProperty('--inv-scale', invScale);

        // Redundant explicit update for maximum security per user request
        const handles = document.querySelectorAll('.crop-handle');
        handles.forEach(h => h.style.setProperty('--inv-scale', invScale));
    }

    function getActiveBrushKey() {
        return state.brushMode || 'erase';
    }

    function isEraseMode() {
        return state.brushMode === 'erase';
    }

    function getBrushPixelSize() {
        if (!state.fullDims.h) return 20; // Handle 0, null, undefined, NaN
        return toPixels(state.brushSize, state.fullDims.h);
    }

    function visualToTruthCoords(vx, vy, overrideW, overrideH) {
        const rot = state.rotation;
        const fw = (overrideW !== undefined) ? overrideW : (state.fullDims.w || 1);
        const fh = (overrideH !== undefined) ? overrideH : (state.fullDims.h || 1);

        let tx = vx;
        let ty = vy;

        if (rot === 90) {
            // Visual X is Truth Y. Visual Width is Truth Height.
            // Origin (0,0) visual is Top-Right of Truth (rotated).
            // tx = vy
            // ty = fh - vx
            tx = vy;
            ty = fh - vx;
        } else if (rot === 180) {
            tx = fw - vx;
            ty = fh - vy;
        } else if (rot === 270) {
            tx = fw - vy;
            ty = vx;
        }
        return { x: tx, y: ty };
    }

    function getCanvasCoordinates(e) {
        const rect = els.viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Visual Canvas Coordinates (Pixels)
        const canvasX = (mouseX - state.view.x) / state.view.scale;
        const canvasY = (mouseY - state.view.y) / state.view.scale;

        const fullH = state.fullDims.h || 1;

        if (!state.isCropping && state.cropRect) {
            // Local Truth Dimensions (Pixels)
            const localTruthW = state.cropRect.w * fullH;
            const localTruthH = state.cropRect.h * fullH;

            const localP = visualToTruthCoords(canvasX, canvasY, localTruthW, localTruthH);

            const absoluteTx = localP.x + (state.cropRect.x * fullH);
            const absoluteTy = localP.y + (state.cropRect.y * fullH);

            return { x: absoluteTx / fullH, y: absoluteTy / fullH };
        }

        // If Cropping (showing full image, just overlay on top):
        // `canvasX` corresponds to Visual Full Image.
        const absP = visualToTruthCoords(canvasX, canvasY);
        return { x: absP.x / fullH, y: absP.y / fullH };
    }

    function enforceCropView(maintainScale = false) {
        if (!state.cropRect || !state.fullDims.w) return;

        // Calculate Visual Size of Crop Box
        // 1. Get Visual Dims (Rotated) of the *Image*
        const isRotated = state.rotation % 180 !== 0;
        const fullH = state.fullDims.h || 1;

        // Base Crop Dimensions (Unrotated Truth)
        const cropW = state.cropRect.w * fullH;
        const cropH = state.cropRect.h * fullH;

        // Visual Dimensions of Crop Box (after 0,90,180,270 rotation)
        const visCropW = isRotated ? cropH : cropW;
        const visCropH = isRotated ? cropW : cropH;

        // If we are auto-fitting (not maintaining current manual zoom)
        if (!maintainScale) {
            const vpW = els.viewport.clientWidth;
            const vpH = els.viewport.clientHeight;
            // Target: Fit crop box in viewport with padding
            const padding = 80;
            const availW = vpW - padding;
            const availH = vpH - padding;

            const scaleW = availW / visCropW;
            const scaleH = availH / visCropH;
            state.view.scale = Math.min(scaleW, scaleH);
        }

        // Center Position
        // We want the CENTER of the Visual Crop Box to be at CENTER of Viewport.

        // 1. Where is the Top-Left of the Crop Box relative to the Canvas Origin (0,0)?
        // Use standard visual rect calculation logic
        const truthH = state.fullDims.h;
        const truthW = state.fullDims.w;
        const r = state.cropRect;
        const tRect = { x: r.x * truthH, y: r.y * truthH, w: r.w * truthH, h: r.h * truthH };

        let vx = tRect.x, vy = tRect.y, vw = tRect.w, vh = tRect.h;

        // Apply Base Rotation (0,90,180,270)
        if (state.rotation === 90) {
            vx = truthH - (tRect.y + tRect.h);
            vy = tRect.x;
            vw = tRect.h;
            vh = tRect.w;
        } else if (state.rotation === 180) {
            vx = truthW - (tRect.x + tRect.w);
            vy = truthH - (tRect.y + tRect.h);
        } else if (state.rotation === 270) {
            vx = tRect.y;
            vy = truthW - (tRect.x + tRect.w);
            vw = tRect.h;
            vh = tRect.w;
        }

        // Center of Visual Crop Box (relative to Unscaled Canvas Top-Left)
        let cropCx = vx + vw / 2;
        let cropCy = vy + vh / 2;

        // Apply Free Rotation (cropRotation) to the Center Point
        // This mirrors the logic in main.js render() to find the actual visual center
        if (state.cropRotation !== 0) {
            const visualFullW = isRotated ? fullH : state.fullDims.w;
            const visualFullH = isRotated ? state.fullDims.w : fullH;
            const canvasCx = visualFullW / 2;
            const canvasCy = visualFullH / 2;

            const rotatedCenter = rotatePoint({x: cropCx, y: cropCy}, canvasCx, canvasCy, state.cropRotation);
            cropCx = rotatedCenter.x;
            cropCy = rotatedCenter.y;
        }

        // Viewport Center
        const vpCx = els.viewport.clientWidth / 2;
        const vpCy = els.viewport.clientHeight / 2;

        state.view.x = vpCx - cropCx * state.view.scale;
        state.view.y = vpCy - cropCy * state.view.scale;

        updateViewTransform();
    }

    function resetView() {
        if (!state.imgA && !state.imgB) return;

        if (state.isCropping) {
            enforceCropView(false);
            return;
        }

        const vpW = els.viewport.clientWidth;
        const vpH = els.viewport.clientHeight;
        const cW = els.mainCanvas.width;
        const cH = els.mainCanvas.height;
        const scale = Math.min((vpW - 40) / cW, (vpH - 40) / cH);
        const x = (vpW - cW * scale) / 2;
        const y = (vpH - cH * scale) / 2;
        state.view = { x, y, scale };
        updateViewTransform();
    }

    function updateViewTransform() {
        els.canvasWrapper.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`;
        updateCursorSize();
        forceCropHandleUpdate();
    }

    function clampBrushSize(val) {
        return Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, val));
    }

    function sliderToBrushSize(sliderVal) {
        const normalized = sliderVal / BRUSH_SLIDER_STEPS;
        return BRUSH_MIN + normalized * (BRUSH_MAX - BRUSH_MIN);
    }

    function brushSizeToSliderValue(size) {
        const normalized = (clampBrushSize(size) - BRUSH_MIN) / (BRUSH_MAX - BRUSH_MIN);
        return Math.round(normalized * BRUSH_SLIDER_STEPS);
    }

    function formatBrushSize(val) {
        // Display as Percentage of Height (0.1 -> 10.0%)
        return (val * 100).toFixed(1);
    }

    function setBrushPercent(newSize) {
        const clamped = clampBrushSize(newSize);
        state.brushSize = clamped;
        const activeKey = getActiveBrushKey();
        if (state.brushSettings && state.brushSettings[activeKey]) {
            state.brushSettings[activeKey].brushSize = clamped;
        }
        els.brushSize.value = brushSizeToSliderValue(clamped);
        els.brushSizeVal.textContent = formatBrushSize(clamped);
        updateCursorSize();
    }

    function setBrushPercentFromSlider(sliderVal) {
        const numericVal = parseInt(sliderVal, 10) || 0;
        const size = sliderToBrushSize(numericVal);
        setBrushPercent(size);
    }

    function sliderToFeatherSize(sliderVal) {
        const normalized = sliderVal / BRUSH_SLIDER_STEPS;
        return FEATHER_SIZE_MIN + normalized * (FEATHER_SIZE_MAX - FEATHER_SIZE_MIN);
    }

    function featherSizeToSliderValue(size) {
        const clamped = Math.max(FEATHER_SIZE_MIN, Math.min(FEATHER_SIZE_MAX, size));
        const normalized = (clamped - FEATHER_SIZE_MIN) / (FEATHER_SIZE_MAX - FEATHER_SIZE_MIN);
        return Math.round(normalized * BRUSH_SLIDER_STEPS);
    }

    function setFeatherFromSlider(sliderVal) {
        const numericVal = parseInt(sliderVal, 10) || 0;
        if (state.featherMode) {
            // Map 0-1000 to FEATHER_SIZE_MIN - MAX
            const size = sliderToFeatherSize(numericVal);
            setFeather(size);
        } else {
            // Map 0-20 (Hardness Slider is 0-20 in HTML?)
            // Wait, standard feather logic was: Invert 0-20 slider.
            // HTML slider max is 20 for feather?
            // "els.feather.max = HARDNESS_MAX" (20).
            // "els.feather.max = FEATHER_PX_MAX" (20) in old code.
            // We need to change the HTML Slider MAX if we want higher precision for FeatherSize?
            // The user requested slider steps of 0.005h (0.5%).
            // Range 0.5% to 5.0%. (0.005 to 0.05).
            // 10 steps? That's low resolution.
            // I will use 0-1000 for Feather Size Mode to give smooth control.

            // Legacy Hardness Mode: Uses the 0-20 range from the HTML slider directly?
            // We'll update the slider attributes dynamically in updateFeatherUI.
            const inverted = HARDNESS_MAX - numericVal;
            setFeather(inverted);
        }
    }

    function setFeather(val) {
        if (state.featherMode) {
            const clamped = Math.max(FEATHER_SIZE_MIN, Math.min(FEATHER_SIZE_MAX, val));
            state.featherSize = clamped;
            const activeKey = getActiveBrushKey();
            if (state.brushSettings && state.brushSettings[activeKey]) {
                state.brushSettings[activeKey].featherSize = clamped;
            }
        } else {
            const clamped = Math.max(HARDNESS_MIN, Math.min(HARDNESS_MAX, val));
            state.feather = clamped;
            const activeKey = getActiveBrushKey();
            if (state.brushSettings && state.brushSettings[activeKey]) {
                state.brushSettings[activeKey].feather = clamped;
            }
        }
        updateFeatherUI();
    }

    function updateFeatherUI() {
        if (!els.feather) return;
        if (state.featherMode) {
            // Use high precision for Proportional Feather
            els.feather.min = 0;
            els.feather.max = BRUSH_SLIDER_STEPS;
            els.feather.step = 1;
            els.feather.value = featherSizeToSliderValue(state.featherSize);

            if (els.featherLabel) els.featherLabel.textContent = 'Feather';
            // Display as % of Height
            els.featherVal.textContent = `${(state.featherSize * 100).toFixed(2)}%`;
        } else {
            // Use 0-20 for Hardness
            els.feather.min = HARDNESS_MIN;
            els.feather.max = HARDNESS_MAX;
            els.feather.step = 1;

            // Invert value for UI: 0 (Hard) -> 20 (Right), 20 (Soft) -> 0 (Left)
            els.feather.value = HARDNESS_MAX - state.feather;
            if (els.featherLabel) els.featherLabel.textContent = 'Hardness';
            const hardness = Math.round(100 - (state.feather / HARDNESS_MAX * 100));
            els.featherVal.textContent = `${hardness}%`;
        }
        updateFeatherToggleUI();
    }

    function updateFeatherToggleUI() {
        if (!els.featherModeBtn) return;
        const img = els.featherModeBtn.querySelector('img');
        if (state.featherMode) {
            els.featherModeBtn.classList.add('active');
            if (img) {
                img.src = 'icons/hardfixed.svg';
                img.alt = 'Fixed Feather Mode';
            }
        } else {
            els.featherModeBtn.classList.remove('active');
            if (img) {
                img.src = 'icons/hardnormal.svg';
                img.alt = 'Hardness Mode';
            }
        }
    }

    function setFeatherMode(enabled, options = {}) {
        state.featherMode = Boolean(enabled);
        const activeKey = getActiveBrushKey();
        const activeSettings = state.brushSettings && state.brushSettings[activeKey];

        // Load settings from active brush if available
        if (state.featherMode) {
            if (activeSettings && typeof activeSettings.featherSize === 'number') {
                state.featherSize = activeSettings.featherSize;
            }
        } else if (activeSettings && typeof activeSettings.feather === 'number') {
            state.feather = activeSettings.feather;
        }

        // Apply overrides if provided
        if (state.featherMode && typeof options.value === 'number') {
            const clamped = Math.max(FEATHER_SIZE_MIN, Math.min(FEATHER_SIZE_MAX, options.value));
            state.featherSize = clamped;
            if (options.applyToAll && state.brushSettings) {
                Object.values(state.brushSettings).forEach((settings) => {
                    settings.featherSize = clamped;
                });
            } else {
                if (state.brushSettings && state.brushSettings[activeKey]) {
                    state.brushSettings[activeKey].featherSize = clamped;
                }
            }
        }
        updateFeatherUI();
    }

    function updateCursorSize() {
        if (!canDraw()) return;
        const visualSize = getBrushPixelSize() * state.view.scale;
        els.cursor.style.width = visualSize + 'px';
        els.cursor.style.height = visualSize + 'px';
    }

    function updateCursorPos(e) {
        if (!canDraw() || state.isPanning || state.isSpacePressed || state.isCropping || state.isZooming) {
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

    function updateCursorStyle() {
        if (!canDraw()) return;
        if (state.isSpacePressed || state.isPanning) {
            els.viewport.classList.add('panning');
            els.cursor.style.display = 'none';
        } else {
            els.viewport.classList.remove('panning');
            if (!state.isCropping) els.cursor.style.display = 'block';
        }
    }

    function drawBrushStamp(propX, propY, context = maskCtx) {
        // propX, propY are Proportions.
        // Convert to Pixels for drawing
        const fullH = state.fullDims.h || 1;
        const x = propX * fullH;
        const y = propY * fullH;

        // Feather Mode:
        // if featherMode is true, featherSize is proportion. Need pixels.
        // if featherMode is false, feather is hardness (0-20). Keep as is.
        let featherVal = state.featherMode ? (state.featherSize * fullH) : state.feather;

        // Ensure at least 1px feather in fixed mode
        if (state.featherMode) {
            featherVal = Math.max(1.0, featherVal);
        }

        BrushKernel.paintStampAt(
            context,
            x,
            y,
            getBrushPixelSize(), // Returns pixels
            featherVal,
            state.featherMode,
            isEraseMode()
        );
    }


    function commitPolyline(shouldFill = false) {
        if (state.polylinePoints.length === 0) return;

        const pts = state.polylinePoints; // Props
        const fullH = state.fullDims.h || 1;

        // Fill first if requested
        if (shouldFill) {
             maskCtx.save();
             maskCtx.beginPath();
             maskCtx.moveTo(pts[0].x * fullH, pts[0].y * fullH);
             for (let i = 1; i < pts.length; i++) {
                 maskCtx.lineTo(pts[i].x * fullH, pts[i].y * fullH);
             }
             maskCtx.closePath();

            if (isEraseMode()) {
                 maskCtx.globalCompositeOperation = 'source-over';
                 maskCtx.fillStyle = 'white';
             } else {
                 maskCtx.globalCompositeOperation = 'destination-out';
                 maskCtx.fillStyle = 'black';
             }
             maskCtx.fill();
             maskCtx.restore();
        }

        // Draw Strokes
         // Node-based spacing logic:
         // 1. Draw Start
         drawBrushStamp(pts[0].x, pts[0].y, maskCtx);

         // 2. Draw Segments
         // Note: PaintStrokeSegment expects PIXELS for points.
         // pts are PROPS.
         const featherVal = state.featherMode ? (state.featherSize * fullH) : state.feather;
         const brushPx = getBrushPixelSize();

         for (let i = 0; i < pts.length - 1; i++) {
             const p1 = { x: pts[i].x * fullH, y: pts[i].y * fullH };
             const p2 = { x: pts[i+1].x * fullH, y: pts[i+1].y * fullH };

             // Walk from p1 to p2, resetting spacing at p1
             BrushKernel.paintStrokeSegment(maskCtx, p1, p2, brushPx, featherVal, state.featherMode, isEraseMode());
             // Draw Node p2
             drawBrushStamp(pts[i+1].x, pts[i+1].y, maskCtx);
         }

         if (window.dispatchAction) {
             dispatchAction({
                 type: 'POLYLINE',
                 payload: {
                     points: JSON.parse(JSON.stringify(state.polylinePoints)), // Props
                     shouldFill,
                     brushSize: state.brushSize, // Prop
                     feather: state.featherMode ? state.featherSize : state.feather, // Prop or Value
                     featherMode: state.featherMode,
                     mode: state.brushMode
                 }
             });
        }

         const actionType = state.currentPolylineAction || 'mask';
         // saveSnapshot(actionType);
         state.polylineDirty = false;
    }

    function ensureFastMaskCanvas() {
        if (!state.fastMaskCanvas) {
            state.fastMaskCanvas = document.createElement('canvas');
            state.fastMaskCtx = state.fastMaskCanvas.getContext('2d', { willReadFrequently: true });
        }
        const maxDim = state.settings.brushPreviewResolution || 100000;
        const scale = Math.min(1, maxDim / Math.max(state.fullDims.w || 1, state.fullDims.h || 1));
        const w = Math.max(1, Math.round(state.fullDims.w * scale));
        const h = Math.max(1, Math.round(state.fullDims.h * scale));

        if (state.fastMaskCanvas.width !== w || state.fastMaskCanvas.height !== h) {
            state.fastMaskCanvas.width = w;
            state.fastMaskCanvas.height = h;
        }
        state.fastMaskScale = scale;
        state.fastMaskCtx.clearRect(0, 0, w, h);
        state.fastMaskCtx.globalCompositeOperation = 'source-over';
        state.fastMaskCtx.drawImage(maskCanvas, 0, 0, w, h);
    }

    function beginFastStrokeSession() {
        ensureFastMaskCanvas();
        state.previewMaskCanvas = state.fastMaskCanvas;
        state.previewMaskScale = state.fastMaskScale;
        state.isPreviewing = true;
        state.useFastPreview = true;
        state.activeStroke = {
            points: [],
            brushSize: getBrushPixelSize(),
            feather: state.featherMode ? state.featherPx : state.feather,
            featherMode: state.featherMode,
            isErasing: isEraseMode()
        };
        state.fastPreviewLastStamp = null;
    }

    function beginFastStrokeSession() {
        ensureFastMaskCanvas();
        state.previewMaskCanvas = state.fastMaskCanvas;
        state.previewMaskScale = state.fastMaskScale;
        state.isPreviewing = true;
        state.useFastPreview = true;

        // Active Stroke stores PROPS
        state.activeStroke = {
            points: [],
            brushSize: state.brushSize, // Prop
            feather: state.featherMode ? state.featherSize : state.feather, // Prop or 0-20
            featherMode: state.featherMode,
            isErasing: isEraseMode(),
            tool: state.brushMode
        };
        state.fastPreviewLastStamp = null;
    }

    function addFastStrokePoint(coords) {
        // coords are PROPS
        if (!state.activeStroke) return;
        const stroke = state.activeStroke;
        stroke.points.push({ x: coords.x, y: coords.y });

        // FastMaskCtx needs PIXELS (Scaled)
        // Scaled Point = (Prop * FullH) * FastScale
        const fullH = state.fullDims.h || 1;
        const scaledPoint = {
            x: coords.x * fullH * state.fastMaskScale,
            y: coords.y * fullH * state.fastMaskScale
        };

        // Brush Size (Px) = Prop * FullH
        const brushPx = stroke.brushSize * fullH;
        const brushPxScaled = brushPx * state.fastMaskScale;

        let effectiveFeather = stroke.feather; // 0-20 or Prop
        if (stroke.featherMode) {
             // Prop * FullH * Scale
             effectiveFeather = stroke.feather * fullH * state.fastMaskScale;
             // Ensure at least 1px (scaled)
             effectiveFeather = Math.max(1.0, effectiveFeather);
        }

        const newStamp = BrushKernel.paintStrokeSegment(state.fastMaskCtx, state.fastPreviewLastStamp, scaledPoint, brushPxScaled, effectiveFeather, stroke.featherMode, stroke.isErasing);
        state.fastPreviewLastStamp = newStamp;
    }

    function replayStrokeToFullMask() {
        const stroke = state.activeStroke;
        if (!stroke || stroke.points.length === 0) return;

        const fullH = state.fullDims.h || 1;
        const brushPx = stroke.brushSize * fullH;
        const featherVal = stroke.featherMode ? (stroke.feather * fullH) : stroke.feather;

        // Convert points Prop->Px
        const pointsPx = stroke.points.map(p => ({ x: p.x * fullH, y: p.y * fullH }));

        BrushKernel.drawStroke(maskCtx, pointsPx, {
            size: brushPx,
            feather: featherVal,
            featherMode: stroke.featherMode,
            isErasing: stroke.isErasing
        });
    }

    function handlePointerDown(e) {
        if (!canDraw()) return;
        const coords = getCanvasCoordinates(e);
        state.currentPointerX = coords.x;
        state.currentPointerY = coords.y;
        state.pointerDownTime = Date.now();
        state.pointerDownCoords = { x: coords.x, y: coords.y };

        if (state.isSpacePressed || e.button === 1) {
            state.isPanning = true;
            state.lastPanX = e.clientX;
            state.lastPanY = e.clientY;
            updateCursorStyle();
            return;
        }

        // Crop Mode Interaction (Priority over Standard Zoom)
        if (state.isCropping) {
            if (e.button === 0) {
                // Determine drag type based on modifiers
                // Matches logic in attachCropHandlers getDragType
                let type = 'pan';
                if (e.ctrlKey || e.metaKey) type = 'rotate';
                else if (e.shiftKey) type = 'scale';

                const getVisualStartRect = () => {
                    const fullH = state.fullDims.h;
                    const fullW = state.fullDims.w;
                    const truthRectPx = {
                        x: state.cropRect.x * fullH,
                        y: state.cropRect.y * fullH,
                        w: state.cropRect.w * fullH,
                        h: state.cropRect.h * fullH
                    };
                    const baseVisual = truthToVisualRect(truthRectPx, state.rotation, fullW, fullH);
                    const isRotated = state.rotation % 180 !== 0;
                    const visualFullW = isRotated ? fullH : fullW;
                    const visualFullH = isRotated ? fullW : fullH;
                    const cx = baseVisual.x + baseVisual.w / 2;
                    const cy = baseVisual.y + baseVisual.h / 2;
                    const canvasCx = visualFullW / 2;
                    const canvasCy = visualFullH / 2;
                    const newCenter = rotatePoint({x: cx, y: cy}, canvasCx, canvasCy, state.cropRotation);
                    return {
                        x: newCenter.x - baseVisual.w / 2,
                        y: newCenter.y - baseVisual.h / 2,
                        w: baseVisual.w,
                        h: baseVisual.h
                    };
                };

                state.cropDrag = {
                    type: type,
                    startX: e.clientX,
                    startY: e.clientY,
                    startView: { ...state.view },
                    startCropRect: { ...state.cropRect },
                    startRotation: state.cropRotation,
                    startVisualRect: getVisualStartRect()
                };
            }
            return;
        }

        if (e.shiftKey && e.button === 0) {
            state.isZooming = true;
            state.lastZoomY = e.clientY;
            const rect = els.viewport.getBoundingClientRect();
            state.zoomStartClientX = e.clientX - rect.left;
            state.zoomStartClientY = e.clientY - rect.top;
            updateCursorStyle();
            return;
        }

        if (e.button === 0) {
            if (state.isCtrlPressed) {
                if (state.isPolylineStart) {
                    state.lastDrawX = coords.x;
                    state.lastDrawY = coords.y;
                    state.isPolylineStart = false;
                    state.polylinePoints = [{ x: coords.x, y: coords.y }];
                    Logger.interaction("Polyline", "Started", `(${coords.x.toFixed(4)}, ${coords.y.toFixed(4)})`);
                } else {
                    // Deferred Drawing Mode: Store points, do not draw to maskCtx yet
                    // Check close loop
                    const threshold = state.brushSize; // Proportions
                    const startPt = state.polylinePoints[0];
                    const dist = Math.hypot(coords.x - startPt.x, coords.y - startPt.y);

                    if (state.polylinePoints.length > 1 && dist < threshold) {
                         Logger.interaction("Polyline", "Loop Closed");
                         // Loop closed
                         // 1. Add current point (the one near start)
                         state.polylinePoints.push({ x: coords.x, y: coords.y });
                         // 2. Add start point to close the loop perfectly
                         state.polylinePoints.push({ x: startPt.x, y: startPt.y });

                         // 3. Commit with fill
                         commitPolyline(true);

                         // 4. Reset for next polyline
                         state.isPolylineStart = true;
                         state.polylinePoints = [];
                         state.lastDrawX = null;
                    } else {
                        state.lastDrawX = coords.x;
                        state.lastDrawY = coords.y;
                        state.polylinePoints.push({ x: coords.x, y: coords.y });
                        Logger.interaction("Polyline", "Point Added", `(${coords.x.toFixed(4)}, ${coords.y.toFixed(4)})`);
                    }
                    state.polylineDirty = true;
                }
                // Trigger preview update immediately
                updateLinePreview();
                render();
                return;
            }

            state.isDrawing = true;
            state.lastDrawX = null;
            state.lastDrawY = null;
            beginFastStrokeSession();
            addFastStrokePoint(coords);

            // Fixed Hardness Hold-to-Density Timer
            if (state.featherMode) {
                if (state.longPressTimer) clearTimeout(state.longPressTimer);
                state.longPressTimer = setTimeout(() => {
                    if (state.isDrawing && state.pointerDownCoords) {
                        drawBrushStamp(state.pointerDownCoords.x, state.pointerDownCoords.y, maskCtx);
                        render();
                    }
                }, 250);
            }

            render();
        }
    }

    function handlePointerMove(e) {
        if (!canDraw()) return;
        const coords = getCanvasCoordinates(e);
        state.currentPointerX = coords.x;
        state.currentPointerY = coords.y;
        updateCursorPos(e);

        if (state.isPanning) {
            const dx = e.clientX - state.lastPanX;
            const dy = e.clientY - state.lastPanY;
            state.view.x += dx;
            state.view.y += dy;

            const vpW = els.viewport.clientWidth;
            const vpH = els.viewport.clientHeight;
            const cW = els.mainCanvas.width * state.view.scale;
            const cH = els.mainCanvas.height * state.view.scale;
            const overlap = 100;
            let newX = state.view.x;
            let newY = state.view.y;
            if (newX > vpW - overlap) newX = vpW - overlap;
            if (newX < overlap - cW) newX = overlap - cW;
            if (newY > vpH - overlap) newY = vpH - overlap;
            if (newY < overlap - cH) newY = overlap - cH;

            state.view.x = newX;
            state.view.y = newY;
            state.lastPanX = e.clientX;
            state.lastPanY = e.clientY;
            updateViewTransform();
        } else if (state.isZooming) {
            const dy = state.lastZoomY - e.clientY; // Drag UP (decreasing Y) -> Positive Delta -> Zoom In
            state.lastZoomY = e.clientY;

            const zoomSpeed = 0.005; // Granular control
            const factor = Math.exp(dy * zoomSpeed);

            const newScale = Math.max(0.1, Math.min(50, state.view.scale * factor));

            // Zoom around drag start point
            const mouseX = state.zoomStartClientX;
            const mouseY = state.zoomStartClientY;

            // Maintain the point under mouseX, mouseY fixed relative to the viewport
            // state.view.x = mouseX - (mouseX - state.view.x) * (newScale / state.view.scale)

            const scaleRatio = newScale / state.view.scale;
            state.view.x = mouseX - (mouseX - state.view.x) * scaleRatio;
            state.view.y = mouseY - (mouseY - state.view.y) * scaleRatio;
            state.view.scale = newScale;

            updateViewTransform();
            // Optional: updateCursorPos(e) if we want to redraw cursor, but it's hidden during zoom
        } else if (state.isCropping && state.cropDrag) {
            // Stability Rewrite: Use Start-State Reference to avoid feedback loops

            const startView = state.cropDrag.startView;
            const startRect = state.cropDrag.startCropRect;
            const startRotation = state.cropDrag.startRotation;
            const fullH = state.fullDims.h || 1;
            const fullW = state.fullDims.w || 1;
            const isRotated = state.rotation % 180 !== 0;
            const visualFullW = isRotated ? fullH : fullW;
            const visualFullH = isRotated ? fullW : fullH;
            const canvasCx = visualFullW / 2;
            const canvasCy = visualFullH / 2;

            // Calculate Deltas in Screen Space
            const dxScreen = e.clientX - state.cropDrag.startX;
            const dyScreen = e.clientY - state.cropDrag.startY;

            if (state.cropDrag.type === 'rotate') {
                state.cropRotation = startRotation + (dxScreen * 0.5);
                enforceCropView(true);
                render();
            }
            else if (state.cropDrag.type === 'pan') {
                // Pan Image = Move CropRect in Opposite Direction
                // Delta in Canvas Pixels (Start Scale)
                const dxCanvas = -dxScreen / startView.scale;
                const dyCanvas = -dyScreen / startView.scale;

                // Rotate Delta into Base Visual Space (inverse of Start Rotation)
                const rotRad = startRotation * Math.PI / 180;
                const cos = Math.cos(-rotRad);
                const sin = Math.sin(-rotRad);
                const baseDx = dxCanvas * cos - dyCanvas * sin;
                const baseDy = dxCanvas * sin + dyCanvas * cos;

                // Start Truth -> Start Base Visual
                const startTruthPx = { x: startRect.x * fullH, y: startRect.y * fullH, w: startRect.w * fullH, h: startRect.h * fullH };
                const baseVisual = truthToVisualRect(startTruthPx, state.rotation, fullW, fullH);

                // Apply Delta
                baseVisual.x += baseDx;
                baseVisual.y += baseDy;

                // Back to Truth
                const newTruth = visualToTruthRect(baseVisual, state.rotation, fullW, fullH);
                state.cropRect = { x: newTruth.x / fullH, y: newTruth.y / fullH, w: newTruth.w / fullH, h: newTruth.h / fullH };

                enforceCropView(true);
                render();
            }
            else if (state.cropDrag.type === 'scale') {
                // Zoom Content (Shift+Drag)
                // Factor driven by Vertical Delta
                // Drag UP = Zoom In (Crop Shrinks).
                const zoomSpeed = 0.005;
                const factor = Math.exp(-dyScreen * zoomSpeed);

                // console.log("Scaling: Factor", factor, "StartW", startRect.w, "NewW", startRect.w * factor);

                state.cropRect.w = startRect.w * factor;
                state.cropRect.h = startRect.h * factor;

                // Maintain Center
                // Start Center in Truth
                const startCx = startRect.x + startRect.w / 2;
                const startCy = startRect.y + startRect.h / 2;

                // Apply new W/H centered at Start Center
                state.cropRect.x = startCx - state.cropRect.w / 2;
                state.cropRect.y = startCy - state.cropRect.h / 2;

                // Inverse View Scale to keep visual size constant
                // New Crop Size (Truth) = Start * Factor
                // We want Visual Size = Constant.
                // Visual = Truth * ViewScale.
                // Constant = (Start * Factor) * NewViewScale
                // Constant = Start * StartViewScale
                // NewViewScale = (Start * StartViewScale) / (Start * Factor) = StartViewScale / Factor
                state.view.scale = startView.scale / factor;

                enforceCropView(true);
                render();
            }
            else if (state.cropDrag.type === 'handle') {
                // Handle Drag (Resize)
                // Use Start Visual Rect (from start of drag)
                // Apply Delta in Canvas Pixels (using Start Scale)

                const dxCanvas = dxScreen / startView.scale;
                const dyCanvas = dyScreen / startView.scale;

                // Apply to Start Visual Rect
                let visualRect = { ...state.cropDrag.startVisualRect };
                const h = state.cropDrag.h;

                if (h.includes('e')) visualRect.w = Math.max(10, visualRect.w + dxCanvas);
                if (h.includes('s')) visualRect.h = Math.max(10, visualRect.h + dyCanvas);
                if (h.includes('w')) {
                    const newW = Math.max(10, visualRect.w - dxCanvas);
                    visualRect.x += (visualRect.w - newW);
                    visualRect.w = newW;
                }
                if (h.includes('n')) {
                    const newH = Math.max(10, visualRect.h - dyCanvas);
                    visualRect.y += (visualRect.h - newH);
                    visualRect.h = newH;
                }

                // Map Back to Truth
                const vCx = visualRect.x + visualRect.w / 2;
                const vCy = visualRect.y + visualRect.h / 2;
                const baseC = rotatePoint({x: vCx, y: vCy}, canvasCx, canvasCy, -startRotation); // Use Start Rotation

                const newBaseVisual = {
                    x: baseC.x - visualRect.w / 2,
                    y: baseC.y - visualRect.h / 2,
                    w: visualRect.w,
                    h: visualRect.h
                };

                const newTruth = visualToTruthRect(newBaseVisual, state.rotation, fullW, fullH);
                state.cropRect = { x: newTruth.x / fullH, y: newTruth.y / fullH, w: newTruth.w / fullH, h: newTruth.h / fullH };

                // Auto-Fit (Recalculate Scale)
                enforceCropView(false);
                render();
                forceCropHandleUpdate();
            }
        } else if (state.isDrawing) {
            addFastStrokePoint(coords);

            // Check for movement to cancel long press
            if (state.longPressTimer && state.pointerDownCoords) {
                const fullH = state.fullDims.h || 1;
                const pdX = state.pointerDownCoords.x * fullH;
                const pdY = state.pointerDownCoords.y * fullH;
                const curX = coords.x * fullH;
                const curY = coords.y * fullH;
                const dist = Math.hypot(curX - pdX, curY - pdY);

                if (dist > 2) {
                    clearTimeout(state.longPressTimer);
                    state.longPressTimer = null;
                }
            }

            render();
        }
    }

    function handlePointerUp(e) {
        if (state.longPressTimer) {
            clearTimeout(state.longPressTimer);
            state.longPressTimer = null;
        }

        if (state.isZooming) {
            state.isZooming = false;
            updateCursorStyle();
            return;
        }

        if (state.isDrawing) {
            replayStrokeToFullMask();

            if (state.activeStroke && window.dispatchAction) {
                dispatchAction({ type: 'STROKE', payload: { ...state.activeStroke } });
            }

            state.previewMaskCanvas = null;
            state.previewMaskScale = 1;
            state.isPreviewing = false;
            state.useFastPreview = false;
            state.fastPreviewLastPoint = null;
            state.activeStroke = null;
            render();
            // saveSnapshot('draw');
        } else {
             // Explicit cleanup for any lingering preview state if isDrawing was false but preview active
             // Fix: Do not clear preview if in the middle of a polyline session (Ctrl pressed)
             if (state.isPreviewing && !state.isCtrlPressed) {
                  state.previewMaskCanvas = null;
                  state.isPreviewing = false;
                  state.useFastPreview = false;
                  render();
             }
        }
        if (state.isCropping && state.cropDrag) {
            state.cropDrag = null;
            // saveSnapshot('crop');
        }
        state.isPanning = false;
        state.isDrawing = false;
        updateCursorStyle();
    }

    function startPreviewLoop() {
        if (state.previewLoopId) return;
        const loop = () => {
            if (!state.isCtrlPressed) return;
            const now = Date.now();
            if (now - state.lastPreviewTime > 50) {
                updateLinePreview();
                state.lastPreviewTime = now;
            }
            state.previewLoopId = requestAnimationFrame(loop);
        };
        state.previewLoopId = requestAnimationFrame(loop);
    }

    function stopPreviewLoop() {
        if (state.previewLoopId) {
            cancelAnimationFrame(state.previewLoopId);
            state.previewLoopId = null;
        }
    }

    function updateLinePreview() {
        // Must accept update even if lastDrawX is null if we have points
        if (state.polylinePoints.length === 0 && (state.lastDrawX === null || state.currentPointerX === null)) return;

        const maxDim = 1920;
        const w = maskCanvas.width; const h = maskCanvas.height;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        if (!state.previewMaskCanvas) state.previewMaskCanvas = document.createElement('canvas');
        const pw = Math.floor(w * scale); const ph = Math.floor(h * scale);
        if (state.previewMaskCanvas.width !== pw || state.previewMaskCanvas.height !== ph) {
            state.previewMaskCanvas.width = pw; state.previewMaskCanvas.height = ph;
        }
        const pCtx = state.previewMaskCanvas.getContext('2d');
        pCtx.clearRect(0, 0, pw, ph);
        // Draw base mask
        pCtx.drawImage(maskCanvas, 0, 0, pw, ph);

        pCtx.save();
        pCtx.scale(scale, scale);

        const fullH = state.fullDims.h || 1;
        const brushPx = getBrushPixelSize();
        const featherVal = state.featherMode ? (state.featherSize * fullH) : state.feather;

        // Note: pCtx is scaled by `scale`.
        // We are drawing into a 1:1 context space (which is scaled up by context transform?)
        // Wait, pCtx.scale(scale, scale) means drawing coordinates should be in full-resolution pixels.
        // And the context scales them down. Correct.
        // So we need to feed Pixels (Prop * FullH) to the functions.

        // Draw already committed points in this sequence
        if (state.polylinePoints.length > 0) {
             const pts = state.polylinePoints;
             // Draw Start
             drawBrushStamp(pts[0].x, pts[0].y, pCtx);

             // Draw Segments
             for (let i = 0; i < pts.length - 1; i++) {
                 const p1 = { x: pts[i].x * fullH, y: pts[i].y * fullH };
                 const p2 = { x: pts[i+1].x * fullH, y: pts[i+1].y * fullH };
                 BrushKernel.paintStrokeSegment(pCtx, p1, p2, brushPx, featherVal, state.featherMode, isEraseMode());
                 drawBrushStamp(pts[i+1].x, pts[i+1].y, pCtx);
             }
        }

        // Draw rubber band line from last point to current cursor
        if (state.lastDrawX !== null && state.currentPointerX !== null) {
             const start = {x: state.lastDrawX * fullH, y: state.lastDrawY * fullH};
             const end = {x: state.currentPointerX * fullH, y: state.currentPointerY * fullH};
             BrushKernel.paintStrokeSegment(pCtx, start, end, brushPx, featherVal, state.featherMode, isEraseMode());
             // Draw cursor node
             drawBrushStamp(state.currentPointerX, state.currentPointerY, pCtx);
        } else if (state.isPolylineStart && state.lastDrawX !== null) {
             // Just start dot
             drawBrushStamp(state.lastDrawX, state.lastDrawY, pCtx);
        }

        pCtx.restore();
        state.previewMaskScale = scale;
        state.isPreviewing = true;
        state.useFastPreview = true;
        render();
    }

    function handleWheel(e) {
        if (!canDraw()) return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            const delta = -Math.sign(e.deltaY) * 0.2;
            setBrushPercent(state.brushPercent + delta);
            return;
        }

        const zoomSpeed = 0.1;
        const delta = -Math.sign(e.deltaY) * zoomSpeed;
        const newScale = Math.max(0.01, Math.min(50, state.view.scale * (1 + delta)));

        if (state.isCropping) {
            // Crop Mode: Zoom = Scale Viewport around Center (Crop Box stays centered)
            // Just update scale and re-enforce center
            state.view.scale = newScale;
            enforceCropView(true);
        } else {
            // Standard Zoom (Mouse Position Anchored)
            const rect = els.viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const canvasX = (mouseX - state.view.x) / state.view.scale;
            const canvasY = (mouseY - state.view.y) / state.view.scale;

            state.view.scale = newScale;
            state.view.x = mouseX - canvasX * newScale;
            state.view.y = mouseY - canvasY * newScale;
            updateViewTransform();
        }
        updateCursorPos(e);
    }

    function truthToVisualRect(r, rot, fullW, fullH) {
        if (rot === 0) return { ...r };
        let vx = r.x, vy = r.y, vw = r.w, vh = r.h;
        if (rot === 90) {
            vx = fullH - (r.y + r.h);
            vy = r.x;
            vw = r.h;
            vh = r.w;
        } else if (rot === 180) {
            vx = fullW - (r.x + r.w);
            vy = fullH - (r.y + r.h);
        } else if (rot === 270) {
            vx = r.y;
            vy = fullW - (r.x + r.w);
            vw = r.h;
            vh = r.w;
        }
        return { x: vx, y: vy, w: vw, h: vh };
    }

    function visualToTruthRect(v, rot, fullW, fullH) {
        if (rot === 0) return { ...v };
        let tx = v.x, ty = v.y, tw = v.w, th = v.h;

        // Inverse logic
        if (rot === 90) {
            // v.x = H - (t.y + t.h)  =>  t.y + t.h = H - v.x  => t.y = H - v.x - t.h
            // v.y = t.x              =>  t.x = v.y
            // v.w = t.h              =>  t.h = v.w
            // v.h = t.w              =>  t.w = v.h
            tw = v.h;
            th = v.w;
            tx = v.y;
            ty = fullH - v.x - th;
        } else if (rot === 180) {
            // v.x = W - (t.x + t.w) => t.x = W - v.x - t.w
            // v.y = H - (t.y + t.h) => t.y = H - v.y - t.h
            tx = fullW - v.x - tw;
            ty = fullH - v.y - th;
        } else if (rot === 270) {
            // v.x = t.y             => t.y = v.x
            // v.y = W - (t.x + t.w) => t.x = W - v.y - t.w
            tw = v.h;
            th = v.w;
            ty = v.x;
            tx = fullW - v.y - tw;
        }
        return { x: tx, y: ty, w: tw, h: th };
    }

    function attachCropHandlers() {
        const handles = document.querySelectorAll('.crop-handle');

        const getVisualStartRect = () => {
            const fullH = state.fullDims.h;
            const fullW = state.fullDims.w;
            const truthRectPx = {
                x: state.cropRect.x * fullH,
                y: state.cropRect.y * fullH,
                w: state.cropRect.w * fullH,
                h: state.cropRect.h * fullH
            };
            // 1. Get Base Visual Rect (Standard Rotation)
            const baseVisual = truthToVisualRect(truthRectPx, state.rotation, fullW, fullH);

            // 2. Apply Crop Rotation to Center
            const isRotated = state.rotation % 180 !== 0;
            const visualFullW = isRotated ? fullH : fullW;
            const visualFullH = isRotated ? fullW : fullH;
            const cx = baseVisual.x + baseVisual.w / 2;
            const cy = baseVisual.y + baseVisual.h / 2;
            const canvasCx = visualFullW / 2;
            const canvasCy = visualFullH / 2;

            const newCenter = rotatePoint({x: cx, y: cy}, canvasCx, canvasCy, state.cropRotation);

            return {
                x: newCenter.x - baseVisual.w / 2,
                y: newCenter.y - baseVisual.h / 2,
                w: baseVisual.w,
                h: baseVisual.h
            };
        };

        const initDrag = (e, type, extra = {}) => {
            e.stopPropagation();
            state.cropDrag = {
                type: type,
                startX: e.clientX,
                startY: e.clientY,
                startView: { ...state.view },
                startCropRect: { ...state.cropRect },
                startRotation: state.cropRotation,
                startVisualRect: getVisualStartRect(),
                ...extra
            };
        };

        const getDragType = (e) => {
            if (e.ctrlKey || e.metaKey) return 'rotate';
            if (e.shiftKey) return 'scale';
            return 'pan';
        };

        handles.forEach(h => {
            h.addEventListener('pointerdown', (e) => {
                initDrag(e, 'handle', { h: h.dataset.handle });
            });
        });

        els.cropBox.addEventListener('pointerdown', (e) => {
            if (e.target !== els.cropBox) return;
            initDrag(e, getDragType(e));
        });

        const dimmer = document.getElementById('backdrop-dimmer');
        if (dimmer) {
            dimmer.addEventListener('pointerdown', (e) => {
                initDrag(e, getDragType(e));
            });
        }
    }

    function attachInputHandlers() {
        els.viewport.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        els.viewport.addEventListener('wheel', handleWheel, { passive: false });
        els.viewport.addEventListener('contextmenu', e => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            showHints();
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                state.isSpacePressed = true;
                updateCursorStyle();
                const now = Date.now();
                if (now - state.lastSpaceUp < 250) {
                    if (state.isCropping) state.cropRotation = 0;
                    resetView();
                }
            }
            if ((e.ctrlKey || e.metaKey) && !e.repeat && !state.isCropping) {
                state.isCtrlPressed = true;
                state.polylineSessionId += 1;
                state.currentPolylineAction = `polyline-${state.polylineSessionId}`;
                state.isPolylineStart = true;
                state.lastDrawX = null;
                state.polylinePoints = [];
                state.polylineDirty = false;
                startPreviewLoop();
            }
            if (e.key === '[' || e.key === ']') {
                const step = e.repeat ? 0.4 : 0.2;
                const delta = e.key === '[' ? -step : step;
                setBrushPercent(state.brushPercent + delta);
            }
            if (!e.repeat && !state.isCropping && !e.ctrlKey && !e.metaKey) {
                if (e.key === '1') setBrushMode('erase');
                if (e.key === '2') setBrushMode('repair');
                if (e.key === '3') setBrushMode('patch');
            }
            if ((e.ctrlKey || e.metaKey) && !state.isCropping) {
                if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
                else if (e.key === 'y') { e.preventDefault(); redo(); }
            }
            if (state.isCropping) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    acceptCrop();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelCrop();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                state.isSpacePressed = false;
                state.isPanning = false;
                state.lastSpaceUp = Date.now();
                updateCursorStyle();
            }
            if (e.key === 'Control' || e.key === 'Meta') {
                if (state.polylineDirty || state.polylinePoints.length > 0) {
                    commitPolyline(false);
                }
                state.isCtrlPressed = false;
                state.currentPolylineAction = null;
                state.previewMaskCanvas = null;
                state.previewMaskScale = 1;
                state.isPreviewing = false;
                state.useFastPreview = false;
                state.isPolylineStart = false;
                state.lastDrawX = null;
                state.polylinePoints = [];
                stopPreviewLoop();
                render();
            }
        });

        attachCropHandlers();
    }

    function syncBrushUIToActive() {
        const activeKey = getActiveBrushKey();
        const activeSettings = state.brushSettings && state.brushSettings[activeKey];
        if (!activeSettings) return;
        setBrushPercent(activeSettings.brushSize);
        if (state.featherMode) {
            setFeather(activeSettings.featherSize);
        } else {
            setFeather(activeSettings.feather);
        }
    }


    return { canDraw, resetView, updateCursorSize, updateCursorStyle, attachInputHandlers, setBrushPercent, setBrushPercentFromSlider, setFeather, setFeatherFromSlider, setFeatherMode, syncBrushUIToActive, brushPercentToSliderValue: brushSizeToSliderValue };
}
