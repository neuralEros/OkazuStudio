1. Scope and Environment Setup
   # Scope: cover scripts/logging.js and validate logging formatting, console side effects, and internal buffer management.
   [ ] 1.1. Configure Test Framework: Jest with JSDOM.
   [ ] 1.2. Implement Clock control: stub Date or Date.prototype.toISOString.
   [ ] 1.3. Implement Console mocks: spy on console.log.
   [ ] 1.4. Implement Console mocks: spy on console.groupCollapsed.
   [ ] 1.5. Implement Console mocks: spy on console.groupEnd.

2. Test Data Fixtures Preparation
   [ ] 2.1. Define Fixed time: ISO string 2024-01-02T03:04:05.678Z.
      # Expected timestamp format: 03:04:05.678 (time portion, millisecond precision, no trailing Z).
   [ ] 2.2. Define dataObj: { ok: true, count: 2 }.
   [ ] 2.3. Define dataStr: JSON.stringify(dataObj, null, 2).

3. Tests for timestamp()
   [ ] 3.1. Test 1: Formatting Under Controlled Time
      # Scenario: timestamp() should return the time portion of ISO string without the trailing Z.
      [ ] 3.1.1. Setup: Stub new Date().toISOString() to return 2024-01-02T03:04:05.678Z.
      [ ] 3.1.2. Input: Invoke timestamp().
      # Expected Output: "03:04:05.678".
      [ ] 3.1.3. Assertion: expect(timestamp()).toBe('03:04:05.678').
   [ ] 3.2. Test 2: Stability Under Fixed Time
      # Scenario: Repeated calls with the same stubbed time return identical values.
      [ ] 3.2.1. Setup: Same stub as 3.1.1.
      [ ] 3.2.2. Input: Call timestamp() twice.
      # Expected Output: Both values identical.
      [ ] 3.2.3. Assertion: expect(timestamp()).toBe(timestamp()).

4. Tests for format via info/warn/error/test
   [ ] 4.1. Test 3: info Logs Without Data (console.log path)
      # Scenario: With no data, format should log a single line and not use grouping.
      [ ] 4.1.1. Setup: Stub timestamp() to return 03:04:05.678.
      [ ] 4.1.2. Setup: Spy on console.log, console.groupCollapsed, console.groupEnd.
      [ ] 4.1.3. Input: Logger.info('hello').
      # Expected Output: Console: console.log('[03:04:05.678] [INFO] hello'). No groupCollapsed/groupEnd. Logs buffer contains one entry.
      [ ] 4.1.4. Assertion: expect(console.log).toHaveBeenCalledWith('[03:04:05.678] [INFO] hello').
      [ ] 4.1.5. Assertion: expect(console.groupCollapsed).not.toHaveBeenCalled().
      [ ] 4.1.6. Assertion: expect(console.groupEnd).not.toHaveBeenCalled().
      [ ] 4.1.7. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [INFO] hello').
   [ ] 4.2. Test 4: warn Logs With Data (grouped output)
      # Scenario: With data, format should use console.groupCollapsed, log data, and close group.
      [ ] 4.2.1. Setup: Stub timestamp() to return 03:04:05.678.
      [ ] 4.2.2. Setup: Spy on console methods.
      [ ] 4.2.3. Input: Logger.warn('problem', dataObj).
      # Expected Output: console.groupCollapsed('[03:04:05.678] [WARN] problem'). console.log(dataObj). console.groupEnd(). Logs buffer contains message line and JSON stringified data line.
      [ ] 4.2.4. Assertion: expect(console.groupCollapsed).toHaveBeenCalledWith('[03:04:05.678] [WARN] problem').
      [ ] 4.2.5. Assertion: expect(console.log).toHaveBeenCalledWith(dataObj).
      [ ] 4.2.6. Assertion: expect(console.groupEnd).toHaveBeenCalled().
      [ ] 4.2.7. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [WARN] problem\n' + dataStr).
   [ ] 4.3. Test 5: error Logs With Data
      # Scenario: error uses same grouped path as warn.
      [ ] 4.3.1. Setup: As above in 4.2.
      [ ] 4.3.2. Input: Logger.error('boom', dataObj).
      # Expected Output: Same grouping behavior with [ERROR].
      [ ] 4.3.3. Assertion: expect(console.groupCollapsed).toHaveBeenCalledWith('[03:04:05.678] [ERROR] boom').
      [ ] 4.3.4. Assertion: expect(console.log).toHaveBeenCalledWith(dataObj).
      [ ] 4.3.5. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [ERROR] boom\n' + dataStr).
   [ ] 4.4. Test 6: test Logs With Data
      # Scenario: test uses [TEST] category.
      [ ] 4.4.1. Setup: As above in 4.2.
      [ ] 4.4.2. Input: Logger.test('case', dataObj).
      # Expected Output: Grouped log with category [TEST].
      [ ] 4.4.3. Assertion: expect(console.groupCollapsed).toHaveBeenCalledWith('[03:04:05.678] [TEST] case').
      [ ] 4.4.4. Assertion: expect(console.log).toHaveBeenCalledWith(dataObj).
      [ ] 4.4.5. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [TEST] case\n' + dataStr).
   [ ] 4.5. Test 7: format JSON.stringify Behavior
      # Scenario: When data is provided, JSON stringified data should be appended to logs.
      [ ] 4.5.1. Setup: Stub timestamp.
      [ ] 4.5.2. Input: Call any logger method with dataObj (e.g., Logger.info('with data', dataObj)).
      # Expected Output: Logger.getLogs() contains log line + JSON string.
      [ ] 4.5.3. Assertion: expect(Logger.getLogs()).toContain(dataStr).

5. Tests for interaction/state/undo/brush
   [ ] 5.1. Test 8: interaction Formats With Value
      # Scenario: When value is provided, interaction appends -> value.
      [ ] 5.1.1. Setup: Stub timestamp.
      [ ] 5.1.2. Input: Logger.interaction('#button', 'click', 'Save').
      # Expected Output: Log line: [INTERACTION] click on #button -> Save.
      [ ] 5.1.3. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [INTERACTION] click on #button -> Save').
   [ ] 5.2. Test 9: interaction Formats Without Value
      # Scenario: With no value, interaction omits arrow.
      [ ] 5.2.1. Setup: Stub timestamp.
      [ ] 5.2.2. Input: Logger.interaction('#button', 'click').
      # Expected Output: Log line: [INTERACTION] click on #button.
      [ ] 5.2.3. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [INTERACTION] click on #button').
   [ ] 5.3. Test 10: state Formats Key and JSON Value
      # Scenario: state stringifies value in message.
      [ ] 5.3.1. Setup: Stub timestamp.
      [ ] 5.3.2. Input: Logger.state('tool', { name: 'brush' }).
      # Expected Output: Log line with tool = {"name":"brush"}.
      [ ] 5.3.3. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [STATE] tool = {"name":"brush"}').
   [ ] 5.4. Test 11: undo Formats Index/Total/Action
      # Scenario: undo should embed index/total and action.
      [ ] 5.4.1. Setup: Stub timestamp.
      [ ] 5.4.2. Input: Logger.undo(3, 10, 'mask stroke').
      # Expected Output: Log line: [UNDO] Action: mask stroke | Index: 3/10.
      [ ] 5.4.3. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [UNDO] Action: mask stroke | Index: 3/10').
   [ ] 5.5. Test 12: brush Formats Type and Node Count
      # Scenario: brush should embed type and node count.
      [ ] 5.5.1. Setup: Stub timestamp.
      [ ] 5.5.2. Input: Logger.brush('erase', 42).
      # Expected Output: Log line: [BRUSH] erase stroke completed with 42 nodes.
      [ ] 5.5.3. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [BRUSH] erase stroke completed with 42 nodes').

6. Tests for getLogs
   [ ] 6.1. Test 13: Newline-Joined Concatenation in Correct Order
      # Scenario: Multiple logs should concatenate in order with newlines.
      [ ] 6.1.1. Setup: Stub timestamp for deterministic output.
      [ ] 6.1.2. Setup: Ensure logs are cleared.
      [ ] 6.1.3. Input 1: Logger.info('first').
      [ ] 6.1.4. Input 2: Logger.warn('second').
      [ ] 6.1.5. Input 3: Logger.error('third').
      # Expected Output: getLogs() returns three lines in order.
      [ ] 6.1.6. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [INFO] first\n[03:04:05.678] [WARN] second\n[03:04:05.678] [ERROR] third').

7. Tests for clear
   [ ] 7.1. Test 14: Clears Buffer
      # Scenario: clear() empties stored logs.
      [ ] 7.1.1. Setup: Add a log line via Logger.info('temp').
      [ ] 7.1.2. Input: Logger.clear().
      # Expected Output: getLogs() returns empty string.
      [ ] 7.1.3. Assertion: expect(Logger.getLogs()).toBe('').
   [ ] 7.2. Test 15: Clear Leaves Future Logging Intact
      # Scenario: After clear, logging should still work normally.
      [ ] 7.2.1. Setup: Clear logs via Logger.clear().
      [ ] 7.2.2. Input: Logger.info('after').
      # Expected Output: getLogs() contains the new log line only.
      [ ] 7.2.3. Assertion: expect(Logger.getLogs()).toBe('[03:04:05.678] [INFO] after').

