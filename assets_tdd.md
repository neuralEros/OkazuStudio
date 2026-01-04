# AssetManager Unit Test Blueprint
# Scope: These tests cover `scripts/assets.js` for the `AssetManager` class exposed as `window.AssetManager`.
# Focus: Deterministic behavior of asset tracking, metadata capture, and map operations.

[ ] 1. Test Environment Setup
    [ ] 1.1. Framework Configuration: Use Jest (or Mocha + Chai) with JSDOM.
    [ ] 1.2. Clock Control: Use fake timers or stub `Date.now()` for deterministic IDs/timestamps.
    [ ] 1.3. Source Type Stubs:
        [ ] 1.3.1. Image: Stub with `naturalWidth` and `naturalHeight`.
        [ ] 1.3.2. Canvas: Stub with `width` and `height` only.
        [ ] 1.3.3. ImageBitmap: Stub with `width` and `height` only.
    [ ] 1.4. Global State: Ensure `window.AssetManager` is recreated per test or reset via `clear()`.

[ ] 2. Test Data Fixtures Preparation
    [ ] 2.1. Stub Image Fixture
        # source = { naturalWidth: 640, naturalHeight: 480, width: 10, height: 10 }
        # Expectation: width/height must resolve from naturalWidth/naturalHeight.
    [ ] 2.2. Stub Canvas Fixture
        # source = { width: 800, height: 600 }
        # Specification: No naturalWidth/naturalHeight.
    [ ] 2.3. Stub ImageBitmap Fixture
        # source = { width: 1920, height: 1080 }
        # Specification: No naturalWidth/naturalHeight.

[ ] 3. AssetManager.addAsset Testing
    [ ] 3.1. Scenario 1: Null/Undefined Sources Return null
        # Goal: Adding a missing or falsy source should return null and avoid map insertion.
        [ ] 3.1.1. Setup: Call `AssetManager.clear()`.
        [ ] 3.1.2. Setup: Stub `Date.now()` to fixed value `1700000000000`.
        [ ] 3.1.3. Execution: Call `addAsset(null, 'Ignored')`.
        [ ] 3.1.4. Execution: Call `addAsset(undefined, 'Ignored')`.
        [ ] 3.1.5. Assertion: Confirm each call returns `null`.
        [ ] 3.1.6. Assertion: Confirm `assets.size` remains `0`.
    [ ] 3.2. Scenario 2: Image vs Canvas vs ImageBitmap Width/Height Resolution
        # Goal: Width/height should resolve from naturalWidth/naturalHeight for Image; fallback to width/height for Canvas/ImageBitmap.
        [ ] 3.2.1. Setup: Call `AssetManager.clear()`.
        [ ] 3.2.2. Setup: Stub `Date.now()` to fixed values per call.
        [ ] 3.2.3. Execution: Add Image asset (`imageStub`, 'Image Asset').
        [ ] 3.2.4. Execution: Add Canvas asset (`canvasStub`, 'Canvas Asset').
        [ ] 3.2.5. Execution: Add Bitmap asset (`bitmapStub`, 'Bitmap Asset').
        [ ] 3.2.6. Assertion: Confirm Image asset uses `640x480` (natural sizes).
        [ ] 3.2.7. Assertion: Confirm Canvas asset uses `800x600`.
        [ ] 3.2.8. Assertion: Confirm Bitmap asset uses `1920x1080`.
    [ ] 3.3. Scenario 3: Default Naming When name Is Omitted
        # Goal: If name is falsy/undefined, default should be 'Untitled'.
        [ ] 3.3.1. Setup: Call `AssetManager.clear()`.
        [ ] 3.3.2. Execution: Call `addAsset(canvasStub)`.
        [ ] 3.3.3. Execution: Call `addAsset(canvasStub, '')`.
        [ ] 3.3.4. Assertion: Confirm stored asset name is 'Untitled' for first call.
        [ ] 3.3.5. Assertion: Confirm stored asset name is 'Untitled' for second call.
    [ ] 3.4. Scenario 4: Timestamp Presence and Determinism
        # Goal: Asset timestamp must exist and match Date.now() at creation.
        [ ] 3.4.1. Setup: Call `AssetManager.clear()`.
        [ ] 3.4.2. Setup: Stub `Date.now()` to return `1700000001234`.
        [ ] 3.4.3. Execution: Call `addAsset(canvasStub, 'Timed Asset')`.
        [ ] 3.4.4. Assertion: Confirm `asset.timestamp === 1700000001234`.
    [ ] 3.5. Scenario 5: ID Uniqueness Across Calls
        # Goal: IDs are unique per call even with identical inputs.
        [ ] 3.5.1. Setup: Call `AssetManager.clear()`.
        [ ] 3.5.2. Setup: Stub `Date.now()` to fixed time across calls to force reliance on random suffix.
        [ ] 3.5.3. Execution: Call `addAsset(canvasStub, 'One')`.
        [ ] 3.5.4. Execution: Call `addAsset(canvasStub, 'Two')`.
        [ ] 3.5.5. Assertion: Confirm IDs differ (`id1 !== id2`).
    [ ] 3.6. Scenario 6: Correct Map Insertion and Return ID
        # Goal: Returned ID must reference stored asset in map.
        [ ] 3.6.1. Setup: Call `AssetManager.clear()`.
        [ ] 3.6.2. Execution: Call `id = addAsset(canvasStub, 'Stored Asset')`.
        [ ] 3.6.3. Assertion: Confirm `assets.has(id) === true`.
        [ ] 3.6.4. Assertion: Confirm `getAsset(id).id === id`.

[ ] 4. AssetManager.getAsset Testing
    [ ] 4.1. Scenario 7: Returns Stored Asset by ID
        # Goal: Should retrieve stored asset object.
        [ ] 4.1.1. Setup: Call `AssetManager.clear()`.
        [ ] 4.1.2. Setup: Add known asset `addAsset(canvasStub, 'Find Me')`.
        [ ] 4.1.3. Execution: Call `getAsset(id)`.
        [ ] 4.1.4. Assertion: Confirm returned object matches stored asset (same reference).
        [ ] 4.1.5. Assertion: Confirm `asset.name === 'Find Me'`.
    [ ] 4.2. Scenario 8: Undefined for Missing IDs
        # Goal: Missing ID returns undefined.
        [ ] 4.2.1. Setup: Call `AssetManager.clear()`.
        [ ] 4.2.2. Execution: Call `getAsset('missing')`.
        [ ] 4.2.3. Assertion: Confirm result is `undefined`.

[ ] 5. AssetManager.removeAsset Testing
    [ ] 5.1. Scenario 9: Returns True on Successful Deletion
        # Goal: Removing an existing ID should return true and reduce map size.
        [ ] 5.1.1. Setup: Call `AssetManager.clear()`.
        [ ] 5.1.2. Setup: Add two assets.
        [ ] 5.1.3. Execution: Call `removeAsset(id1)`.
        [ ] 5.1.4. Assertion: Confirm return value is `true`.
        [ ] 5.1.5. Assertion: Confirm `assets.has(id1) === false`.
        [ ] 5.1.6. Assertion: Confirm `assets.size` is reduced by 1.
    [ ] 5.2. Scenario 10: Returns False When ID Missing
        # Goal: Removing unknown ID should return false and not change size.
        [ ] 5.2.1. Setup: Call `AssetManager.clear()`.
        [ ] 5.2.2. Setup: Add one asset.
        [ ] 5.2.3. Execution: Call `removeAsset('missing')`.
        [ ] 5.2.4. Assertion: Confirm return value is `false`.
        [ ] 5.2.5. Assertion: Confirm `assets.size` is unchanged.

[ ] 6. AssetManager.clear Testing
    [ ] 6.1. Scenario 11: Empties Map
        # Goal: Clear should remove all entries.
        [ ] 6.1.1. Setup: Call `AssetManager.clear()`.
        [ ] 6.1.2. Setup: Add multiple assets.
        [ ] 6.1.3. Execution: Call `clear()`.
        [ ] 6.1.4. Assertion: Confirm `assets.size === 0`.
    [ ] 6.2. Scenario 12: Repeated Clear Calls Are Safe
        # Goal: Calling clear multiple times should not throw and remain empty.
        [ ] 6.2.1. Setup: Call `AssetManager.clear()`.
        [ ] 6.2.2. Execution: Call `clear()` twice.
        [ ] 6.2.3. Assertion: Confirm `assets.size === 0` after first call.
        [ ] 6.2.4. Assertion: Confirm `assets.size === 0` after second call.

