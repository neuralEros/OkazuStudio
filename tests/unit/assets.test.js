(function() {
    const { register, assert, assertEqual, assertDeepEqual } = window.TestRunner;
    const { AssetManager } = window.OkazuTestables.assets;

    // Helper: Fake timer
    let currentTime = 1700000000000;
    const originalDateNow = Date.now;
    function mockTime(t) { currentTime = t; Date.now = () => currentTime; }
    function restoreTime() { Date.now = originalDateNow; }
    const originalRandom = Math.random;
    function mockRandom(values) {
        let index = 0;
        Math.random = () => values[index++];
    }
    function restoreRandom() { Math.random = originalRandom; }

    register('AssetManager: Core Functionality', async () => {
        const manager = new AssetManager();
        mockTime(1700000000000);

        // 3.1 Null Source
        assertEqual(manager.addAsset(null), null, 'Null source returns null');
        assertEqual(manager.assets.size, 0, 'Size remains 0');

        // 3.2 Width/Height Resolution
        const imgStub = { naturalWidth: 640, naturalHeight: 480, width: 10, height: 10 };
        const canvasStub = { width: 800, height: 600 };
        const bitmapStub = { width: 1920, height: 1080 };
        const id1 = manager.addAsset(imgStub, 'Img');
        const id2 = manager.addAsset(canvasStub, 'Canvas');
        const idBitmap = manager.addAsset(bitmapStub, 'Bitmap');

        assertEqual(manager.getAsset(id1).width, 640, 'Image uses naturalWidth');
        assertEqual(manager.getAsset(id2).width, 800, 'Canvas uses width');
        assertEqual(manager.getAsset(idBitmap).width, 1920, 'Bitmap uses width');

        // 3.3 Default Naming
        const id3 = manager.addAsset(canvasStub);
        const id4 = manager.addAsset(canvasStub, '');
        assertEqual(manager.getAsset(id3).name, 'Untitled', 'Default name is Untitled');
        assertEqual(manager.getAsset(id4).name, 'Untitled', 'Empty name defaults to Untitled');

        // 3.4 Timestamp
        assertEqual(manager.getAsset(id1).timestamp, 1700000000000, 'Timestamp matches Date.now()');

        // 3.5 Unique IDs
        mockRandom([0.12345, 0.6789]);
        const fixedTime = 1700000000000;
        mockTime(fixedTime);
        const deterministic1 = manager.addAsset(canvasStub, 'One');
        const deterministic2 = manager.addAsset(canvasStub, 'Two');
        const expectedPrefix = 'asset_' + fixedTime.toString(36);
        const expected1 = expectedPrefix + (0.12345).toString(36).substr(2, 5);
        const expected2 = expectedPrefix + (0.6789).toString(36).substr(2, 5);
        assertEqual(deterministic1, expected1, 'Deterministic ID matches stubbed random (1)');
        assertEqual(deterministic2, expected2, 'Deterministic ID matches stubbed random (2)');
        assert(deterministic1 !== deterministic2, 'IDs are unique');
        restoreRandom();

        // 4.1 getAsset
        const retrieved = manager.getAsset(id1);
        assertEqual(retrieved.id, id1, 'Retrieved asset has correct ID');
        assertEqual(retrieved.source, imgStub, 'Retrieved asset has correct source ref');

        // 4.2 Missing ID
        assertEqual(manager.getAsset('missing'), undefined, 'Missing ID returns undefined');

        // 5.1 Remove Asset
        const removed = manager.removeAsset(id1);
        assert(removed, 'removeAsset returns true on success');
        assertEqual(manager.assets.has(id1), false, 'Asset removed from map');
        assertEqual(manager.assets.size, 6, 'Size decremented');

        // 5.2 Remove Missing
        const removedMissing = manager.removeAsset('missing');
        assert(!removedMissing, 'removeAsset returns false on failure');

        // 6.1 Clear
        manager.clear();
        assertEqual(manager.assets.size, 0, 'Clear empties map');

        // 6.2 Repeated Clear
        manager.clear();
        assertEqual(manager.assets.size, 0, 'Repeated clear keeps map empty');

        restoreTime();
    });
})();
