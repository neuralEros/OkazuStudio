
function createSettingsSystem({ state, els, render, scheduleHeavyTask }) {

    // Default Settings
    const defaults = {
        hue: 28,
        saturation: 96,
        rgbMode: true,
        rgbSpeed: 1.0, // Multiplier (1.0 = 4 deg/s)
        brushPreviewResolution: 1080, // 'p' refers to height
        adjustmentPreviewResolution: 1080,
        apiKey: '',
        keyframeInterval: 10,
        keyframeBuffer: 5,
        useReplay: true
    };

    let lastStaticHue = defaults.hue;
    let rgbInterval = null;
    let debugPollInterval = null; // Polling for logs

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
        stopRgbMode(); // Restart if already running to apply new speed
        const baseInterval = 125;
        const interval = baseInterval / (state.settings.rgbSpeed || 1.0);

        rgbInterval = setInterval(() => {
            state.settings.hue = (state.settings.hue + 0.5) % 360;
            updateThemeVariables(state.settings.hue, state.settings.saturation);
            // Update slider if visible
            const slider = document.getElementById('setting-hue');
            if (slider) slider.value = state.settings.hue;
            // We don't save constantly during RGB mode loop
        }, interval); // 0.5 notch per interval
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
                <div id="settings-modal" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[150%] bg-panel-strong border border-panel border-panel-border w-[800px] max-w-[90vw] rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ease-in-out flex flex-col h-[500px]">

                    <!-- Header -->
                    <div class="flex items-center justify-between px-4 py-2 border-b border-panel-divider bg-panel-header shrink-0">
                        <h3 id="settings-title" class="text-lg font-bold text-accent translate-y-[1px]">Settings</h3>
                        <button id="settings-close" class="accent-action rounded-sm shadow-sm flex items-center justify-center w-6 h-6">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="flex flex-grow overflow-hidden">
                        <!-- Sidebar -->
                        <div class="w-1/4 bg-panel-strong border-r border-panel-divider flex flex-col pt-2">
                            <button class="settings-tab-btn active text-left px-4 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors border-l-4 border-transparent" data-tab="general">
                                General
                            </button>
                            <button class="settings-tab-btn text-left px-4 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors border-l-4 border-transparent" data-tab="performance">
                                Performance
                            </button>
                            <button class="settings-tab-btn text-left px-4 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors border-l-4 border-transparent" data-tab="debug">
                                Debug
                            </button>
                        </div>

                        <!-- Content Area -->
                        <div class="w-3/4 flex flex-col bg-panel">
                            <div class="p-4 overflow-y-auto flex-grow">

                                <!-- TAB: GENERAL -->
                                <div id="tab-general" class="settings-tab-content block">
                                    <div class="mb-6">
                                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">UI Theme Hue/Saturation</label>
                                        <div class="grid grid-cols-[1fr_auto] grid-rows-3 gap-x-4 gap-y-4 items-center">
                                            <input id="setting-hue" type="range" min="0" max="360" class="w-full accent-accent">
                                            <button id="setting-rgb-toggle" class="text-xs font-bold text-gray-400 hover:text-white uppercase px-2 py-1 rounded border border-panel-divider hover:bg-panel-strong transition-colors w-20">RGB</button>

                                            <input id="setting-saturation" type="range" min="0" max="100" class="w-full accent-accent">
                                            <button id="setting-hue-reset" class="text-xs font-bold text-accent hover:text-white uppercase px-2 py-1 rounded border border-panel-divider hover:bg-panel-strong transition-colors w-20">Default</button>

                                            <div class="col-span-2 flex flex-col gap-1 mt-2">
                                                <div class="flex justify-between">
                                                    <span class="text-[10px] text-gray-400 uppercase tracking-wider font-bold">RGB Cycle Speed</span>
                                                    <span id="val-rgb-speed" class="text-[10px] text-gray-400">1.0x</span>
                                                </div>
                                                <input id="setting-rgb-speed" type="range" min="0.1" max="5.0" step="0.1" class="w-full accent-accent">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- TAB: PERFORMANCE -->
                                <div id="tab-performance" class="settings-tab-content hidden">
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
                                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Undo History (Replay Buffer)</label>
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
                                </div>

                                <!-- TAB: DEBUG -->
                                <div id="tab-debug" class="settings-tab-content hidden h-full flex flex-col">
                                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Session Logs</label>
                                    <textarea id="debug-log-viewer" class="w-full flex-grow bg-black/20 border border-panel-divider rounded p-2 text-[10px] font-mono text-gray-400 resize-none focus:outline-none focus:ring-1 focus:ring-accent mb-4" readonly></textarea>
                                    <div class="flex justify-end gap-2 shrink-0">
                                        <button id="clear-logs-btn" class="px-3 py-1.5 text-xs font-bold rounded border border-panel-divider bg-panel-strong text-gray-400 hover:text-red-400 hover:bg-panel-800 transition-colors">Clear Log</button>
                                        <button id="copy-logs-btn" class="accent-action px-3 py-1.5 text-xs font-bold rounded-sm shadow-sm flex items-center justify-center transition-colors">Copy to Clipboard</button>
                                    </div>
                                </div>

                            </div>
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
        document.getElementById('settings-close').addEventListener('click', closeSettings);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeSettings();
        });

        // --- TAB SWITCHING ---
        const tabs = document.querySelectorAll('.settings-tab-btn');
        const contents = document.querySelectorAll('.settings-tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate all
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.backgroundColor = '';
                    t.style.color = '';
                    t.classList.add('text-gray-400', 'hover:text-white', 'hover:bg-white/5');
                });
                contents.forEach(c => c.classList.add('hidden'));

                // Activate clicked
                tab.classList.add('active');
                tab.classList.remove('text-gray-400', 'hover:text-white', 'hover:bg-white/5');

                // Set Tint
                tab.style.backgroundColor = 'hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.15)';
                tab.style.color = 'var(--accent-soft)';

                const targetId = tab.dataset.tab;
                document.getElementById(`tab-${targetId}`).classList.remove('hidden');

                if (targetId === 'debug') {
                    startLogPolling();
                } else {
                    stopLogPolling();
                }
            });
        });

        // Add initial active styling for General
        const generalTab = document.querySelector('[data-tab="general"]');
        if(generalTab) {
             generalTab.classList.add('active');
             generalTab.classList.remove('text-gray-400', 'hover:text-white', 'hover:bg-white/5');
             generalTab.style.backgroundColor = 'hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.15)';
             generalTab.style.color = 'var(--accent-soft)';
        }


        // --- GENERAL TAB ---

        // Hue Controls
        const hueSlider = document.getElementById('setting-hue');
        const saturationSlider = document.getElementById('setting-saturation');
        const hueReset = document.getElementById('setting-hue-reset');
        const rgbToggle = document.getElementById('setting-rgb-toggle');
        const rgbSpeedSlider = document.getElementById('setting-rgb-speed');
        const rgbSpeedVal = document.getElementById('val-rgb-speed');


        hueSlider.value = state.settings.hue;
        saturationSlider.value = state.settings.saturation;

        // RGB Speed
        rgbSpeedSlider.value = state.settings.rgbSpeed || 1.0;
        rgbSpeedVal.textContent = (state.settings.rgbSpeed || 1.0).toFixed(1) + 'x';


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

        rgbSpeedSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state.settings.rgbSpeed = val;
            rgbSpeedVal.textContent = val.toFixed(1) + 'x';
            if (state.settings.rgbMode) {
                startRgbMode(); // Restart with new speed
            }
            saveDebounced();
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


        // --- PERFORMANCE TAB ---

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


        // --- DEBUG TAB ---
        const logViewer = document.getElementById('debug-log-viewer');
        // Removed refresh btn
        const clearLogsBtn = document.getElementById('clear-logs-btn');
        const copyLogsBtn = document.getElementById('copy-logs-btn');

        function refreshLogs() {
            if (window.Logger && window.Logger.getLogs) {
                const currentLogs = window.Logger.getLogs();
                // Only update if changed to prevent selection flicker, although selection is hard in readonly
                if (logViewer.value !== currentLogs) {
                    logViewer.value = currentLogs;
                    logViewer.scrollTop = logViewer.scrollHeight;
                }
            } else {
                logViewer.value = "Logger not active.";
            }
        }

        function startLogPolling() {
            stopLogPolling();
            refreshLogs();
            debugPollInterval = setInterval(refreshLogs, 500);
        }

        function stopLogPolling() {
            if (debugPollInterval) {
                clearInterval(debugPollInterval);
                debugPollInterval = null;
            }
        }

        clearLogsBtn.addEventListener('click', () => {
             if (window.Logger && window.Logger.clear) {
                window.Logger.clear();
                refreshLogs();
            }
        });

        copyLogsBtn.addEventListener('click', () => {
            const logs = logViewer.value;
            navigator.clipboard.writeText(logs).then(() => {
                const originalText = copyLogsBtn.textContent;
                copyLogsBtn.textContent = "COPIED!";
                setTimeout(() => {
                    copyLogsBtn.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy logs', err);
            });
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

            // Default to General tab?
            // If debug was last active, we might want to start polling?
            // For now, let's just leave the DOM state as is (hidden tabs).
            // But if debug tab is currently visible class-wise, we should start polling.
            const debugTab = document.getElementById('tab-debug');
            if (debugTab && !debugTab.classList.contains('hidden')) {
                startLogPolling();
            }
        }

        function closeSettings() {
            stopLogPolling(); // Ensure polling stops
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
