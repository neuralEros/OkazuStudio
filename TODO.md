Agents: It is CRITICAL that you keep track of your progress here, and in each of the referenced checklists. You are expected to fill out the checklist, marking boxes with X as you complete them, and regularly referencing the checklist about what to do next. Utilizing the checklists as a part of your work stream is itself part of the assignment.


===== MAIN CHECKLIST:

 [x] 0.  Ensure the Okazu Test System is up and running (see below)
 [x] 1.  Complete all assignments in adjustments_tdd.md
 [x] 2.  Complete all assignments in assets_tdd.md
 [x] 3.  Complete all assignments in brush_tdd.md
 [x] 4.  Complete all assignments in input_tdd.md
 [x] 5.  Complete all assignments in kakushi_tdd.md
 [x] 6.  Complete all assignments in logging_tdd.md
 [x] 7.  Complete all assignments in main_tdd.md
 [x] 8.  Complete all assignments in replay_tdd.md
 [x] 9.  Complete all assignments in settings_tdd.md
 [x] 10. Complete all assignments in stego_tdd.md
 [x] 11. Complete all assignments in watermark_tdd.md
 [x] 12. Ensure all implemented tests pass.
 
 ===== OKAZU TEST SYSTEM REFERENCE:

## 1. Overview
The OkazuStudio testing system is a dependency-free, browser-based test runner designed to run entirely in client-side JavaScript. It does not use Node.js, Jest, Mocha, or any external libraries.

## 2. Directory Structure
*   `scripts/test_runner.js`: The core test library (exposed as `window.TestRunner`).
*   `tests/unit/*.test.js`: Test files containing the test suites.

## 3. The TestRunner API (`window.TestRunner`)
The `TestRunner` object provides the following methods:

*   `register(name, fn, options)`: Registers a test case.
    *   `name`: String description of the test.
    *   `fn`: Function to execute (can be async).
    *   `options`: Optional object (e.g., `{ timeout: 5000 }`).
*   `runAll()`: Runs all registered tests and reports results.

### Assertions
*   `assert(condition, message)`: Throws if `condition` is falsy.
*   `assertEqual(actual, expected, message)`: Throws if `actual !== expected`.
*   `assertApprox(actual, expected, epsilon, message)`: Throws if `Math.abs(actual - expected) > epsilon`.
*   `assertDeepEqual(actual, expected, message)`: Throws if `JSON.stringify(actual) !== JSON.stringify(expected)`.

### Spies & Mocking (`spyOn`)
Use `TestRunner.spyOn(obj, method)` to mock functions and track calls.

*   `const spy = TestRunner.spyOn(object, 'methodName');`
*   `spy.mockImplementation(fn)`: Replaces the original method with `fn`.
*   `spy.mockReturnValue(val)`: Makes the method return `val`.
*   `spy.restore()`: Restores the original method.
*   `spy.calls`: Array of argument arrays for every call made to the spy.
*   `spy.expectCalled()`: Asserts the spy was called at least once.
*   `spy.expectCalledWith(arg1, arg2...)`: Asserts the spy was called with specific arguments.
*   `spy.expectNotCalled()`: Asserts the spy was never called.

## 4. Mocking Strategies

### 4.1 DOM Elements
Since there is no JSDOM, tests running in `test.html` have a real DOM. However, to isolate unit tests, mock DOM interactions:

```javascript
const getById = TestRunner.spyOn(document, 'getElementById');
getById.mockImplementation((id) => {
    return {
        value: '10',
        addEventListener: TestRunner.spyOn({ addEventListener: () => {} }, 'addEventListener'),
        // ... other props needed by the code under test
    };
});
// ... run test ...
getById.restore();
```

### 4.2 Global State
The application relies on a global `state` object. For unit tests:
1.  Save the original state (if initialized).
2.  Create a fresh mock state object.
3.  Inject it (if the module allows) or overwrite the global variable.
4.  Restore after the test.

### 4.3 Async & heavy Tasks
Mock `scheduleHeavyTask` to run synchronously for tests:
```javascript
const taskSpy = TestRunner.spyOn(window, 'scheduleHeavyTask');
taskSpy.mockImplementation(async (fn) => fn());
```

### 5 UX
The tests should be runnable from a button on the Debug panel of the Settings menu. Once run, they should save a log to LocalStorage, and then refresh the page. On new load, bring up the settings menu's debug section again, and append the log from storage once the application has started up. this way, tests don't have to clean up after themselves and the user gets a clean experience.
