(function() {
    const { register, assert, assertEqual, spyOn } = window.TestRunner;

    // 2. Fixtures
    const fixedTime = '2024-01-02T03:04:05.678Z';
    const expectedTimeStr = '03:04:05.678';
    const dataObj = { ok: true, count: 2 };
    const dataStr = JSON.stringify(dataObj, null, 2);

    // Helpers
    function setupMocks() {
        const dateSpy = spyOn(Date.prototype, 'toISOString');
        dateSpy.mockReturnValue(fixedTime);

        const logSpy = spyOn(console, 'log');
        logSpy.mockImplementation(() => {});

        const groupSpy = spyOn(console, 'groupCollapsed');
        groupSpy.mockImplementation(() => {});

        const groupEndSpy = spyOn(console, 'groupEnd');
        groupEndSpy.mockImplementation(() => {});

        window.Logger.clear();

        return { dateSpy, logSpy, groupSpy, groupEndSpy };
    }

    function restoreMocks(mocks) {
        mocks.dateSpy.restore();
        mocks.logSpy.restore();
        mocks.groupSpy.restore();
        mocks.groupEndSpy.restore();
    }

    // 3. Tests for timestamp()
    register('Logging: timestamp formatting', () => {
        const mocks = setupMocks();
        try {
            const ts = window.OkazuTestables.logging.timestamp();
            assertEqual(ts, expectedTimeStr, 'Should return time portion without Z');

            const ts2 = window.OkazuTestables.logging.timestamp();
            assertEqual(ts2, ts, 'Should be stable under fixed time');
        } finally {
            restoreMocks(mocks);
        }
    });

    // 4. Tests for format via info/warn/error/test
    register('Logging: info logs without data', () => {
        const mocks = setupMocks();
        try {
            window.Logger.info('hello');

            // Assertion 4.1.4
            mocks.logSpy.expectCalledWith(`[${expectedTimeStr}] [INFO] hello`);

            // Assertion 4.1.5 - 4.1.6
            try { mocks.groupSpy.expectNotCalled(); } catch(e) { throw new Error("groupCollapsed called unexpectedly"); }
            try { mocks.groupEndSpy.expectNotCalled(); } catch(e) { throw new Error("groupEnd called unexpectedly"); }

            // Assertion 4.1.7
            assertEqual(window.Logger.getLogs(), `[${expectedTimeStr}] [INFO] hello`);
        } finally {
            restoreMocks(mocks);
        }
    });

    register('Logging: warn logs with data', () => {
        const mocks = setupMocks();
        try {
            window.Logger.warn('problem', dataObj);

            mocks.groupSpy.expectCalledWith(`[${expectedTimeStr}] [WARN] problem`);

            // console.log called with object
            // expectCalledWith checks exact args
            mocks.logSpy.expectCalledWith(dataObj);

            mocks.groupEndSpy.expectCalled();

            const expectedLog = `[${expectedTimeStr}] [WARN] problem\n${dataStr}`;
            assertEqual(window.Logger.getLogs(), expectedLog);
        } finally {
            restoreMocks(mocks);
        }
    });

    register('Logging: error logs with data', () => {
        const mocks = setupMocks();
        try {
            window.Logger.error('boom', dataObj);

            mocks.groupSpy.expectCalledWith(`[${expectedTimeStr}] [ERROR] boom`);
            mocks.logSpy.expectCalledWith(dataObj);

            const expectedLog = `[${expectedTimeStr}] [ERROR] boom\n${dataStr}`;
            assertEqual(window.Logger.getLogs(), expectedLog);
        } finally {
            restoreMocks(mocks);
        }
    });

    register('Logging: test logs with data', () => {
        const mocks = setupMocks();
        try {
            window.Logger.test('case', dataObj);

            mocks.groupSpy.expectCalledWith(`[${expectedTimeStr}] [TEST] case`);
            mocks.logSpy.expectCalledWith(dataObj);

            const expectedLog = `[${expectedTimeStr}] [TEST] case\n${dataStr}`;
            assertEqual(window.Logger.getLogs(), expectedLog);
        } finally {
            restoreMocks(mocks);
        }
    });

    register('Logging: format JSON.stringify behavior', () => {
        const mocks = setupMocks();
        try {
            window.Logger.info('with data', dataObj);
            const logs = window.Logger.getLogs();
            if (!logs.includes(dataStr)) {
                throw new Error('Logs should contain stringified data object');
            }
        } finally {
            restoreMocks(mocks);
        }
    });

    // 5. Tests for interaction/state/undo/brush
    register('Logging: interaction formats with value', () => {
        const mocks = setupMocks();
        try {
            window.Logger.interaction('#button', 'click', 'Save');
            assertEqual(window.Logger.getLogs(), `[${expectedTimeStr}] [INTERACTION] click on #button -> Save`);
        } finally {
            restoreMocks(mocks);
        }
    });

    register('Logging: interaction formats without value', () => {
        const mocks = setupMocks();
        try {
            window.Logger.interaction('#button', 'click');
            assertEqual(window.Logger.getLogs(), `[${expectedTimeStr}] [INTERACTION] click on #button`);
        } finally {
            restoreMocks(mocks);
        }
    });

    register('Logging: state formats key and JSON value', () => {
        const mocks = setupMocks();
        try {
            window.Logger.state('tool', { name: 'brush' });
            assertEqual(window.Logger.getLogs(), `[${expectedTimeStr}] [STATE] tool = {"name":"brush"}`);
        } finally {
            restoreMocks(mocks);
        }
    });

    register('Logging: undo formats index/total/action', () => {
        const mocks = setupMocks();
        try {
            window.Logger.undo(3, 10, 'mask stroke');
            assertEqual(window.Logger.getLogs(), `[${expectedTimeStr}] [UNDO] Action: mask stroke | Index: 3/10`);
        } finally {
            restoreMocks(mocks);
        }
    });

    register('Logging: brush formats type and node count', () => {
        const mocks = setupMocks();
        try {
            window.Logger.brush('erase', 42);
            assertEqual(window.Logger.getLogs(), `[${expectedTimeStr}] [BRUSH] erase stroke completed with 42 nodes`);
        } finally {
            restoreMocks(mocks);
        }
    });

    // 6. Tests for getLogs (concatenation)
    register('Logging: getLogs concatenation', () => {
        const mocks = setupMocks();
        try {
            window.Logger.info('first');
            window.Logger.warn('second');
            window.Logger.error('third');

            const expected = `[${expectedTimeStr}] [INFO] first\n[${expectedTimeStr}] [WARN] second\n[${expectedTimeStr}] [ERROR] third`;
            assertEqual(window.Logger.getLogs(), expected);
        } finally {
            restoreMocks(mocks);
        }
    });

    // 7. Tests for clear
    register('Logging: clear empties buffer', () => {
        const mocks = setupMocks();
        try {
            window.Logger.info('temp');
            window.Logger.clear();
            assertEqual(window.Logger.getLogs(), '');
        } finally {
            restoreMocks(mocks);
        }
    });

    register('Logging: logging works after clear', () => {
        const mocks = setupMocks();
        try {
            window.Logger.info('before');
            window.Logger.clear();
            window.Logger.info('after');
            assertEqual(window.Logger.getLogs(), `[${expectedTimeStr}] [INFO] after`);
        } finally {
            restoreMocks(mocks);
        }
    });

    // Extra: importLogs
    register('Logging: importLogs appends logs', () => {
        const mocks = setupMocks();
        try {
            window.Logger.info('current');
            const imported = `[00:00:00.000] [OLD] old log\n[00:00:01.000] [OLD] old log 2`;
            window.Logger.importLogs(imported);

            const expected = `[${expectedTimeStr}] [INFO] current\n[00:00:00.000] [OLD] old log\n[00:00:01.000] [OLD] old log 2`;
            assertEqual(window.Logger.getLogs(), expected);
        } finally {
            restoreMocks(mocks);
        }
    });

})();
