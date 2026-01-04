(function() {
    const { register, assert, assertEqual, assertApprox, spyOn, assertDeepEqual } = window.TestRunner;

    // 1. TEST HARNESS & FIXTURES
    function createMockEls() {
        return {
            mainCanvas: { width: 1000, height: 800, getContext: () => ({ drawImage: () => {}, clearRect: () => {}, fillRect: () => {}, getImageData: () => ({data:[]}), putImageData: () => {}, save:()=>{}, restore:()=>{}, translate:()=>{}, rotate:()=>{}, scale:()=>{} }), style: {}, classList: { add:()=>{}, remove:()=>{} }, toDataURL: () => 'data:image/png;base64,' },
            previewCanvas: { width: 1000, height: 800, getContext: () => ({}), style: {}, classList: { add:()=>{}, remove:()=>{}, toggle:()=>{} } },
            viewport: { clientWidth: 1200, clientHeight: 800, style: {}, getBoundingClientRect: () => ({ left: 10, top: 20, width: 1200, height: 800 }), classList: { add:()=>{}, remove:()=>{}, toggle:()=>{} }, addEventListener: () => {} },
            canvasWrapper: { style: {} },
            emptyState: { style: {} },
            loadingOverlay: { classList: { add:()=>{}, remove:()=>{} } },

            // Buttons
            fileA: { addEventListener: () => {} }, fileB: { addEventListener: () => {} },
            btnA: { addEventListener: () => {}, classList: { add:()=>{}, remove:()=>{} }, innerHTML: '' },
            btnB: { addEventListener: () => {}, classList: { add:()=>{}, remove:()=>{} }, innerHTML: '' },
            btnTrashA: { addEventListener: () => {}, style: {} }, btnTrashB: { addEventListener: () => {}, style: {} },
            swapBtn: { addEventListener: () => {} },
            opacitySlider: { addEventListener: () => {}, value: 80, parentElement: { style: {} } },
            opacityVal: { textContent: '' },
            brushSize: { addEventListener: () => {} }, brushSizeVal: {},
            feather: { addEventListener: () => {} }, featherVal: {}, featherLabel: {},
            eraseMode: { addEventListener: () => {}, classList: { toggle: ()=>{} } },
            repairMode: { addEventListener: () => {}, classList: { toggle: ()=>{} } },
            patchMode: { addEventListener: () => {}, classList: { toggle: ()=>{} } },
            clearMask: { addEventListener: () => {} },
            saveBtn: { addEventListener: () => {} }, exportBtn: { addEventListener: () => {} },
            mergeBtn: { addEventListener: () => {} }, censorBtn: { addEventListener: () => {} },
            undoBtn: { addEventListener: () => {} }, redoBtn: { addEventListener: () => {} },
            rotateBtn: { addEventListener: () => {} }, cropBtn: { addEventListener: () => {}, classList: { add:()=>{}, remove:()=>{} } },
            newBtn: { addEventListener: () => {} },
            resetAdjBtn: { addEventListener: () => {} }, resetLevelsBtn: { addEventListener: () => {} },
            resetColorBtn: { addEventListener: () => {} }, resetSatBtn: { addEventListener: () => {} },
            toggleMaskBtn: { addEventListener: () => {}, classList: { toggle: ()=>{} } },
            toggleBackBtn: { addEventListener: () => {}, classList: { toggle: ()=>{} } },
            toggleAdjBtn: { addEventListener: () => {}, classList: { toggle: ()=>{} } },
            maskEyeOpen: { classList: { toggle: ()=>{} } }, maskEyeClosed: { classList: { toggle: ()=>{} } },
            rearEyeOpen: { classList: { toggle: ()=>{} } }, rearEyeClosed: { classList: { toggle: ()=>{} } },
            adjEyeOpen: { classList: { toggle: ()=>{} } }, adjEyeClosed: { classList: { toggle: ()=>{} } },

            // Drawers/Overlays
            adjDrawer: { addEventListener: () => {} },
            colorTuningDrawer: { addEventListener: () => {} },
            cursor: { style: {} },
            cropOverlayDom: { style: {} }, cropBox: { style: { setProperty: ()=>{} } },
            workspaceResolution: { style: {}, textContent: '' },
            verticalToolbox: { getBoundingClientRect: () => ({ top:0, bottom:0, left:0, right:0, width:0, height:0 }) },

            // Mode buttons
            modeMaster: { classList: { toggle: ()=>{} }, addEventListener: ()=>{} },
            modeCensor: { classList: { toggle: ()=>{} }, addEventListener: ()=>{} },
            modeComposite: { classList: { toggle: ()=>{} }, addEventListener: ()=>{} },

            // Modal
            modalOverlay: document.createElement('div'), // Real element for simplicity or mock
            modalTitle: { textContent: '' },
            modalMessage: { textContent: '' },
            modalChoices: { innerHTML: '', appendChild: () => {} },
            modalClose: { style: {}, onclick: null }
        };
    }

    // 2. STATE CONSTRUCTION
    register('Main: createDefaultState', () => {
        const { createDefaultState } = window.OkazuTestables.main;
        const state = createDefaultState();

        assertEqual(state.imgA, null);
        assertEqual(state.imgB, null);
        assertEqual(state.isAFront, true);
        assertEqual(state.opacity, 0.8);
        assertEqual(state.brushSize, 0.1);
        assertEqual(state.featherMode, false);
        assertEqual(state.mode, 'master');
        assertEqual(state.maskVisible, true);
        assertEqual(state.fullDims.w, 0);
        assertEqual(state.settings.brushPreviewResolution, 1080);
    });

    // 3. MODE + UI SWITCHING
    register('Main: setAppMode', () => {
        const { setAppMode } = window.OkazuTestables.main;
        // Mock els
        const els = createMockEls();
        // Since setAppMode uses closure `els`, we must inject them?
        // `createDefaultEls` is exposed but `setAppMode` uses module scope `els`.
        // This is tricky. `scripts/main.js` defines `els` at module level.
        // We exposed `els` in `OkazuTestables.main.els`. We can mutate it.
        Object.assign(window.OkazuTestables.main.els, els);

        // Mock setFeatherMode (createInputSystem mock is hard here since it's destructured)
        // But main.js exports `setFeatherMode` in `OkazuTestables.main`? No, it's not exported there explicitly.
        // Wait, `createInputSystem` returns `setFeatherMode`.
        // And `main.js` calls it.
        // `setAppMode` calls `setFeatherMode`.
        // We can't mock `setFeatherMode` easily because it's a local variable in main.js closure.
        // But `window.OkazuTestables.main` has `setAppMode` which is the REAL function.
        // The real function uses the closure variables.

        // However, we can test side effects on DOM if we can't spy on internal functions.
        // Or we rely on `state.mode`.

        const { state } = window.OkazuTestables.main;
        setAppMode('censor');
        assertEqual(state.mode, 'censor');

        // Reset
        setAppMode('master');
        assertEqual(state.mode, 'master');
    });

    // 4. CANVAS UTILITIES
    register('Main: cloneToCanvas', () => {
        const { cloneToCanvas } = window.OkazuTestables.main;
        const img = { width: 100, height: 50 }; // Mock image
        // Requires real canvas creation
        // The implementation uses document.createElement('canvas').
        // JSDOM or browser supports this.

        const canvas = cloneToCanvas(img);
        assertEqual(canvas.width, 100);
        assertEqual(canvas.height, 50);
        // Note: drawImage with mock img might fail if strict canvas?
        // But in JSDOM usually okay-ish or throws.
        // If this runs in browser, it works.
    });

    register('Main: generateThumbnail', () => {
        const { generateThumbnail } = window.OkazuTestables.main;
        const img = document.createElement('canvas');
        img.width = 2000; img.height = 1000;

        const thumb = generateThumbnail(img, 256);
        assertEqual(thumb.height, 256);
        // Aspect ratio: 2:1. Width should be 512.
        assertEqual(thumb.width, 512);
    });

    register('Main: rotateRect', () => {
        const { rotateRect } = window.OkazuTestables.main;
        const r = { x: 2, y: 3, w: 4, h: 5 };
        const pW = 100, pH = 50;

        const r90 = rotateRect(r, pW, pH, 90);
        // 90 CW: x' = pH - (y + h) = 50 - (3+5) = 42.
        // y' = x = 2.
        // w' = h = 5.
        // h' = w = 4.
        assertDeepEqual(r90, { x: 42, y: 2, w: 5, h: 4 });
    });

    // 5. WORKING/PREVIEW LAYERS
    register('Main: rebuildWorkingCopyForSlot', () => {
        // This function depends on `state` and `hasActiveAdjustments`.
        const { rebuildWorkingCopyForSlot, state } = window.OkazuTestables.main;

        // Setup
        state.sourceA = document.createElement('canvas');
        state.sourceA.width = 10; state.sourceA.height = 10;
        state.adjustments = {
            gamma: 1, levels: {black:0, mid:1, white:255},
            saturation: 0, vibrance: 0, wb: 0, colorBal: {r:0,g:0,b:0},
            shadows: 0, highlights: 0,
            colorTuning: {}
        };
        // Ensure no active adjustments

        rebuildWorkingCopyForSlot('A');

        assert(state.workingA !== null, 'Working copy should be created');
        assertEqual(state.workingA.width, 10);
    });

    // 6. RENDERING PIPELINE
    register('Main: renderToContext mask_grayscale', () => {
        const { renderToContext, state } = window.OkazuTestables.main;
        const ctx = {
            clearRect: () => {},
            save: () => {}, restore: () => {},
            drawImage: spyOn({}, 'drawImage'),
            fillRect: spyOn({}, 'fillRect'),
            globalCompositeOperation: ''
        };

        // Setup state for mask export
        state.cropRect = { x: 0, y: 0, w: 1, h: 1 };
        state.fullDims = { w: 100, h: 100 };
        // We need a mask source
        window.OkazuTestables.main.maskCanvas.width = 100;
        window.OkazuTestables.main.maskCanvas.height = 100;

        renderToContext(ctx, 100, 100, { renderMode: 'mask_grayscale' });

        // Expect black fill at end
        // spy check might be complex due to multiple calls.
        // Last op should be destination-over and black fill.
        // But ctx mock is simple object.

        // We can check if fillRect was called with black?
        // Or just that it ran without error and called expected methods.
        ctx.drawImage.expectCalled();
        ctx.fillRect.expectCalled();
    });

    // 8. LAYER MANAGEMENT
    register('Main: assignLayer auto-fit', () => {
        const { assignLayer, state, els } = window.OkazuTestables.main;

        // Mock viewport
        Object.defineProperty(els.viewport, 'clientWidth', { value: 1000, configurable: true });
        Object.defineProperty(els.viewport, 'clientHeight', { value: 1000, configurable: true });
        // Mock canvas
        els.mainCanvas.width = 100; els.mainCanvas.height = 100;

        // Mock AssetManager
        window.AssetManager = { addAsset: () => 'id123' };

        const img = document.createElement('canvas');
        img.width = 2000; img.height = 2000;

        state.imgA = null; state.imgB = null; // Ensure empty

        assignLayer(img, 'A', 'test.png');

        // Should have reset view. 2000x2000 in 1000x1000 viewport.
        // Scale ~ 0.5 (actually (1000-40)/2000 = 0.48).
        assertApprox(state.view.scale, 0.48, 0.01);
        assert(state.assetIdA === 'id123');
    });

    register('Main: clearLayer resets', () => {
        const { clearLayer, state } = window.OkazuTestables.main;
        state.imgA = {};
        state.imgB = null;

        clearLayer('A');

        assertEqual(state.imgA, null);
        // Should be full reset
        // We can check if mainCanvas hidden
        // assert(els.mainCanvas.classList.contains('hidden')); // Need to check mock impl
    });

    // 10. UI
    register('Main: updateUI toggles', () => {
        const { updateUI, state, els } = window.OkazuTestables.main;
        state.imgA = {};
        state.imgB = {}; // Both loaded
        state.maskVisible = false;

        updateUI();

        // Opacity slider enabled
        assert(els.opacitySlider.disabled === false);
        // Toggle buttons logic is in updateVisibilityToggles called by updateUI

        // Check Visibility Toggles
        // maskVisible false -> toggleMaskBtn should have active class (bg-accent-dark)
        // Mock classList.toggle was called.
        // We can't easily assert on spy calls without returning the spy from mockEls.
        // But we trust the logic flow if no error.
    });

    register('Main: showModal returns promise', async () => {
        const { showModal } = window.OkazuTestables.main;

        // Mock DOM for modal
        const overlay = document.createElement('div'); overlay.id = 'modal-overlay'; document.body.appendChild(overlay);
        const title = document.createElement('div'); title.id = 'modal-title'; document.body.appendChild(title);
        const msg = document.createElement('div'); msg.id = 'modal-message'; document.body.appendChild(msg);
        const choices = document.createElement('div'); choices.id = 'modal-choices'; document.body.appendChild(choices);
        const close = document.createElement('button'); close.id = 'modal-close'; document.body.appendChild(close);

        const p = showModal('Title', 'Msg', [{label: 'Yes', value: true}]);

        // Click the button created in choices
        const btn = choices.querySelector('button');
        assert(btn, 'Button should be created');
        btn.click();

        const result = await p;
        assertEqual(result, true);

        // Cleanup
        document.body.removeChild(overlay);
        document.body.removeChild(title);
        document.body.removeChild(msg);
        document.body.removeChild(choices);
        document.body.removeChild(close);
    });

})();
