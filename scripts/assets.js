// Asset Manager - Phase 3
// Stores loaded and generated image assets

(function() {
    function generateId() {
        return 'asset_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    class AssetManager {
        constructor() {
            this.assets = new Map();
        }

        addAsset(source, name) {
            // source can be Image, Canvas, or ImageBitmap
            if (!source) return null;

            const id = generateId();
            const width = source.naturalWidth || source.width;
            const height = source.naturalHeight || source.height;

            const asset = {
                id,
                name: name || 'Untitled',
                width,
                height,
                source: source, // The actual image data/reference
                timestamp: Date.now()
            };

            this.assets.set(id, asset);
            // console.log(`[AssetManager] Added asset ${id} (${width}x${height}) - ${name}`);
            return id;
        }

        getAsset(id) {
            return this.assets.get(id);
        }

        removeAsset(id) {
            if (this.assets.has(id)) {
                this.assets.delete(id);
                // console.log(`[AssetManager] Removed asset ${id}`);
                return true;
            }
            return false;
        }

        clear() {
            this.assets.clear();
        }
    }

    window.AssetManager = new AssetManager();

})();
