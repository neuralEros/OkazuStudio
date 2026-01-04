(function() {
    const { register, assert, assertEqual, assertDeepEqual } = window.TestRunner;
    const { AssetManager } = window.OkazuTestables.assets;

    // Helper: Fake timer
    let currentTime = 1700000000000;
    const originalDateNow = Date.now;
    function mockTime(t) { currentTime = t; Date.now = () => currentTime; }
    function restoreTime() { Date.now = originalDateNow; }

    register('AssetManager: Core Functionality', async () => {
        const manager = new AssetManager();
        mockTime(1700000000000);

        // 3.1 Null Source
        assertEqual(manager.addAsset(null), null, 'Null source returns null');
        assertEqual(manager.assets.size, 0, 'Size remains 0');

        // 3.2 Width/Height Resolution
        const imgStub = { naturalWidth: 640, naturalHeight: 480 };
        const canvasStub = { width: 800, height: 600 };
        const id1 = manager.addAsset(imgStub, 'Img');
        const id2 = manager.addAsset(canvasStub, 'Canvas');

        assertEqual(manager.getAsset(id1).width, 640, 'Image uses naturalWidth');
        assertEqual(manager.getAsset(id2).width, 800, 'Canvas uses width');

        // 3.3 Default Naming
        const id3 = manager.addAsset(canvasStub);
        assertEqual(manager.getAsset(id3).name, 'Untitled', 'Default name is Untitled');

        // 3.4 Timestamp
        assertEqual(manager.getAsset(id1).timestamp, 1700000000000, 'Timestamp matches Date.now()');

        // 3.5 Unique IDs
        // Even with same time, random suffix should differ (we can't mock random easily without more invasion,
        // but we can check inequality).
        assert(id1 !== id2, 'IDs are unique');

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
        assertEqual(manager.assets.size, 2, 'Size decremented');

        // 5.2 Remove Missing
        const removedMissing = manager.removeAsset('missing');
        assert(!removedMissing, 'removeAsset returns false on failure');

        // 6.1 Clear
        manager.clear();
        assertEqual(manager.assets.size, 0, 'Clear empties map');

        restoreTime();
    });
})();
