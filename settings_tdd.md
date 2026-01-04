# Settings System Unit Test Blueprint (settings.js)

> Scope: `scripts/settings.js` (loadSettings/saveSettings, updateThemeVariables, initRgbLoop, updateRgbButtonColor, debounce/saveDebounced, Settings UI wiring)
>
> Test harness assumptions: JSDOM with `document.documentElement.style`, fake timers (`setInterval`, `setTimeout`), and a mock `localStorage`. Provide `state`, `els`, and `render`/`scheduleHeavyTask` spies. Use deterministic `btoa/atob` behavior (native or polyfill).

---

## Test Fixtures & Helpers

### Shared State Fixture (`settingsState`)
- `state.settings` initialized to defaults only when `loadSettings` runs.
- `state.settings` default values (match `defaults` in file):
  - `hue: 28`, `saturation: 96`, `rgbMode: false`, `rgbSpeed: 5.0`, `brushPreviewResolution: 1080`, `adjustmentPreviewResolution: 1080`, `apiKey: ''`, `keyframeInterval: 10`, `keyframeBuffer: 5`, `useReplay: true`, `exportFormat: 'image/png'`, `exportQuality: 98`, `exportHeightCap: 4320`, `exportLayers: { merged: true, save: false, mask: false, front: false, back: false }`.
- `els`: DOM references used in UI wiring tests (create minimal DOM nodes for sliders/toggles).

### DOM Helpers
- Add to DOM:
  - `#setting-hue` range input.
  - `#setting-saturation` range input.
  - `#setting-rgb-mode` checkbox.
  - `#setting-rgb-speed` range input.
  - `#settings-btn` and modal elements if UI init requires them.
- Ensure `document.documentElement.style` is writable and can be read via `.getPropertyValue`.

### Storage Helpers
- Mock `localStorage.getItem`, `localStorage.setItem` with in-memory object store and spy on `setItem` calls.
- Utility to set stored string to malformed JSON for error handling tests.

---

## loadSettings / saveSettings

### 1) loadSettings merges localStorage with defaults
- **Scenario**: Stored settings missing keys are merged with defaults.
- **Setup**:
  - `localStorage.getItem('okazu_settings')` returns JSON: `{ "hue": 120, "rgbMode": true, "exportQuality": 80 }`.
- **Input**: `loadSettings()`.
- **Expected**:
  - `state.settings.hue === 0` (forced to 0 because rgbMode true).
  - All default keys present (e.g., `brushPreviewResolution` still 1080).
- **Assertions**:
  - `state.settings.exportQuality === 80`.
  - `state.settings.exportFormat === 'image/png'`.
  - `state.settings.hue === 0`.

### 2) loadSettings decode/encode API key round-trip
- **Scenario**: Stored API key is decoded on load and encoded on save.
- **Setup**:
  - Prepare raw key: `'sk-test-123'`.
  - Store encoded key in localStorage.
- **Input**:
  - `loadSettings()` then `saveSettings()`.
- **Expected**:
  - After `loadSettings`, `state.settings.apiKey === rawKey`.
  - On `saveSettings`, localStorage stores encoded form (not plain text).
- **Assertions**:
  - `localStorage.setItem` called with JSON where `apiKey !== rawKey`.

### 3) rgbMode hue persistence rules
- **Scenario**: When RGB mode is active, save stores last static hue, not cycling hue.
- **Setup**:
  - `state.settings.rgbMode = true`.
  - `state.settings.hue = 200` (cycling).
  - `lastStaticHue` captured via previous non-RGB state (simulate by setting to 50).
- **Input**: `saveSettings()`.
- **Expected**:
  - saved JSON has `hue: 50` (lastStaticHue).
- **Assertions**:
  - Parsed stored JSON `hue` equals 50.

### 4) loadSettings error handling on malformed storage
- **Scenario**: Invalid JSON in storage falls back to defaults and logs error.
- **Setup**: `localStorage.getItem` returns `'{'`.
- **Input**: `loadSettings()`.
- **Expected**:
  - `console.error` invoked.
  - `state.settings` equals defaults object.
- **Assertions**:
  - `state.settings.hue === 28`.
  - `state.settings.rgbMode === false`.

---

## updateThemeVariables

### 1) CSS variable math for hue/saturation/lightness
- **Scenario**: CSS vars reflect computed `--accent-*` values.
- **Setup**: `state.settings.rgbMode = false`.
- **Input**: `updateThemeVariables(240, 50)`.
- **Expected**:
  - `--accent-h = 240`.
  - `--accent-s = '50%'`.
  - `--accent-l` based on `buttonL = min(95, 56 + satBoost + hueBoost)`.
- **Assertions**:
  - Compute `satBoost = (100-50)*0.4 = 20`.
  - `hueBoost = cos((240-240)°)*15 = 15`.
  - `buttonL = min(95, 56+20+15=91)` -> 91.
  - `--accent-l` equals `91%`.

### 2) log-accent derivations
- **Scenario**: `--log-accent-color` uses logHue and boosted lightness.
- **Setup**:
  - `state.settings.rgbMode = true`.
  - `hue = 100`, `sat = 100`.
- **Input**: `updateThemeVariables(100, 100)`.
- **Expected**:
  - `logHue = (hue * 3) % 360 = 300`.
  - `logButtonL` computed from satBoost/hueBoost.
  - `logInkL` clamped to `>= 75` and `<= 98`.
- **Assertions**:
  - `--log-accent-color` equals `hsl(300, 100%, <computed logInkL>%)`.

---

## initRgbLoop

### 1) interval calculation respects rgbSpeed
- **Scenario**: Theme interval uses baseInterval / rgbSpeed.
- **Setup**:
  - `state.settings.rgbSpeed = 2`.
  - Fake timers active.
- **Input**: `initRgbLoop()`.
- **Expected**:
  - `setInterval` called with `interval = 125 / 2 = 62.5`.
- **Assertions**:
  - `setInterval` called with 62.5 (or close if rounding applied by environment).

### 2) hue cycling behavior (rgbMode on)
- **Scenario**: When rgbMode true, hue increments and updates theme variables and slider.
- **Setup**:
  - `state.settings.rgbMode = true`, `state.settings.hue = 10`, `state.settings.saturation = 80`.
  - `cycleHue` starts at 10.
  - DOM includes `#setting-hue` input.
  - Fake timers; spy on `updateThemeVariables`.
- **Input**: `initRgbLoop()`, advance timers by one tick.
- **Expected**:
  - `cycleHue` increases by 0.5.
  - `state.settings.hue` updated to new `cycleHue`.
  - `updateThemeVariables` invoked with new hue/saturation.
  - `#setting-hue.value` updated to new hue.
- **Assertions**:
  - `#setting-hue.value === String(state.settings.hue)`.

### 3) button color updates
- **Scenario**: Button interval advances fast and calls `updateRgbButtonColor`.
- **Setup**: Fake timers; spy on `updateRgbButtonColor`.
- **Input**: `initRgbLoop()`, advance timers by 10ms.
- **Expected**: `updateRgbButtonColor` called once and `buttonHue` incremented by 1.
- **Assertions**: `updateRgbButtonColor` called with `1` if `buttonHue` starts at 0.

---

## updateRgbButtonColor

### 1) correctness of computed CSS variables
- **Scenario**: CSS vars reflect computed color and ink from hue and saturation.
- **Setup**:
  - `state.settings.saturation = 40`.
- **Input**: `updateRgbButtonColor(200)`.
- **Expected**:
  - `satBoost = (100-40)*0.4 = 24`.
  - `hueBoost = max(0, cos((200-240)°) * 15)`.
  - `buttonL = min(95, 56 + satBoost + hueBoost)`.
  - `inkL = 10 + max(0, (buttonL - 56) * 0.294)`.
  - `--rgb-button-color = hsl(200, 40%, <buttonL>%)`.
  - `--rgb-button-ink = hsl(200, 90%, <inkL>%)`.
- **Assertions**: computed CSS variable values match expected numbers within small float tolerance.

---

## debounce / saveDebounced

### 1) debounce timing behavior
- **Scenario**: Debounced function fires only after wait, last call wins.
- **Setup**: fake timers; create `debounce` with wait `1000`.
- **Input**:
  - Call debounced function three times within 500ms.
  - Advance timers to 999ms then 1000ms.
- **Expected**:
  - Under 1000ms: no invocation.
  - At 1000ms after last call: one invocation with last args.
- **Assertions**:
  - call count 1; args match last call.

### 2) saveDebounced uses saveSettings
- **Scenario**: `saveDebounced` wraps `saveSettings` with 1s debounce.
- **Setup**: spy on `saveSettings`, fake timers.
- **Input**: call `saveDebounced()` twice quickly, advance timers 1000ms.
- **Expected**: `saveSettings` called once.
- **Assertions**: call count 1.

---

## Settings UI Wiring

> These tests validate that UI interaction updates `state.settings`, triggers `saveSettings`/`saveDebounced`, and triggers render or heavy task scheduling where appropriate. Use `initSettingsUI()` (if needed) or manually wire event handlers if UI wiring functions are exposed within the test harness.

### 1) Slider changes update state and theme
- **Scenario**: Hue slider updates `state.settings.hue` and calls `updateThemeVariables`.
- **Setup**:
  - Insert `#setting-hue` input type range.
  - Ensure handler registered in init.
  - `state.settings.rgbMode = false`.
- **Input**: dispatch `input` event with value `180`.
- **Expected**:
  - `state.settings.hue === 180`.
  - `updateThemeVariables(180, state.settings.saturation)` called.
  - `saveDebounced` called.
- **Assertions**: state change, updateThemeVariables spy, saveDebounced spy.

### 2) Saturation slider change updates theme
- **Scenario**: Saturation slider updates settings and theme variables.
- **Setup**: `#setting-saturation` input, `updateThemeVariables` spy.
- **Input**: value `70`, `input` event.
- **Expected**: `state.settings.saturation === 70`, `updateThemeVariables` called with current hue & 70.

### 3) RGB mode toggle changes hue behavior
- **Scenario**: toggling rgbMode on sets hue to 0 and starts loop.
- **Setup**:
  - `#setting-rgb-mode` checkbox.
  - `state.settings.hue = 120` and `lastStaticHue = 120`.
  - spy `initRgbLoop`.
- **Input**: set checkbox checked true and dispatch `change`.
- **Expected**:
  - `state.settings.rgbMode === true`.
  - `state.settings.hue === 0`.
  - `initRgbLoop` called.
  - `saveDebounced` called.

### 4) RGB speed slider updates loop interval
- **Scenario**: Changing rgbSpeed reinitializes loop.
- **Setup**: `#setting-rgb-speed` range input; spy on `initRgbLoop` and `saveDebounced`.
- **Input**: set value `8`, dispatch `change` or `input` (depending on wiring).
- **Expected**:
  - `state.settings.rgbSpeed === 8`.
  - `initRgbLoop` called to apply new speed.
  - `saveDebounced` called.

### 5) Export settings toggles and selects
- **Scenario**: Export controls update `state.settings.exportLayers` / `exportFormat` and save.
- **Setup**: create toggle inputs for `exportLayers.merged`, `exportLayers.save`, etc., and select for export format.
- **Input**: toggle `exportLayers.mask` on, set format to `image/webp`.
- **Expected**: state updated and `saveDebounced` called; render/scheduleHeavyTask if used.
- **Assertions**: state fields updated; saveDebounced called.

### 6) apiKey input triggers save and encode later
- **Scenario**: API key input updates state and persists via save.
- **Setup**: text input bound to apiKey; `saveDebounced` spy.
- **Input**: set value to `sk-test-123` and dispatch `input`.
- **Expected**:
  - `state.settings.apiKey` equals raw key (not encoded).
  - `saveDebounced` called.
- **Assertions**: state and call count.

### 7) render triggers on relevant setting changes
- **Scenario**: Performance-related settings trigger render or scheduleHeavyTask.
- **Setup**: spy `render` and `scheduleHeavyTask`.
- **Input**: change `brushPreviewResolution` and `adjustmentPreviewResolution` via UI controls.
- **Expected**:
  - `state.settings.*` updated.
  - `scheduleHeavyTask` called with render or rebuild callback.
- **Assertions**: ensure the correct function is called per wiring.

