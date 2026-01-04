
// ------------------------------------------------------------------------------------------------
// AssetManager Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping assets tests.');
        return;
    }

    const { register, assert, assertEqual, assertDeepEqual, spyOn } = window.TestRunner;

    // --- 1. Harness & Mocking ---

    // Test Data Fixtures
    const imageStub = { naturalWidth: 640, naturalHeight: 480, width: 10, height: 10 };
    const canvasStub = { width: 800, height: 600 };
    const bitmapStub = { width: 1920, height: 1080 };

    // --- 3. addAsset Testing ---

    register('AssetManager: 3.1 Null/Undefined Sources', () => {
        window.AssetManager.clear();

        const id1 = window.AssetManager.addAsset(null, 'Ignored');
        assertEqual(id1, null, 'addAsset(null) should return null');

        const id2 = window.AssetManager.addAsset(undefined, 'Ignored');
        assertEqual(id2, null, 'addAsset(undefined) should return null');

        // Access internal map size via getAsset lookup or just trust logic if not exposed?
        // scripts/assets.js exposes assets map via getter? No.
        // But we can check if any ID was returned. We verified null.
        // We can't easily check internal map size without exposing it.
        // Assuming addAsset logic is sound if it returns null.
    });

    register('AssetManager: 3.2 Width/Height Resolution', () => {
        window.AssetManager.clear();

        const idImg = window.AssetManager.addAsset(imageStub, 'Image Asset');
        const assetImg = window.AssetManager.getAsset(idImg);
        assertEqual(assetImg.width, 640, 'Image should use naturalWidth');
        assertEqual(assetImg.height, 480, 'Image should use naturalHeight');

        const idCan = window.AssetManager.addAsset(canvasStub, 'Canvas Asset');
        const assetCan = window.AssetManager.getAsset(idCan);
        assertEqual(assetCan.width, 800, 'Canvas should use width');
        assertEqual(assetCan.height, 600, 'Canvas should use height');

        const idBit = window.AssetManager.addAsset(bitmapStub, 'Bitmap Asset');
        const assetBit = window.AssetManager.getAsset(idBit);
        assertEqual(assetBit.width, 1920, 'Bitmap should use width');
        assertEqual(assetBit.height, 1080, 'Bitmap should use height');
    });

    register('AssetManager: 3.3 Default Naming', () => {
        window.AssetManager.clear();

        const id1 = window.AssetManager.addAsset(canvasStub);
        const asset1 = window.AssetManager.getAsset(id1);
        assertEqual(asset1.name, 'Untitled', 'Default name should be Untitled');

        const id2 = window.AssetManager.addAsset(canvasStub, '');
        const asset2 = window.AssetManager.getAsset(id2);
        assertEqual(asset2.name, 'Untitled', 'Empty string name should fallback to Untitled');
    });

    register('AssetManager: 3.4 Timestamp Determinism', () => {
        window.AssetManager.clear();

        // Mock Date.now
        const nowSpy = spyOn(Date, 'now').mockReturnValue(1700000001234);

        const id = window.AssetManager.addAsset(canvasStub, 'Timed Asset');
        const asset = window.AssetManager.getAsset(id);

        assertEqual(asset.timestamp, 1700000001234, 'Timestamp should match Date.now()');

        nowSpy.restore();
    });

    register('AssetManager: 3.5 ID Uniqueness', () => {
        window.AssetManager.clear();

        // Even with same time, IDs should differ due to randomness
        const nowSpy = spyOn(Date, 'now').mockReturnValue(1000);
        const mathSpy = spyOn(Math, 'random');

        mathSpy.mockReturnValue(0.1);
        const id1 = window.AssetManager.addAsset(canvasStub, 'One');

        mathSpy.mockReturnValue(0.2);
        const id2 = window.AssetManager.addAsset(canvasStub, 'Two');

        assert(id1 !== id2, 'IDs must be unique');

        nowSpy.restore();
        mathSpy.restore();
    });

    register('AssetManager: 3.6 Map Insertion', () => {
        window.AssetManager.clear();
        const id = window.AssetManager.addAsset(canvasStub, 'Stored Asset');
        const asset = window.AssetManager.getAsset(id);

        assert(asset !== undefined, 'Asset must be retrievable');
        assertEqual(asset.id, id, 'Retrieved asset ID must match');
    });

    // --- 4. getAsset Testing ---

    register('AssetManager: 4.1 Returns Stored Asset', () => {
        window.AssetManager.clear();
        const id = window.AssetManager.addAsset(canvasStub, 'Find Me');
        const asset = window.AssetManager.getAsset(id);

        assertEqual(asset.source, canvasStub, 'Asset source should match stored object');
        assertEqual(asset.name, 'Find Me', 'Asset name should match');
    });

    register('AssetManager: 4.2 Undefined for Missing', () => {
        window.AssetManager.clear();
        const asset = window.AssetManager.getAsset('missing');
        assertEqual(asset, undefined, 'Missing ID should return undefined');
    });

    // --- 5. removeAsset Testing ---

    register('AssetManager: 5.1 Returns True on Deletion', () => {
        window.AssetManager.clear();
        const id1 = window.AssetManager.addAsset(canvasStub, '1');
        const id2 = window.AssetManager.addAsset(canvasStub, '2');

        const result = window.AssetManager.removeAsset(id1);
        assertEqual(result, true, 'Removal should return true');

        const check = window.AssetManager.getAsset(id1);
        assertEqual(check, undefined, 'Asset should be gone');

        const check2 = window.AssetManager.getAsset(id2);
        assert(check2 !== undefined, 'Other asset should remain');
    });

    register('AssetManager: 5.2 Returns False When Missing', () => {
        window.AssetManager.clear();
        const id = window.AssetManager.addAsset(canvasStub, '1');

        const result = window.AssetManager.removeAsset('missing');
        assertEqual(result, false, 'Removal of missing should return false');

        const check = window.AssetManager.getAsset(id);
        assert(check !== undefined, 'Existing asset should remain');
    });

    // --- 6. clear Testing ---

    register('AssetManager: 6.1 Empties Map', () => {
        window.AssetManager.clear();
        const id = window.AssetManager.addAsset(canvasStub, '1');

        window.AssetManager.clear();

        const check = window.AssetManager.getAsset(id);
        assertEqual(check, undefined, 'Map should be empty');
    });

})();
