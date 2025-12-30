
function createSettingsSystem({ state, els, render, scheduleHeavyTask }) {

    // Default Settings
    const defaults = {
        hue: 28,
        saturation: 96,
        rgbMode: false,
        rgbSpeed: 5.0, // Multiplier (1.0 = 4 deg/s)
        brushPreviewResolution: 1080, // 'p' refers to height
        adjustmentPreviewResolution: 1080,
        apiKey: '',
        keyframeInterval: 10,
        keyframeBuffer: 5,
        useReplay: true,
        // Export Defaults
        exportFormat: 'image/png', // 'image/jpeg', 'image/png', 'image/webp'
        exportQuality: 98,
        exportHeightCap: 4320, // 'Full' or number
        exportLayers: {
            merged: true,
            mask: false,
            front: false,
            back: false
        }
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

        // Log Accent (Cycle 3x speed in RGB mode)
        const logHue = state.settings.rgbMode ? (hue * 3) % 360 : hue;
        // Recalculate lightness boost for the shifted log hue
        const logHueBoost = Math.max(0, Math.cos((logHue - 240) * Math.PI / 180)) * 15;
        const logButtonL = Math.min(95, 56 + satBoost + logHueBoost);
        // "Pop" on dark background: Ensure high lightness (70-90 range)
        // Original inkL was designed for light button backgrounds (dark text).
        // Here we want light text on dark log background.
        const logInkL = Math.min(98, Math.max(75, logButtonL + 15));

        document.documentElement.style.setProperty('--log-accent-color', `hsl(${logHue}, 100%, ${logInkL}%)`);
    }

    function applySettings() {
        // Initial setup
        cycleHue = state.settings.hue;
        updateThemeVariables(state.settings.hue, state.settings.saturation);

        // Restart loop to apply speed changes or ensure it's running
        initRgbLoop();
    }

    function updateRgbButtonColor(hue) {
        const sat = state.settings.saturation;

        // Similar lightness logic as standard button but using the 3x hue
        const satBoost = (100 - sat) * 0.4;
        const hueBoost = Math.max(0, Math.cos((hue - 240) * Math.PI / 180)) * 15;
        const buttonL = Math.min(95, 56 + satBoost + hueBoost);
        const inkL = 10 + Math.max(0, (buttonL - 56) * 0.294);

        const color = `hsl(${hue}, ${sat}%, ${buttonL}%)`;
        const inkColor = `hsl(${hue}, 90%, ${inkL}%)`;

        document.documentElement.style.setProperty('--rgb-button-color', color);
        document.documentElement.style.setProperty('--rgb-button-ink', inkColor);
    }

    let cycleHue = defaults.hue;
    let buttonHue = 0;
    let buttonInterval = null;

    function initRgbLoop() {
        // Theme Loop (Variable Speed)
        if (rgbInterval) clearInterval(rgbInterval);

        const baseInterval = 125;
        const interval = baseInterval / (state.settings.rgbSpeed || 1.0);

        rgbInterval = setInterval(() => {
            // Increment theme cycle
            cycleHue = (cycleHue + 0.5) % 360;

            // Update global theme if RGB Mode is ON
            if (state.settings.rgbMode) {
                state.settings.hue = cycleHue;
                updateThemeVariables(state.settings.hue, state.settings.saturation);

                // Update slider if visible
                const slider = document.getElementById('setting-hue');
                if (slider) slider.value = state.settings.hue;
            }
        }, interval);

        // Button Loop (Fixed High Speed 20x)
        // 20x relative to base 1.0x (4 deg/s)? Or just fast?
        // Let's assume 20x multiplier on base speed.
        // Base: 0.5 deg every 125ms = 4 deg/s
        // 20x: 80 deg/s.
        // Interval for 0.5 deg increment: 125 / 20 = 6.25ms
        // Let's do 10ms interval and appropriate increment to hit ~80 deg/s?
        // 10ms is 100fps. 0.8 deg per tick.
        if (buttonInterval) clearInterval(buttonInterval);

        buttonInterval = setInterval(() => {
            buttonHue = (buttonHue + 1) % 360; // 1 deg per ~10ms = 100 deg/s (~25x)
            updateRgbButtonColor(buttonHue);
        }, 10);
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
                <div id="settings-modal" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[150%] bg-panel-strong border border-panel border-panel-border w-[560px] max-w-[90vw] rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ease-in-out flex flex-col h-[500px]">

                    <!-- Header -->
                    <div class="flex items-center justify-between px-4 py-2 border-b border-panel-divider bg-panel-header shrink-0">
                        <h3 id="settings-title" class="text-lg font-bold text-accent translate-y-[1px] uppercase tracking-widest">Settings</h3>
                        <button id="settings-close" class="accent-action rounded-sm shadow-sm flex items-center justify-center w-6 h-6">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="flex flex-grow overflow-hidden">
                        <!-- Sidebar -->
                        <div class="w-[18.75%] bg-panel-strong border-r border-panel-divider flex flex-col pt-2">
                            <button class="settings-tab-btn active flex items-center text-left px-4 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors border-l-4 border-transparent" data-tab="interface">
                                <span class="w-4 h-4 mr-3 bg-current shrink-0" style="-webkit-mask-image: url('icons/set_interface.svg'); mask-image: url('icons/set_interface.svg'); -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; -webkit-mask-size: contain; mask-size: contain;"></span>
                                Interface
                            </button>
                            <button class="settings-tab-btn flex items-center text-left px-4 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors border-l-4 border-transparent" data-tab="performance">
                                <span class="w-4 h-4 mr-3 bg-current shrink-0" style="-webkit-mask-image: url('icons/set_performance.svg'); mask-image: url('icons/set_performance.svg'); -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; -webkit-mask-size: contain; mask-size: contain;"></span>
                                Performance
                            </button>
                            <button class="settings-tab-btn flex items-center text-left px-4 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors border-l-4 border-transparent" data-tab="export">
                                <span class="w-4 h-4 mr-3 bg-current shrink-0" style="-webkit-mask-image: url('icons/set_export.svg'); mask-image: url('icons/set_export.svg'); -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; -webkit-mask-size: contain; mask-size: contain;"></span>
                                Export
                            </button>
                            <button class="settings-tab-btn flex items-center text-left px-4 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors border-l-4 border-transparent" data-tab="debug">
                                <span class="w-4 h-4 mr-3 bg-current shrink-0" style="-webkit-mask-image: url('icons/set_debug.svg'); mask-image: url('icons/set_debug.svg'); -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; -webkit-mask-size: contain; mask-size: contain;"></span>
                                Debug
                            </button>
                        </div>

                        <!-- Content Area -->
                        <div class="flex-1 flex flex-col bg-panel">
                            <div class="p-4 overflow-y-auto flex-grow">

                                <!-- TAB: INTERFACE -->
                                <div id="tab-interface" class="settings-tab-content block">
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
                                                <input id="setting-rgb-speed" type="range" min="0.1" max="10.0" step="0.1" class="w-full accent-accent">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- TAB: PERFORMANCE -->
                                <div id="tab-performance" class="settings-tab-content hidden">
                                    <!-- Brush Resolution -->
                                    <div class="mb-6">
                                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Brush Preview Resolution</label>
                                        <div class="flex rounded bg-panel-strong p-1 gap-1">
                                            <button class="res-btn-brush flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="720">720p</button>
                                            <button class="res-btn-brush flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="1080">1080p</button>
                                            <button class="res-btn-brush flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="Full">Full</button>
                                        </div>
                                    </div>

                                    <!-- Adjustment Resolution -->
                                    <div class="mb-6">
                                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Adjustment Preview Resolution</label>
                                        <div class="flex rounded bg-panel-strong p-1 gap-1">
                                            <button class="res-btn-adj flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="720">720p</button>
                                            <button class="res-btn-adj flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="1080">1080p</button>
                                            <button class="res-btn-adj flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="Full">Full</button>
                                        </div>
                                    </div>

                                    <!-- Undo History -->
                                    <div class="mb-6">
                                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Undo History</label>
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

                                <!-- TAB: EXPORT -->
                                <div id="tab-export" class="settings-tab-content hidden">

                                    <!-- File Format -->
                                    <div class="mb-6">
                                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">File Format</label>
                                        <div class="flex rounded bg-panel-strong p-1 gap-1 mb-4">
                                            <button class="export-fmt-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="image/jpeg">JPG</button>
                                            <button class="export-fmt-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="image/png">PNG</button>
                                            <button class="export-fmt-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="image/webp">WEBP</button>
                                        </div>

                                        <!-- Quality Slider -->
                                        <div id="export-quality-container" class="flex flex-col gap-1 transition-opacity duration-200">
                                            <div class="flex justify-between">
                                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Quality</span>
                                                <span id="val-export-quality" class="text-[10px] text-gray-400">98%</span>
                                            </div>
                                            <input id="setting-export-quality" type="range" min="0" max="100" class="w-full accent-accent">
                                        </div>
                                    </div>

                                    <!-- Height Cap -->
                                    <div class="mb-6">
                                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Height Cap</label>
                                        <div class="flex rounded bg-panel-strong p-1 gap-1">
                                            <button class="export-cap-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="1080">1080p (HD)</button>
                                            <button class="export-cap-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="2160">2160p (4K)</button>
                                            <button class="export-cap-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="4320">4320p (8K)</button>
                                            <button class="export-cap-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-val="Full">Full</button>
                                        </div>
                                    </div>

                                    <!-- Layer Exports -->
                                    <div class="mb-6">
                                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Layer Exports</label>
                                        <div class="flex rounded bg-panel-strong p-1 gap-1">
                                            <button class="export-layer-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-key="merged">Merged</button>
                                            <button class="export-layer-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-key="mask">Mask</button>
                                            <button class="export-layer-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-key="front">Front</button>
                                            <button class="export-layer-btn flex-1 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white hover:bg-panel-800 transition-colors" data-key="back">Back</button>
                                        </div>
                                    </div>

                                </div>

                                <!-- TAB: DEBUG -->
                                <div id="tab-debug" class="settings-tab-content hidden h-full flex flex-col">
                                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Session Logs</label>
                                    <div id="debug-log-viewer" class="w-full flex-grow bg-black/20 border border-panel-divider rounded p-2 text-[10px] font-mono text-gray-400 overflow-y-auto whitespace-pre-wrap select-text focus:outline-none mb-4" tabindex="0"></div>
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

        // Add initial active styling for Interface
        const interfaceTab = document.querySelector('[data-tab="interface"]');
        if(interfaceTab) {
             interfaceTab.classList.add('active');
             interfaceTab.classList.remove('text-gray-400', 'hover:text-white', 'hover:bg-white/5');
             interfaceTab.style.backgroundColor = 'hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.15)';
             interfaceTab.style.color = 'var(--accent-soft)';
        }


        // --- EXPORT TAB ---

        // File Format
        const exportFmtButtons = document.querySelectorAll('.export-fmt-btn');
        const exportQualityContainer = document.getElementById('export-quality-container');
        const exportQualitySlider = document.getElementById('setting-export-quality');
        const exportQualityVal = document.getElementById('val-export-quality');

        exportQualitySlider.value = state.settings.exportQuality || 98;
        exportQualityVal.textContent = (state.settings.exportQuality || 98) + '%';

        function updateExportFormatUI() {
            const currentFmt = state.settings.exportFormat;
            exportFmtButtons.forEach(btn => {
                const val = btn.dataset.val;
                if (val === currentFmt) {
                    btn.classList.add('bg-accent');
                    btn.classList.remove('text-gray-400', 'hover:bg-panel-800');
                } else {
                    btn.classList.remove('bg-accent');
                    btn.classList.add('text-gray-400', 'hover:bg-panel-800');
                }
            });

            // Handle Quality Slider Visibility/State
            if (currentFmt === 'image/png') {
                exportQualityContainer.style.opacity = '0.3';
                exportQualityContainer.style.pointerEvents = 'none';
            } else {
                exportQualityContainer.style.opacity = '1';
                exportQualityContainer.style.pointerEvents = 'auto';
            }
        }

        exportFmtButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                state.settings.exportFormat = btn.dataset.val;
                updateExportFormatUI();
                saveSettings();
            });
        });

        exportQualitySlider.addEventListener('input', (e) => {
             const val = parseInt(e.target.value);
             state.settings.exportQuality = val;
             exportQualityVal.textContent = val + '%';
             saveDebounced();
        });

        updateExportFormatUI();

        // Height Cap
        function setupExportCapSwitch(selector, settingKey) {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = btn.dataset.val;
                    state.settings[settingKey] = val === 'Full' ? 'Full' : parseInt(val);
                    updateExportCapButtons(selector, settingKey);
                    saveSettings();
                });
            });
            updateExportCapButtons(selector, settingKey);
        }

        function updateExportCapButtons(selector, settingKey) {
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
        setupExportCapSwitch('.export-cap-btn', 'exportHeightCap');

        // Layer Exports
        const exportLayerButtons = document.querySelectorAll('.export-layer-btn');

        // Defaults check (in case not in stored settings)
        if (!state.settings.exportLayers) {
            state.settings.exportLayers = { merged: true, mask: false, front: false, back: false };
        }

        function updateLayerButtons() {
            const layers = state.settings.exportLayers;
            exportLayerButtons.forEach(btn => {
                const key = btn.dataset.key;
                if (layers[key]) {
                    btn.classList.add('bg-accent');
                    btn.classList.remove('text-gray-400', 'hover:bg-panel-800');
                } else {
                    btn.classList.remove('bg-accent');
                    btn.classList.add('text-gray-400', 'hover:bg-panel-800');
                }
            });
        }

        exportLayerButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                state.settings.exportLayers[key] = !state.settings.exportLayers[key];
                updateLayerButtons();
                saveSettings();
            });
        });

        updateLayerButtons();


        // --- INTERFACE TAB ---

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
            cycleHue = state.settings.hue; // Sync cycle
            // If dragging slider, disable RGB mode
            if (state.settings.rgbMode) {
                state.settings.rgbMode = false;
                updateRgbButtonState();
                // Loop continues running for button, but main theme stops cycling
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
            cycleHue = defaults.hue;
            if (state.settings.rgbMode) {
                state.settings.rgbMode = false;
                updateRgbButtonState();
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
            initRgbLoop(); // Restart loop with new speed immediately
            saveDebounced();
        });


        function updateRgbButtonState() {
            // Remove standard accent classes to allow custom coloring
            rgbToggle.classList.remove('bg-accent', 'border-accent', 'text-gray-400', 'hover:bg-panel-strong');

            // Base styles
            rgbToggle.style.borderColor = 'var(--rgb-button-color)';

            if (state.settings.rgbMode) {
                // On: Filled with dynamic color
                rgbToggle.style.backgroundColor = 'var(--rgb-button-color)';
                rgbToggle.style.color = 'var(--rgb-button-ink)';
            } else {
                // Off: Transparent with dynamic text/border
                rgbToggle.style.backgroundColor = 'transparent';
                rgbToggle.style.color = 'var(--rgb-button-color)';
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

        function formatLogLine(line) {
            const escapeHtml = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // Regex to detect standard log header: [timestamp] [CATEGORY]
            // e.g. [02:09:24.404] [INTERACTION] ...
            const prefixRegex = /^(\[)([^\]]+)(\] \[)([^\]]+)(\] )(.*)$/;
            const match = line.match(prefixRegex);

            let messagePart = line;
            let prefixPart = '';

            const style = 'style="color: var(--log-accent-color)"';

            if (match) {
                // Group 1: [
                // Group 2: Timestamp
                // Group 3: ] [
                // Group 4: Category
                // Group 5: ]
                // Group 6: Message
                // User requested no accent color for [INFO] etc.
                prefixPart = `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]}`;
                messagePart = match[6];
            }

            // Escape message part before highlighting
            let safeMessage = escapeHtml(messagePart);

            // Special Handling for "System Info" lines
            if (safeMessage.startsWith('System Info: ')) {
                const content = safeMessage.substring('System Info: '.length);
                const parts = content.split('|');
                const processedParts = parts.map(part => {
                    const colonIndex = part.indexOf(':');
                    if (colonIndex !== -1) {
                        const key = part.substring(0, colonIndex + 1);
                        const val = part.substring(colonIndex + 1);
                        return `${key}<span style="color: var(--log-accent-color)">${val}</span>`;
                    }
                    return part;
                });
                return prefixPart + 'System Info: ' + processedParts.join('|');
            }

            // Combined Regex for Assets, Filenames, Resolutions, and Numbers
            // Group 1: Asset Prefix (optional)
            // Group 2: Asset ID (asset_...)
            // Group 3: Filename
            // Group 4: Resolution
            // Group 5: Number (Floats only to avoid highlighting indices)
            const regex = /(Asset: )?(asset_\w+)|(\b[\w-]+\.(?:png|jpg|jpeg|webp|PNG|JPG|JPEG|WEBP)\b)|(\b\d+x\d+\b)|((?<!\w)-?\d+\.\d+\b)/g;

            safeMessage = safeMessage.replace(regex, (match, assetPrefix, assetId, filename, resolution, number) => {
                const style = 'style="color: var(--log-accent-color)"';
                if (assetId) {
                    return (assetPrefix || '') + `<span ${style}>${assetId}</span>`;
                }
                if (filename) return `<span ${style}>${filename}</span>`;
                if (resolution) return `<span ${style}>${resolution}</span>`;
                if (number) return `<span ${style}>${number}</span>`;
                return match;
            });

            return prefixPart + safeMessage;
        }

        function refreshLogs() {
            if (window.Logger && window.Logger.getLogs) {
                const currentLogs = window.Logger.getLogs();
                // We always update because we are formatting on the fly and checking equality of
                // formatted HTML against raw string is complex.
                // Optimization: Check if raw string length changed or use a separate tracker.
                // But for now, simple is better.

                const lines = currentLogs.split('\n');
                // Keep last 500
                const slice = lines.slice(Math.max(0, lines.length - 500));

                // Format
                const formatted = slice.map(formatLogLine).join('\n');

                // Only update DOM if changed (using a data-attr or just checking innerHTML length?)
                // Checking innerHTML is expensive.
                // Let's just update. The browser handles it reasonably well for 500 lines.
                // Actually, if we type in a field and this updates every 500ms, it might be annoying if we lose selection.
                // But this is a read-only log viewer.

                if (logViewer.innerHTML !== formatted) {
                    logViewer.innerHTML = formatted;
                    logViewer.scrollTop = logViewer.scrollHeight;
                }

            } else {
                logViewer.innerHTML = "Logger not active.";
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
            // Use window.Logger.getLogs() directly to get the full raw text
            if (window.Logger && window.Logger.getLogs) {
                const logs = window.Logger.getLogs();
                navigator.clipboard.writeText(logs).then(() => {
                    const originalText = copyLogsBtn.textContent;
                    copyLogsBtn.textContent = "COPIED!";
                    setTimeout(() => {
                        copyLogsBtn.textContent = originalText;
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy logs', err);
                });
            }
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
