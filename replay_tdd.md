# Replay Engine Unit Test Blueprint (replay.js)

> Scope: `scripts/replay.js` (ActionHistoryLog, KeyframeManager, ReplayEngine)
> 
> Test harness assumptions: JSDOM or equivalent DOM shim with canvas support (or mocked 2D context), fake timers for interval-based behavior, and a spyable `window.Logger`, `window.AssetManager`, `window.BrushKernel`, and rendering callbacks. Use deterministic fixtures with explicit `Date.now()` and `performance.now()` mocks.

---

## Test Fixtures & Helpers

### Shared State Fixture (`baseState`)
- **state**: 
  - `adjustments`: full object with gamma/levels/shadows/highlights/saturation/vibrance/wb/colorBal/colorTuning bands.
  - `cropRect`: `{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }`.
  - `fullDims`: `{ w: 800, h: 600 }`.
  - `rotation`: `90`.
  - `brushSettings`: `{ erase: { size: 0.1, hardness: 0.5 }, repair: { size: 0.05, hardness: 0.7 } }`.
  - `opacity`: `0.75`.
  - `isAFront`: `true`.
  - `assetIdA`: `'asset-a'`, `assetIdB`: `'asset-b'`.
  - `nameA`: `'Front'`, `nameB`: `'Back'`.
  - toggles: `maskVisible: true`, `backVisible: true`, `adjustmentsVisible: true`, `brushMode: 'erase'`, `feather: 0.1`, `featherSize: 0.05`, `featherMode: true`, `brushSize: 0.1`.
  - `settings`: `{ keyframeInterval: 3, keyframeBuffer: 2 }`.
- **maskCanvas**: HTMLCanvasElement with width/height matching `fullDims` (800x600).
- **maskCtx**: 2D context stub with spyable `getImageData`, `putImageData`, `clearRect`, `drawImage`.
- **render/updateUI/rebuildWorkingCopies**: spy functions.
- **window.AssetManager**: mock with `getAsset(id)` returning `{ source: <canvas>, width, height }`.
- **window.Logger**: mock with `info()` spy for log assertions.
- **window.BrushKernel**: mock `drawStroke`, `paintStampAt`, `paintStrokeSegment`.

### Canvas Fixtures
- `canvasA`: 400x600
- `canvasB`: 900x300
- `asset-a`: source = `canvasA`
- `asset-b`: source = `canvasB`
- `cloneCanvas` in replay.js uses `drawImage`, so ensure context exists.

### Time Mocks
- Stub `Date.now()` to return deterministic sequence.
- Stub `performance.now()` for `replayTo` timing log.

---

## ActionHistoryLog

### 1) logAction truncates future history
- **Scenario**: Logging a new action after undo (cursor not at end) truncates future entries.
- **Setup**:
  - Instantiate ActionHistoryLog.
  - Pre-populate `actions` with 3 dummy entries and set `cursor = 1`.
- **Input**: `logAction({ type: 'ADJUST', payload: { key: 'gamma', value: 1.1 } })`.
- **Expected**:
  - `actions.length === 2` before push (truncation removed index 2).
  - New entry appended at index 2.
  - `cursor === 2`.
- **Assertions**:
  - `actions` contains original indices `[0,1]` and the new entry.
  - No old index 2 entry remains.

### 2) logAction cursor updates to last index
- **Scenario**: Cursor always points at the last logged action.
- **Setup**: Empty ActionHistoryLog.
- **Input**: log three actions.
- **Expected**: `cursor === 2` after third log.
- **Assertions**: cursor value matches `actions.length - 1`.

### 3) logAction entry shape
- **Scenario**: Logged entry has correct structure and immutable-ish payload reference.
- **Setup**: Empty ActionHistoryLog, mock `Date.now()`.
- **Input**: action with `{ type: 'STROKE', payload: { points: [{ x: 0.1, y: 0.2 }] } }`.
- **Expected**:
  - Entry contains `id` (string), `timestamp` (mocked), `type`, `payload`.
  - `payload` matches input reference (no deep clone).
- **Assertions**:
  - `typeof entry.id === 'string'`.
  - `entry.timestamp === mockedNow`.
  - `entry.payload === input.payload`.

### 4) logAction logging side effects
- **Scenario**: Logger messages are emitted per action type.
- **Setup**: Provide `window.Logger.info` spy; use mock for `console.log`.
- **Inputs**:
  1. `STROKE` payload includes `mode`, `brushSize`, `feather`, `featherMode`, `points`.
  2. `ADJUST` payload includes `key`, `value`, `oldValue`.
  3. `RESET_ALL` payload empty.
- **Expected**:
  - `Logger.info` called with formatted strings containing action type and metadata.
  - `console.log` called with `[ActionHistory] Logged:` prefix.
- **Assertions**:
  - `Logger.info` receives the per-type summary string.
  - For `STROKE`, ensure point logs include `Point 0: (x, y)`.
  - `console.log` called with entry payload.

---

## KeyframeManager

### 1) createSnapshot contents
- **Scenario**: Snapshot copies state, mask data, and asset IDs.
- **Setup**: KeyframeManager with `state` fixture and maskCtx with stubbed `getImageData` returning object `{ width: 800, height: 600, data: Uint8ClampedArray(...) }`.
- **Input**: `createSnapshot()`.
- **Expected**:
  - Snapshot includes `maskData`, `adjustments`, `cropRect`, `fullDims`, `rotation`, `brushSettings`, `opacity`, `isAFront`, `assetIdA`, `assetIdB`, `nameA`, `nameB`, toggles, brush values.
- **Assertions**:
  - `snapshot.adjustments` is deep-copied (mutating original does not affect snapshot).
  - `snapshot.cropRect` is cloned.
  - `snapshot.maskData` equals the stubbed image data.

### 2) saveKeyframe buffer policy + pruneKeyframes
- **Scenario**: Buffer policy keeps base (-1) and last N keyframes.
- **Setup**:
  - `state.settings.keyframeBuffer = 2`.
  - Create keyframes at indices -1, 0, 1, 2, 3.
- **Input**: call `saveKeyframe(3)` or call `pruneKeyframes(3)` explicitly.
- **Expected**:
  - Keyframes kept: `-1`, `2`, `3`.
  - Others removed.
- **Assertions**:
  - `keyframes.has(-1)` true.
  - `keyframes.has(1)` false.
  - `keyframes.size === 3`.

### 3) invalidateFutureKeyframes
- **Scenario**: Deleting keyframes beyond current index.
- **Setup**: Keyframes at indices -1, 0, 2, 5.
- **Input**: `invalidateFutureKeyframes(1)`.
- **Expected**: indices 2 and 5 removed.
- **Assertions**: `keyframes.has(2) === false`, `keyframes.has(5) === false`.

### 4) restoreKeyframe restores state and hydrates assets
- **Scenario**: Snapshot restore repopulates simple state and mask pixels; hydrates A/B.
- **Setup**:
  - Snapshot with `assetIdA = 'asset-a'`, `assetIdB = 'asset-b'` and `maskData` for 800x600.
  - `window.AssetManager.getAsset` returns corresponding source canvases.
  - `maskCanvas` initially different size (e.g., 100x100).
- **Input**: `restoreKeyframe(snapshot)`.
- **Expected**:
  - State fields match snapshot values.
  - `imgA/imgB/sourceA/sourceB` are cloned canvases (not same reference as asset source).
  - maskCanvas resized to maskData size and pixels replaced via `putImageData`.
- **Assertions**:
  - `state.adjustments` deeply equals snapshot adjustments.
  - `state.assetIdA === 'asset-a'` and `state.imgA !== asset.source`.
  - `maskCanvas.width === snapshot.maskData.width` and `maskCtx.putImageData` called with the maskData.

### 5) restoreKeyframe handles missing assets
- **Scenario**: Missing asset should warn and clear layer data.
- **Setup**: `AssetManager.getAsset` returns null for asset id.
- **Input**: snapshot with `assetIdA = 'missing'`.
- **Expected**: `state.imgA/sourceA` null and warning emitted.
- **Assertions**: `console.warn` called with `[Replay] Missing asset ...`.

### 6) getNearestKeyframe behavior
- **Scenario**: Returns best keyframe at or before target index.
- **Setup**: keyframes at -1, 3, 7.
- **Inputs/Expected**:
  - target 0 -> returns -1.
  - target 4 -> returns 3.
  - target 9 -> returns 7.
- **Assertions**: returned object `{ index, snapshot }` matches expectations.

---

## ReplayEngine

### 1) logAction keyframe interval
- **Scenario**: Creates keyframe at interval boundary.
- **Setup**: `state.settings.keyframeInterval = 2`, ReplayEngine instance with spies on `keyframeManager.saveKeyframe`.
- **Input**: log actions to reach indices 0,1,2,3.
- **Expected**:
  - saveKeyframe called for index 0 and 2 (not for 1 or 3).
- **Assertions**: `saveKeyframe` call count and args.

### 2) undo/redo constraints + undoFloor
- **Scenario**: undo stops at undoFloor; redo stops at end.
- **Setup**:
  - Log 3 actions (cursor 2).
  - set `undoFloor = 1`.
  - Spy `replayTo`.
- **Input**: `undo()` twice, `redo()` twice.
- **Expected**:
  - First undo moves cursor to 1 and replays.
  - Second undo does nothing (cursor remains 1).
  - Redo moves cursor to 2; second redo does nothing.
- **Assertions**:
  - `replayTo` called once for undo and once for redo.
  - `history.cursor` values as expected.

### 3) clear/reset behavior
- **Scenario**: Clear resets history, keyframes, undoFloor, and updates UI.
- **Setup**: log actions and create keyframes; updateUI is spy.
- **Input**: `clear()`.
- **Expected**:
  - `history.actions` empty, `cursor = -1`.
  - keyframes cleared but base keyframe re-saved at -1.
  - `undoFloor === -1`.
  - updateUI called.
- **Assertions**: keyframe map contains `-1` only.

### 4) clear/setUndoFloor
- **Scenario**: setUndoFloor clamps to -1 and triggers UI update.
- **Setup**: updateUI spy.
- **Input**: `setUndoFloor(-5)` and `setUndoFloor(2)`.
- **Expected**:
  - `undoFloor === -1` then `2`.
  - `updateUI` invoked both times.
- **Assertions**: `updateUI` call count 2.

### 5) saveKeyframeAtCursor
- **Scenario**: Saves keyframe at current cursor including -1.
- **Setup**: cursor at -1 and at 2; spy on `keyframeManager.saveKeyframe`.
- **Input**: call `saveKeyframeAtCursor()` for each case.
- **Expected**: called with `-1` and `2`.
- **Assertions**: argument list.

### 6) replayTo ordering (restore → applyAction → rebuild/render)
- **Scenario**: Ensure replay order of operations.
- **Setup**:
  - history with actions at indices 0..2.
  - keyframe at index 0.
  - mock `keyframeManager.restoreKeyframe`, `applyAction`, `rebuildWorkingCopies`, `updateCanvasDimensionsFn`, `updateUI`, `render`.
- **Input**: `replayTo(2)`.
- **Expected call order**:
  1. `restoreKeyframe(snapshot)`
  2. `applyAction` for indices 1 and 2 (in ascending order)
  3. `rebuildWorkingCopies(true)`
  4. `updateCanvasDimensionsFn()` (if set)
  5. `updateUI()`
  6. `render()`
- **Assertions**: use call order assertions (e.g., jest `toHaveBeenCalledBefore`).

### 7) performBakeRotation transforms layers/mask/crop
- **Scenario**: Rotated state is baked into canvas dimensions and crop rect.
- **Setup**:
  - `state.rotation = 90`.
  - `state.imgA` and `state.imgB` with known sizes, `maskCanvas` with known dimensions.
  - `state.fullDims = { w: 800, h: 600 }`, `cropRect` defined.
- **Input**: `performBakeRotation()`.
- **Expected**:
  - `imgA/imgB/sourceA/sourceB` dimensions swapped (90/270 rotations).
  - mask canvas rotated and dimensions updated.
  - `state.fullDims` swapped (w=600, h=800).
  - `cropRect` rotated using `rotateRect` rules.
  - `state.rotation === 0`.
- **Assertions**: dimensions and cropRect match expected formula outputs.

### 8) applyAction: LOAD_IMAGE branch with union dims and crop defaults
- **Scenario**: Loading image recalculates union dims, resizes mask, sets cropRect.
- **Setup**:
  - Existing `imgA` present; `imgB` null.
  - `maskCanvas` initially 400x600.
  - payload: `{ type: 'LOAD_IMAGE', payload: { assetId: 'asset-b', slot: 'B' } }` where asset-b is 900x300.
- **Input**: `applyAction('LOAD_IMAGE', payload)`.
- **Expected**:
  - `performBakeRotation` invoked first (if rotation nonzero).
  - `state.assetIdB` set to asset-b; `nameB` default if none.
  - union dims from A and B: union height = max(600, 300)=600; union width = max(400, 900*2) = 1800.
  - mask resized to 1800x600 and old mask centered.
  - cropRect set to frame target image, proportions based on union height.
- **Assertions**:
  - `state.fullDims === { w: 1800, h: 600 }`.
  - `state.cropRect` equals `{ x: offX/newH, y: 0, w: visW/newH, h: 1 }` with computed values.

### 9) applyAction: MERGE_LAYERS branch (layer naming + crop fallback)
- **Scenario**: Merge sets A to merged asset, clears B, preserves crop when present.
- **Setup**:
  - payload: `{ assetId: 'asset-a' }`, type `MERGE_LAYERS`.
  - `state.cropRect` null.
- **Input**: `applyAction('MERGE_LAYERS', payload)`.
- **Expected**:
  - `state.nameA === 'Merged Layer'` when no payload name.
  - `state.imgB/sourceB/assetIdB` cleared.
  - `state.fullDims` set to asset dimensions.
  - `state.cropRect` defaulted to `{ x:0, y:0, w: asset.width/asset.height, h: 1 }`.
- **Assertions**: fields match expected.

### 10) applyAction: APPLY_CENSOR branch (layer naming + UI reset)
- **Scenario**: Censor loads into B, sets name, resets opacity/front.
- **Setup**:
  - payload: `{ assetId: 'asset-b' }`, type `APPLY_CENSOR` with no slot.
  - `state.opacity = 0.2`, `state.isAFront = false`.
- **Input**: `applyAction('APPLY_CENSOR', payload)`.
- **Expected**:
  - `slot` defaults to 'B'.
  - `state.nameB === 'Censored Layer'` when no payload name.
  - `state.fullDims` set to asset dimensions.
  - `state.cropRect` default if null.
  - `state.opacity === 1.0`, `state.isAFront === true`.
- **Assertions**: fields match expected.

### 11) applyAction branches for adjustments and toggles
- **Scenario**: Adjustment updates, tuning updates, toggles.
- **Setup**: state with clean adjustments.
- **Inputs/Expected**:
  - `ADJUST` with subkey updates nested value.
  - `TUNE_COLOR` updates band value.
  - `SET_OPACITY` sets opacity.
  - `TOGGLE_MASK/BACK/ADJUSTMENTS` update booleans.
- **Assertions**: values updated as expected.

### 12) applyAction: STROKE & POLYLINE use fullDims height proportions
- **Scenario**: Payload points converted from proportions to pixels; feather uses mode.
- **Setup**:
  - `state.fullDims.h = 1000`.
  - STROKE payload with points `[ { x: 0.1, y: 0.2 } ]`, `brushSize: 0.01`, `feather: 0.02`, `featherMode: true`.
  - POLYLINE payload with points `[ { x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 } ]`, `brushSize: 0.01`, `feather: 2`, `featherMode: false`, `mode: 'erase'`.
- **Expected**:
  - STROKE calls `drawStroke` with px size = 10, feather = 20 when featherMode true.
  - POLYLINE uses `paintStampAt` and `paintStrokeSegment` with px points.
- **Assertions**: called with exact pixel values and composite mode.

---

## Integration: ReplayEngine + Keyframes

### 1) logAction invalidates future keyframes before new action
- **Scenario**: Branching history after undo removes future keyframes.
- **Setup**:
  - Keyframes at indices -1, 2, 4; history cursor at 2.
- **Input**: `logAction({ type: 'ADJUST', payload: { key: 'gamma', value: 1.2 } })`.
- **Expected**: keyframe at 4 removed before logAction completes.
- **Assertions**: `keyframeManager.keyframes.has(4) === false`.

### 2) replayTo uses base keyframe when no other keyframes
- **Scenario**: Replay starts from base if no recent keyframe.
- **Setup**: only keyframe at -1; history length > 0.
- **Input**: `replayTo(1)`.
- **Expected**: `restoreKeyframe` called with base snapshot and `applyAction` starts at 0.
- **Assertions**: applyAction called for indices 0..1.

---

## Diagnostics & Logging

### 1) Replay timing log
- **Scenario**: replayTo logs duration.
- **Setup**: stub `performance.now()` to return 100 then 125.
- **Input**: `replayTo(0)`.
- **Expected**: `console.log` called with `took 25.0ms`.
- **Assertions**: message contains `Replay to 0` and duration.

