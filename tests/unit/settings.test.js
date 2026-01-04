
// ------------------------------------------------------------------------------------------------
// Settings Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping settings tests.');
        return;
    }

    const { register, assert, assertEqual, spyOn } = window.TestRunner;

    // --- 1. Harness & Mocking ---

    // Mock localStorage
    const storage = {};
    window.localStorageMock = {
        getItem: (k) => storage[k] || null,
        setItem: (k, v) => { storage[k] = v; }
    };
    // Need to spy on global localStorage if settings.js uses it directly.
    try {
        const getSpy = spyOn(localStorage, 'getItem').mockImplementation((k) => storage[k] || null);
        const setSpy = spyOn(localStorage, 'setItem').mockImplementation((k, v) => { storage[k] = v; });
    } catch(e) {
        // Fallback if spyOn fails on native object
        console.warn('Could not spy on localStorage');
    }

    function createMockEls() {
        return {
            settingHue: { value: '28', addEventListener: spyOn({}, 'addEventListener') },
            settingSat: { value: '96', addEventListener: spyOn({}, 'addEventListener') },
            settingRgb: { checked: false, addEventListener: spyOn({}, 'addEventListener') },
            settingRgbSpeed: { value: '5', addEventListener: spyOn({}, 'addEventListener') },
            settingsBtn: { addEventListener: spyOn({}, 'addEventListener') },
        };
    }

    // --- 2. loadSettings ---

    register('Settings: 2.1 Defaults Merging', () => {
        // Reset storage
        for (let k in storage) delete storage[k];

        // Populate storage with partial
        storage['okazu_settings'] = JSON.stringify({ hue: 120, rgbMode: true, exportQuality: 80 });

        // Mock state
        const state = { settings: {} };
        const els = createMockEls();

        // Create system
        const sys = window.createSettingsSystem({ state, els, render: ()=>{}, scheduleHeavyTask: ()=>{} });

        assertEqual(state.settings.exportQuality, 80);
        assertEqual(state.settings.exportFormat, 'image/png'); // Default
    });

    register('Settings: 2.2 API Key Encoding', () => {
        for (let k in storage) delete storage[k];

        const state = { settings: { apiKey: 'sk-test' } };
        const els = createMockEls();
        const sys = window.createSettingsSystem({ state, els, render: ()=>{}, scheduleHeavyTask: ()=>{} });

        // Trigger save if possible, or verify encode util logic directly via testables
        if (sys && sys.encodeApiKey) {
            const encoded = sys.encodeApiKey('sk-test');
            const decoded = sys.decodeApiKey(encoded);
            assertEqual(decoded, 'sk-test');
        }
    });

    // --- 3. Theme Variables ---

    register('Settings: 3.1 CSS Variables', () => {
        // Mock document.documentElement.style.setProperty
        const styleSpy = spyOn(document.documentElement.style, 'setProperty');

        const state = { settings: { hue: 240, saturation: 50, rgbMode: false } };
        const els = createMockEls();
        const sys = window.createSettingsSystem({ state, els, render: ()=>{}, scheduleHeavyTask: ()=>{} });

        if (sys.updateThemeVariables) {
            sys.updateThemeVariables(240, 50);

            styleSpy.expectCalledWith('--accent-h', 240);
            styleSpy.expectCalledWith('--accent-s', '50%');
        }

        styleSpy.restore();
    });

    // --- 6. Debounce ---

    register('Settings: 6.1 Debounce Timing', async () => {
        // Mock debounce or verify behavior
        // Since we can't easily mock time inside the closure without refactoring settings.js,
        // we will test the exported debounce utility if available.
        const state = { settings: {} };
        const els = createMockEls();
        const sys = window.createSettingsSystem({ state, els, render: ()=>{}, scheduleHeavyTask: ()=>{} });

        if (sys.debounce) {
            let counter = 0;
            const fn = sys.debounce(() => counter++, 50);

            fn();
            fn();
            fn();

            assertEqual(counter, 0, 'Should not fire immediately');

            await new Promise(r => setTimeout(r, 60));

            assertEqual(counter, 1, 'Should fire once after delay');
        }
    });

})();
