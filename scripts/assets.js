// Asset Manager - Phase 3
// Stores loaded and generated image assets

(function() {
    const defaultNow = () => Date.now();

    class AssetManager {
        constructor(options = {}) {
            this.assets = new Map();
            this.nowFn = typeof options.nowFn === 'function' ? options.nowFn : defaultNow;
            if (typeof options.idGenerator === 'function') {
                this.idGenerator = options.idGenerator;
            } else {
                const defaultGen = () => `asset_${this.nowFn().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
                defaultGen.usesDefaultNow = true;
                this.idGenerator = defaultGen;
            }
        }

        setTimeProvider(fn) {
            this.nowFn = typeof fn === 'function' ? fn : defaultNow;
            if (!this.idGenerator || this.idGenerator.usesDefaultNow) {
                this.setIdGenerator(null);
            }
        }

        setIdGenerator(fn) {
            if (typeof fn === 'function') {
                this.idGenerator = fn;
            } else {
                const defaultGen = () => `asset_${this.nowFn().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
                defaultGen.usesDefaultNow = true;
                this.idGenerator = defaultGen;
            }
        }

        addAsset(source, name) {
            // source can be Image, Canvas, or ImageBitmap
            if (!source) return null;

            const id = this.idGenerator();
            const width = source.naturalWidth || source.width;
            const height = source.naturalHeight || source.height;

            const asset = {
                id,
                name: name || 'Untitled',
                width,
                height,
                source: source, // The actual image data/reference
                timestamp: this.nowFn()
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
