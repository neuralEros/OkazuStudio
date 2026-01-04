const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function loadScript(dom, filePath) {
    const code = fs.readFileSync(filePath, 'utf-8');
    dom.window.eval(code);
}

function setupDom() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
    const dom = new JSDOM(html, {
        url: 'http://localhost',
        pretendToBeVisual: true,
        runScripts: 'outside-only'
    });

    dom.window.__OKAZU_TEST__ = true;
    dom.window.require = require;

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.Image = dom.window.Image;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    const storage = new Map();
    const localStorage = {
        getItem: (key) => (storage.has(key) ? storage.get(key) : null),
        setItem: (key, value) => {
            storage.set(key, String(value));
        },
        removeItem: (key) => {
            storage.delete(key);
        },
        clear: () => {
            storage.clear();
        }
    };
    Object.defineProperty(dom.window, 'localStorage', {
        value: localStorage,
        configurable: true,
        writable: true
    });
    global.localStorage = dom.window.localStorage;
    global.DOMParser = dom.window.DOMParser;
    global.CustomEvent = dom.window.CustomEvent;
    global.Event = dom.window.Event;
    const canvasCtx = dom.window.document.createElement('canvas').getContext('2d');
    dom.window.CanvasRenderingContext2D = dom.window.CanvasRenderingContext2D || canvasCtx.constructor;
    global.CanvasRenderingContext2D = dom.window.CanvasRenderingContext2D;
    global.ImageData = dom.window.ImageData;
    global.Blob = dom.window.Blob;

    const { TextEncoder, TextDecoder } = require('util');
    if (!dom.window.TextEncoder) dom.window.TextEncoder = TextEncoder;
    if (!dom.window.TextDecoder) dom.window.TextDecoder = TextDecoder;
    global.TextEncoder = dom.window.TextEncoder;
    global.TextDecoder = dom.window.TextDecoder;
    if (!dom.window.ResizeObserver) {
        dom.window.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
    global.ResizeObserver = dom.window.ResizeObserver;

    if (!dom.window.requestAnimationFrame) {
        dom.window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    }
    if (!dom.window.cancelAnimationFrame) {
        dom.window.cancelAnimationFrame = (id) => clearTimeout(id);
    }

    global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
    global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

    if (!dom.window.fetch) {
        dom.window.fetch = () => Promise.reject(new Error('fetch not implemented in unit test runner'));
    }
    global.fetch = dom.window.fetch.bind(dom.window);

    return dom;
}

function run() {
    const dom = setupDom();
    const scriptOrder = [
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
        'scripts/test_runner.js'
    ];

    scriptOrder.forEach((relPath) => {
        loadScript(dom, path.join(__dirname, '..', relPath));
    });

    const testDir = path.join(__dirname, 'unit');
    const testFiles = fs.readdirSync(testDir)
        .filter((file) => file.endsWith('.test.js'))
        .sort();

    testFiles.forEach((file) => {
        loadScript(dom, path.join(testDir, file));
    });

    return dom.window.TestRunner.runAll();
}

run()
    .then((results) => {
        if (results.failed > 0) {
            process.exitCode = 1;
        }
    })
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    });
