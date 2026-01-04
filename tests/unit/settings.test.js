(function() {
    const { register, assert, assertEqual, assertApprox, spyOn, assertDeepEqual } = window.TestRunner;

    // 1. Test Fixtures & Helpers
    function createMockState() {
        return { settings: {} };
    }

    function createMockEls() {
        const createEl = (id) => {
            const el = document.createElement('input');
            el.id = id;
            return el;
        };
        return {
            hueSlider: createEl('setting-hue'),
            saturationSlider: createEl('setting-saturation'),
            rgbToggle: document.createElement('button'),
            rgbSpeedSlider: createEl('setting-rgb-speed'),
            settingsBtn: document.createElement('button'),
            // other els needed by initSettingsUI...
        };
    }

    // 2. loadSettings / saveSettings
    register('Settings: loadSettings merges defaults', () => {
        const state = createMockState();
        // Mock localStorage
        const getItem = spyOn(localStorage, 'getItem');
        getItem.mockReturnValue(JSON.stringify({ hue: 120, rgbMode: true, exportQuality: 80 }));

        const settingsSys = window.createSettingsSystem({ state, els: {}, render: () => {}, scheduleHeavyTask: () => {} });

        // hue is forced to 0 because rgbMode is true in logic
        assertEqual(state.settings.hue, 0);
        assertEqual(state.settings.rgbMode, true);
        assertEqual(state.settings.exportQuality, 80);
        assertEqual(state.settings.brushPreviewResolution, 1080); // Default preserved

        getItem.restore();
    });

    register('Settings: saveSettings stores encoded API key', () => {
        const state = createMockState();
        state.settings = { apiKey: 'sk-test-123' };

        const setItem = spyOn(localStorage, 'setItem');

        const settingsSys = window.createSettingsSystem({ state, els: {}, render: () => {}, scheduleHeavyTask: () => {} });
        window.OkazuTestables.settings.saveSettings();

        const stored = JSON.parse(setItem.calls[0][1]);
        assert(stored.apiKey !== 'sk-test-123', 'Key should be encoded');

        setItem.restore();
    });

    register('Settings: saveSettings preserves last static hue in RGB mode', () => {
        const state = createMockState();
        state.settings = { rgbMode: true, hue: 200 }; // cycling

        const settingsSys = window.createSettingsSystem({ state, els: {}, render: () => {}, scheduleHeavyTask: () => {} });
        window.OkazuTestables.settings.setLastStaticHue(50);

        const setItem = spyOn(localStorage, 'setItem');
        window.OkazuTestables.settings.saveSettings();

        const stored = JSON.parse(setItem.calls[0][1]);
        assertEqual(stored.hue, 50, 'Should save last static hue');

        setItem.restore();
    });

    // 3. updateThemeVariables
    register('Settings: updateThemeVariables logic', () => {
        const state = createMockState();
        const settingsSys = window.createSettingsSystem({ state, els: {}, render: () => {}, scheduleHeavyTask: () => {} });

        // Mock style.setProperty
        const setProp = spyOn(document.documentElement.style, 'setProperty');

        window.OkazuTestables.settings.updateThemeVariables(240, 50);

        // Checks based on logic in settings.js
        // --accent-h: 240
        // --accent-s: 50%
        // satBoost = (100-50)*0.4 = 20
        // hueBoost = cos(0)*15 = 15
        // buttonL = min(95, 56+20+15=91) -> 91
        // inkL = 10 + (91-56)*0.294 = 10 + 10.29 = 20.29

        // Check calls
        const calls = setProp.calls;
        const getVal = (key) => calls.find(c => c[0] === key)?.[1];

        assertEqual(getVal('--accent-h'), 240);
        assertEqual(getVal('--accent-s'), '50%');
        assertEqual(getVal('--accent-l'), '91%');

        setProp.restore();
    });

    // 4. initRgbLoop
    register('Settings: initRgbLoop interval', () => {
        const state = createMockState();
        state.settings = { rgbSpeed: 2.0, rgbMode: false };

        const setIntervalSpy = spyOn(window, 'setInterval');
        const settingsSys = window.createSettingsSystem({ state, els: {}, render: () => {}, scheduleHeavyTask: () => {} });

        window.OkazuTestables.settings.initRgbLoop();

        // First interval (Theme Loop): 125 / 2 = 62.5
        // Second interval (Button Loop): 10
        // Since calls order might vary or check args
        const themeCall = setIntervalSpy.calls.find(c => c[1] === 62.5);
        assert(themeCall, 'Should start theme loop with correct interval');

        setIntervalSpy.restore();
        window.OkazuTestables.settings.stopRgbLoop();
    });

    register('Settings: cycle behavior', () => {
        const state = createMockState();
        state.settings = { rgbMode: true, hue: 10, saturation: 80 };
        window.OkazuTestables.settings.setCycleHue(10);

        // Mock setProperty to avoid error
        const setProp = spyOn(document.documentElement.style, 'setProperty');

        // We need to run the loop callback.
        // We can't easily extract the callback from setInterval spy unless we capture it.
        let themeCallback = null;
        const setIntervalSpy = spyOn(window, 'setInterval');
        setIntervalSpy.mockImplementation((cb, ms) => {
            if (ms > 10) themeCallback = cb; // Assume >10ms is theme loop
            return 123;
        });

        const settingsSys = window.createSettingsSystem({ state, els: {}, render: () => {}, scheduleHeavyTask: () => {} });
        window.OkazuTestables.settings.initRgbLoop();

        if (!themeCallback) throw new Error("Theme callback not captured");

        // Run tick
        themeCallback();

        // Check cycleHue incremented by 0.5
        assertEqual(window.OkazuTestables.settings.getCycleHue(), 10.5);
        assertEqual(state.settings.hue, 10.5);

        setProp.restore();
        setIntervalSpy.restore();
        window.OkazuTestables.settings.stopRgbLoop();
    });

    // 6. debounce
    register('Settings: debounce', async () => {
        let calls = 0;
        const fn = () => { calls++; };
        const debounced = window.OkazuTestables.settings.debounce(fn, 50);

        debounced();
        debounced();
        debounced();

        assertEqual(calls, 0);

        await new Promise(r => setTimeout(r, 60));

        assertEqual(calls, 1);
    });

})();
