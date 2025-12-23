function createInputSystem({ state, els, maskCtx, maskCanvas, render, saveSnapshot, undo, redo, showHints, scheduleHeavyTask }) {
    const BRUSH_MIN = 0.2;
    const BRUSH_MAX = 30;
    const BRUSH_SLIDER_STEPS = 1000;

    function canDraw() { return (state.imgA || state.imgB) && state.cropRect; }

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
        els.brushSize.value = brushPercentToSliderValue(clamped);
        els.brushSizeVal.textContent = formatBrushPercent(clamped);
        updateCursorSize();
    }

    function setBrushPercentFromSlider(sliderVal) {
        const numericVal = parseInt(sliderVal, 10) || 0;
        const percent = sliderValueToBrushPercent(numericVal);
        setBrushPercent(percent);
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
        const size = getBrushPixelSize();
        const radius = size / 2;
        const softness = state.feather / 20;
        if (state.isErasing) {
            context.globalCompositeOperation = 'source-over';
            if (softness === 0) {
                context.fillStyle = 'white';
                context.beginPath();
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.fill();
            } else {
                const grad = context.createRadialGradient(x, y, radius * (1 - softness), x, y, radius);
                grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
                grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                context.fillStyle = grad;
                context.beginPath();
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.fill();
            }
        } else {
            context.globalCompositeOperation = 'destination-out';
            if (softness === 0) {
                context.fillStyle = 'black';
                context.beginPath();
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.fill();
            } else {
                const grad = context.createRadialGradient(x, y, radius * (1 - softness), x, y, radius);
                grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                context.fillStyle = grad;
                context.beginPath();
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.fill();
            }
        }
    }

    function drawStrokeDistance(x, y, context = maskCtx, isPreview = false) {
        const startX = state.lastDrawX;
        const startY = state.lastDrawY;
        if (startX === null || startY === null) {
            drawBrushStamp(x, y, context);
            if (!isPreview) {
                state.lastDrawX = x;
                state.lastDrawY = y;
            }
            return;
        }
        const dx = x - startX;
        const dy = y - startY;
        const dist = Math.hypot(dx, dy);
        const size = getBrushPixelSize();
        const spacing = Math.max(1, size * 0.15);
        drawBrushStamp(startX, startY, context);
        if (dist >= spacing) {
            const steps = dist / spacing;
            const stepX = dx / steps;
            const stepY = dy / steps;
            for (let i = 1; i <= steps; i++) {
                const drawX = startX + stepX * i;
                const drawY = startY + stepY * i;
                drawBrushStamp(drawX, drawY, context);
            }
        }
        drawBrushStamp(x, y, context);
        if (!isPreview) {
            state.lastDrawX = x;
            state.lastDrawY = y;
        }
    }

    function paintStampAt(context, x, y, size, feather, isErasing) {
        const radius = size / 2;
        const softness = feather / 20;
        context.globalCompositeOperation = isErasing ? 'source-over' : 'destination-out';
        if (softness === 0) {
            context.fillStyle = isErasing ? 'white' : 'black';
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();
            return;
        }
        const grad = context.createRadialGradient(x, y, radius * (1 - softness), x, y, radius);
        grad.addColorStop(0, isErasing ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = grad;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }

    function paintStrokeSegment(context, lastPoint, point, size, feather, isErasing) {
        const spacing = Math.max(1, size * 0.15);
        if (!lastPoint) {
            paintStampAt(context, point.x, point.y, size, feather, isErasing);
            return;
        }
        const dx = point.x - lastPoint.x;
        const dy = point.y - lastPoint.y;
        const dist = Math.hypot(dx, dy);
        paintStampAt(context, lastPoint.x, lastPoint.y, size, feather, isErasing);
        if (dist >= spacing) {
            const steps = dist / spacing;
            const stepX = dx / steps;
            const stepY = dy / steps;
            for (let i = 1; i <= steps; i++) {
                paintStampAt(context, lastPoint.x + stepX * i, lastPoint.y + stepY * i, size, feather, isErasing);
            }
        }
        paintStampAt(context, point.x, point.y, size, feather, isErasing);
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
            feather: state.feather,
            isErasing: state.isErasing
        };
        state.fastPreviewLastPoint = null;
    }

    function addFastStrokePoint(coords) {
        if (!state.activeStroke) return;
        const stroke = state.activeStroke;
        stroke.points.push({ x: coords.x, y: coords.y });
        const scaledPoint = { x: coords.x * state.fastMaskScale, y: coords.y * state.fastMaskScale };
        paintStrokeSegment(state.fastMaskCtx, state.fastPreviewLastPoint, scaledPoint, stroke.brushSize * state.fastMaskScale, stroke.feather, stroke.isErasing);
        state.fastPreviewLastPoint = scaledPoint;
    }

    function replayStrokeToFullMask() {
        const stroke = state.activeStroke;
        if (!stroke || stroke.points.length === 0) return;
        let last = null;
        for (const pt of stroke.points) {
            paintStrokeSegment(maskCtx, last, pt, stroke.brushSize, stroke.feather, stroke.isErasing);
            last = pt;
        }
    }

    function handlePointerDown(e) {
        if (!canDraw()) return;
        const coords = getCanvasCoordinates(e);
        state.currentPointerX = coords.x;
        state.currentPointerY = coords.y;

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
                } else {
                    const threshold = getBrushPixelSize();
                    const startPt = state.polylinePoints[0];
                    const dist = Math.hypot(coords.x - startPt.x, coords.y - startPt.y);

                    if (state.polylinePoints.length > 2 && dist < threshold) {
                        drawStrokeDistance(coords.x, coords.y);
                        state.polylinePoints.push({ x: coords.x, y: coords.y });
                        state.lastDrawX = coords.x;
                        state.lastDrawY = coords.y;
                        drawStrokeDistance(startPt.x, startPt.y);
                        maskCtx.beginPath();
                        maskCtx.moveTo(state.polylinePoints[0].x, state.polylinePoints[0].y);
                        for (let i = 1; i < state.polylinePoints.length; i++) maskCtx.lineTo(state.polylinePoints[i].x, state.polylinePoints[i].y);
                        maskCtx.closePath();
                        if (state.isErasing) {
                            maskCtx.globalCompositeOperation = 'source-over';
                            maskCtx.fillStyle = 'white';
                        } else {
                            maskCtx.globalCompositeOperation = 'destination-out';
                            maskCtx.fillStyle = 'black';
                        }
                        maskCtx.fill();
                        state.isPolylineStart = true;
                        state.polylinePoints = [];
                        state.lastDrawX = null;
                        const actionType = state.currentPolylineAction || 'draw';
                        saveSnapshot(actionType);
                        state.polylineDirty = false;
                        render();
                        return;
                    }
                    if (state.polylinePoints.length === 1) drawBrushStamp(state.lastDrawX, state.lastDrawY);
                    drawStrokeDistance(coords.x, coords.y);
                    state.lastDrawX = coords.x;
                    state.lastDrawY = coords.y;
                    state.polylinePoints.push({ x: coords.x, y: coords.y });
                    state.polylineDirty = true;
                }
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
            const mx = (e.clientX - rect.left - state.view.x) / state.view.scale;
            const my = (e.clientY - rect.top - state.view.y) / state.view.scale;

            const r = state.cropRect;

            if (state.cropDrag.type === 'box') {
                const dx = mx - state.cropDrag.startX;
                const dy = my - state.cropDrag.startY;
                const sr = state.cropDrag.startRect;
                r.x = Math.max(0, Math.min(state.fullDims.w - r.w, sr.x + dx));
                r.y = Math.max(0, Math.min(state.fullDims.h - r.h, sr.y + dy));
            } else {
                const h = state.cropDrag.h;
                if (h === 'nw') {
                    const oldR = r.x + r.w; const oldB = r.y + r.h;
                    r.x = Math.min(mx, oldR - 10);
                    r.x = Math.max(0, r.x);
                    r.y = Math.min(my, oldB - 10);
                    r.y = Math.max(0, r.y);
                    r.w = oldR - r.x;
                    r.h = oldB - r.y;
                } else if (h === 'se') {
                    r.w = Math.max(10, Math.min(state.fullDims.w - r.x, mx - r.x));
                    r.h = Math.max(10, Math.min(state.fullDims.h - r.y, my - r.y));
                } else if (h === 'ne') {
                    const oldB = r.y + r.h;
                    r.y = Math.min(my, oldB - 10);
                    r.y = Math.max(0, r.y);
                    r.h = oldB - r.y;
                    r.w = Math.max(10, Math.min(state.fullDims.w - r.x, mx - r.x));
                } else if (h === 'sw') {
                    const oldR = r.x + r.w;
                    r.x = Math.min(mx, oldR - 10);
                    r.x = Math.max(0, r.x);
                    r.w = oldR - r.x;
                    r.h = Math.max(10, Math.min(state.fullDims.h - r.y, my - r.y));
                } else if (h === 'n') {
                    const oldB = r.y + r.h;
                    r.y = Math.min(my, oldB - 10);
                    r.y = Math.max(0, r.y);
                    r.h = oldB - r.y;
                } else if (h === 's') {
                    r.h = Math.max(10, Math.min(state.fullDims.h - r.y, my - r.y));
                } else if (h === 'e') {
                    r.w = Math.max(10, Math.min(state.fullDims.w - r.x, mx - r.x));
                } else if (h === 'w') {
                    const oldR = r.x + r.w;
                    r.x = Math.min(mx, oldR - 10);
                    r.x = Math.max(0, r.x);
                    r.w = oldR - r.x;
                }
            }
            render();
        } else if (state.isDrawing) {
            addFastStrokePoint(coords);
            render();
        }
    }

    function handlePointerUp() {
        if (state.isDrawing) {
            state.isDrawing = false;
            scheduleHeavyTask(() => {
                replayStrokeToFullMask();
                state.previewMaskCanvas = null;
                state.previewMaskScale = 1;
                state.isPreviewing = false;
                state.useFastPreview = false;
                state.fastPreviewLastPoint = null;
                state.activeStroke = null;
                render();
                saveSnapshot('draw');
                updateCursorStyle();
            });
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
        if (state.lastDrawX === null || state.currentPointerX === null) return;
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
        pCtx.drawImage(maskCanvas, 0, 0, pw, ph);
        pCtx.save(); pCtx.scale(scale, scale);
        if (state.isPolylineStart && state.lastDrawX !== null) {
            drawBrushStamp(state.lastDrawX, state.lastDrawY, pCtx);
        }
        drawStrokeDistance(state.currentPointerX, state.currentPointerY, pCtx, true);
        pCtx.restore();
        state.previewMaskScale = scale;
        state.isPreviewing = true;
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

    function attachCropHandlers() {
        const handles = document.querySelectorAll('.crop-handle');

        handles.forEach(h => {
            h.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                state.cropDrag = { type: 'handle', h: h.dataset.handle };
            });
        });

        els.cropBox.addEventListener('pointerdown', (e) => {
            if (e.target !== els.cropBox) return;
            e.stopPropagation();
            const rect = els.viewport.getBoundingClientRect();
            const mx = (e.clientX - rect.left - state.view.x) / state.view.scale;
            const my = (e.clientY - rect.top - state.view.y) / state.view.scale;
            state.cropDrag = {
                type: 'box',
                startX: mx,
                startY: my,
                startRect: { ...state.cropRect }
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
                const delta = e.key === '[' ? -0.2 : 0.2;
                setBrushPercent(state.brushPercent + delta);
            }
            if ((e.ctrlKey || e.metaKey)) {
                if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
                else if (e.key === 'y') { e.preventDefault(); redo(); }
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
                if (state.polylineDirty) {
                    const actionType = state.currentPolylineAction || 'mask';
                    saveSnapshot(actionType);
                    state.polylineDirty = false;
                }
                state.isCtrlPressed = false;
                state.currentPolylineAction = null;
                state.previewMaskCanvas = null;
                state.previewMaskScale = 1;
                state.isPreviewing = false;
                state.isPolylineStart = false;
                state.lastDrawX = null;
                state.polylinePoints = [];
                stopPreviewLoop();
                render();
            }
        });

        attachCropHandlers();
    }

    return { canDraw, resetView, updateCursorSize, updateCursorStyle, attachInputHandlers, setBrushPercent, setBrushPercentFromSlider, brushPercentToSliderValue };
}
