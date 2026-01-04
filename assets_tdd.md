# AssetManager Unit Test Blueprint

## Scope
These tests cover `scripts/assets.js` for the `AssetManager` class exposed as `window.AssetManager`. The focus is on deterministic behavior of asset tracking, metadata capture, and map operations.

## Test Environment
- **Framework**: Jest (or Mocha + Chai) with JSDOM.
- **Clock control**: Use fake timers or stub `Date.now()` for deterministic IDs/timestamps.
- **Source types**:
  - **Image**: stub with `naturalWidth`/`naturalHeight`.
  - **Canvas**: stub with `width`/`height` only.
  - **ImageBitmap**: stub with `width`/`height` only.
- **Global**: Ensure `window.AssetManager` is recreated per test or reset via `clear()`.

## Test Data Fixtures
1. **Stub Image**
   - `source = { naturalWidth: 640, naturalHeight: 480, width: 10, height: 10 }`
   - Expect width/height to resolve from `naturalWidth`/`naturalHeight`.
2. **Stub Canvas**
   - `source = { width: 800, height: 600 }`
   - No `naturalWidth`/`naturalHeight`.
3. **Stub ImageBitmap**
   - `source = { width: 1920, height: 1080 }`
   - No `naturalWidth`/`naturalHeight`.

## Tests for `AssetManager.addAsset`

### 1. Null/Undefined Sources Return `null`
**Scenario:** Adding a missing or falsy source should return `null` and avoid map insertion.

**Setup:**
1. `AssetManager.clear()`.
2. Stub `Date.now()` to a fixed value (e.g., `1700000000000`).

**Inputs:**
1. `addAsset(null, 'Ignored')`
2. `addAsset(undefined, 'Ignored')`

**Expected Output:**
- Each call returns `null`.
- `assets.size` remains `0`.

**Exact Assertions:**
1. `expect(manager.addAsset(null, 'Ignored')).toBeNull()`
2. `expect(manager.addAsset(undefined, 'Ignored')).toBeNull()`
3. `expect(manager.assets.size).toBe(0)`

### 2. Image vs Canvas vs ImageBitmap Width/Height Resolution
**Scenario:** Width/height should resolve from `naturalWidth`/`naturalHeight` for Image; fallback to `width`/`height` for Canvas/ImageBitmap.

**Setup:**
1. `AssetManager.clear()`.
2. Stub `Date.now()` to fixed values per call.

**Inputs:**
1. `addAsset(imageStub, 'Image Asset')`
2. `addAsset(canvasStub, 'Canvas Asset')`
3. `addAsset(bitmapStub, 'Bitmap Asset')`

**Expected Output:**
- Image asset uses `640x480` (natural sizes).
- Canvas asset uses `800x600`.
- Bitmap asset uses `1920x1080`.

**Exact Assertions:**
1. `const imgId = manager.addAsset(imageStub, 'Image Asset')`
2. `const imgAsset = manager.getAsset(imgId)`
3. `expect(imgAsset.width).toBe(640)`
4. `expect(imgAsset.height).toBe(480)`
5. `const canvasId = manager.addAsset(canvasStub, 'Canvas Asset')`
6. `expect(manager.getAsset(canvasId).width).toBe(800)`
7. `expect(manager.getAsset(canvasId).height).toBe(600)`
8. `const bmpId = manager.addAsset(bitmapStub, 'Bitmap Asset')`
9. `expect(manager.getAsset(bmpId).width).toBe(1920)`
10. `expect(manager.getAsset(bmpId).height).toBe(1080)`

### 3. Default Naming When `name` Is Omitted
**Scenario:** If `name` is falsy/undefined, default should be `'Untitled'`.

**Setup:**
1. `AssetManager.clear()`.

**Inputs:**
1. `addAsset(canvasStub)`
2. `addAsset(canvasStub, '')`

**Expected Output:**
- The stored asset `name` should be `'Untitled'` for both calls.

**Exact Assertions:**
1. `const id1 = manager.addAsset(canvasStub)`
2. `expect(manager.getAsset(id1).name).toBe('Untitled')`
3. `const id2 = manager.addAsset(canvasStub, '')`
4. `expect(manager.getAsset(id2).name).toBe('Untitled')`

### 4. Timestamp Presence and Determinism
**Scenario:** Asset timestamp must exist and match `Date.now()` at creation.

**Setup:**
1. `AssetManager.clear()`.
2. Stub `Date.now()` to return `1700000001234`.

**Inputs:**
1. `addAsset(canvasStub, 'Timed Asset')`

**Expected Output:**
- `asset.timestamp === 1700000001234`.

**Exact Assertions:**
1. `const id = manager.addAsset(canvasStub, 'Timed Asset')`
2. `expect(manager.getAsset(id).timestamp).toBe(1700000001234)`

### 5. ID Uniqueness Across Calls
**Scenario:** IDs are unique per call even with identical inputs.

**Setup:**
1. `AssetManager.clear()`.
2. Stub `Date.now()` to fixed time (same value across calls) to force uniqueness to rely on random suffix.

**Inputs:**
1. `addAsset(canvasStub, 'One')`
2. `addAsset(canvasStub, 'Two')`

**Expected Output:**
- IDs differ.

**Exact Assertions:**
1. `const id1 = manager.addAsset(canvasStub, 'One')`
2. `const id2 = manager.addAsset(canvasStub, 'Two')`
3. `expect(id1).not.toBe(id2)`

### 6. Correct Map Insertion and Return ID
**Scenario:** Returned ID must reference stored asset in map.

**Setup:**
1. `AssetManager.clear()`.

**Inputs:**
1. `const id = addAsset(canvasStub, 'Stored Asset')`

**Expected Output:**
- `assets.has(id) === true`.
- `getAsset(id).id === id`.

**Exact Assertions:**
1. `expect(manager.assets.has(id)).toBe(true)`
2. `expect(manager.getAsset(id).id).toBe(id)`

## Tests for `getAsset`

### 7. Returns Stored Asset by ID
**Scenario:** Should retrieve stored asset object.

**Setup:**
1. `AssetManager.clear()`.
2. Add a known asset.

**Inputs:**
1. `const id = addAsset(canvasStub, 'Find Me')`
2. `getAsset(id)`

**Expected Output:**
- Returned object matches stored asset (same reference).

**Exact Assertions:**
1. `const asset = manager.getAsset(id)`
2. `expect(asset).toBe(manager.assets.get(id))`
3. `expect(asset.name).toBe('Find Me')`

### 8. Undefined for Missing IDs
**Scenario:** Missing ID returns `undefined`.

**Setup:**
1. `AssetManager.clear()`.

**Inputs:**
1. `getAsset('missing')`

**Expected Output:**
- `undefined`.

**Exact Assertions:**
1. `expect(manager.getAsset('missing')).toBeUndefined()`

## Tests for `removeAsset`

### 9. Returns True on Successful Deletion
**Scenario:** Removing an existing ID should return `true` and reduce map size.

**Setup:**
1. `AssetManager.clear()`.
2. Add two assets.

**Inputs:**
1. `removeAsset(id1)`

**Expected Output:**
- `true` returned.
- `assets.has(id1) === false`.
- `assets.size` reduced by 1.

**Exact Assertions:**
1. `const sizeBefore = manager.assets.size`
2. `expect(manager.removeAsset(id1)).toBe(true)`
3. `expect(manager.assets.has(id1)).toBe(false)`
4. `expect(manager.assets.size).toBe(sizeBefore - 1)`

### 10. Returns False When ID Missing
**Scenario:** Removing unknown ID should return `false` and not change size.

**Setup:**
1. `AssetManager.clear()`.
2. Add one asset.

**Inputs:**
1. `removeAsset('missing')`

**Expected Output:**
- `false` returned.
- `assets.size` unchanged.

**Exact Assertions:**
1. `const sizeBefore = manager.assets.size`
2. `expect(manager.removeAsset('missing')).toBe(false)`
3. `expect(manager.assets.size).toBe(sizeBefore)`

## Tests for `clear`

### 11. Empties Map
**Scenario:** Clear should remove all entries.

**Setup:**
1. `AssetManager.clear()`.
2. Add multiple assets.

**Inputs:**
1. `clear()`

**Expected Output:**
- `assets.size === 0`.

**Exact Assertions:**
1. `manager.clear()`
2. `expect(manager.assets.size).toBe(0)`

### 12. Repeated Clear Calls Are Safe
**Scenario:** Calling clear multiple times should not throw and remain empty.

**Setup:**
1. `AssetManager.clear()`.

**Inputs:**
1. `clear()` twice.

**Expected Output:**
- `assets.size === 0` after each call.

**Exact Assertions:**
1. `manager.clear()`
2. `expect(manager.assets.size).toBe(0)`
3. `manager.clear()`
4. `expect(manager.assets.size).toBe(0)`
