# Settings System Unit Test Blueprint (settings.js)
# Scope: scripts/settings.js (loadSettings/saveSettings, updateThemeVariables, initRgbLoop, updateRgbButtonColor, debounce/saveDebounced, Settings UI wiring)
# Test harness assumptions: JSDOM with document.documentElement.style, fake timers (setInterval, setTimeout), and a mock localStorage. Provide state, els, and render/scheduleHeavyTask spies. Use deterministic btoa/atob behavior (native or polyfill).

1. Test Fixtures & Helpers
    [ ] 1.1. Shared State Fixture (settingsState)
        [ ] 1.1.1. Initialize state.settings to defaults only when loadSettings runs
        [ ] 1.1.2. Verify state.settings default values:
            # hue: 28
            # saturation: 96
            # rgbMode: false
            # rgbSpeed: 5.0
            # brushPreviewResolution: 1080
            # adjustmentPreviewResolution: 1080
            # apiKey: ''
            # keyframeInterval: 10
            # keyframeBuffer: 5
            # useReplay: true
            # exportFormat: 'image/png'
            # exportQuality: 98
            # exportHeightCap: 4320
            # exportLayers: { merged: true, save: false, mask: false, front: false, back: false }
        [ ] 1.1.3. Create minimal DOM nodes for els (sliders/toggles) to support UI wiring tests
    [ ] 1.2. DOM Helpers
        [ ] 1.2.1. Add #setting-hue range input to DOM
        [ ] 1.2.2. Add #setting-saturation range input to DOM
        [ ] 1.2.3. Add #setting-rgb-mode checkbox to DOM
        [ ] 1.2.4. Add #setting-rgb-speed range input to DOM
        [ ] 1.2.5. Add #settings-btn and modal elements to DOM
        [ ] 1.2.6. Ensure document.documentElement.style is writable and readable via getPropertyValue
    [ ] 1.3. Storage Helpers
        [ ] 1.3.1. Mock localStorage.getItem and localStorage.setItem with in-memory store
        [ ] 1.3.2. Spy on localStorage.setItem calls
        [ ] 1.3.3. Create utility to set stored string to malformed JSON for error handling tests

2. loadSettings / saveSettings
    [ ] 2.1. loadSettings merges localStorage with defaults
        # Scenario: Stored settings missing keys are merged with defaults
        # Setup: localStorage.getItem('okazu_settings') returns JSON: { "hue": 120, "rgbMode": true, "exportQuality": 80 }
        [ ] 2.1.1. Call loadSettings()
        [ ] 2.1.2. Assert state.settings.hue === 0 (forced to 0 because rgbMode true)
        [ ] 2.1.3. Assert all default keys present (e.g., brushPreviewResolution still 1080)
        [ ] 2.1.4. Assert state.settings.exportQuality === 80
        [ ] 2.1.5. Assert state.settings.exportFormat === 'image/png'
    [ ] 2.2. loadSettings decode/encode API key round-trip
        # Scenario: Stored API key is decoded on load and encoded on save
        # Setup: Prepare raw key 'sk-test-123' and store encoded key in localStorage
        [ ] 2.2.1. Call loadSettings()
        [ ] 2.2.2. Call saveSettings()
        [ ] 2.2.3. Assert after loadSettings, state.settings.apiKey === rawKey
        [ ] 2.2.4. Assert on saveSettings, localStorage stores encoded form (not plain text)
        [ ] 2.2.5. Assert localStorage.setItem was called with JSON where apiKey !== rawKey
    [ ] 2.3. rgbMode hue persistence rules
        # Scenario: When RGB mode is active, save stores last static hue, not cycling hue
        # Setup: state.settings.rgbMode = true, state.settings.hue = 200 (cycling), lastStaticHue = 50
        [ ] 2.3.1. Call saveSettings()
        [ ] 2.3.2. Assert saved JSON has hue: 50 (lastStaticHue)
        [ ] 2.3.3. Assert parsed stored JSON hue equals 50
    [ ] 2.4. loadSettings error handling on malformed storage
        # Scenario: Invalid JSON in storage falls back to defaults and logs error
        # Setup: localStorage.getItem returns '{'
        [ ] 2.4.1. Call loadSettings()
        [ ] 2.4.2. Assert console.error invoked
        [ ] 2.4.3. Assert state.settings equals defaults object
        [ ] 2.4.4. Assert state.settings.hue === 28
        [ ] 2.4.5. Assert state.settings.rgbMode === false

3. updateThemeVariables
    [ ] 3.1. CSS variable math for hue/saturation/lightness
        # Scenario: CSS vars reflect computed --accent-* values
        # Setup: state.settings.rgbMode = false
        [ ] 3.1.1. Call updateThemeVariables(240, 50)
        [ ] 3.1.2. Assert --accent-h = 240
        [ ] 3.1.3. Assert --accent-s = '50%'
        [ ] 3.1.4. Compute expected buttonL: satBoost = (100-50)*0.4 = 20; hueBoost = cos((240-240)°)*15 = 15; buttonL = min(95, 56+20+15=91) -> 91
        [ ] 3.1.5. Assert --accent-l equals 91%
    [ ] 3.2. log-accent derivations
        # Scenario: --log-accent-color uses logHue and boosted lightness
        # Setup: state.settings.rgbMode = true, hue = 100, sat = 100
        [ ] 3.2.1. Call updateThemeVariables(100, 100)
        [ ] 3.2.2. Assert logHue = (hue * 3) % 360 = 300
        [ ] 3.2.3. Assert --log-accent-color equals hsl(300, 100%, <computed logInkL>%)
        # Note: logInkL clamped to >= 75 and <= 98

4. initRgbLoop
    [ ] 4.1. interval calculation respects rgbSpeed
        # Scenario: Theme interval uses baseInterval / rgbSpeed
        # Setup: state.settings.rgbSpeed = 2, fake timers active
        [ ] 4.1.1. Call initRgbLoop()
        [ ] 4.1.2. Assert setInterval called with interval = 125 / 2 = 62.5
    [ ] 4.2. hue cycling behavior (rgbMode on)
        # Scenario: When rgbMode true, hue increments and updates theme variables and slider
        # Setup: state.settings.rgbMode = true, state.settings.hue = 10, state.settings.saturation = 80, cycleHue starts at 10, DOM includes #setting-hue input, fake timers, spy updateThemeVariables
        [ ] 4.2.1. Call initRgbLoop()
        [ ] 4.2.2. Advance timers by one tick
        [ ] 4.2.3. Assert cycleHue increases by 0.5
        [ ] 4.2.4. Assert state.settings.hue updated to new cycleHue
        [ ] 4.2.5. Assert updateThemeVariables invoked with new hue/saturation
        [ ] 4.2.6. Assert #setting-hue.value === String(state.settings.hue)
    [ ] 4.3. button color updates
        # Scenario: Button interval advances fast and calls updateRgbButtonColor
        # Setup: Fake timers, spy on updateRgbButtonColor
        [ ] 4.3.1. Call initRgbLoop()
        [ ] 4.3.2. Advance timers by 10ms
        [ ] 4.3.3. Assert updateRgbButtonColor called once
        [ ] 4.3.4. Assert buttonHue incremented by 1 (Assert updateRgbButtonColor called with 1 if starting at 0)

5. updateRgbButtonColor
    [ ] 5.1. correctness of computed CSS variables
        # Scenario: CSS vars reflect computed color and ink from hue and saturation
        # Setup: state.settings.saturation = 40
        [ ] 5.1.1. Call updateRgbButtonColor(200)
        [ ] 5.1.2. Compute expected values:
            # satBoost = (100-40)*0.4 = 24
            # hueBoost = max(0, cos((200-240)°) * 15)
            # buttonL = min(95, 56 + satBoost + hueBoost)
            # inkL = 10 + max(0, (buttonL - 56) * 0.294)
        [ ] 5.1.3. Assert --rgb-button-color equals hsl(200, 40%, <buttonL>%)
        [ ] 5.1.4. Assert --rgb-button-ink equals hsl(200, 90%, <inkL>%)
        # Note: Match expected numbers within small float tolerance

6. debounce / saveDebounced
    [ ] 6.1. debounce timing behavior
        # Scenario: Debounced function fires only after wait, last call wins
        # Setup: fake timers, create debounce with wait 1000
        [ ] 6.1.1. Call debounced function three times within 500ms
        [ ] 6.1.2. Advance timers to 999ms
        [ ] 6.1.3. Assert no invocation occurs under 1000ms
        [ ] 6.1.4. Advance timers to 1000ms (after last call)
        [ ] 6.1.5. Assert one invocation occurred with last args
        [ ] 6.1.6. Assert call count is 1
    [ ] 6.2. saveDebounced uses saveSettings
        # Scenario: saveDebounced wraps saveSettings with 1s debounce
        # Setup: spy on saveSettings, fake timers
        [ ] 6.2.1. Call saveDebounced() twice quickly
        [ ] 6.2.2. Advance timers 1000ms
        [ ] 6.2.3. Assert saveSettings called exactly once

7. Settings UI Wiring
    # These tests validate that UI interaction updates state.settings, triggers saveSettings/saveDebounced, and triggers render or heavy task scheduling.
    [ ] 7.1. Slider changes update state and theme
        # Scenario: Hue slider updates state.settings.hue and calls updateThemeVariables
        # Setup: Insert #setting-hue range input, ensure handler registered, state.settings.rgbMode = false
        [ ] 7.1.1. Dispatch input event with value 180 to #setting-hue
        [ ] 7.1.2. Assert state.settings.hue === 180
        [ ] 7.1.3. Assert updateThemeVariables(180, state.settings.saturation) called
        [ ] 7.1.4. Assert saveDebounced called
    [ ] 7.2. Saturation slider change updates theme
        # Scenario: Saturation slider updates settings and theme variables
        # Setup: #setting-saturation input, updateThemeVariables spy
        [ ] 7.2.1. Dispatch input event with value 70 to #setting-saturation
        [ ] 7.2.2. Assert state.settings.saturation === 70
        [ ] 7.2.3. Assert updateThemeVariables called with (current hue, 70)
    [ ] 7.3. RGB mode toggle changes hue behavior
        # Scenario: toggling rgbMode on sets hue to 0 and starts loop
        # Setup: #setting-rgb-mode checkbox, state.settings.hue = 120, lastStaticHue = 120, spy initRgbLoop
        [ ] 7.3.1. Set #setting-rgb-mode checkbox checked true
        [ ] 7.3.2. Dispatch change event
        [ ] 7.3.3. Assert state.settings.rgbMode === true
        [ ] 7.3.4. Assert state.settings.hue === 0
        [ ] 7.3.5. Assert initRgbLoop called
        [ ] 7.3.6. Assert saveDebounced called
    [ ] 7.4. RGB speed slider updates loop interval
        # Scenario: Changing rgbSpeed reinitializes loop
        # Setup: #setting-rgb-speed range input, spy on initRgbLoop and saveDebounced
        [ ] 7.4.1. Set #setting-rgb-speed value to 8
        [ ] 7.4.2. Dispatch change or input event
        [ ] 7.4.3. Assert state.settings.rgbSpeed === 8
        [ ] 7.4.4. Assert initRgbLoop called to apply new speed
        [ ] 7.4.5. Assert saveDebounced called
    [ ] 7.5. Export settings toggles and selects
        # Scenario: Export controls update state.settings.exportLayers / exportFormat and save
        # Setup: create toggle inputs for exportLayers (merged, save, etc.), select for export format
        [ ] 7.5.1. Toggle exportLayers.mask on
        [ ] 7.5.2. Set format to image/webp
        [ ] 7.5.3. Assert state updated
        [ ] 7.5.4. Assert saveDebounced called
        [ ] 7.5.5. Note: check for render/scheduleHeavyTask if used
    [ ] 7.6. apiKey input triggers save and encode later
        # Scenario: API key input updates state and persists via save
        # Setup: text input bound to apiKey, saveDebounced spy
        [ ] 7.6.1. Set value to sk-test-123
        [ ] 7.6.2. Dispatch input event
        [ ] 7.6.3. Assert state.settings.apiKey equals raw key (not encoded)
        [ ] 7.6.4. Assert saveDebounced called
    [ ] 7.7. render triggers on relevant setting changes
        # Scenario: Performance-related settings trigger render or scheduleHeavyTask
        # Setup: spy render and scheduleHeavyTask
        [ ] 7.7.1. Change brushPreviewResolution via UI control
        [ ] 7.7.2. Change adjustmentPreviewResolution via UI control
        [ ] 7.7.3. Assert state.settings.* fields updated
        [ ] 7.7.4. Assert scheduleHeavyTask called with render or rebuild callback

