
// ------------------------------------------------------------------------------------------------
// Logging Unit Tests
// ------------------------------------------------------------------------------------------------

(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping logging tests.');
        return;
    }

    const { register, assert, assertEqual, spyOn } = window.TestRunner;

    // Helper to spy on console
    function spyConsole() {
        return {
            log: spyOn(console, 'log'),
            groupCollapsed: spyOn(console, 'groupCollapsed'),
            groupEnd: spyOn(console, 'groupEnd')
        };
    }

    function restoreConsole(spies) {
        spies.log.restore();
        spies.groupCollapsed.restore();
        spies.groupEnd.restore();
    }

    // Mock Date.prototype.toISOString
    function mockDate() {
        const original = Date.prototype.toISOString;
        Date.prototype.toISOString = () => '2024-01-02T03:04:05.678Z';
        return () => { Date.prototype.toISOString = original; };
    }

    // --- 3. timestamp() ---

    register('Logging: 3.1 Format Under Controlled Time', () => {
        const restoreDate = mockDate();

        window.Logger.clear();
        const spies = spyConsole();

        window.Logger.info('test');

        spies.log.expectCalledWith('[03:04:05.678] [INFO] test');

        restoreConsole(spies);
        restoreDate();
    });

    // --- 4. Format via methods ---

    register('Logging: 4.1 Info Logs Without Data', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();

        window.Logger.info('hello');

        spies.log.expectCalledWith('[03:04:05.678] [INFO] hello');
        spies.groupCollapsed.expectNotCalled();
        spies.groupEnd.expectNotCalled();
        assertEqual(window.Logger.getLogs(), '[03:04:05.678] [INFO] hello');

        restoreConsole(spies);
        restoreDate();
    });

    register('Logging: 4.2 Warn Logs With Data', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();
        const dataObj = { ok: true, count: 2 };

        window.Logger.warn('problem', dataObj);

        spies.groupCollapsed.expectCalledWith('[03:04:05.678] [WARN] problem');
        spies.log.expectCalledWith(dataObj);
        spies.groupEnd.expectCalled();

        const expectedLog = '[03:04:05.678] [WARN] problem\n' + JSON.stringify(dataObj, null, 2);
        assertEqual(window.Logger.getLogs(), expectedLog);

        restoreConsole(spies);
        restoreDate();
    });

    register('Logging: 4.3 Error Logs With Data', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();
        const dataObj = { ok: true };

        window.Logger.error('boom', dataObj);

        spies.groupCollapsed.expectCalledWith('[03:04:05.678] [ERROR] boom');
        spies.log.expectCalledWith(dataObj);
        spies.groupEnd.expectCalled();

        const expectedLog = '[03:04:05.678] [ERROR] boom\n' + JSON.stringify(dataObj, null, 2);
        assertEqual(window.Logger.getLogs(), expectedLog);

        restoreConsole(spies);
        restoreDate();
    });

    register('Logging: 4.4 Test Logs With Data', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();
        const dataObj = { ok: true };

        window.Logger.test('case', dataObj);

        spies.groupCollapsed.expectCalledWith('[03:04:05.678] [TEST] case');
        spies.log.expectCalledWith(dataObj);
        spies.groupEnd.expectCalled();

        const expectedLog = '[03:04:05.678] [TEST] case\n' + JSON.stringify(dataObj, null, 2);
        assertEqual(window.Logger.getLogs(), expectedLog);

        restoreConsole(spies);
        restoreDate();
    });

    // --- 5. Interaction/State/Undo/Brush ---

    register('Logging: 5.1 Interaction With Value', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();

        window.Logger.interaction('#button', 'click', 'Save');

        const expected = '[03:04:05.678] [INTERACTION] click on #button -> Save';
        spies.log.expectCalledWith(expected);
        assertEqual(window.Logger.getLogs(), expected);

        restoreConsole(spies);
        restoreDate();
    });

    register('Logging: 5.2 Interaction Without Value', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();

        window.Logger.interaction('#button', 'click');

        const expected = '[03:04:05.678] [INTERACTION] click on #button';
        spies.log.expectCalledWith(expected);
        assertEqual(window.Logger.getLogs(), expected);

        restoreConsole(spies);
        restoreDate();
    });

    register('Logging: 5.3 State', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();

        window.Logger.state('tool', { name: 'brush' });

        const expected = '[03:04:05.678] [STATE] tool = {"name":"brush"}';
        spies.log.expectCalledWith(expected);
        assertEqual(window.Logger.getLogs(), expected);

        restoreConsole(spies);
        restoreDate();
    });

    register('Logging: 5.4 Undo', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();

        window.Logger.undo(3, 10, 'mask stroke');

        const expected = '[03:04:05.678] [UNDO] Action: mask stroke | Index: 3/10';
        spies.log.expectCalledWith(expected);
        assertEqual(window.Logger.getLogs(), expected);

        restoreConsole(spies);
        restoreDate();
    });

    register('Logging: 5.5 Brush', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();

        window.Logger.brush('erase', 42);

        const expected = '[03:04:05.678] [BRUSH] erase stroke completed with 42 nodes';
        spies.log.expectCalledWith(expected);
        assertEqual(window.Logger.getLogs(), expected);

        restoreConsole(spies);
        restoreDate();
    });

    // --- 6. getLogs ---

    register('Logging: 6.1 getLogs concatenation', () => {
        const restoreDate = mockDate();
        window.Logger.clear();

        const spies = spyConsole();

        window.Logger.info('first');
        window.Logger.warn('second');
        window.Logger.error('third');

        const expected = '[03:04:05.678] [INFO] first\n[03:04:05.678] [WARN] second\n[03:04:05.678] [ERROR] third';
        assertEqual(window.Logger.getLogs(), expected);

        restoreConsole(spies);
        restoreDate();
    });

    // --- 7. clear/restore ---

    register('Logging: 7.1 Clear Buffer', () => {
        const restoreDate = mockDate();
        window.Logger.clear();
        const spies = spyConsole();

        window.Logger.info('temp');
        window.Logger.clear();

        assertEqual(window.Logger.getLogs(), '');

        restoreConsole(spies);
        restoreDate();
    });

    register('Logging: 7.2 Restore', () => {
        window.Logger.clear();
        const logs = "Line 1\nLine 2";
        window.Logger.restore(logs);

        assertEqual(window.Logger.getLogs(), "Line 1\nLine 2");

        // Restore empty
        window.Logger.restore('');
        assertEqual(window.Logger.getLogs(), "Line 1\nLine 2"); // Should be no-op for empty or clear?
        // Implementation: if (!logString) return; so no-op.

        // Restore overwrite
        window.Logger.restore("New Log");
        assertEqual(window.Logger.getLogs(), "New Log");
    });

})();
