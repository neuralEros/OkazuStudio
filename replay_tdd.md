1. # Replay Engine Unit Test Blueprint (replay.js)
    1.1. # Scope: scripts/replay.js (ActionHistoryLog, KeyframeManager, ReplayEngine)
    1.2. # Test harness assumptions: JSDOM/equivalent DOM shim, canvas support/mocked 2D context, fake timers, spyable window.Logger, window.AssetManager, window.BrushKernel, rendering callbacks. Deterministic fixtures with explicit Date.now() and performance.now() mocks.

2. Test Fixtures & Helpers Setup
    [x] 2.1. Initialize baseState Shared State Fixture
        [x] 2.1.1. Set adjustments: full object (gamma/levels/shadows/highlights/saturation/vibrance/wb/colorBal/colorTuning bands)
        [x] 2.1.2. Set cropRect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }
        [x] 2.1.3. Set fullDims: { w: 800, h: 600 }
        [x] 2.1.4. Set rotation: 90
        [x] 2.1.5. Set brushSettings: { erase: { size: 0.1, hardness: 0.5 }, repair: { size: 0.05, hardness: 0.7 } }
        [x] 2.1.6. Set opacity: 0.75
        [x] 2.1.7. Set isAFront: true
        [x] 2.1.8. Set assetIdA: 'asset-a', assetIdB: 'asset-b'
        [x] 2.1.9. Set nameA: 'Front', nameB: 'Back'
        [x] 2.1.10. Set toggles: maskVisible: true, backVisible: true, adjustmentsVisible: true, brushMode: 'erase', feather: 0.1, featherSize: 0.05, featherMode: true, brushSize: 0.1
        [x] 2.1.11. Set settings: { keyframeInterval: 3, keyframeBuffer: 2 }
    [x] 2.2. Initialize maskCanvas: HTMLCanvasElement (800x600)
    [x] 2.3. Initialize maskCtx: 2D context stub (spies: getImageData, putImageData, clearRect, drawImage)
    [x] 2.4. Mock render, updateUI, and rebuildWorkingCopies spy functions
    [x] 2.5. Mock window.AssetManager: getAsset(id) returns { source: <canvas>, width, height }
    [x] 2.6. Mock window.Logger: info() spy
    [x] 2.7. Mock window.BrushKernel: drawStroke, paintStampAt, paintStrokeSegment
    [x] 2.8. Setup Canvas Fixtures
        [x] 2.8.1. canvasA: 400x600 (asset-a source)
        [x] 2.8.2. canvasB: 900x300 (asset-b source)
        [x] 2.8.3. Ensure context exists for cloneCanvas
    [x] 2.9. Setup Time Mocks
        [x] 2.9.1. Stub Date.now() for deterministic sequence
        [x] 2.9.2. Stub performance.now() for replayTo timing log

3. ActionHistoryLog Tests
    3.1. [x] LogAction truncates future history
        [x] 3.1.1. Setup: Instantiate ActionHistoryLog; Pre-populate actions with 3 dummy entries; set cursor = 1
        [x] 3.1.2. Input: logAction({ type: 'ADJUST', payload: { key: 'gamma', value: 1.1 } })
        [x] 3.1.3. Assert actions.length is 2 before push (truncation of index 2)
        [x] 3.1.4. Assert new entry is appended at index 2
        [x] 3.1.5. Assert cursor is 2
        [x] 3.1.6. Assert actions contains original indices [0,1] and the new entry, removing old index 2
    3.2. [x] LogAction cursor updates to last index
        [x] 3.2.1. Setup: Empty ActionHistoryLog
        [x] 3.2.2. Input: Log three actions
        [x] 3.2.3. Assert cursor is 2 (matches actions.length - 1)
    3.3. [x] LogAction entry shape
        [x] 3.3.1. Setup: Empty ActionHistoryLog, mock Date.now()
        [x] 3.3.2. Input: action with { type: 'STROKE', payload: { points: [{ x: 0.1, y: 0.2 }] } }
        [x] 3.3.3. Assert entry.id is a string
        [x] 3.3.4. Assert entry.timestamp matches mocked Date.now()
        [x] 3.3.5. Assert entry.payload matches input reference (no deep clone)
    3.4. [x] LogAction logging side effects
        [x] 3.4.1. Setup: Provide window.Logger.info spy; mock console.log
        [x] 3.4.2. Input STROKE payload (mode, brushSize, feather, featherMode, points)
        [x] 3.4.3. Input ADJUST payload (key, value, oldValue)
        [x] 3.4.4. Input RESET_ALL payload (empty)
        [x] 3.4.5. Assert Logger.info received formatted summary strings for each type
        [x] 3.4.6. Assert STROKE log includes 'Point 0: (x, y)'
        [x] 3.4.7. Assert console.log called with '[ActionHistory] Logged:' prefix and entry payload

4. KeyframeManager Tests
    4.1. [x] CreateSnapshot contents
        [x] 4.1.1. Setup: KeyframeManager with state fixture; maskCtx.getImageData stub returning { width: 800, height: 600, data: Uint8ClampedArray }
        [x] 4.1.2. Input: createSnapshot()
        [x] 4.1.3. Assert snapshot includes: maskData, adjustments, cropRect, fullDims, rotation, brushSettings, opacity, isAFront, assetIdA, assetIdB, nameA, nameB, toggles, brush values
        [x] 4.1.4. Assert snapshot.adjustments is deep-copied (mutations to original don't affect snapshot)
        [x] 4.1.5. Assert snapshot.cropRect is cloned
        [x] 4.1.6. Assert snapshot.maskData equals the stubbed image data
    4.2. [x] SaveKeyframe buffer policy + pruneKeyframes
        [x] 4.2.1. Setup: state.settings.keyframeBuffer = 2; Create keyframes at indices -1, 0, 1, 2, 3
        [x] 4.2.2. Input: call saveKeyframe(3) or pruneKeyframes(3)
        [x] 4.2.3. Assert keyframes -1, 2, and 3 are kept
        [x] 4.2.4. Assert keyframe 1 is removed
        [x] 4.2.5. Assert keyframes.size is 3
    4.3. [x] InvalidateFutureKeyframes
        [x] 4.3.1. Setup: Keyframes at indices -1, 0, 2, 5
        [x] 4.3.2. Input: invalidateFutureKeyframes(1)
        [x] 4.3.3. Assert indices 2 and 5 are removed
    4.4. [x] RestoreKeyframe restores state and hydrates assets
        [x] 4.4.1. Setup: Snapshot with assetIdA='asset-a', assetIdB='asset-b', maskData 800x600; AssetManager mocks; maskCanvas size 100x100
        [x] 4.4.2. Input: restoreKeyframe(snapshot)
        [x] 4.4.3. Assert state fields match snapshot values
        [x] 4.4.4. Assert state.adjustments deeply equals snapshot adjustments
        [x] 4.4.5. Assert imgA/imgB/sourceA/sourceB are cloned canvases (different reference than asset source)
        [x] 4.4.6. Assert maskCanvas is resized to maskData dimensions
        [x] 4.4.7. Assert maskCtx.putImageData was called with snapshot.maskData
    4.5. [x] RestoreKeyframe handles missing assets
        [x] 4.5.1. Setup: AssetManager.getAsset returns null for asset id
        [x] 4.5.2. Input: snapshot with assetIdA = 'missing'
        [x] 4.5.3. Assert state.imgA/sourceA are null
        [x] 4.5.4. Assert console.warn called with '[Replay] Missing asset ...'
    4.6. [x] GetNearestKeyframe behavior
        [x] 4.6.1. Setup: keyframes at -1, 3, 7
        [x] 4.6.2. Assert target 0 returns keyframe -1
        [x] 4.6.3. Assert target 4 returns keyframe 3
        [x] 4.6.4. Assert target 9 returns keyframe 7

5. ReplayEngine Tests
    5.1. [x] LogAction keyframe interval
        [x] 5.1.1. Setup: state.settings.keyframeInterval = 2; Spy on keyframeManager.saveKeyframe
        [x] 5.1.2. Input: log actions to reach indices 0, 1, 2, 3
        [x] 5.1.3. Assert saveKeyframe called for index 0 and 2
        [x] 5.1.4. Assert saveKeyframe NOT called for index 1 or 3
    5.2. [x] Undo/Redo constraints + undoFloor
        [x] 5.2.1. Setup: Log 3 actions (cursor 2); set undoFloor = 1; spy replayTo
        [x] 5.2.2. Input: undo() twice
        [x] 5.2.3. Assert first undo moves cursor to 1 and replays
        [x] 5.2.4. Assert second undo does nothing (cursor remains 1)
        [x] 5.2.5. Input: redo() twice
        [x] 5.2.6. Assert first redo moves cursor to 2 and replays
        [x] 5.2.7. Assert second redo does nothing
        [x] 5.2.8. Assert replayTo called exactly once for valid undo and once for valid redo
    5.3. [x] Clear/Reset behavior
        [x] 5.3.1. Setup: Log actions and create keyframes; spy updateUI
        [x] 5.3.2. Input: clear()
        [x] 5.3.3. Assert history.actions is empty, cursor is -1
        [x] 5.3.4. Assert keyframes cleared but base keyframe re-saved at -1
        [x] 5.3.5. Assert undoFloor is -1
        [x] 5.3.6. Assert updateUI called
    5.4. [x] Clear/setUndoFloor
        [x] 5.4.1. Setup: spy updateUI
        [x] 5.4.2. Input: setUndoFloor(-5) then setUndoFloor(2)
        [x] 5.4.3. Assert undoFloor is clamped to -1 after first call
        [x] 5.4.4. Assert undoFloor is 2 after second call
        [x] 5.4.5. Assert updateUI call count is 2
    5.5. [x] SaveKeyframeAtCursor
        [x] 5.5.1. Setup: cursor at -1, then at 2; spy keyframeManager.saveKeyframe
        [x] 5.5.2. Input: call saveKeyframeAtCursor() at each cursor position
        [x] 5.5.3. Assert saveKeyframe called with -1 and 2 respectively
    5.6. [x] ReplayTo ordering (restore -> applyAction -> rebuild/render)
        [x] 5.6.1. Setup: history with actions 0-2; keyframe at 0; mock restoreKeyframe, applyAction, rebuildWorkingCopies, updateCanvasDimensionsFn, updateUI, render
        [x] 5.6.2. Input: replayTo(2)
        [x] 5.6.3. Assert restoreKeyframe(snapshot) called first
        [x] 5.6.4. Assert applyAction called for indices 1 and 2 in ascending order
        [x] 5.6.5. Assert rebuildWorkingCopies(true) called after actions
        [x] 5.6.6. Assert updateCanvasDimensionsFn() called (if set)
        [x] 5.6.7. Assert updateUI() called
        [x] 5.6.8. Assert render() called last
    5.7. [x] PerformBakeRotation transforms layers/mask/crop
        [x] 5.7.1. Setup: state.rotation = 90; state.fullDims = { w: 800, h: 600 }; Define cropRect; imgA/imgB/maskCanvas with known sizes
        [x] 5.7.2. Input: performBakeRotation()
        [x] 5.7.3. Assert imgA, imgB, sourceA, sourceB dimensions are swapped
        [x] 5.7.4. Assert mask canvas is rotated and dimensions updated
        [x] 5.7.5. Assert state.fullDims is swapped (w=600, h=800)
        [x] 5.7.6. Assert cropRect is rotated per rotateRect rules
        [x] 5.7.7. Assert state.rotation is reset to 0
    5.8. [x] ApplyAction: LOAD_IMAGE branch with union dims and crop defaults
        [x] 5.8.1. Setup: Existing imgA; imgB null; maskCanvas 400x600; payload { assetId: 'asset-b', slot: 'B' } (asset-b is 900x300)
        [x] 5.8.2. Input: applyAction('LOAD_IMAGE', payload)
        [x] 5.8.3. Assert performBakeRotation invoked if rotation was nonzero
        [x] 5.8.4. Assert state.assetIdB is set to asset-b; nameB uses default if none
        [x] 5.8.5. Assert union height = max(600, 300) = 600
        [x] 5.8.6. Assert union width = max(400, 900*2) = 1800
        [x] 5.8.7. Assert state.fullDims is { w: 1800, h: 600 }
        [x] 5.8.8. Assert mask resized to 1800x600 and old mask contents centered
        [x] 5.8.9. Assert state.cropRect set to frame target image with proportions based on union height
    5.9. [x] ApplyAction: MERGE_LAYERS branch (layer naming + crop fallback)
        [x] 5.9.1. Setup: payload { assetId: 'asset-a' }; type MERGE_LAYERS; state.cropRect is null
        [x] 5.9.2. Input: applyAction('MERGE_LAYERS', payload)
        [x] 5.9.3. Assert state.nameA is 'Merged Layer' (default)
        [x] 5.9.4. Assert state.imgB, sourceB, and assetIdB are cleared
        [x] 5.9.5. Assert state.fullDims matches asset dimensions
        [x] 5.9.6. Assert state.cropRect defaulted to { x: 0, y: 0, w: asset.width/asset.height, h: 1 }
    5.10. [x] ApplyAction: APPLY_CENSOR branch (layer naming + UI reset)
        [x] 5.10.1. Setup: payload { assetId: 'asset-b' }; type APPLY_CENSOR; no slot; state.opacity = 0.2; state.isAFront = false
        [x] 5.10.2. Input: applyAction('APPLY_CENSOR', payload)
        [x] 5.10.3. Assert slot defaults to 'B'
        [x] 5.10.4. Assert state.nameB is 'Censored Layer' (default)
        [x] 5.10.5. Assert state.fullDims set to asset dimensions
        [x] 5.10.6. Assert state.cropRect default assigned if null
        [x] 5.10.7. Assert state.opacity is reset to 1.0
        [x] 5.10.8. Assert state.isAFront is reset to true
    5.11. [x] ApplyAction branches for adjustments and toggles
        [x] 5.11.1. Setup: Clean adjustment state
        [x] 5.11.2. Input ADJUST: Assert subkey update affects nested value
        [x] 5.11.3. Input TUNE_COLOR: Assert band value update
        [x] 5.11.4. Input SET_OPACITY: Assert opacity update
        [x] 5.11.5. Input TOGGLE_MASK/BACK/ADJUSTMENTS: Assert boolean updates
    5.12. [x] ApplyAction: STROKE & POLYLINE use fullDims height proportions
        [x] 5.12.1. Setup: state.fullDims.h = 1000
        [x] 5.12.2. Input STROKE: payload { points: [ { x: 0.1, y: 0.2 } ], brushSize: 0.01, feather: 0.02, featherMode: true }
        [x] 5.12.3. Input POLYLINE: payload { points: [ { x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 } ], brushSize: 0.01, feather: 2, featherMode: false, mode: 'erase' }
        [x] 5.12.4. Assert STROKE calls drawStroke with px size = 10, feather = 20
        [x] 5.12.5. Assert POLYLINE calls paintStampAt and paintStrokeSegment with pixel-converted points and composite mode

6. Integration: ReplayEngine + Keyframes
    6.1. [x] LogAction invalidates future keyframes before new action
        [x] 6.1.1. Setup: Keyframes at -1, 2, 4; history cursor at 2
        [x] 6.1.2. Input: logAction({ type: 'ADJUST', payload: { key: 'gamma', value: 1.2 } })
        [x] 6.1.3. Assert keyframe at 4 is removed before logging completes
    6.2. [x] ReplayTo uses base keyframe when no other keyframes
        [x] 6.2.1. Setup: keyframe at -1 only; history length > 0
        [x] 6.2.2. Input: replayTo(1)
        [x] 6.2.3. Assert restoreKeyframe called with base snapshot
        [x] 6.2.4. Assert applyAction starts at index 0 and proceeds to 1

7. Diagnostics & Logging
    7.1. [x] Replay timing log
        [x] 7.1.1. Setup: stub performance.now() to return 100 then 125
        [x] 7.1.2. Input: replayTo(0)
        [x] 7.1.3. Assert console.log called with 'took 25.0ms'
        [x] 7.1.4. Assert log message contains 'Replay to 0'

