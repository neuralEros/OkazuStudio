(function (global) {
    function init({ state, els, canvases, helpers, eventHub }) {
        const { maskCanvas, maskCtx, frontLayerCanvas, frontLayerCtx } = canvases;
        const { updateCanvasDimensions, updateUI, truncate, resizeMainCanvas, resetMaskOnly, log, canDraw } = helpers;

        const requestRender = (options = {}) => eventHub.emit('render-request', options);
        const requestHistorySave = (actionType) => eventHub.emit('history-save', actionType);

        const setButtonState = (slot, name, hasImage) => {
            const btn = slot === 'A' ? els.btnA : els.btnB;
            const defaultLabel = slot === 'A' ? 'Load Img A' : 'Load Img B';
            btn.textContent = truncate(name || defaultLabel);
            btn.classList.toggle('border-blue-500', hasImage);
            btn.classList.toggle('text-blue-400', hasImage);
        };

        const assignImage = (img, slot, name) => {
            if (slot === 'A') {
                state.imgA = img;
                state.nameA = name;
            } else {
                state.imgB = img;
                state.nameB = name;
            }
            setButtonState(slot, name, Boolean(img));
        };

        function handleFileLoad(file, slot) {
            if (!file) return;
            log(`Loading ${file.name}...`, 'info');
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    assignImage(img, slot, file.name);
                    updateCanvasDimensions();
                    requestHistorySave('load');
                    requestRender();
                    updateUI();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }

        function setupDragAndDrop() {
            const body = document.body;
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => body.addEventListener(eventName, preventDefaults, false));
            function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
            body.addEventListener('dragenter', () => body.classList.add('dragging'));
            body.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) body.classList.remove('dragging'); });
            body.addEventListener('drop', (e) => {
                body.classList.remove('dragging');
                const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
                if (files.length === 1) {
                    handleFileLoad(files[0], state.imgA ? 'B' : 'A');
                } else if (files.length === 2) {
                    handleFileLoad(files[0], 'A');
                    handleFileLoad(files[1], 'B');
                }
            });
        }

        function swapImages() {
            [state.imgA, state.imgB] = [state.imgB, state.imgA];
            [state.nameA, state.nameB] = [state.nameB, state.nameA];
            setButtonState('A', state.nameA, Boolean(state.imgA));
            setButtonState('B', state.nameB, Boolean(state.imgB));
            updateCanvasDimensions(true);
            requestHistorySave('swap');
            requestRender();
            updateUI();
        }

        function mergeDown() {
            if (!canDraw()) return;
            log('Merging...', 'info');
            setTimeout(() => {
                try {
                    const wasCropping = state.isCropping;
                    state.isCropping = false;
                    resizeMainCanvas(state.fullDims.w, state.fullDims.h);

                    requestRender({ final: true, skipAdjustments: true });
                    const dataURL = els.mainCanvas.toDataURL('image/png');
                    const newImg = new Image();
                    newImg.onload = () => {
                        state.imgA = newImg; state.imgB = null;
                        state.nameA = 'Merged Layer'; state.nameB = '';

                        const newW = newImg.width;
                        const newH = newImg.height;
                        state.fullDims = { w: newW, h: newH };

                        if (!state.cropRect || state.cropRect.w > newW || state.cropRect.h > newH) {
                            state.cropRect = { x: 0, y: 0, w: newW, h: newH };
                        }

                        resetMaskOnly();

                        state.isCropping = wasCropping;
                        if (!wasCropping) resizeMainCanvas(state.cropRect.w, state.cropRect.h);
                        else resizeMainCanvas(newW, newH);

                        maskCanvas.width = newW; maskCanvas.height = newH;
                        frontLayerCanvas.width = newW; frontLayerCanvas.height = newH;
                        maskCtx.clearRect(0, 0, newW, newH);

                        state.isAFront = true; state.opacity = 1.0;
                        els.opacitySlider.value = 100; els.opacityVal.textContent = '100%';
                        setButtonState('A', 'Merged', true);
                        setButtonState('B', 'Load Img B', false);

                        requestHistorySave('merge');
                        requestRender();
                        updateUI();
                        log('Merge successful', 'info');
                    };
                    newImg.src = dataURL;
                } catch (e) { console.error(e); }
            }, 50);
        }

        function applyCensor() {
            if (!state.imgA && !state.imgB) { log('Need at least one image'); return; }
            log('Generating Censor layer...', 'info');
            setTimeout(() => {
                try {
                    const wasCropping = state.isCropping;
                    state.isCropping = false;
                    resizeMainCanvas(state.fullDims.w, state.fullDims.h);

                    requestRender({ final: true, skipAdjustments: true });
                    const baseData = els.mainCanvas.toDataURL('image/png');
                    const imgBase = new Image();
                    imgBase.onload = () => {
                        state.imgA = imgBase; state.nameA = 'Base Layer';
                        const w = imgBase.width; const h = imgBase.height;
                        const blurRadius = Math.max(1, h * 0.01);
                        const pad = Math.ceil(blurRadius * 3);
                        const paddedCanvas = document.createElement('canvas');
                        paddedCanvas.width = w + pad * 2; paddedCanvas.height = h + pad * 2;
                        const pCtx = paddedCanvas.getContext('2d');
                        pCtx.drawImage(imgBase, pad, pad);
                        pCtx.drawImage(imgBase, 0, 0, w, 1, pad, 0, w, pad);
                        pCtx.drawImage(imgBase, 0, h - 1, w, 1, pad, h + pad, w, pad);
                        pCtx.drawImage(imgBase, 0, 0, 1, h, 0, pad, pad, h);
                        pCtx.drawImage(imgBase, w - 1, 0, 1, h, w + pad, pad, pad, h);
                        const blurCanvas = document.createElement('canvas');
                        blurCanvas.width = w; blurCanvas.height = h;
                        const bCtx = blurCanvas.getContext('2d');
                        bCtx.filter = `blur(${blurRadius}px)`;
                        bCtx.drawImage(paddedCanvas, -pad, -pad);
                        bCtx.filter = 'none';
                        const blockSize = Math.max(1, h * 0.025);
                        const sw = Math.ceil(w / blockSize); const sh = Math.ceil(h / blockSize);
                        const tinyCanvas = document.createElement('canvas');
                        tinyCanvas.width = sw; tinyCanvas.height = sh;
                        const tinyCtx = tinyCanvas.getContext('2d');
                        tinyCtx.drawImage(blurCanvas, 0, 0, sw, sh);
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = w; tempCanvas.height = h;
                        const tCtx = tempCanvas.getContext('2d');
                        tCtx.imageSmoothingEnabled = false;
                        tCtx.drawImage(tinyCanvas, 0, 0, sw, sh, 0, 0, w, h);
                        const imgCensored = new Image();
                        imgCensored.onload = () => {
                            state.imgB = imgCensored; state.nameB = 'Censored Layer';

                            const newW = imgCensored.width;
                            const newH = imgCensored.height;
                            state.fullDims = { w: newW, h: newH };
                            if (!state.cropRect || state.cropRect.w > newW || state.cropRect.h > newH) {
                                state.cropRect = { x: 0, y: 0, w: newW, h: newH };
                            }

                            resetMaskOnly();

                            state.isCropping = wasCropping;
                            if (!wasCropping) resizeMainCanvas(state.cropRect.w, state.cropRect.h);
                            else resizeMainCanvas(newW, newH);

                            state.maskVisible = true;
                            els.maskEyeOpen.classList.remove('hidden'); els.maskEyeClosed.classList.add('hidden');
                            state.backVisible = true;
                            els.rearEyeOpen.classList.remove('hidden'); els.rearEyeClosed.classList.add('hidden');
                            state.feather = 2; els.feather.value = 2; els.featherVal.textContent = '90%';
                            state.opacity = 1.0; els.opacitySlider.value = 100; els.opacityVal.textContent = '100%';
                            state.isAFront = true;
                            setButtonState('A', 'Base', true);
                            setButtonState('B', 'Censored', true);

                            requestHistorySave('censor');
                            requestRender();
                            updateUI();
                            log('Censor setup complete', 'info');
                        };
                        imgCensored.src = tempCanvas.toDataURL('image/png');
                    };
                    imgBase.src = baseData;
                } catch (e) { console.error(e); }
             }, 50);
        }

        function saveImage() {
            if (!state.imgA && !state.imgB) return;
            try {
                const wasCropping = state.isCropping;
                state.isCropping = false;
                resizeMainCanvas(state.cropRect.w, state.cropRect.h);

                requestRender({ final: true });

                const now = new Date();
                const pad = (n) => n.toString().padStart(2, '0');
                const timeString = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
                const filename = `${timeString}.png`;

                const link = document.createElement('a');
                link.download = filename;
                link.href = els.mainCanvas.toDataURL('image/png');
                link.click();

                if (wasCropping) {
                    state.isCropping = true;
                    resizeMainCanvas(state.fullDims.w, state.fullDims.h);
                }

                requestRender();
                log('Image saved', 'info');
            } catch (e) { log('Save failed'); }
        }

        function wireInputs() {
            els.fileA.addEventListener('change', (e) => handleFileLoad(e.target.files[0], 'A'));
            els.fileB.addEventListener('change', (e) => handleFileLoad(e.target.files[0], 'B'));
            els.swapBtn.addEventListener('click', swapImages);
            els.mergeBtn.addEventListener('click', mergeDown);
            els.censorBtn.addEventListener('click', applyCensor);
            els.saveBtn.addEventListener('click', saveImage);
            setupDragAndDrop();
        }

        wireInputs();
    }

    global.filesModule = { init };
})(window);
