# Logger Unit Test Blueprint

## Scope
These tests cover `scripts/logging.js` and validate logging formatting, console side effects, and internal buffer management.

## Test Environment
- **Framework**: Jest with JSDOM.
- **Clock control**: stub `Date` or `Date.prototype.toISOString`.
- **Console mocks**: spy on `console.log`, `console.groupCollapsed`, `console.groupEnd`.

## Test Data Fixtures
- **Fixed time**: ISO string `2024-01-02T03:04:05.678Z`.
  - Expected timestamp format: `03:04:05.678` (time portion, millisecond precision, no trailing `Z`).
- **Sample data**:
  - `dataObj = { ok: true, count: 2 }`
  - `dataStr = JSON.stringify(dataObj, null, 2)`

## Tests for `timestamp()`

### 1. Formatting Under Controlled Time
**Scenario:** `timestamp()` should return the time portion of ISO string without the trailing `Z`.

**Setup:**
1. Stub `new Date().toISOString()` to return `2024-01-02T03:04:05.678Z`.

**Inputs:** `timestamp()`

**Expected Output:** `"03:04:05.678"`.

**Exact Assertions:**
1. `expect(timestamp()).toBe('03:04:05.678')`

### 2. Stability Under Fixed Time
**Scenario:** Repeated calls with the same stubbed time return identical values.

**Setup:** Same stub as above.

**Inputs:** Call `timestamp()` twice.

**Expected Output:** Both values identical.

**Exact Assertions:**
1. `expect(timestamp()).toBe(timestamp())`

## Tests for `format` via `info/warn/error/test`

### 3. `info` Logs Without Data (console.log path)
**Scenario:** With no data, `format` should log a single line and not use grouping.

**Setup:**
1. Stub `timestamp()` to return `03:04:05.678`.
2. Spy on `console.log`, `console.groupCollapsed`, `console.groupEnd`.

**Inputs:** `Logger.info('hello')`

**Expected Output:**
- Console: `console.log('[03:04:05.678] [INFO] hello')`.
- No `groupCollapsed` / `groupEnd`.
- Logs buffer contains one entry.

**Exact Assertions:**
1. `expect(console.log).toHaveBeenCalledWith('[03:04:05.678] [INFO] hello')`
2. `expect(console.groupCollapsed).not.toHaveBeenCalled()`
3. `expect(console.groupEnd).not.toHaveBeenCalled()`
4. `expect(Logger.getLogs()).toBe('[03:04:05.678] [INFO] hello')`

### 4. `warn` Logs With Data (grouped output)
**Scenario:** With data, `format` should use `console.groupCollapsed`, log data, and close group.

**Setup:**
1. Stub `timestamp()` to return `03:04:05.678`.
2. Spy on console methods.

**Inputs:** `Logger.warn('problem', dataObj)`

**Expected Output:**
- `console.groupCollapsed('[03:04:05.678] [WARN] problem')`
- `console.log(dataObj)`
- `console.groupEnd()`
- Logs buffer contains message line and JSON stringified data line.

**Exact Assertions:**
1. `expect(console.groupCollapsed).toHaveBeenCalledWith('[03:04:05.678] [WARN] problem')`
2. `expect(console.log).toHaveBeenCalledWith(dataObj)`
3. `expect(console.groupEnd).toHaveBeenCalled()`
4. `expect(Logger.getLogs()).toBe('[03:04:05.678] [WARN] problem\n' + dataStr)`

### 5. `error` Logs With Data
**Scenario:** `error` uses same grouped path as `warn`.

**Setup:** As above.

**Inputs:** `Logger.error('boom', dataObj)`

**Expected Output:**
- Same grouping behavior with `[ERROR]`.

**Exact Assertions:**
1. `expect(console.groupCollapsed).toHaveBeenCalledWith('[03:04:05.678] [ERROR] boom')`
2. `expect(console.log).toHaveBeenCalledWith(dataObj)`
3. `expect(Logger.getLogs()).toBe('[03:04:05.678] [ERROR] boom\n' + dataStr)`

### 6. `test` Logs With Data
**Scenario:** `test` uses `[TEST]` category.

**Setup:** As above.

**Inputs:** `Logger.test('case', dataObj)`

**Expected Output:**
- Grouped log with category `[TEST]`.

**Exact Assertions:**
1. `expect(console.groupCollapsed).toHaveBeenCalledWith('[03:04:05.678] [TEST] case')`
2. `expect(console.log).toHaveBeenCalledWith(dataObj)`
3. `expect(Logger.getLogs()).toBe('[03:04:05.678] [TEST] case\n' + dataStr)`

### 7. `format` JSON.stringify Behavior
**Scenario:** When data is provided, JSON stringified data should be appended to logs.

**Setup:**
1. Stub timestamp.
2. Call any logger method with `dataObj`.

**Inputs:** `Logger.info('with data', dataObj)`

**Expected Output:**
- `Logger.getLogs()` contains log line + JSON string.

**Exact Assertions:**
1. `expect(Logger.getLogs()).toContain(dataStr)`

## Tests for `interaction/state/undo/brush`

### 8. `interaction` Formats With Value
**Scenario:** When value is provided, `interaction` appends `-> value`.

**Setup:** Stub timestamp.

**Inputs:** `Logger.interaction('#button', 'click', 'Save')`

**Expected Output:**
- Log line: `[INTERACTION] click on #button -> Save`.

**Exact Assertions:**
1. `expect(Logger.getLogs()).toBe('[03:04:05.678] [INTERACTION] click on #button -> Save')`

### 9. `interaction` Formats Without Value
**Scenario:** With no value, `interaction` omits arrow.

**Setup:** Stub timestamp.

**Inputs:** `Logger.interaction('#button', 'click')`

**Expected Output:**
- Log line: `[INTERACTION] click on #button`.

**Exact Assertions:**
1. `expect(Logger.getLogs()).toBe('[03:04:05.678] [INTERACTION] click on #button')`

### 10. `state` Formats Key and JSON Value
**Scenario:** `state` stringifies value in message.

**Setup:** Stub timestamp.

**Inputs:** `Logger.state('tool', { name: 'brush' })`

**Expected Output:**
- Log line with `tool = {"name":"brush"}`

**Exact Assertions:**
1. `expect(Logger.getLogs()).toBe('[03:04:05.678] [STATE] tool = {"name":"brush"}')`

### 11. `undo` Formats Index/Total/Action
**Scenario:** `undo` should embed index/total and action.

**Setup:** Stub timestamp.

**Inputs:** `Logger.undo(3, 10, 'mask stroke')`

**Expected Output:**
- Log line: `[UNDO] Action: mask stroke | Index: 3/10`.

**Exact Assertions:**
1. `expect(Logger.getLogs()).toBe('[03:04:05.678] [UNDO] Action: mask stroke | Index: 3/10')`

### 12. `brush` Formats Type and Node Count
**Scenario:** `brush` should embed type and node count.

**Setup:** Stub timestamp.

**Inputs:** `Logger.brush('erase', 42)`

**Expected Output:**
- Log line: `[BRUSH] erase stroke completed with 42 nodes`.

**Exact Assertions:**
1. `expect(Logger.getLogs()).toBe('[03:04:05.678] [BRUSH] erase stroke completed with 42 nodes')`

## Tests for `getLogs`

### 13. Newline-Joined Concatenation in Correct Order
**Scenario:** Multiple logs should concatenate in order with newlines.

**Setup:** Stub timestamp for deterministic output; ensure logs cleared.

**Inputs:**
1. `Logger.info('first')`
2. `Logger.warn('second')`
3. `Logger.error('third')`

**Expected Output:**
- `getLogs()` returns three lines in order.

**Exact Assertions:**
1. `expect(Logger.getLogs()).toBe(
   '[03:04:05.678] [INFO] first\n' +
   '[03:04:05.678] [WARN] second\n' +
   '[03:04:05.678] [ERROR] third'
 )`

## Tests for `clear`

### 14. Clears Buffer
**Scenario:** `clear()` empties stored logs.

**Setup:** Add a log line, then clear.

**Inputs:** `Logger.clear()`

**Expected Output:**
- `getLogs()` returns empty string.

**Exact Assertions:**
1. `Logger.info('temp')`
2. `Logger.clear()`
3. `expect(Logger.getLogs()).toBe('')`

### 15. Clear Leaves Future Logging Intact
**Scenario:** After clear, logging should still work normally.

**Setup:** Clear logs, then log again.

**Inputs:** `Logger.clear(); Logger.info('after')`

**Expected Output:**
- `getLogs()` contains the new log line only.

**Exact Assertions:**
1. `Logger.clear()`
2. `Logger.info('after')`
3. `expect(Logger.getLogs()).toBe('[03:04:05.678] [INFO] after')`
