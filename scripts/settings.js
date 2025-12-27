
function createSettingsSystem({ state, els, render, scheduleHeavyTask }) {

    // Default Settings
    const defaults = {
        hue: 28,
        saturation: 96,
        rgbMode: true,
        brushPreviewResolution: 1080, // 'p' refers to height
        adjustmentPreviewResolution: 1080,
        apiKey: '',
        keyframeInterval: 10,
        keyframeBuffer: 5,
        useReplay: false
    };

    let lastStaticHue = defaults.hue;
    let rgbInterval = null;

    // Load settings from localStorage or use defaults
    function loadSettings() {
        const stored = localStorage.getItem('okazu_settings');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Merge with defaults to ensure all keys exist
                state.settings = { ...defaults, ...parsed };
                // Decode API Key if present
                if (state.settings.apiKey) {
                    state.settings.apiKey = decodeApiKey(state.settings.apiKey);
                }
                lastStaticHue = state.settings.hue;
            } catch (e) {
                console.error("Failed to load settings", e);
                state.settings = { ...defaults };
            }
        } else {
            state.settings = { ...defaults };
        }

        // If RGB mode is active on load, force start at Hue 0 (Red)
        if (state.settings.rgbMode) {
            state.settings.hue = 0;
        }

        applySettings();
    }

    // Save settings to localStorage
    function saveSettings() {
        const toSave = { ...state.settings };
        // Encode API Key before saving
        if (toSave.apiKey) {
            toSave.apiKey = encodeApiKey(toSave.apiKey);
        }

        // If RGB mode is active, don't save the current cycling hue, save the last user-set hue.
        if (toSave.rgbMode) {
             toSave.hue = lastStaticHue;
        }

        // Don't save runtime state if any
        localStorage.setItem('okazu_settings', JSON.stringify(toSave));
    }

    // Simple obfuscation (Not secure, just prevents casual reading)
    function encodeApiKey(key) {
        if (!key) return '';
        try {
            return btoa(key.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (i % 255))).join(''));
        } catch (e) { return key; }
    }

    function decodeApiKey(encoded) {
        if (!encoded) return '';
        try {
            return atob(encoded).split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (i % 255))).join('');
        } catch (e) { return encoded; }
    }

    function updateThemeVariables(hue, sat) {
        // Boost lightness for pastels (low saturation)
        // At sat=100, boost=0. At sat=0, boost=40.
        const satBoost = (100 - sat) * 0.4;

        // Boost lightness for darker hues (Blue/Purple area around 240)
        // Cosine peak at 240deg.
        // hue 240 -> cos(0) = 1 -> boost 15
        // hue 60 -> cos(-180) = -1 -> boost 0 (clamped)
        const hueBoost = Math.max(0, Math.cos((hue - 240) * Math.PI / 180)) * 15;

        // Base lightness 56, max 95
        const buttonL = Math.min(95, 56 + satBoost + hueBoost);

        // Ink Lightness
        // Base 10% lightness. If button is very light (e.g. 90%), ink should be slightly lighter (20%)
        // to avoid harsh black-on-pastel contrast? Or maybe just keep it dark.
        // User requested: "10% when button is 56% and 20% when button is 90%"
        // slope = (20 - 10) / (90 - 56) = 10 / 34 ~= 0.294
        const inkL = 10 + Math.max(0, (buttonL - 56) * 0.294);

        document.documentElement.style.setProperty('--accent-h', hue);
        document.documentElement.style.setProperty('--accent-s', `${sat}%`);
        document.documentElement.style.setProperty('--accent-l', `${buttonL}%`);
        document.documentElement.style.setProperty('--accent-ink', `hsl(${hue}, 90%, ${inkL}%)`);
    }

    function applySettings() {
        updateThemeVariables(state.settings.hue, state.settings.saturation);

        // Handle RGB Mode
        if (state.settings.rgbMode) {
            startRgbMode();
        } else {
            stopRgbMode();
        }
    }

    function startRgbMode() {
        if (rgbInterval) return;
        rgbInterval = setInterval(() => {
            state.settings.hue = (state.settings.hue + 0.5) % 360;
            updateThemeVariables(state.settings.hue, state.settings.saturation);
            // Update slider if visible
            const slider = document.getElementById('setting-hue');
            if (slider) slider.value = state.settings.hue;
            // We don't save constantly during RGB mode loop
        }, 125); // 0.5 notch per 125ms (4x speed)
    }

    function stopRgbMode() {
        if (rgbInterval) {
            clearInterval(rgbInterval);
            rgbInterval = null;
        }
    }

    // Debounce utility
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    const saveDebounced = debounce(saveSettings, 1000);

    // UI Construction
    function initSettingsUI() {
        const modalHtml = `
            <div id="settings-overlay" class="hidden fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-200 opacity-0">
                <div id="settings-modal" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[150%] bg-panel border border-panel w-[500px] max-w-[90vw] rounded-lg shadow-2xl p-6 transition-all duration-300 ease-in-out">
                    <h2 class="text-xl font-bold text-gray-200 mb-6 border-b border-panel-divider pb-2">Settings</h2>

                    <!-- UI Hue -->
                    <div class="mb-6">
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">UI Theme Hue/Saturation</label>
                        <div class="grid grid-cols-[1fr_auto] grid-rows-2 gap-x-4 gap-y-3 items-center">
                            <input id="setting-hue" type="range" min="0" max="360" class="w-full accent-accent">
                            <button id="setting-rgb-toggle" class="text-xs font-bold text-gray-400 hover:text-white uppercase px-2 py-1 rounded border border-panel-divider hover:bg-panel-strong transition-colors">RGB</button>
                            <input id="setting-saturation" type="range" min="0" max="100" class="w-full accent-accent">
                            <button id="setting-hue-reset" class="text-xs font-bold text-accent hover:text-white uppercase px-2 py-1 rounded border border-panel-divider hover:bg-panel-strong transition-colors">Default</button>
                        </div>
                    </div>

                    <!-- Brush Resolution -->
                    <div class="mb-6">
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Brush Preview Resolution (Height)</label>
                        <div class="flex rounded bg-panel-strong p-1 gap-1">
                            <button class="res-btn-brush flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="720">720p</button>
                            <button class="res-btn-brush flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="1080">1080p</button>
                            <button class="res-btn-brush flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="Full">Full</button>
                        </div>
                    </div>

                    <!-- Adjustment Resolution -->
                    <div class="mb-6">
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Adjustment Preview Resolution (Height)</label>
                        <div class="flex rounded bg-panel-strong p-1 gap-1">
                            <button class="res-btn-adj flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="720">720p</button>
                            <button class="res-btn-adj flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="1080">1080p</button>
                            <button class="res-btn-adj flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="Full">Full</button>
                        </div>
                    </div>

                    <!-- Undo History -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest">Undo History (Replay Buffer)</label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <span class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Enable Replay (Beta)</span>
                                <input type="checkbox" id="setting-use-replay" class="accent-accent">
                            </label>
                        </div>
                        <div class="flex gap-4">
                            <div class="flex-1">
                                <div class="flex justify-between mb-1">
                                    <span class="text-[10px] text-gray-400">Keyframe Interval</span>
                                    <span id="val-keyframe-interval" class="text-[10px] text-gray-400">10</span>
                                </div>
                                <input id="setting-keyframe-interval" type="range" min="1" max="50" step="1" class="w-full accent-accent">
                            </div>
                            <div class="flex-1">
                                <div class="flex justify-between mb-1">
                                    <span class="text-[10px] text-gray-400">Buffer Depth</span>
                                    <span id="val-keyframe-buffer" class="text-[10px] text-gray-400">5</span>
                                </div>
                                <input id="setting-keyframe-buffer" type="range" min="1" max="20" step="1" class="w-full accent-accent">
                            </div>
                        </div>
                    </div>

                    <!-- Logs -->
                    <div class="mt-4 pt-4 border-t border-panel-divider text-right">
                        <button id="copy-logs-btn" class="text-[10px] font-bold text-gray-500 hover:text-accent uppercase tracking-wider cursor-pointer bg-transparent border-none p-0 transition-colors">
                            Copy Session Logs
                        </button>
                    </div>

                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const overlay = document.getElementById('settings-overlay');
        const modal = document.getElementById('settings-modal');
        const btn = document.getElementById('settingsBtn');

        // Wiring
        btn.addEventListener('click', openSettings);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeSettings();
        });

        // Hue Controls
        const hueSlider = document.getElementById('setting-hue');
        const saturationSlider = document.getElementById('setting-saturation');
        const hueReset = document.getElementById('setting-hue-reset');
        const rgbToggle = document.getElementById('setting-rgb-toggle');

        hueSlider.value = state.settings.hue;
        saturationSlider.value = state.settings.saturation;
        hueSlider.addEventListener('input', (e) => {
            state.settings.hue = parseInt(e.target.value);
            // If dragging slider, disable RGB mode
            if (state.settings.rgbMode) {
                state.settings.rgbMode = false;
                updateRgbButtonState();
                stopRgbMode();
            }
            lastStaticHue = state.settings.hue;
            applySettings();
            saveDebounced();
        });

        saturationSlider.addEventListener('input', (e) => {
            state.settings.saturation = parseInt(e.target.value);
            applySettings();
            saveDebounced();
        });

        hueReset.addEventListener('click', () => {
            state.settings.hue = defaults.hue; // Default orange
            state.settings.saturation = defaults.saturation;
            hueSlider.value = defaults.hue;
            saturationSlider.value = defaults.saturation;
            if (state.settings.rgbMode) {
                state.settings.rgbMode = false;
                updateRgbButtonState();
                stopRgbMode();
            }
            lastStaticHue = defaults.hue;
            applySettings();
            saveSettings();
        });

        rgbToggle.addEventListener('click', () => {
            state.settings.rgbMode = !state.settings.rgbMode;
            updateRgbButtonState();
            applySettings();
            saveSettings();
        });

        function updateRgbButtonState() {
            if (state.settings.rgbMode) {
                rgbToggle.classList.add('bg-accent', 'border-accent');
                rgbToggle.classList.remove('text-gray-400', 'hover:bg-panel-strong');
            } else {
                rgbToggle.classList.remove('bg-accent', 'border-accent');
                rgbToggle.classList.add('text-gray-400', 'hover:bg-panel-strong');
            }
        }
        updateRgbButtonState();

        // Resolution Switches
        function setupResSwitch(selector, settingKey) {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = btn.dataset.val;
                    state.settings[settingKey] = val === 'Full' ? 'Full' : parseInt(val);
                    updateResButtons(selector, settingKey);
                    saveSettings();
                });
            });
            updateResButtons(selector, settingKey);
        }

        function updateResButtons(selector, settingKey) {
            const current = state.settings[settingKey];
            document.querySelectorAll(selector).forEach(btn => {
                const val = btn.dataset.val === 'Full' ? 'Full' : parseInt(btn.dataset.val);
                if (val === current) {
                    btn.classList.add('bg-accent');
                    btn.classList.remove('text-gray-400', 'hover:bg-panel-800');
                } else {
                    btn.classList.remove('bg-accent');
                    btn.classList.add('text-gray-400', 'hover:bg-panel-800');
                }
            });
        }

        setupResSwitch('.res-btn-brush', 'brushPreviewResolution');
        setupResSwitch('.res-btn-adj', 'adjustmentPreviewResolution');

        // Undo History Settings
        const keyframeIntervalSlider = document.getElementById('setting-keyframe-interval');
        const keyframeIntervalVal = document.getElementById('val-keyframe-interval');
        const keyframeBufferSlider = document.getElementById('setting-keyframe-buffer');
        const keyframeBufferVal = document.getElementById('val-keyframe-buffer');

        keyframeIntervalSlider.value = state.settings.keyframeInterval;
        keyframeIntervalVal.textContent = state.settings.keyframeInterval;

        keyframeBufferSlider.value = state.settings.keyframeBuffer;
        keyframeBufferVal.textContent = state.settings.keyframeBuffer;

        keyframeIntervalSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            state.settings.keyframeInterval = val;
            keyframeIntervalVal.textContent = val;
            saveDebounced();
        });

        keyframeBufferSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            state.settings.keyframeBuffer = val;
            keyframeBufferVal.textContent = val;
            saveDebounced();
        });

        const useReplayCheckbox = document.getElementById('setting-use-replay');
        useReplayCheckbox.checked = state.settings.useReplay;
        useReplayCheckbox.addEventListener('change', (e) => {
            state.settings.useReplay = e.target.checked;
            saveSettings();
            // Notify main app if needed? Global state is updated.
            // main.js checks state.settings.useReplay dynamically.
        });

        // Copy Logs
        const copyLogsBtn = document.getElementById('copy-logs-btn');
        if (copyLogsBtn) {
            copyLogsBtn.addEventListener('click', () => {
                const logger = window.Logger;
                if (logger && logger.getLogs) {
                    const logs = logger.getLogs();
                    navigator.clipboard.writeText(logs).then(() => {
                        const originalText = copyLogsBtn.textContent;
                        copyLogsBtn.textContent = "COPIED!";
                        copyLogsBtn.classList.add('text-accent');
                        setTimeout(() => {
                            copyLogsBtn.textContent = originalText;
                            copyLogsBtn.classList.remove('text-accent');
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy logs', err);
                        copyLogsBtn.textContent = "ERROR";
                    });
                } else {
                    console.error("Logger not found or getLogs missing");
                }
            });
        }

        // Modal Logic
        function openSettings() {
            overlay.classList.remove('hidden');
            // Trigger reflow
            void overlay.offsetWidth;
            overlay.classList.remove('opacity-0');

            // Slide in from top
            modal.style.transform = 'translate(-50%, -50%)';
            // -50% Y is centered. Start was -150% (above)
        }

        function closeSettings() {
            saveSettings(); // Ensure save on close
            overlay.classList.add('opacity-0');
            // Slide out to bottom
            modal.style.transform = 'translate(-50%, 150%)'; // Off screen bottom

            setTimeout(() => {
                overlay.classList.add('hidden');
                // Reset position for next open (back to top)
                modal.style.transform = 'translate(-50%, -150%)';
            }, 300); // Match duration
        }
    }

    // Autosave on unload
    window.addEventListener('beforeunload', () => {
        saveSettings();
    });

    // Init logic
    loadSettings();
    initSettingsUI();

    return {
        // Expose if needed
    };
}
