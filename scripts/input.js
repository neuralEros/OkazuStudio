function createInputSystem({ state, els, maskCtx, maskCanvas, render, saveSnapshot, undo, redo, showHints, scheduleHeavyTask, acceptCrop, cancelCrop, setBrushMode }) {
    const BRUSH_MIN = 0.2;
    const BRUSH_MAX = 30;
    const BRUSH_SLIDER_STEPS = 1000;
    const HARDNESS_MIN = 0;
    const HARDNESS_MAX = 20;
    const FEATHER_PX_MIN = 1;
    const FEATHER_PX_MAX = 20;

    function canDraw() { return (state.imgA || state.imgB) && state.cropRect; }

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
        if (state.fullDims.h === 0) return 20;
        return (state.brushPercent / 100) * state.fullDims.h;
    }

    function getCanvasCoordinates(e) {
        const rect = els.viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasX = (mouseX - state.view.x) / state.view.scale;
        const canvasY = (mouseY - state.view.y) / state.view.scale;

        if (!state.isCropping && state.cropRect) {
            return { x: canvasX + state.cropRect.x, y: canvasY + state.cropRect.y };
        }
        return { x: canvasX, y: canvasY };
    }

    function resetView() {
        if (!state.imgA && !state.imgB) return;
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

    function clampBrushPercent(val) {
        return Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, val));
    }

    function sliderValueToBrushPercent(sliderVal) {
        const normalized = sliderVal / BRUSH_SLIDER_STEPS;
        return BRUSH_MIN + normalized * (BRUSH_MAX - BRUSH_MIN);
    }

    function brushPercentToSliderValue(percent) {
        const normalized = (clampBrushPercent(percent) - BRUSH_MIN) / (BRUSH_MAX - BRUSH_MIN);
        return Math.round(normalized * BRUSH_SLIDER_STEPS);
    }

    function formatBrushPercent(val) {
        return parseFloat(val.toFixed(1));
    }

    function setBrushPercent(newPercent) {
        const clamped = clampBrushPercent(newPercent);
        state.brushPercent = clamped;
        const activeKey = getActiveBrushKey();
        if (state.brushSettings && state.brushSettings[activeKey]) {
            state.brushSettings[activeKey].brushPercent = clamped;
        }
        els.brushSize.value = brushPercentToSliderValue(clamped);
        els.brushSizeVal.textContent = formatBrushPercent(clamped);
        updateCursorSize();
    }

    function setBrushPercentFromSlider(sliderVal) {
        const numericVal = parseInt(sliderVal, 10) || 0;
        const percent = sliderValueToBrushPercent(numericVal);
        setBrushPercent(percent);
    }

    function setFeatherFromSlider(sliderVal) {
        const numericVal = parseInt(sliderVal, 10) || 0;
        if (state.featherMode) {
            setFeather(numericVal);
        } else {
            // Invert the slider value for Hardness mode so Right is Hard (0) and Left is Soft (20)
            // Slider 0 (Left) -> 20 (Softest)
            // Slider 20 (Right) -> 0 (Hardest)
            const inverted = HARDNESS_MAX - numericVal;
            setFeather(inverted);
        }
    }

    function setFeather(val) {
        if (state.featherMode) {
            const clamped = Math.max(FEATHER_PX_MIN, Math.min(FEATHER_PX_MAX, val));
            state.featherPx = clamped;
        const activeKey = getActiveBrushKey();
        if (state.brushSettings && state.brushSettings[activeKey]) {
            state.brushSettings[activeKey].featherPx = clamped;
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
            els.feather.min = FEATHER_PX_MIN;
            els.feather.max = FEATHER_PX_MAX;
            els.feather.value = state.featherPx;
            if (els.featherLabel) els.featherLabel.textContent = 'Feather';
            els.featherVal.textContent = `${state.featherPx}px`;
        } else {
            els.feather.min = HARDNESS_MIN;
            els.feather.max = HARDNESS_MAX;
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
        if (state.featherMode) {
            if (activeSettings && typeof activeSettings.featherPx === 'number') {
                state.featherPx = activeSettings.featherPx;
            }
        } else if (activeSettings && typeof activeSettings.feather === 'number') {
            state.feather = activeSettings.feather;
        }
        if (state.featherMode && typeof options.value === 'number') {
            const clamped = Math.max(FEATHER_PX_MIN, Math.min(FEATHER_PX_MAX, options.value));
            state.featherPx = clamped;
            if (options.applyToAll && state.brushSettings) {
                Object.values(state.brushSettings).forEach((settings) => {
                    settings.featherPx = clamped;
                });
            } else {
                if (state.brushSettings && state.brushSettings[activeKey]) {
                    state.brushSettings[activeKey].featherPx = clamped;
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

    function drawBrushStamp(x, y, context = maskCtx) {
        BrushKernel.paintStampAt(
            context,
            x,
            y,
            getBrushPixelSize(),
            state.featherMode ? state.featherPx : state.feather,
            state.featherMode,
            isEraseMode()
        );
    }


    function commitPolyline(shouldFill = false) {
        if (state.polylinePoints.length === 0) return;

        if (window.dispatchAction) {
             dispatchAction({
                 type: 'POLYLINE',
                 payload: {
                     points: JSON.parse(JSON.stringify(state.polylinePoints)),
                     shouldFill,
                     brushSize: getBrushPixelSize(),
                     feather: state.featherMode ? state.featherPx : state.feather,
                     featherMode: state.featherMode,
                     mode: isEraseMode() ? 'erase' : 'repair'
                 }
             });
        }

        const pts = state.polylinePoints;

        // Fill first if requested
        if (shouldFill) {
             maskCtx.save();
             maskCtx.beginPath();
             maskCtx.moveTo(pts[0].x, pts[0].y);
             for (let i = 1; i < pts.length; i++) {
                 maskCtx.lineTo(pts[i].x, pts[i].y);
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
         for (let i = 0; i < pts.length - 1; i++) {
             const p1 = pts[i];
             const p2 = pts[i+1];
             // Walk from p1 to p2, resetting spacing at p1
             BrushKernel.paintStrokeSegment(maskCtx, p1, p2, getBrushPixelSize(), state.featherMode ? state.featherPx : state.feather, state.featherMode, isEraseMode());
             // Draw Node p2
             drawBrushStamp(p2.x, p2.y, maskCtx);
         }

         const actionType = state.currentPolylineAction || 'mask';
         saveSnapshot(actionType);
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

    function addFastStrokePoint(coords) {
        if (!state.activeStroke) return;
        const stroke = state.activeStroke;
        stroke.points.push({ x: coords.x, y: coords.y });
        const scaledPoint = { x: coords.x * state.fastMaskScale, y: coords.y * state.fastMaskScale };

        let effectiveFeather = stroke.feather;
        if (stroke.featherMode) {
             effectiveFeather = stroke.feather * state.fastMaskScale;
        }

        const newStamp = BrushKernel.paintStrokeSegment(state.fastMaskCtx, state.fastPreviewLastStamp, scaledPoint, stroke.brushSize * state.fastMaskScale, effectiveFeather, stroke.featherMode, stroke.isErasing);
        state.fastPreviewLastStamp = newStamp;
    }

    function replayStrokeToFullMask() {
        const stroke = state.activeStroke;
        if (!stroke || stroke.points.length === 0) return;
        BrushKernel.drawStroke(maskCtx, stroke.points, {
            size: stroke.brushSize,
            feather: stroke.feather,
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

        if (state.isCropping) return;

        if (e.button === 0) {
            if (state.isCtrlPressed) {
                if (state.isPolylineStart) {
                    state.lastDrawX = coords.x;
                    state.lastDrawY = coords.y;
                    state.isPolylineStart = false;
                    state.polylinePoints = [{ x: coords.x, y: coords.y }];
                    Logger.interaction("Polyline", "Started", `(${Math.round(coords.x)}, ${Math.round(coords.y)})`);
                } else {
                    // Deferred Drawing Mode: Store points, do not draw to maskCtx yet
                    // Check close loop
                    const threshold = getBrushPixelSize();
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
                        Logger.interaction("Polyline", "Point Added", `(${Math.round(coords.x)}, ${Math.round(coords.y)})`);
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
        } else if (state.isCropping && state.cropDrag) {
            const rect = els.viewport.getBoundingClientRect();
            // Mouse in Visual Canvas Coords
            const mx = (e.clientX - rect.left - state.view.x) / state.view.scale;
            const my = (e.clientY - rect.top - state.view.y) / state.view.scale;

            const isRotated = state.rotation % 180 !== 0;
            // Visual Dimensions (Swapped if rotated)
            const visualFullW = isRotated ? state.fullDims.h : state.fullDims.w;
            const visualFullH = isRotated ? state.fullDims.w : state.fullDims.h;

            // Work with a Visual Rect
            let newVisualRect = { ...state.cropDrag.startVisualRect };

            if (state.cropDrag.type === 'box') {
                const dx = mx - state.cropDrag.startX;
                const dy = my - state.cropDrag.startY;

                newVisualRect.x = Math.max(0, Math.min(visualFullW - newVisualRect.w, newVisualRect.x + dx));
                newVisualRect.y = Math.max(0, Math.min(visualFullH - newVisualRect.h, newVisualRect.y + dy));
            } else {
                const h = state.cropDrag.h;

                // Visual Resizing Logic
                if (h.includes('e')) newVisualRect.w = Math.max(10, Math.min(visualFullW - newVisualRect.x, mx - newVisualRect.x));
                if (h.includes('s')) newVisualRect.h = Math.max(10, Math.min(visualFullH - newVisualRect.y, my - newVisualRect.y));

                if (h.includes('w')) {
                    const oldR = newVisualRect.x + newVisualRect.w;
                    newVisualRect.x = Math.min(mx, oldR - 10);
                    newVisualRect.x = Math.max(0, newVisualRect.x);
                    newVisualRect.w = oldR - newVisualRect.x;
                }

                if (h.includes('n')) {
                    const oldB = newVisualRect.y + newVisualRect.h;
                    newVisualRect.y = Math.min(my, oldB - 10);
                    newVisualRect.y = Math.max(0, newVisualRect.y);
                    newVisualRect.h = oldB - newVisualRect.y;
                }
            }

            // Convert back to Truth Space for state
            state.cropRect = visualToTruthRect(newVisualRect, state.rotation, state.fullDims.w, state.fullDims.h);
            render();
            forceCropHandleUpdate();
        } else if (state.isDrawing) {
            addFastStrokePoint(coords);
            render();
        }
    }

    function handlePointerUp(e) {
        if (state.isDrawing) {
            replayStrokeToFullMask();

            // Fixed Hardness Single Click Double-Hit Check
            if (state.featherMode && state.pointerDownTime && state.pointerDownCoords) {
                const duration = Date.now() - state.pointerDownTime;
                // If event is missing (pointerup sometimes doesn't have coords same way), use last known
                // But we used pointerDownCoords.
                // We need current coords to check distance.
                // handlePointerUp might be triggered by window, so e.clientX might be available
                let dist = 999;
                if (e && e.clientX !== undefined) {
                     const rect = els.viewport.getBoundingClientRect();
                     const mx = (e.clientX - rect.left - state.view.x) / state.view.scale;
                     const my = (e.clientY - rect.top - state.view.y) / state.view.scale;
                     dist = Math.hypot(mx - state.pointerDownCoords.x, my - state.pointerDownCoords.y);
                } else {
                     // Fallback if we can't get coords, assume 0 moved if lastDrawX is close?
                     // Use state.currentPointerX
                     if (state.currentPointerX !== null) {
                        dist = Math.hypot(state.currentPointerX - state.pointerDownCoords.x, state.currentPointerY - state.pointerDownCoords.y);
                     }
                }

                if (duration < 500 && dist <= 2) {
                    // Double hit!
                    // The first hit was done by replayStrokeToFullMask (it replays all points, for a single click it replays 1 point)
                    // We just draw it again.
                    drawBrushStamp(state.pointerDownCoords.x, state.pointerDownCoords.y, maskCtx);
                }
            }

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
            saveSnapshot('draw');
        }
        if (state.isCropping && state.cropDrag) {
            state.cropDrag = null;
            saveSnapshot('crop');
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

        // Draw already committed points in this sequence? No, they are in polylinePoints but NOT in maskCanvas
        if (state.polylinePoints.length > 0) {
             // Draw Start
             drawBrushStamp(state.polylinePoints[0].x, state.polylinePoints[0].y, pCtx);

             // Draw Segments
             for (let i = 0; i < state.polylinePoints.length - 1; i++) {
                 const p1 = state.polylinePoints[i];
                 const p2 = state.polylinePoints[i+1];
                 BrushKernel.paintStrokeSegment(pCtx, p1, p2, getBrushPixelSize(), state.featherMode ? state.featherPx : state.feather, state.featherMode, isEraseMode());
                 drawBrushStamp(p2.x, p2.y, pCtx);
             }
        }

        // Draw rubber band line from last point to current cursor
        if (state.lastDrawX !== null && state.currentPointerX !== null) {
             const start = {x: state.lastDrawX, y: state.lastDrawY};
             const end = {x: state.currentPointerX, y: state.currentPointerY};
             BrushKernel.paintStrokeSegment(pCtx, start, end, getBrushPixelSize(), state.featherMode ? state.featherPx : state.feather, state.featherMode, isEraseMode());
             // Draw cursor node
             drawBrushStamp(end.x, end.y, pCtx);
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
        const newScale = Math.max(0.1, Math.min(10, state.view.scale * (1 + delta)));
        const rect = els.viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const canvasX = (mouseX - state.view.x) / state.view.scale;
        const canvasY = (mouseY - state.view.y) / state.view.scale;
        state.view.scale = newScale;
        state.view.x = mouseX - canvasX * newScale;
        state.view.y = mouseY - canvasY * newScale;
        updateViewTransform();
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

        handles.forEach(h => {
            h.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                // Store Visual Start Rect for consistent dragging
                const startVisualRect = truthToVisualRect(state.cropRect, state.rotation, state.fullDims.w, state.fullDims.h);
                state.cropDrag = {
                    type: 'handle',
                    h: h.dataset.handle,
                    startVisualRect
                };
            });
        });

        els.cropBox.addEventListener('pointerdown', (e) => {
            if (e.target !== els.cropBox) return;
            e.stopPropagation();
            const rect = els.viewport.getBoundingClientRect();
            const mx = (e.clientX - rect.left - state.view.x) / state.view.scale;
            const my = (e.clientY - rect.top - state.view.y) / state.view.scale;

            const startVisualRect = truthToVisualRect(state.cropRect, state.rotation, state.fullDims.w, state.fullDims.h);

            state.cropDrag = {
                type: 'box',
                startX: mx,
                startY: my,
                startRect: { ...state.cropRect }, // Legacy field, might remove if unused
                startVisualRect
            };
        });

        document.getElementById('backdrop-dimmer').addEventListener('pointerdown', (e) => {
            if (!state.isCropping) return;
            e.stopPropagation();
            state.cropDrag = null;
        });
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
                if (now - state.lastSpaceUp < 250) resetView();
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
            if ((e.ctrlKey || e.metaKey)) {
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
        setBrushPercent(activeSettings.brushPercent);
        if (state.featherMode) {
            setFeather(activeSettings.featherPx);
        } else {
            setFeather(activeSettings.feather);
        }
    }


    return { canDraw, resetView, updateCursorSize, updateCursorStyle, attachInputHandlers, setBrushPercent, setBrushPercentFromSlider, setFeather, setFeatherFromSlider, setFeatherMode, syncBrushUIToActive, brushPercentToSliderValue };
}
