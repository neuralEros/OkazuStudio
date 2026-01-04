# OKAZU STUDIO SCRIPTS/MAIN.JS UNIT-TEST BLUEPRINT CHECKLIST

1. TEST HARNESS & FIXTURES (SHARED SETUP)
[ ] 1.1. JSDOM Environment Requirements
    [ ] 1.1.1. Support for document.body
    [ ] 1.1.2. Support for document.getElementById
    [ ] 1.1.3. Support for classList manipulation
[ ] 1.2. Canvas Mock Requirements (getContext('2d'))
    [ ] 1.2.1. drawImage
    [ ] 1.2.2. getImageData
    [ ] 1.2.3. putImageData
    [ ] 1.2.4. clearRect
    [ ] 1.2.5. fillRect
    [ ] 1.2.6. globalCompositeOperation
    [ ] 1.2.7. globalAlpha
[ ] 1.3. Global Timer/Observer Stubs
    [ ] 1.3.1. stub requestAnimationFrame
    [ ] 1.3.2. stub setTimeout
    [ ] 1.3.3. stub ResizeObserver
[ ] 1.4. Global Stubs and Spies
    [ ] 1.4.1. window.Logger stub: info, warn, error, interaction methods
    [ ] 1.4.2. window.createReplayEngine stub: logAction, undo, redo, setUpdateCanvasDimensionsFn, undoFloor
    [ ] 1.4.3. window.AssetManager stub: addAsset (returning deterministic IDs)
    [ ] 1.4.4. window.dispatchAction spy (re-assigned by main.js)
    [ ] 1.4.5. createAdjustmentSystem stub (applyMasterLUT, applyColorOps, applySelectiveColor, initAdjustments, resetAllAdjustments, recalculateColorTuning, updateAllAdjustmentUI spies)
    [ ] 1.4.6. createInputSystem stub (canDraw, resetView, updateCursorSize, attachInputHandlers, setBrushPercent, setBrushPercentFromSlider, setFeather, setFeatherFromSlider, setFeatherMode, syncBrushUIToActive spies)
[ ] 1.5. Reusable DOM Fixture (Elements from createDefaultEls)
    [ ] 1.5.1. #mainCanvas
    [ ] 1.5.2. #previewCanvas
    [ ] 1.5.3. #viewport
    [ ] 1.5.4. #canvas-wrapper
    [ ] 1.5.5. #empty-state
    [ ] 1.5.6. #drawer-adj
    [ ] 1.5.7. #modeMaster
    [ ] 1.5.8. #modeCensor
    [ ] 1.5.9. #modeComposite
    [ ] 1.5.10. #loading-overlay
    [ ] 1.5.11. Modal: #modal-overlay, #modal-title, #modal-message, #modal-choices, #modal-close
    [ ] 1.5.12. Visibility Toggles: #toggleMaskBtn, #maskEyeOpen, #maskEyeClosed, #toggleBackBtn, #rearEyeOpen, #rearEyeClosed, #toggleAdjBtn, #adjEyeOpen, #adjEyeClosed
    [ ] 1.5.13. Crop: #cropBtn, #crop-overlay-dom, #crop-box, .crop-handle
[ ] 1.6. Canvas/Image Fixtures
    [ ] 1.6.1. img2x3: 2x3 canvas with distinct RGBA pixels per coordinate (e.g. 0,0=red)
    [ ] 1.6.2. img4x2: 4x2 canvas for scaling tests
    [ ] 1.6.3. mask2x3: 2x3 mask canvas with opaque pixels in diagonal pattern

2. STATE/ELEMENT CONSTRUCTION
[ ] 2.1. createDefaultState
    # Scenario: default state object contains expected primitives and nested defaults
    # Assertions:
    [ ] 2.1.1. imgA, imgB, sourceA, sourceB, thumbA, thumbB are null
    [ ] 2.1.2. assetIdA, assetIdB are null
    [ ] 2.1.3. nameA, nameB, formatA, formatB are ''
    [ ] 2.1.4. isAFront === true
    [ ] 2.1.5. opacity === 0.8
    [ ] 2.1.6. brushSize === 0.1
    [ ] 2.1.7. feather === 1
    [ ] 2.1.8. featherSize === 0.0012
    [ ] 2.1.9. featherMode === false
    [ ] 2.1.10. brushMode === 'erase'
    [ ] 2.1.11. maskVisible === true, backVisible === true, adjustmentsVisible === true
    [ ] 2.1.12. history is empty array, historyIndex === -1, lastActionType === null
    [ ] 2.1.13. isSpacePressed === false, isPanning === false, view === { x: 0, y: 0, scale: 1 }, lastSpaceUp === 0
    [ ] 2.1.14. isPreviewing === false, previewMaskCanvas === null, previewMaskScale === 1, previewLoopId === null
    [ ] 2.1.15. isPolylineStart === false, polylinePoints empty, polylineDirty === false, polylineSessionId === 0, currentPolylineAction === null
    [ ] 2.1.16. activeStroke === null, fastPreviewLastPoint === null, pointerDownTime === 0, pointerDownCoords === null
    [ ] 2.1.17. rotation === 0
    [ ] 2.1.18. brushSettings.erase.brushSize === 0.1; repair.brushSize === 0.05; patch.brushSize === 0.05
    [ ] 2.1.19. erase.feather === 1; patch.feather === 10; featherSize for all is 0.0012
    [ ] 2.1.20. gamma === 1, levels.black === 0, levels.mid === 1, levels.white === 255
    [ ] 2.1.21. saturation === 0, vibrance === 0, wb === 0, colorBal all 0
    [ ] 2.1.22. colorTuning.* all zeros for hue/saturation/vibrance/luminance/shadows/highlights
    [ ] 2.1.23. isAdjusting === false, previewCanvas === null, previewFrontLayer === null
    [ ] 2.1.24. workingA/B === null, previewWorkingA/B === null, previewScaleA/B === 1, previewWorkingVersionA/B === 0
    [ ] 2.1.25. previewComposite === null, adjustmentsVersion === 0, workingVersionA/B === 0
    [ ] 2.1.26. isCropping === false, cropRect === null, cropRectSnapshot === null, fullDims === { w: 0, h: 0 }, cropDrag === null
    [ ] 2.1.27. fastMaskCanvas === null, fastMaskCtx === null, fastMaskScale === 1, useFastPreview === false
    [ ] 2.1.28. settings.brushPreviewResolution === 1080, settings.adjustmentPreviewResolution === 1080
    [ ] 2.1.29. pendingAdjustmentCommit === false, drawerCloseTimer === null, activeDrawerTab === null
    [ ] 2.1.30. mode === 'master', cropRotation === 0, hasShownSaveMergeWarning === false
[ ] 2.2. createDefaultEls
    [ ] 2.2.1. Scenario: DOM elements are wired when present
        # Setup: Build DOM with all expected IDs
        # Assertions: Each returned property references matching element ID
    [ ] 2.2.2. Scenario: missing elements are handled without throwing
        # Setup: Provide root node with only subset of IDs
        # Assertions: Missing elements return null for those keys

3. MODE + UI SWITCHING
[ ] 3.1. setAppMode
    [ ] 3.1.1. Scenario: toggles global classes and button active state
        # Setup: document.body exists; mode buttons exist; stub setFeatherMode
        # Inputs: setAppMode('censor')
        # Expected: state.mode is 'censor'; Body has 'mode-non-master'; setFeatherMode(true) called; modeCensor has 'active'
    [ ] 3.1.2. Scenario: no-op for falsy mode
        # Setup: state.mode = 'master'; spy setFeatherMode
        # Inputs: setAppMode('')
        # Expected: No changes; setFeatherMode not called
[ ] 3.2. bindModeSwitcher
    [ ] 3.2.1. Scenario: attaches click events and applies current mode
        # Setup: state.mode = 'composite'; spy setAppMode
        # Expected: listeners attached; setAppMode('composite') called on init; clicking master calls setAppMode('master')

4. CANVAS UTILITIES
[ ] 4.1. cloneToCanvas
    [ ] 4.1.1. Scenario: clones canvas/image content to a new canvas
        # Inputs: cloneToCanvas(img2x3)
        # Expected: output size 2x3; pixel content identical; drawImage called once
[ ] 4.2. generateThumbnail
    [ ] 4.2.1. Scenario: returns null for no input
    [ ] 4.2.2. Scenario: returns clone when height <= target
        # Setup: img4x2, targetH=4 -> returned canvas 4x2
    [ ] 4.2.3. Scenario: progressive downscale to target height
        # Setup: img 2000x1000, targetH=256
        # Expected: Halves multiple times; final height 256; width scaled proportionally; imageSmoothingEnabled is true
[ ] 4.3. rotateCanvas
    [ ] 4.3.1. Scenario: 0 deg returns original canvas reference
    [ ] 4.3.2. Scenario: 90 deg swaps dimensions and pixels rotate correctly
        # Expected: new size 3x2; original (0,0) mapped to new rotated position via getImageData
[ ] 4.4. rotateRect
    [ ] 4.4.1. Scenario: 0 deg yields shallow copy
        # Assertions: deep equality but result !== original
    [ ] 4.4.2. Scenario: 90 deg mapping
        # Logic: parentH - (y+h) for x; x for y; swaps w/h
        # Input: {x:2,y:3,w:4,h:5}, parentW:100, parentH:50
        # Expected: { x: 42, y: 2, w: 5, h: 4 }
    [ ] 4.4.3. Scenario: 180 and 270 deg mappings
        # Expected 180: { x: 94, y: 42, w: 4, h: 5 }
        # Expected 270: { x: 3, y: 94, w: 5, h: 4 }
[ ] 4.5. bakeRotation
    [ ] 4.5.1. Scenario: no-op when rotation is 0
    [ ] 4.5.2. Scenario: rotates layers, mask, updates fullDims/cropRect, clears history
        # Setup: state.rotation=90; state.imgA/B set; fullDims={w:200,h:100}; cropRect={x:10,y:20,w:50,h:30}
        # Expected: imgA/B rotated; maskCanvas resized/remapped; fullDims={w:100,h:200}; cropRect rotated; rotation=0; history cleared
        # Assertions: Verify rotateCanvas calls; history.length === 0; historyIndex === -1

5. WORKING/PREVIEW LAYERS
[ ] 5.1. rebuildWorkingCopyForSlot
    [ ] 5.1.1. Scenario: no source clears working state
        # Setup: state.sourceA = null -> workingA = null; workingVersionA = 0
    [ ] 5.1.2. Scenario: source exists and no active adjustments
        # Setup: state.sourceA = img2x3; hasActiveAdjustments = false
        # Expected: workingA matches img2x3 pixels; workingVersionA updated; rebuildPreviewLayerForSlot('A') called
    [ ] 5.1.3. Scenario: source exists and adjustments active
        # Expected: applyMasterLUT, applyColorOps, applySelectiveColor called once; putImageData called
[ ] 5.2. rebuildWorkingCopies
    [ ] 5.2.1. Scenario: forceVersionBump increments adjustmentsVersion
        # Expected: markAdjustmentsDirty called; rebuild called for A and B
[ ] 5.3. rebuildPreviewLayerForSlot
    [ ] 5.3.1. Scenario: skip when preview disabled or full resolution
        # Setup: settings.brushPreviewResolution = 'Full'
    [ ] 5.3.2. Scenario: missing working clears preview state
        # Setup: workingA = null -> previewWorkingA = null; previewVersion = 0; scale = 1
    [ ] 5.3.3. Scenario: downscaled preview built
        # Setup: workingA 4000x2000; resolution=1000
        # Expected: previewScaleA = 0.5; size 2000x1000; previewWorkingVersion matches adjustmentsVersion
[ ] 5.4. getLayerForRender
    [ ] 5.4.1. Scenario: no source returns null layer ({ img: null, scale: 1 })
    [ ] 5.4.2. Scenario: adjustments hidden bypasses working
        # Setup: adjustmentsVisible = false -> returns source image, scale 1
    [ ] 5.4.3. Scenario: stale working triggers rebuild
        # Setup: adjustmentsVisible=true; workingA=null; spy rebuildWorkingCopyForSlot
    [ ] 5.4.4. Scenario: prefer preview uses preview layer when version matches
        # Setup: previewWorkingA matches adjustmentsVersion; scale=0.5

6. RENDERING PIPELINE
[ ] 6.1. renderToContext
    [ ] 6.1.1. Scenario: returns early without crop
        # Setup: cropRect=null; isCropping=false -> clearRect called, drawImage NOT called
    [ ] 6.1.2. Scenario: legacy boolean options map to proper defaults
    [ ] 6.1.3. Scenario: mask_alpha render uses destination-out with white background
        # Setup: state.isPreviewing=false; maskCanvas populated
        # Expected: fillStyle='#FFFFFF' for background; globalCompositeOperation='destination-out' before mask draw
    [ ] 6.1.4. Scenario: mask_grayscale fills black behind mask holes
        # Expected: globalCompositeOperation='destination-over' for final black background fill
    [ ] 6.1.5. Scenario: composite render uses back/front with mask and opacity
        # Setup: imgA/B exist; isAFront=true; maskVisible=true; opacity=0.5
        # Expected: Back layer alpha=1; Front layer mask applied; Final draw uses globalAlpha=0.5
[ ] 6.2. render
    [ ] 6.2.1. Scenario: throttles during adjustment preview
        # Setup: isAdjusting=true; throttle check < 500ms -> returns early
    [ ] 6.2.2. Scenario: downscaled preview composite path
        # Setup: useFastPreview=true; settings.brushPreviewResolution=1080
        # Expected: mainCanvas.style.visibility='hidden'; previewCanvas visible; previewCanvas size matches scaled crop

7. CROP WORKFLOWS
[ ] 7.1. toggleCropMode
    [ ] 7.1.1. Scenario: entering crop mode
        # Setup: canDraw()=true; isCropping=false
        # Expected: isCropping=true; cropRectSnapshot saved; cropBtn active; viewport has 'cropping' class; UpdateCanvasDimensions(true) called
    [ ] 7.1.2. Scenario: exiting crop mode with auto-trim
        # Expected: trimCropRectToImageBounds called; toggles removed
[ ] 7.2. acceptCrop
    [ ] 7.2.1. Scenario: apply crop and dispatch action
        # Expected: trimCropRectToImageBounds called; toggleCropMode(false) called; dispatchAction type CROP
[ ] 7.3. cancelCrop
    [ ] 7.3.1. Scenario: restore snapshot and exit
        # Expected: cropRect = cropRectSnapshot; cropDrag cleared; toggleCropMode(false)
[ ] 7.4. trimCropRectToImageBounds
    [ ] 7.4.1. Scenario: clamp crop to image bounds without rotation
        # Setup: fullDims={w:1000,h:500}; cropRect={x:-0.1,y:-0.1,w:1.5,h:1.2}
        # Expected: x,y >= 0; w <= ratio (2.0); h <= 1; min size >= 0.001
    [ ] 7.4.2. Scenario: rotation-aware clamping
        # Setup: rotation=90; cropRotation=30
        # Expected: Visual bounds preserved; Center preserved
[ ] 7.5. updateCanvasDimensions
    [ ] 7.5.1. Scenario: no images returns without changes
    [ ] 7.5.2. Scenario: updates union dims, crop rect, and mask size
        # Expected: fullDims equals union; cropRect set to frame; maskCanvas re-sized (content preserved); resizeMainCanvas called
    [ ] 7.5.3. Scenario: preserve view avoids reset
[ ] 7.6. resizeMainCanvas
    [ ] 7.6.1. Scenario: resizes main and front layer canvases
        # Input: (640, 480) -> width=640; height=480; updateWorkspaceLabel called

8. LAYER MANAGEMENT
[ ] 8.1. setLayerSource
    [ ] 8.1.1. Scenario: assigns base image, thumb, and resets versions
        # Expected: sourceX/imgX = clones; thumbX set; working/preview versions = 0
[ ] 8.2. assignLayer
    [ ] 8.2.1. Scenario: first image load (wasEmpty) auto-fits view
        # Setup: imgA/B null; AssetManager.addAsset returns id
        # Expected: assetId/name/format assigned; fullDims/cropRect calculated; resetView called; dispatchAction LOAD_IMAGE
[ ] 8.3. clearLayer
    [ ] 8.3.1. Scenario: clearing last remaining layer resets state
        # Expected: layers null; cropRect null; resetAllAdjustments, resetView, updateUI called; empty-state shown
    [ ] 8.3.2. Scenario: clearing one of two layers preserves other and updates canvas
        # Expected: rebuildWorkingCopies called; updateCanvasDimensions(true) called
[ ] 8.4. mergeDown
    [ ] 8.4.1. Scenario: merges composite into slot A
        # Setup: imgA/B exist; stub scheduleHeavyTask
        # Expected: imgB cleared; imgA set to merged; name="Merged Layer"; cropRotation=0; mask cleared; isAFront=true; opacity=1.0; dispatchAction MERGE_LAYERS
[ ] 8.5. applyCensor
    [ ] 8.5.1. Scenario: builds censored back layer and resets brush defaults
        # Expected: Base to A, Censored to B; asset IDs updated; mask/cropRot reset; opacity=1.0; brush defaults reset; feather mode enabled; dispatchAction APPLY_CENSOR

9. IO HANDLING
[ ] 9.1. handleFileLoad
    [ ] 9.1.1. Scenario: no file resolves without side effects
    [ ] 9.1.2. Scenario: stego handler short-circuits assignment
        # Setup: resolveStegoLoad -> handled: true
    [ ] 9.1.3. Scenario: assigns layer on success
        # Setup: resolveStegoLoad -> handled: false, image: img2x3
[ ] 9.2. fetchImage
    [ ] 9.2.1. Scenario: direct fetch success returns blob
    [ ] 9.2.2. Scenario: direct fetch fails and proxy is used
        # Setup: proxyUrl template set; first fetch rejects
        # Expected: second fetch uses encoded proxy URL
[ ] 9.3. handlePaste
    [ ] 9.3.1. Scenario: ignores paste in input/textarea
    [ ] 9.3.2. Scenario: uses valid blob from clipboard
        # Expected: loadLayerWithSmartSlotting(blob, 'Pasted Image')
    [ ] 9.3.3. Scenario: uses URL from text data
        # Expected: fetchImage called -> loadLayerWithSmartSlotting(blob, 'Pasted URL')
    [ ] 9.3.4. Scenario: parses <img src="..."> HTML
        # Expected: extracts URL -> fetchImage
[ ] 9.4. setupDragAndDrop
    [ ] 9.4.1. Scenario: dragenter adds body class, dragleave removes
    [ ] 9.4.2. Scenario: drop with single image file
        # Expected: loadLayerWithSmartSlotting(file, file.name)
    [ ] 9.4.3. Scenario: drop with two images prompts overwrite
        # Setup: imgA/B set; showModal returns true
        # Expected: handleFileLoad for A and B; resetView

10. UI MAINTENANCE
[ ] 10.1. updateUI
    [ ] 10.1.1. Scenario: disables/enables controls based on state and cropping
        # Assertions during crop: undo/redo disabled; brush disabled
        # Assertions solo image: opacity slider disabled; empty state hidden
[ ] 10.2. updateVisibilityToggles
    [ ] 10.2.1. Scenario: toggles mask/back/adjustments icons and classes
        # Assertions: icon swaps (open/closed eye); class bg-accent-dark / border-accent-strong
[ ] 10.3. updateWorkspaceLabel
    [ ] 10.3.1. Scenario: hides label when nothing can draw (display='none')
    [ ] 10.3.2. Scenario: shows label with dimensions (e.g. 120x80)
[ ] 10.4. syncDrawerHeights
    [ ] 10.4.1. Scenario: sets uniform height based on tallest drawer
        # Expected: max offsetHeight + 2px applied to .drawer-content
[ ] 10.5. initDrawerSync
    [ ] 10.5.1. Scenario: wires ResizeObserver and window resize
        # Assertions: observer.observe called for each .drawer-inner
[ ] 10.6. showModal
    [ ] 10.6.1. Scenario: displays modal, resolves with chosen value, and cleans up
        # Setup: Title, Msg, Choice[{label:'Yes', value:true}]
        # Expected: Promise resolves true; after 200ms visibility='hidden'
    [ ] 10.6.2. Scenario: cancellable close returns null
[ ] 10.7. scheduleHeavyTask
    [ ] 10.7.1. Scenario: runs task immediately when loading overlay missing
    [ ] 10.7.2. Scenario: toggles loading overlay and handles errors
        # Expected: 'hidden' removed during task; 'hidden' restored on finish/error; error logged

11. COVERAGE/NOTES
[ ] 11.1. verify cropping rotation paths
[ ] 11.2. verify preview compositing branch in render()
[ ] 11.3. Regression: applyCensor/mergeDown restore crop mode/canvas sizes if state.isCropping is true
[ ] 11.4. Regression: updateUI() sets undo/redo titles from ActionHistory logs and replayEngine.undoFloor

