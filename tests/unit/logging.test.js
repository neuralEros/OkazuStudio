(function() {
    const { register, assert, assertEqual } = window.TestRunner;
    const Logger = window.Logger; // Global instance

    const fixedIso = '2024-01-02T03:04:05.678Z';
    const fixedTime = '03:04:05.678';
    const dataObj = { ok: true, count: 2 };
    const dataStr = JSON.stringify(dataObj, null, 2);

    function stubToISOString() {
        const original = Date.prototype.toISOString;
        Date.prototype.toISOString = () => fixedIso;
        return () => {
            Date.prototype.toISOString = original;
        };
    }

    function spyConsole() {
        const spies = {
            log: [],
            groupCollapsed: [],
            groupEnd: []
        };
        const origLog = console.log;
        const origGroupCollapsed = console.groupCollapsed;
        const origGroupEnd = console.groupEnd;

        console.log = (...args) => spies.log.push(args);
        console.groupCollapsed = (...args) => spies.groupCollapsed.push(args);
        console.groupEnd = (...args) => spies.groupEnd.push(args);

        return {
            spies,
            restore: () => {
                console.log = origLog;
                console.groupCollapsed = origGroupCollapsed;
                console.groupEnd = origGroupEnd;
            }
        };
    }

    register('Logging: Timestamp Format', () => {
        const restoreTime = stubToISOString();
        try {
            const { timestamp } = window.OkazuTestables.logging;
            assertEqual(timestamp(), fixedTime, 'Timestamp matches fixed time');
            assertEqual(timestamp(), fixedTime, 'Timestamp stable across calls');
        } finally {
            restoreTime();
        }
    });

    register('Logging: Info formatting without data', () => {
        Logger.clear();
        const restoreTime = stubToISOString();
        const { spies, restore } = spyConsole();

        try {
            Logger.info('hello');
            const expectedLine = `[${fixedTime}] [INFO] hello`;
            assertEqual(Logger.getLogs(), expectedLine, 'Info log line format');
            assertEqual(spies.log.length, 1, 'Info uses console.log once');
            assertEqual(spies.log[0][0], expectedLine, 'Console log line matches');
            assertEqual(spies.groupCollapsed.length, 0, 'Info has no groupCollapsed');
            assertEqual(spies.groupEnd.length, 0, 'Info has no groupEnd');
        } finally {
            restore();
            restoreTime();
        }
    });

    register('Logging: Warn formatting with data', () => {
        Logger.clear();
        const restoreTime = stubToISOString();
        const { spies, restore } = spyConsole();

        try {
            Logger.warn('problem', dataObj);
            const expectedLine = `[${fixedTime}] [WARN] problem`;
            assertEqual(Logger.getLogs(), `${expectedLine}\n${dataStr}`, 'Warn log line format');
            assertEqual(spies.groupCollapsed.length, 1, 'Warn uses groupCollapsed');
            assertEqual(spies.groupCollapsed[0][0], expectedLine, 'GroupCollapsed line matches');
            assertEqual(spies.log.length, 1, 'Warn logs data once');
            assertEqual(spies.log[0][0], dataObj, 'Console log data matches');
            assertEqual(spies.groupEnd.length, 1, 'Warn uses groupEnd');
        } finally {
            restore();
            restoreTime();
        }
    });

    register('Logging: Error formatting with data', () => {
        Logger.clear();
        const restoreTime = stubToISOString();
        const { spies, restore } = spyConsole();

        try {
            Logger.error('boom', dataObj);
            const expectedLine = `[${fixedTime}] [ERROR] boom`;
            assertEqual(Logger.getLogs(), `${expectedLine}\n${dataStr}`, 'Error log line format');
            assertEqual(spies.groupCollapsed.length, 1, 'Error uses groupCollapsed');
            assertEqual(spies.groupCollapsed[0][0], expectedLine, 'GroupCollapsed line matches');
            assertEqual(spies.log.length, 1, 'Error logs data once');
            assertEqual(spies.log[0][0], dataObj, 'Console log data matches');
            assertEqual(spies.groupEnd.length, 1, 'Error uses groupEnd');
        } finally {
            restore();
            restoreTime();
        }
    });

    register('Logging: Test formatting with data', () => {
        Logger.clear();
        const restoreTime = stubToISOString();
        const { spies, restore } = spyConsole();

        try {
            Logger.test('case', dataObj);
            const expectedLine = `[${fixedTime}] [TEST] case`;
            assertEqual(Logger.getLogs(), `${expectedLine}\n${dataStr}`, 'Test log line format');
            assertEqual(spies.groupCollapsed.length, 1, 'Test uses groupCollapsed');
            assertEqual(spies.groupCollapsed[0][0], expectedLine, 'GroupCollapsed line matches');
            assertEqual(spies.log.length, 1, 'Test logs data once');
            assertEqual(spies.log[0][0], dataObj, 'Console log data matches');
            assertEqual(spies.groupEnd.length, 1, 'Test uses groupEnd');
        } finally {
            restore();
            restoreTime();
        }
    });

    register('Logging: Special Methods', () => {
        Logger.clear();
        const restoreTime = stubToISOString();
        const { restore } = spyConsole();
        try {
            Logger.interaction('#btn', 'click', 'Save');
            assertEqual(
                Logger.getLogs(),
                `[${fixedTime}] [INTERACTION] click on #btn -> Save`,
                'Interaction format'
            );

            Logger.clear();
            Logger.state('tool', 'brush');
            assertEqual(
                Logger.getLogs(),
                `[${fixedTime}] [STATE] tool = "brush"`,
                'State format'
            );

            Logger.clear();
            Logger.undo(1, 5, 'STROKE');
            assertEqual(
                Logger.getLogs(),
                `[${fixedTime}] [UNDO] Action: STROKE | Index: 1/5`,
                'Undo format'
            );

            Logger.clear();
            Logger.brush('erase', 10);
            assertEqual(
                Logger.getLogs(),
                `[${fixedTime}] [BRUSH] erase stroke completed with 10 nodes`,
                'Brush format'
            );
        } finally {
            restore();
            restoreTime();
        }
    });

    register('Logging: getLogs order', () => {
        Logger.clear();
        const restoreTime = stubToISOString();
        const { restore } = spyConsole();

        try {
            Logger.info('first');
            Logger.warn('second');
            Logger.error('third');
            assertEqual(
                Logger.getLogs(),
                `[${fixedTime}] [INFO] first\n[${fixedTime}] [WARN] second\n[${fixedTime}] [ERROR] third`,
                'Logs are newline-joined in order'
            );
        } finally {
            restore();
            restoreTime();
        }
    });

    register('Logging: Clear then log', () => {
        const restoreTime = stubToISOString();
        const { restore } = spyConsole();
        try {
            Logger.info('test');
            assert(Logger.getLogs().length > 0, 'Not empty');
            Logger.clear();
            Logger.info('after');
            assertEqual(
                Logger.getLogs(),
                `[${fixedTime}] [INFO] after`,
                'Logs reset after clear'
            );
        } finally {
            restore();
            restoreTime();
        }
    });

})();
