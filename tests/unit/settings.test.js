(function() {
    const { register, assert, assertEqual, assertDeepEqual } = window.TestRunner;
    const settings = window.OkazuTestables.settings;

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

})();
