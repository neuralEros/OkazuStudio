# OkazuStudio Testability & In‑App Tests Diary

## Entry 1
- Started work by drafting the project reference (`report.md`) and initializing this diary.
- Next: expose test‑friendly helpers and wire the in‑app test runner.

## Entry 2
- Added testability factories in `scripts/main.js` and exposed them via `window.OkazuTestables`.
- Extracted and exposed pure input/adjustment helpers for unit tests.
- Exposed Kakushi/Stego/Watermark helpers under the test namespace.

## Entry 3
- Implemented the in‑app test runner (`scripts/test_runner.js`) and initial tests (`scripts/tests.js`).
- Added a Debug panel “Run Tests” button and Logger support for TEST output.
- Wired the new test scripts into `index.html` and updated AGENTS notes.
