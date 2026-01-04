const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const repoRoot = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://localhost/'
});

const { window } = dom;
window.require = require;
window.Buffer = Buffer;

global.window = window;
global.document = window.document;
global.Buffer = Buffer;
global.navigator = window.navigator;
const storageData = new Map();
const storage = {
    getItem: (key) => (storageData.has(key) ? storageData.get(key) : null),
    setItem: (key, value) => {
        storageData.set(key, String(value));
    },
    removeItem: (key) => {
        storageData.delete(key);
    },
    clear: () => {
        storageData.clear();
    },
    key: (index) => Array.from(storageData.keys())[index] || null,
    get length() {
        return storageData.size;
    }
};
Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
global.localStorage = storage;
global.Node = window.Node;
global.HTMLElement = window.HTMLElement;
global.Image = window.Image;
global.HTMLCanvasElement = window.HTMLCanvasElement;
global.DOMParser = window.DOMParser;
global.CustomEvent = window.CustomEvent;
global.Event = window.Event;
global.KeyboardEvent = window.KeyboardEvent;
global.MouseEvent = window.MouseEvent;
global.PointerEvent = window.PointerEvent;
let CanvasRenderingContext2DRef = window.CanvasRenderingContext2D;
if (!CanvasRenderingContext2DRef) {
    try {
        ({ CanvasRenderingContext2D: CanvasRenderingContext2DRef } = require('canvas'));
    } catch (error) {
        CanvasRenderingContext2DRef = undefined;
    }
}
global.CanvasRenderingContext2D = CanvasRenderingContext2DRef;
window.CanvasRenderingContext2D = CanvasRenderingContext2DRef;

const originalLocalStorageGet = storage.getItem.bind(storage);
const originalLocalStorageSet = storage.setItem.bind(storage);
let customLocalStorageGet = null;
let customLocalStorageSet = null;

Object.defineProperty(storage, 'getItem', {
    configurable: true,
    enumerable: true,
    get() {
        return customLocalStorageGet || originalLocalStorageGet;
    },
    set(fn) {
        customLocalStorageGet = fn;
    }
});

Object.defineProperty(storage, 'setItem', {
    configurable: true,
    enumerable: true,
    get() {
        return customLocalStorageSet || originalLocalStorageSet;
    },
    set(fn) {
        customLocalStorageSet = fn;
    }
});
const ResizeObserverShim = window.ResizeObserver || class {
    observe() {}
    unobserve() {}
    disconnect() {}
};
global.ResizeObserver = ResizeObserverShim;
window.ResizeObserver = ResizeObserverShim;
global.requestAnimationFrame = window.requestAnimationFrame.bind(window);
global.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

const scriptsInOrder = [
    'scripts/logging.js',
    'scripts/assets.js',
    'scripts/brush.js',
    'scripts/kakushi.js',
    'scripts/stego.js',
    'scripts/watermark.js',
    'scripts/replay.js',
    'scripts/adjustments.js',
    'scripts/input.js',
    'scripts/settings.js',
    'scripts/main.js',
    'scripts/test_runner.js',
    'tests/unit/logging.test.js',
    'tests/unit/adjustments.test.js',
    'tests/unit/assets.test.js',
    'tests/unit/brush.test.js',
    'tests/unit/input.test.js',
    'tests/unit/kakushi.test.js',
    'tests/unit/main.test.js',
    'tests/unit/replay.test.js',
    'tests/unit/settings.test.js',
    'tests/unit/stego.test.js',
    'tests/unit/watermark.test.js'
];

for (const relPath of scriptsInOrder) {
    const fullPath = path.join(repoRoot, relPath);
    const code = fs.readFileSync(fullPath, 'utf8');
    window.eval(`${code}\n//# sourceURL=${relPath}`);
}

(async () => {
    const results = await window.TestRunner.runAll();
    process.exit(results.failed > 0 ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
