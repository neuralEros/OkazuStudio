1. # Replay Engine Unit Test Blueprint (replay.js)
    1.1. # Scope: scripts/replay.js (ActionHistoryLog, KeyframeManager, ReplayEngine)
    1.2. # Test harness assumptions: JSDOM/equivalent DOM shim, canvas support/mocked 2D context, fake timers, spyable window.Logger, window.AssetManager, window.BrushKernel, rendering callbacks. Deterministic fixtures with explicit Date.now() and performance.now() mocks.

2. Test Fixtures & Helpers Setup
    [ ] 2.1. Initialize baseState Shared State Fixture
        [ ] 2.1.1. Set adjustments: full object (gamma/levels/shadows/highlights/saturation/vibrance/wb/colorBal/colorTuning bands)
        [ ] 2.1.2. Set cropRect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }
        [ ] 2.1.3. Set fullDims: { w: 800, h: 600 }
        [ ] 2.1.4. Set rotation: 90
        [ ] 2.1.5. Set brushSettings: { erase: { size: 0.1, hardness: 0.5 }, repair: { size: 0.05, hardness: 0.7 } }
        [ ] 2.1.6. Set opacity: 0.75
        [ ] 2.1.7. Set isAFront: true
        [ ] 2.1.8. Set assetIdA: 'asset-a', assetIdB: 'asset-b'
        [ ] 2.1.9. Set nameA: 'Front', nameB: 'Back'
        [ ] 2.1.10. Set toggles: maskVisible: true, backVisible: true, adjustmentsVisible: true, brushMode: 'erase', feather: 0.1, featherSize: 0.05, featherMode: true, brushSize: 0.1
        [ ] 2.1.11. Set settings: { keyframeInterval: 3, keyframeBuffer: 2 }
    [ ] 2.2. Initialize maskCanvas: HTMLCanvasElement (800x600)
    [ ] 2.3. Initialize maskCtx: 2D context stub (spies: getImageData, putImageData, clearRect, drawImage)
    [ ] 2.4. Mock render, updateUI, and rebuildWorkingCopies spy functions
    [ ] 2.5. Mock window.AssetManager: getAsset(id) returns { source: <canvas>, width, height }
    [ ] 2.6. Mock window.Logger: info() spy
    [ ] 2.7. Mock window.BrushKernel: drawStroke, paintStampAt, paintStrokeSegment
    [ ] 2.8. Setup Canvas Fixtures
        [ ] 2.8.1. canvasA: 400x600 (asset-a source)
        [ ] 2.8.2. canvasB: 900x300 (asset-b source)
        [ ] 2.8.3. Ensure context exists for cloneCanvas
    [ ] 2.9. Setup Time Mocks
        [ ] 2.9.1. Stub Date.now() for deterministic sequence
        [ ] 2.9.2. Stub performance.now() for replayTo timing log

3. ActionHistoryLog Tests
    3.1. [ ] LogAction truncates future history
        [ ] 3.1.1. Setup: Instantiate ActionHistoryLog; Pre-populate actions with 3 dummy entries; set cursor = 1
        [ ] 3.1.2. Input: logAction({ type: 'ADJUST', payload: { key: 'gamma', value: 1.1 } })
        [ ] 3.1.3. Assert actions.length is 2 before push (truncation of index 2)
        [ ] 3.1.4. Assert new entry is appended at index 2
        [ ] 3.1.5. Assert cursor is 2
        [ ] 3.1.6. Assert actions contains original indices [0,1] and the new entry, removing old index 2
    3.2. [ ] LogAction cursor updates to last index
        [ ] 3.2.1. Setup: Empty ActionHistoryLog
        [ ] 3.2.2. Input: Log three actions
        [ ] 3.2.3. Assert cursor is 2 (matches actions.length - 1)
    3.3. [ ] LogAction entry shape
        [ ] 3.3.1. Setup: Empty ActionHistoryLog, mock Date.now()
        [ ] 3.3.2. Input: action with { type: 'STROKE', payload: { points: [{ x: 0.1, y: 0.2 }] } }
        [ ] 3.3.3. Assert entry.id is a string
        [ ] 3.3.4. Assert entry.timestamp matches mocked Date.now()
        [ ] 3.3.5. Assert entry.payload matches input reference (no deep clone)
    3.4. [ ] LogAction logging side effects
        [ ] 3.4.1. Setup: Provide window.Logger.info spy; mock console.log
        [ ] 3.4.2. Input STROKE payload (mode, brushSize, feather, featherMode, points)
        [ ] 3.4.3. Input ADJUST payload (key, value, oldValue)
        [ ] 3.4.4. Input RESET_ALL payload (empty)
        [ ] 3.4.5. Assert Logger.info received formatted summary strings for each type
        [ ] 3.4.6. Assert STROKE log includes 'Point 0: (x, y)'
        [ ] 3.4.7. Assert console.log called with '[ActionHistory] Logged:' prefix and entry payload

4. KeyframeManager Tests
    4.1. [ ] CreateSnapshot contents
        [ ] 4.1.1. Setup: KeyframeManager with state fixture; maskCtx.getImageData stub returning { width: 800, height: 600, data: Uint8ClampedArray }
        [ ] 4.1.2. Input: createSnapshot()
        [ ] 4.1.3. Assert snapshot includes: maskData, adjustments, cropRect, fullDims, rotation, brushSettings, opacity, isAFront, assetIdA, assetIdB, nameA, nameB, toggles, brush values
        [ ] 4.1.4. Assert snapshot.adjustments is deep-copied (mutations to original don't affect snapshot)
        [ ] 4.1.5. Assert snapshot.cropRect is cloned
        [ ] 4.1.6. Assert snapshot.maskData equals the stubbed image data
    4.2. [ ] SaveKeyframe buffer policy + pruneKeyframes
        [ ] 4.2.1. Setup: state.settings.keyframeBuffer = 2; Create keyframes at indices -1, 0, 1, 2, 3
        [ ] 4.2.2. Input: call saveKeyframe(3) or pruneKeyframes(3)
        [ ] 4.2.3. Assert keyframes -1, 2, and 3 are kept
        [ ] 4.2.4. Assert keyframe 1 is removed
        [ ] 4.2.5. Assert keyframes.size is 3
    4.3. [ ] InvalidateFutureKeyframes
        [ ] 4.3.1. Setup: Keyframes at indices -1, 0, 2, 5
        [ ] 4.3.2. Input: invalidateFutureKeyframes(1)
        [ ] 4.3.3. Assert indices 2 and 5 are removed
    4.4. [ ] RestoreKeyframe restores state and hydrates assets
        [ ] 4.4.1. Setup: Snapshot with assetIdA='asset-a', assetIdB='asset-b', maskData 800x600; AssetManager mocks; maskCanvas size 100x100
        [ ] 4.4.2. Input: restoreKeyframe(snapshot)
        [ ] 4.4.3. Assert state fields match snapshot values
        [ ] 4.4.4. Assert state.adjustments deeply equals snapshot adjustments
        [ ] 4.4.5. Assert imgA/imgB/sourceA/sourceB are cloned canvases (different reference than asset source)
        [ ] 4.4.6. Assert maskCanvas is resized to maskData dimensions
        [ ] 4.4.7. Assert maskCtx.putImageData was called with snapshot.maskData
    4.5. [ ] RestoreKeyframe handles missing assets
        [ ] 4.5.1. Setup: AssetManager.getAsset returns null for asset id
        [ ] 4.5.2. Input: snapshot with assetIdA = 'missing'
        [ ] 4.5.3. Assert state.imgA/sourceA are null
        [ ] 4.5.4. Assert console.warn called with '[Replay] Missing asset ...'
    4.6. [ ] GetNearestKeyframe behavior
        [ ] 4.6.1. Setup: keyframes at -1, 3, 7
        [ ] 4.6.2. Assert target 0 returns keyframe -1
        [ ] 4.6.3. Assert target 4 returns keyframe 3
        [ ] 4.6.4. Assert target 9 returns keyframe 7

5. ReplayEngine Tests
    5.1. [ ] LogAction keyframe interval
        [ ] 5.1.1. Setup: state.settings.keyframeInterval = 2; Spy on keyframeManager.saveKeyframe
        [ ] 5.1.2. Input: log actions to reach indices 0, 1, 2, 3
        [ ] 5.1.3. Assert saveKeyframe called for index 0 and 2
        [ ] 5.1.4. Assert saveKeyframe NOT called for index 1 or 3
    5.2. [ ] Undo/Redo constraints + undoFloor
        [ ] 5.2.1. Setup: Log 3 actions (cursor 2); set undoFloor = 1; spy replayTo
        [ ] 5.2.2. Input: undo() twice
        [ ] 5.2.3. Assert first undo moves cursor to 1 and replays
        [ ] 5.2.4. Assert second undo does nothing (cursor remains 1)
        [ ] 5.2.5. Input: redo() twice
        [ ] 5.2.6. Assert first redo moves cursor to 2 and replays
        [ ] 5.2.7. Assert second redo does nothing
        [ ] 5.2.8. Assert replayTo called exactly once for valid undo and once for valid redo
    5.3. [ ] Clear/Reset behavior
        [ ] 5.3.1. Setup: Log actions and create keyframes; spy updateUI
        [ ] 5.3.2. Input: clear()
        [ ] 5.3.3. Assert history.actions is empty, cursor is -1
        [ ] 5.3.4. Assert keyframes cleared but base keyframe re-saved at -1
        [ ] 5.3.5. Assert undoFloor is -1
        [ ] 5.3.6. Assert updateUI called
    5.4. [ ] Clear/setUndoFloor
        [ ] 5.4.1. Setup: spy updateUI
        [ ] 5.4.2. Input: setUndoFloor(-5) then setUndoFloor(2)
        [ ] 5.4.3. Assert undoFloor is clamped to -1 after first call
        [ ] 5.4.4. Assert undoFloor is 2 after second call
        [ ] 5.4.5. Assert updateUI call count is 2
    5.5. [ ] SaveKeyframeAtCursor
        [ ] 5.5.1. Setup: cursor at -1, then at 2; spy keyframeManager.saveKeyframe
        [ ] 5.5.2. Input: call saveKeyframeAtCursor() at each cursor position
        [ ] 5.5.3. Assert saveKeyframe called with -1 and 2 respectively
    5.6. [ ] ReplayTo ordering (restore -> applyAction -> rebuild/render)
        [ ] 5.6.1. Setup: history with actions 0-2; keyframe at 0; mock restoreKeyframe, applyAction, rebuildWorkingCopies, updateCanvasDimensionsFn, updateUI, render
        [ ] 5.6.2. Input: replayTo(2)
        [ ] 5.6.3. Assert restoreKeyframe(snapshot) called first
        [ ] 5.6.4. Assert applyAction called for indices 1 and 2 in ascending order
        [ ] 5.6.5. Assert rebuildWorkingCopies(true) called after actions
        [ ] 5.6.6. Assert updateCanvasDimensionsFn() called (if set)
        [ ] 5.6.7. Assert updateUI() called
        [ ] 5.6.8. Assert render() called last
    5.7. [ ] PerformBakeRotation transforms layers/mask/crop
        [ ] 5.7.1. Setup: state.rotation = 90; state.fullDims = { w: 800, h: 600 }; Define cropRect; imgA/imgB/maskCanvas with known sizes
        [ ] 5.7.2. Input: performBakeRotation()
        [ ] 5.7.3. Assert imgA, imgB, sourceA, sourceB dimensions are swapped
        [ ] 5.7.4. Assert mask canvas is rotated and dimensions updated
        [ ] 5.7.5. Assert state.fullDims is swapped (w=600, h=800)
        [ ] 5.7.6. Assert cropRect is rotated per rotateRect rules
        [ ] 5.7.7. Assert state.rotation is reset to 0
    5.8. [ ] ApplyAction: LOAD_IMAGE branch with union dims and crop defaults
        [ ] 5.8.1. Setup: Existing imgA; imgB null; maskCanvas 400x600; payload { assetId: 'asset-b', slot: 'B' } (asset-b is 900x300)
        [ ] 5.8.2. Input: applyAction('LOAD_IMAGE', payload)
        [ ] 5.8.3. Assert performBakeRotation invoked if rotation was nonzero
        [ ] 5.8.4. Assert state.assetIdB is set to asset-b; nameB uses default if none
        [ ] 5.8.5. Assert union height = max(600, 300) = 600
        [ ] 5.8.6. Assert union width = max(400, 900*2) = 1800
        [ ] 5.8.7. Assert state.fullDims is { w: 1800, h: 600 }
        [ ] 5.8.8. Assert mask resized to 1800x600 and old mask contents centered
        [ ] 5.8.9. Assert state.cropRect set to frame target image with proportions based on union height
    5.9. [ ] ApplyAction: MERGE_LAYERS branch (layer naming + crop fallback)
        [ ] 5.9.1. Setup: payload { assetId: 'asset-a' }; type MERGE_LAYERS; state.cropRect is null
        [ ] 5.9.2. Input: applyAction('MERGE_LAYERS', payload)
        [ ] 5.9.3. Assert state.nameA is 'Merged Layer' (default)
        [ ] 5.9.4. Assert state.imgB, sourceB, and assetIdB are cleared
        [ ] 5.9.5. Assert state.fullDims matches asset dimensions
        [ ] 5.9.6. Assert state.cropRect defaulted to { x: 0, y: 0, w: asset.width/asset.height, h: 1 }
    5.10. [ ] ApplyAction: APPLY_CENSOR branch (layer naming + UI reset)
        [ ] 5.10.1. Setup: payload { assetId: 'asset-b' }; type APPLY_CENSOR; no slot; state.opacity = 0.2; state.isAFront = false
        [ ] 5.10.2. Input: applyAction('APPLY_CENSOR', payload)
        [ ] 5.10.3. Assert slot defaults to 'B'
        [ ] 5.10.4. Assert state.nameB is 'Censored Layer' (default)
        [ ] 5.10.5. Assert state.fullDims set to asset dimensions
        [ ] 5.10.6. Assert state.cropRect default assigned if null
        [ ] 5.10.7. Assert state.opacity is reset to 1.0
        [ ] 5.10.8. Assert state.isAFront is reset to true
    5.11. [ ] ApplyAction branches for adjustments and toggles
        [ ] 5.11.1. Setup: Clean adjustment state
        [ ] 5.11.2. Input ADJUST: Assert subkey update affects nested value
        [ ] 5.11.3. Input TUNE_COLOR: Assert band value update
        [ ] 5.11.4. Input SET_OPACITY: Assert opacity update
        [ ] 5.11.5. Input TOGGLE_MASK/BACK/ADJUSTMENTS: Assert boolean updates
    5.12. [ ] ApplyAction: STROKE & POLYLINE use fullDims height proportions
        [ ] 5.12.1. Setup: state.fullDims.h = 1000
        [ ] 5.12.2. Input STROKE: payload { points: [ { x: 0.1, y: 0.2 } ], brushSize: 0.01, feather: 0.02, featherMode: true }
        [ ] 5.12.3. Input POLYLINE: payload { points: [ { x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 } ], brushSize: 0.01, feather: 2, featherMode: false, mode: 'erase' }
        [ ] 5.12.4. Assert STROKE calls drawStroke with px size = 10, feather = 20
        [ ] 5.12.5. Assert POLYLINE calls paintStampAt and paintStrokeSegment with pixel-converted points and composite mode

6. Integration: ReplayEngine + Keyframes
    6.1. [ ] LogAction invalidates future keyframes before new action
        [ ] 6.1.1. Setup: Keyframes at -1, 2, 4; history cursor at 2
        [ ] 6.1.2. Input: logAction({ type: 'ADJUST', payload: { key: 'gamma', value: 1.2 } })
        [ ] 6.1.3. Assert keyframe at 4 is removed before logging completes
    6.2. [ ] ReplayTo uses base keyframe when no other keyframes
        [ ] 6.2.1. Setup: keyframe at -1 only; history length > 0
        [ ] 6.2.2. Input: replayTo(1)
        [ ] 6.2.3. Assert restoreKeyframe called with base snapshot
        [ ] 6.2.4. Assert applyAction starts at index 0 and proceeds to 1

7. Diagnostics & Logging
    7.1. [ ] Replay timing log
        [ ] 7.1.1. Setup: stub performance.now() to return 100 then 125
        [ ] 7.1.2. Input: replayTo(0)
        [ ] 7.1.3. Assert console.log called with 'took 25.0ms'
        [ ] 7.1.4. Assert log message contains 'Replay to 0'

