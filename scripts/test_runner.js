window.TestRunner = (() => {
    const tests = [];
    const DEFAULT_TIMEOUT_MS = 2000;

    function register(name, fn, options = {}) {
        tests.push({ name, fn, timeout: options.timeout || DEFAULT_TIMEOUT_MS });
    }

    function clear() {
        tests.length = 0;
    }

    function assert(condition, message = 'Assertion failed') {
        if (!condition) {
            throw new Error(message);
        }
    }

    function assertEqual(actual, expected, message = '') {
        if (actual !== expected) {
            const suffix = message ? `: ${message}` : '';
            throw new Error(`Expected ${expected} but got ${actual}${suffix}`);
        }
    }

    function assertApprox(actual, expected, epsilon = 1e-6, message = '') {
        if (Math.abs(actual - expected) > epsilon) {
            const suffix = message ? `: ${message}` : '';
            throw new Error(`Expected ${actual} to be within ${epsilon} of ${expected}${suffix}`);
        }
    }

    function assertDeepEqual(actual, expected, message = '') {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            const suffix = message ? `: ${message}` : '';
            throw new Error(`Deep equal failed${suffix}\nExpected: ${expectedStr}\nActual: ${actualStr}`);
        }
    }

    function now() {
        return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }

    function logTest(message, data) {
        if (window.Logger && window.Logger.test) {
            window.Logger.test(message, data);
        } else {
            console.log(`[TEST] ${message}`, data || '');
        }
    }

    async function withTimeout(promise, ms) {
        let timeoutId;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
        });
        try {
            return await Promise.race([promise, timeout]);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function spyOn(obj, methodName) {
        const original = obj[methodName];
        const calls = [];

        const spy = function(...args) {
            calls.push(args);
            if (spy.implementation) {
                return spy.implementation.apply(this, args);
            }
            if (spy.hasOwnProperty('returnValue')) {
                return spy.returnValue;
            }
            return original ? original.apply(this, args) : undefined;
        };

        spy.calls = calls;
        spy.implementation = null;
        spy.returnValue = undefined;

        spy.mockImplementation = (fn) => {
            spy.implementation = fn;
            return spy;
        };
        spy.mockReturnValue = (val) => {
            spy.returnValue = val;
            delete spy.implementation; // Return value takes precedence if set
            return spy;
        };
        spy.restore = () => {
            obj[methodName] = original;
        };
        spy.expectCalled = () => {
            if (calls.length === 0) {
                throw new Error(`Expected ${methodName} to be called, but it was not.`);
            }
        };
        spy.expectCalledWith = (...expectedArgs) => {
            const match = calls.some(callArgs =>
                JSON.stringify(callArgs) === JSON.stringify(expectedArgs)
            );
            if (!match) {
                throw new Error(`Expected ${methodName} to be called with ${JSON.stringify(expectedArgs)}, but it was not.`);
            }
        };
        spy.expectNotCalled = () => {
            if (calls.length > 0) {
                throw new Error(`Expected ${methodName} not to be called, but it was called ${calls.length} times.`);
            }
        };

        obj[methodName] = spy;
        return spy;
    }

    async function runAll() {
        logTest(`Running ${tests.length} tests.`);
        const results = {
            total: tests.length,
            passed: 0,
            failed: 0,
            failures: []
        };

        for (const test of tests) {
            const start = now();
            try {
                const result = test.fn();
                if (result && typeof result.then === 'function') {
                    await withTimeout(result, test.timeout);
                }
                const duration = Math.round(now() - start);
                results.passed += 1;
                logTest(`PASS ${test.name} (${duration}ms)`);
            } catch (error) {
                const duration = Math.round(now() - start);
                results.failed += 1;
                results.failures.push({ name: test.name, error: error.message || String(error) });
                logTest(`FAIL ${test.name} (${duration}ms): ${error.message || error}`);
            }
        }

        logTest(`Done. Passed: ${results.passed}, Failed: ${results.failed}, Total: ${results.total}`);
        return results;
    }

    return {
        register,
        clear,
        runAll,
        assert,
        assertEqual,
        assertApprox,
        assertDeepEqual,
        spyOn
    };
})();
