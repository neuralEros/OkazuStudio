window.TestHarness = (function() {
    const tests = [];
    let isRunning = false;
    const prefix = '[TEST]';

    function logInfo(message) {
        if (window.Logger && window.Logger.info) {
            window.Logger.info(`${prefix} ${message}`);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    function logError(message) {
        if (window.Logger && window.Logger.error) {
            window.Logger.error(`${prefix} ${message}`);
        } else {
            console.error(`${prefix} ${message}`);
        }
    }

    function registerTest(name, fn, options = {}) {
        if (typeof name !== 'string' || !name.trim()) {
            throw new Error('Test name must be a non-empty string.');
        }
        if (typeof fn !== 'function') {
            throw new Error(`Test "${name}" must be a function.`);
        }
        tests.push({ name, fn, options });
    }

    function assertTrue(value, message = 'Expected value to be truthy.') {
        if (!value) {
            throw new Error(message);
        }
    }

    function assertEqual(actual, expected, message = null) {
        if (actual !== expected) {
            const defaultMessage = `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}.`;
            throw new Error(message || defaultMessage);
        }
    }

    function assertApprox(actual, expected, tolerance = 1e-6, message = null) {
        if (typeof actual !== 'number' || typeof expected !== 'number') {
            throw new Error(message || 'assertApprox expects numeric values.');
        }
        const delta = Math.abs(actual - expected);
        if (delta > tolerance) {
            const defaultMessage = `Expected ${actual} to be within ${tolerance} of ${expected}.`;
            throw new Error(message || defaultMessage);
        }
    }

    async function assertThrows(fn, message = 'Expected function to throw.') {
        let threw = false;
        try {
            const result = fn();
            if (result && typeof result.then === 'function') {
                await result;
            }
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error(message);
        }
    }

    async function runTest(test) {
        const { fn, options } = test;
        if (options && typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Test timed out.')), options.timeoutMs);
            });
            await Promise.race([fn(), timeoutPromise]);
        } else {
            await fn();
        }
    }

    async function runAll() {
        if (isRunning) {
            return;
        }
        isRunning = true;
        const total = tests.length;
        const startedAt = performance.now();
        logInfo(`START (${total} tests)`);

        let passed = 0;
        let failed = 0;

        try {
            for (const test of tests) {
                try {
                    await runTest(test);
                    passed += 1;
                    logInfo(`PASS ${test.name}`);
                } catch (error) {
                    failed += 1;
                    const message = error && error.message ? error.message : String(error);
                    logError(`FAIL ${test.name}: ${message}`);
                }
            }
        } finally {
            const durationMs = Math.round(performance.now() - startedAt);
            logInfo(`SUMMARY ${passed} passed, ${failed} failed, ${total} total (${durationMs}ms)`);
            isRunning = false;
        }
    }

    return {
        registerTest,
        runAll,
        assertTrue,
        assertEqual,
        assertApprox,
        assertThrows
    };
})();
