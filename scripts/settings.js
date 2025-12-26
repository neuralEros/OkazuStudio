
function createSettingsSystem({ state, els, render, scheduleHeavyTask }) {

    // Default Settings
    const defaults = {
        hue: 28,
        rgbMode: false,
        brushPreviewResolution: 1080, // 'p' refers to height
        adjustmentPreviewResolution: 1080,
        apiKey: '',
        undoKeyframeInterval: 20,
        undoHistoryLimit: 5
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

    function applySettings() {
        // Apply Hue
        document.documentElement.style.setProperty('--accent-h', state.settings.hue);

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
            state.settings.hue = (state.settings.hue + 1) % 360;
            document.documentElement.style.setProperty('--accent-h', state.settings.hue);
            // Update slider if visible
            const slider = document.getElementById('setting-hue');
            if (slider) slider.value = state.settings.hue;
            // We don't save constantly during RGB mode loop
        }, 1000); // 1 notch per second
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
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">UI Theme Hue</label>
                        <div class="flex items-center gap-4">
                            <input id="setting-hue" type="range" min="0" max="360" class="flex-grow accent-accent">
                            <button id="setting-hue-reset" class="text-xs font-bold text-accent hover:text-white uppercase px-2 py-1 rounded border border-panel-divider hover:bg-panel-strong transition-colors">Default</button>
                            <button id="setting-rgb-toggle" class="text-xs font-bold text-gray-400 hover:text-white uppercase px-2 py-1 rounded border border-panel-divider hover:bg-panel-strong transition-colors">RGB</button>
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

                    <!-- API Key -->
                    <div class="mb-6">
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Replicate AI API Key</label>
                        <input id="setting-api-key" type="password" class="w-full bg-panel-strong border border-panel rounded-sm px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors" placeholder="r8_...">
                        <p class="text-[10px] text-gray-500 mt-1">Stored locally in your browser.</p>
                    </div>

                    <!-- Undo Settings -->
                    <div class="mb-2">
                         <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-panel-divider pb-1">Undo History</h3>

                         <div class="mb-4">
                            <label class="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>Keyframe Interval (Actions)</span>
                                <span id="val-undo-interval">20</span>
                            </label>
                            <input id="setting-undo-interval" type="range" min="5" max="100" step="5" class="w-full accent-accent">
                         </div>

                         <div class="mb-2">
                            <label class="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>Max Keyframes Kept</span>
                                <span id="val-undo-limit">5</span>
                            </label>
                            <input id="setting-undo-limit" type="range" min="1" max="50" step="1" class="w-full accent-accent">
                            <p class="text-[10px] text-gray-500 mt-1">More keyframes = Faster undo, More RAM.</p>
                         </div>
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
        const hueReset = document.getElementById('setting-hue-reset');
        const rgbToggle = document.getElementById('setting-rgb-toggle');

        hueSlider.value = state.settings.hue;
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

        hueReset.addEventListener('click', () => {
            state.settings.hue = 28; // Default orange
            hueSlider.value = 28;
            if (state.settings.rgbMode) {
                state.settings.rgbMode = false;
                updateRgbButtonState();
                stopRgbMode();
            }
            lastStaticHue = 28;
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
                rgbToggle.classList.add('bg-accent', 'border-accent', 'text-white');
                rgbToggle.classList.remove('text-gray-400', 'hover:bg-panel-strong');
            } else {
                rgbToggle.classList.remove('bg-accent', 'border-accent', 'text-white');
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
                    btn.classList.add('bg-accent', 'text-white');
                    btn.classList.remove('text-gray-400', 'hover:bg-panel-800');
                } else {
                    btn.classList.remove('bg-accent', 'text-white');
                    btn.classList.add('text-gray-400', 'hover:bg-panel-800');
                }
            });
        }

        setupResSwitch('.res-btn-brush', 'brushPreviewResolution');
        setupResSwitch('.res-btn-adj', 'adjustmentPreviewResolution');

        // API Key
        const keyInput = document.getElementById('setting-api-key');
        keyInput.value = state.settings.apiKey;
        keyInput.addEventListener('input', (e) => {
            state.settings.apiKey = e.target.value;
            saveDebounced();
        });

        // Undo Settings
        const undoIntervalInput = document.getElementById('setting-undo-interval');
        const undoIntervalVal = document.getElementById('val-undo-interval');
        const undoLimitInput = document.getElementById('setting-undo-limit');
        const undoLimitVal = document.getElementById('val-undo-limit');

        undoIntervalInput.value = state.settings.undoKeyframeInterval || 20;
        undoIntervalVal.textContent = undoIntervalInput.value;

        undoLimitInput.value = state.settings.undoHistoryLimit || 5;
        undoLimitVal.textContent = undoLimitInput.value;

        undoIntervalInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            state.settings.undoKeyframeInterval = val;
            undoIntervalVal.textContent = val;
            saveSettings();
        });

        undoLimitInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            state.settings.undoHistoryLimit = val;
            undoLimitVal.textContent = val;
            saveSettings();
        });

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
