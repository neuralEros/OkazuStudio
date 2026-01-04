(function() {
    const { register, assert, assertEqual, assertApprox, assertDeepEqual } = window.TestRunner;
    const settings = window.OkazuTestables.settings;
    const mainState = window.OkazuTestables.main.state;

    // 1. Storage Persistence
    register('Settings: Load/Save Cycle', () => {
        // Mock localStorage
        const store = {};
        const origGet = localStorage.getItem;
        const origSet = localStorage.setItem;

        localStorage.getItem = (k) => store[k];
        localStorage.setItem = (k, v) => store[k] = v;

        try {
            // Save
            const state = { settings: { hue: 123, apiKey: 'secret' } };
            // We need to inject state into the system, but `settings.js` runs as a factory closure.
            // We can test the exposed helpers.

            // Encode API Key
            const encoded = settings.encodeApiKey('secret');
            assert(encoded !== 'secret', 'Encoded');
            const decoded = settings.decodeApiKey(encoded);
            assertEqual(decoded, 'secret', 'Round trip');

        } finally {
            localStorage.getItem = origGet;
            localStorage.setItem = origSet;
        }
    });

    register('Settings: loadSettings merges defaults and handles malformed storage', () => {
        const store = {};
        const origGet = localStorage.getItem;
        const origSet = localStorage.setItem;
        const origSetInterval = window.setInterval;
        const origClearInterval = window.clearInterval;
        const originalSettings = mainState.settings;

        window.setInterval = () => 1;
        window.clearInterval = () => {};
        localStorage.getItem = (k) => store[k];
        localStorage.setItem = (k, v) => store[k] = v;

        try {
            store.okazu_settings = JSON.stringify({ hue: 120 });
            settings.loadSettings();
            assertEqual(mainState.settings.hue, 120);
            assertEqual(mainState.settings.saturation, 96);
            assertEqual(mainState.settings.exportFormat, 'image/png');

            store.okazu_settings = '{bad-json';
            settings.loadSettings();
            assertEqual(mainState.settings.hue, 28);
            assertEqual(mainState.settings.saturation, 96);
        } finally {
            mainState.settings = originalSettings;
            localStorage.getItem = origGet;
            localStorage.setItem = origSet;
            window.setInterval = origSetInterval;
            window.clearInterval = origClearInterval;
            settings.stopRgbLoop();
        }
    });

    register('Settings: save/load persist API key encoding', () => {
        const store = {};
        const origGet = localStorage.getItem;
        const origSet = localStorage.setItem;
        const origSetInterval = window.setInterval;
        const origClearInterval = window.clearInterval;
        const originalSettings = mainState.settings;

        window.setInterval = () => 1;
        window.clearInterval = () => {};
        localStorage.getItem = (k) => store[k];
        localStorage.setItem = (k, v) => store[k] = v;

        try {
            mainState.settings = { ...originalSettings, apiKey: 'super-secret' };
            settings.saveSettings();

            const saved = JSON.parse(store.okazu_settings);
            assert(saved.apiKey !== 'super-secret', 'API key encoded');
            assertEqual(settings.decodeApiKey(saved.apiKey), 'super-secret');

            mainState.settings = {};
            settings.loadSettings();
            assertEqual(mainState.settings.apiKey, 'super-secret');
        } finally {
            mainState.settings = originalSettings;
            localStorage.getItem = origGet;
            localStorage.setItem = origSet;
            window.setInterval = origSetInterval;
            window.clearInterval = origClearInterval;
            settings.stopRgbLoop();
        }
    });

    register('Settings: saveDebounced timing', () => {
        const store = {};
        const origGet = localStorage.getItem;
        const origSet = localStorage.setItem;
        const origSetTimeout = window.setTimeout;
        const origClearTimeout = window.clearTimeout;
        const originalSettings = mainState.settings;
        let callCount = 0;
        const timeouts = new Map();
        let nextId = 1;

        localStorage.getItem = (k) => store[k];
        localStorage.setItem = (k, v) => {
            store[k] = v;
            callCount += 1;
        };
        window.setTimeout = (cb, ms) => {
            const id = nextId++;
            timeouts.set(id, { cb, ms });
            return id;
        };
        window.clearTimeout = (id) => {
            timeouts.delete(id);
        };

        try {
            mainState.settings = { ...originalSettings };
            settings.saveDebounced();
            settings.saveDebounced();

            assertEqual(callCount, 0, 'Not called immediately');
            assertEqual(timeouts.size, 1, 'Only latest timer remains');

            const pending = Array.from(timeouts.values())[0];
            assertEqual(pending.ms, 1000);
            pending.cb();

            assert(store.okazu_settings, 'Called after timeout');
        } finally {
            mainState.settings = originalSettings;
            localStorage.getItem = origGet;
            localStorage.setItem = origSet;
            window.setTimeout = origSetTimeout;
            window.clearTimeout = origClearTimeout;
        }
    });

    // 2. Theme Logic
    register('Settings: updateThemeVariables', () => {
        // Stub document.documentElement.style.setProperty
        const props = {};
        const origSetProp = document.documentElement.style.setProperty;
        document.documentElement.style.setProperty = (k, v) => props[k] = v;

        try {
            settings.updateThemeVariables(0, 100); // Red, Sat 100

            // Base Lightness (sat 100 -> boost 0). Hue 0 -> cos(-240) = -0.5 -> boost 0.
            // Base 56.
            assertEqual(props['--accent-h'], 0);
            assertEqual(props['--accent-l'], '56%');

            // Low Saturation Boost
            settings.updateThemeVariables(0, 0); // Gray
            // Sat 0 -> Boost 40. L = 56 + 40 = 96 -> clamped to 95.
            assertEqual(props['--accent-l'], '95%');

        } finally {
            document.documentElement.style.setProperty = origSetProp;
        }
    });

    register('Settings: RGB loop persistence and speed changes', () => {
        const store = {};
        const origGet = localStorage.getItem;
        const origSet = localStorage.setItem;
        const origSetInterval = window.setInterval;
        const origClearInterval = window.clearInterval;
        const intervals = [];
        const originalSettings = mainState.settings;

        localStorage.getItem = (k) => store[k];
        localStorage.setItem = (k, v) => store[k] = v;
        window.setInterval = (cb, ms) => {
            intervals.push(ms);
            return intervals.length;
        };
        window.clearInterval = () => {};

        try {
            mainState.settings = { ...originalSettings, rgbMode: true, rgbSpeed: 2.0, hue: 210 };
            settings.setLastStaticHue(45);
            settings.saveSettings();

            const saved = JSON.parse(store.okazu_settings);
            assertEqual(saved.hue, 45);

            settings.loadSettings();
            assertEqual(mainState.settings.rgbMode, true);
            assertEqual(mainState.settings.hue, 0);
            assertEqual(settings.getLastStaticHue(), 45);

            const themeInterval = intervals.find((ms) => ms !== 10);
            assertApprox(themeInterval, 62.5, 0.01);

            intervals.length = 0;
            mainState.settings.rgbSpeed = 4.0;
            settings.initRgbLoop();
            const nextInterval = intervals.find((ms) => ms !== 10);
            assertApprox(nextInterval, 31.25, 0.01);
        } finally {
            mainState.settings = originalSettings;
            localStorage.getItem = origGet;
            localStorage.setItem = origSet;
            window.setInterval = origSetInterval;
            window.clearInterval = origClearInterval;
            settings.stopRgbLoop();
        }
    });

    register('Settings: updateRgbButtonColor', () => {
        const props = {};
        const origSetProp = document.documentElement.style.setProperty;
        const originalSettings = mainState.settings;

        document.documentElement.style.setProperty = (k, v) => props[k] = v;

        try {
            mainState.settings = { ...originalSettings, saturation: 50 };
            const hue = 120;
            const sat = mainState.settings.saturation;
            const satBoost = (100 - sat) * 0.4;
            const hueBoost = Math.max(0, Math.cos((hue - 240) * Math.PI / 180)) * 15;
            const buttonL = Math.min(95, 56 + satBoost + hueBoost);
            const inkL = 10 + Math.max(0, (buttonL - 56) * 0.294);

            settings.updateRgbButtonColor(hue);

            assertEqual(props['--rgb-button-color'], `hsl(${hue}, ${sat}%, ${buttonL}%)`);
            assertEqual(props['--rgb-button-ink'], `hsl(${hue}, 90%, ${inkL}%)`);
        } finally {
            mainState.settings = originalSettings;
            document.documentElement.style.setProperty = origSetProp;
        }
    });

    // 3. RGB Loop Logic
    register('Settings: RGB Loop', async () => {
        // Stub setInterval
        const callbacks = [];
        const origSetInterval = window.setInterval;
        const origClearInterval = window.clearInterval;
        window.setInterval = (cb, ms) => {
            callbacks.push({ cb, ms });
            return callbacks.length;
        };
        window.clearInterval = () => {};

        try {
            // Init
            settings.setCycleHue(0);
            settings.initRgbLoop();

            // Should have 2 intervals: Theme Loop (variable ms) and Button Loop (10ms)
            // Theme loop is first.
            const themeLoop = callbacks.find(c => c.ms > 20); // Base is 125ms / speed

            if (themeLoop) themeLoop.cb();

            // Cycle Hue increments by 0.5
            assertEqual(settings.getCycleHue(), 0.5);

        } finally {
            window.setInterval = origSetInterval;
            window.clearInterval = origClearInterval;
            settings.stopRgbLoop();
        }
    });

    register('Settings UI: sliders and toggles update state', () => {
        const hueSlider = document.getElementById('setting-hue');
        const saturationSlider = document.getElementById('setting-saturation');
        const rgbToggle = document.getElementById('setting-rgb-toggle');
        const rgbSpeedSlider = document.getElementById('setting-rgb-speed');
        const rgbSpeedVal = document.getElementById('val-rgb-speed');

        const origSetTimeout = window.setTimeout;
        const origClearTimeout = window.clearTimeout;
        const originalSettings = mainState.settings;

        window.setTimeout = () => 1;
        window.clearTimeout = () => {};

        try {
            mainState.settings = { ...originalSettings, rgbMode: true, hue: 10, saturation: 80 };

            hueSlider.value = '200';
            hueSlider.dispatchEvent(new Event('input', { bubbles: true }));
            assertEqual(mainState.settings.hue, 200);
            assertEqual(mainState.settings.rgbMode, false);
            assertEqual(rgbToggle.style.backgroundColor, 'transparent');

            saturationSlider.value = '55';
            saturationSlider.dispatchEvent(new Event('input', { bubbles: true }));
            assertEqual(mainState.settings.saturation, 55);

            rgbSpeedSlider.value = '2.5';
            rgbSpeedSlider.dispatchEvent(new Event('input', { bubbles: true }));
            assertEqual(mainState.settings.rgbSpeed, 2.5);
            assertEqual(rgbSpeedVal.textContent, '2.5x');

            rgbToggle.dispatchEvent(new Event('click', { bubbles: true }));
            assertEqual(mainState.settings.rgbMode, true);
        } finally {
            mainState.settings = originalSettings;
            window.setTimeout = origSetTimeout;
            window.clearTimeout = origClearTimeout;
        }
    });

    register('Settings UI: export controls update settings', () => {
        const exportQualityContainer = document.getElementById('export-quality-container');
        const exportQualitySlider = document.getElementById('setting-export-quality');
        const exportQualityVal = document.getElementById('val-export-quality');
        const exportFmtButtons = document.querySelectorAll('.export-fmt-btn');
        const exportCapButtons = document.querySelectorAll('.export-cap-btn');
        const exportLayerButtons = document.querySelectorAll('.export-layer-btn');

        const origSetTimeout = window.setTimeout;
        const origClearTimeout = window.clearTimeout;
        const originalSettings = mainState.settings;

        window.setTimeout = () => 1;
        window.clearTimeout = () => {};

        try {
            mainState.settings = {
                ...originalSettings,
                exportFormat: 'image/png',
                exportQuality: 98,
                exportHeightCap: 4320,
                exportLayers: { merged: true, save: false, mask: false, front: false, back: false }
            };

            const jpegButton = Array.from(exportFmtButtons).find((btn) => btn.dataset.val === 'image/jpeg');
            const pngButton = Array.from(exportFmtButtons).find((btn) => btn.dataset.val === 'image/png');

            jpegButton.dispatchEvent(new Event('click', { bubbles: true }));
            assertEqual(mainState.settings.exportFormat, 'image/jpeg');
            assertEqual(exportQualityContainer.style.pointerEvents, 'auto');
            assertEqual(exportQualityContainer.style.opacity, '1');

            pngButton.dispatchEvent(new Event('click', { bubbles: true }));
            assertEqual(mainState.settings.exportFormat, 'image/png');
            assertEqual(exportQualityContainer.style.pointerEvents, 'none');
            assertEqual(exportQualityContainer.style.opacity, '0.3');

            exportQualitySlider.value = '72';
            exportQualitySlider.dispatchEvent(new Event('input', { bubbles: true }));
            assertEqual(mainState.settings.exportQuality, 72);
            assertEqual(exportQualityVal.textContent, '72%');

            const capButton = Array.from(exportCapButtons).find((btn) => btn.dataset.val === '2160');
            capButton.dispatchEvent(new Event('click', { bubbles: true }));
            assertEqual(mainState.settings.exportHeightCap, 2160);

            const maskButton = Array.from(exportLayerButtons).find((btn) => btn.dataset.key === 'mask');
            maskButton.dispatchEvent(new Event('click', { bubbles: true }));
            assertEqual(mainState.settings.exportLayers.mask, true);
        } finally {
            mainState.settings = originalSettings;
            window.setTimeout = origSetTimeout;
            window.clearTimeout = origClearTimeout;
        }
    });

})();
