(function() {
    const { register, assert, assertEqual, spyOn } = window.TestRunner;

    // 2. Fixtures
    const imageStub = { naturalWidth: 640, naturalHeight: 480, width: 10, height: 10 };
    const canvasStub = { width: 800, height: 600 };
    const bitmapStub = { width: 1920, height: 1080 };

    // 3. AssetManager.addAsset Testing
    register('AssetManager: addAsset ignores null/undefined', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();

        const r1 = am.addAsset(null, 'Ignored');
        assertEqual(r1, null, 'Should return null for null source');

        const r2 = am.addAsset(undefined, 'Ignored');
        assertEqual(r2, null, 'Should return null for undefined source');

        assertEqual(am.assets.size, 0, 'Should not add to map');
    });

    register('AssetManager: addAsset resolves dimensions correctly', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();

        const id1 = am.addAsset(imageStub, 'Image');
        const asset1 = am.getAsset(id1);
        assertEqual(asset1.width, 640);
        assertEqual(asset1.height, 480);

        const id2 = am.addAsset(canvasStub, 'Canvas');
        const asset2 = am.getAsset(id2);
        assertEqual(asset2.width, 800);
        assertEqual(asset2.height, 600);

        const id3 = am.addAsset(bitmapStub, 'Bitmap');
        const asset3 = am.getAsset(id3);
        assertEqual(asset3.width, 1920);
        assertEqual(asset3.height, 1080);
    });

    register('AssetManager: addAsset naming defaults', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();

        const id1 = am.addAsset(canvasStub);
        assertEqual(am.getAsset(id1).name, 'Untitled');

        const id2 = am.addAsset(canvasStub, '');
        assertEqual(am.getAsset(id2).name, 'Untitled');
    });

    register('AssetManager: addAsset timestamp determinism', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();

        const dateSpy = spyOn(Date, 'now');
        const fixedTime = 1700000001234;
        dateSpy.mockReturnValue(fixedTime);

        try {
            const id = am.addAsset(canvasStub, 'Timed');
            assertEqual(am.getAsset(id).timestamp, fixedTime);
        } finally {
            dateSpy.restore();
        }
    });

    register('AssetManager: addAsset unique IDs', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();

        const dateSpy = spyOn(Date, 'now');
        dateSpy.mockReturnValue(1000); // Fixed time

        try {
            const id1 = am.addAsset(canvasStub, 'One');
            const id2 = am.addAsset(canvasStub, 'Two');
            assert(id1 !== id2, 'IDs should be unique even with same timestamp');
        } finally {
            dateSpy.restore();
        }
    });

    register('AssetManager: addAsset stores and returns ID', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();

        const id = am.addAsset(canvasStub, 'Stored');
        assert(am.assets.has(id), 'Map should contain ID');
        const asset = am.getAsset(id);
        assertEqual(asset.id, id);
    });

    // 4. AssetManager.getAsset Testing
    register('AssetManager: getAsset retrieves object', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();

        const id = am.addAsset(canvasStub, 'Find Me');
        const asset = am.getAsset(id);
        assert(asset, 'Should return asset');
        assertEqual(asset.name, 'Find Me');
    });

    register('AssetManager: getAsset returns undefined for missing', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();
        assertEqual(am.getAsset('missing'), undefined);
    });

    // 5. AssetManager.removeAsset Testing
    register('AssetManager: removeAsset deletes existing', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();

        const id = am.addAsset(canvasStub);
        am.addAsset(canvasStub); // Add another

        const result = am.removeAsset(id);
        assertEqual(result, true, 'Should return true on success');
        assert(!am.assets.has(id), 'ID should be gone');
        assertEqual(am.assets.size, 1, 'Size should decrease');
    });

    register('AssetManager: removeAsset handles missing', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();
        am.addAsset(canvasStub);

        const result = am.removeAsset('missing');
        assertEqual(result, false, 'Should return false on failure');
        assertEqual(am.assets.size, 1, 'Size should not change');
    });

    // 6. AssetManager.clear Testing
    register('AssetManager: clear empties map', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();
        am.addAsset(canvasStub);
        am.addAsset(canvasStub);

        am.clear();
        assertEqual(am.assets.size, 0);
    });

    register('AssetManager: clear is idempotent', () => {
        const am = window.OkazuTestables.assets.instance;
        am.clear();
        am.clear(); // Second call
        assertEqual(am.assets.size, 0);
    });

})();
