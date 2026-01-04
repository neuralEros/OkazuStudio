(function() {
    const { register, assert, assertEqual, assertDeepEqual } = window.TestRunner;
    const Logger = window.Logger; // Global instance
    // Note: Since Logger is a singleton and `format` writes to console, we must spy on console.

    // 1. Test Environment
    // We cannot easily replace `new Date` inside the closure of `logging.js` because it's already executed.
    // However, `timestamp` function is exposed via `OkazuTestables`.
    // We can spy on console methods.

    function spyConsole() {
        const spies = {
            log: [],
            groupCollapsed: [],
            groupEnd: []
        };
        const origLog = console.log;
        const origGroupCollapsed = console.groupCollapsed;
        const origGroupEnd = console.groupEnd;

        console.log = (msg) => spies.log.push(msg);
        console.groupCollapsed = (msg) => spies.groupCollapsed.push(msg);
        console.groupEnd = () => spies.groupEnd.push('called');

        return {
            spies,
            restore: () => {
                console.log = origLog;
                console.groupCollapsed = origGroupCollapsed;
                console.groupEnd = origGroupEnd;
            }
        };
    }

    // 3. Tests for timestamp
    register('Logging: Timestamp Format', () => {
        const { timestamp } = window.OkazuTestables.logging;
        // Check format: HH:MM:SS.mmm
        const ts = timestamp();
        assert(/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(ts), `Timestamp format match: ${ts}`);
    });

    // 4. Tests for format via public methods
    register('Logging: Info/Warn/Error formatting', () => {
        Logger.clear();
        const { spies, restore } = spyConsole();

        try {
            // 4.1 Info (No Data)
            Logger.info('hello');
            // Log buffer updated
            const logs = Logger.getLogs();
            assert(logs.includes('[INFO] hello'), 'Log buffer contains message');
            // Console output
            assert(spies.log.some(m => typeof m === 'string' && m.includes('[INFO] hello')), 'Console log called');
            assertEqual(spies.groupCollapsed.length, 0, 'No group');

            // 4.2 Warn (With Data)
            const dataObj = { a: 1 };
            Logger.warn('alert', dataObj);
            const logs2 = Logger.getLogs();
            assert(logs2.includes('[WARN] alert'), 'Log buffer update');
            assert(logs2.includes('"a": 1'), 'Log buffer JSON');
            assert(spies.groupCollapsed.length > 0, 'Group started');
            assert(spies.groupEnd.length > 0, 'Group ended');
            // Check that object was logged
            assert(spies.log.includes(dataObj), 'Data object logged to console');

        } finally {
            restore();
        }
    });

    // 5. Specialized Formats
    register('Logging: Special Methods', () => {
        Logger.clear();
        const { restore } = spyConsole(); // Suppress output
        try {
            // 5.1 Interaction
            Logger.interaction('#btn', 'click', 'Save');
            assert(Logger.getLogs().includes('click on #btn -> Save'), 'Interaction format');

            // 5.3 State
            Logger.state('tool', 'brush');
            assert(Logger.getLogs().includes('tool = "brush"'), 'State format');

            // 5.4 Undo
            Logger.undo(1, 5, 'STROKE');
            assert(Logger.getLogs().includes('Action: STROKE | Index: 1/5'), 'Undo format');

            // 5.5 Brush
            Logger.brush('erase', 10);
            assert(Logger.getLogs().includes('erase stroke completed with 10 nodes'), 'Brush format');
        } finally {
            restore();
        }
    });

    // 7. Clear
    register('Logging: Clear', () => {
        Logger.info('test');
        assert(Logger.getLogs().length > 0, 'Not empty');
        Logger.clear();
        assertEqual(Logger.getLogs(), '', 'Empty string after clear');
    });

})();
