# OkazuStudio Testability + In-App Test System Plan

This document is the **primary reference** for the full effort to make the codebase test‑friendly and to embed an offline, in‑app “Run Tests” workflow. It is organized **per file**, with checklist‑level scope and the verification I will perform to confirm each change works. It also documents the incremental execution strategy.

## Execution strategy (incremental + verified)
1. **Preparation first**: introduce test‑friendly helpers and explicit factory functions without changing user behavior.
2. **Smallest viable surface**: expose core math/data helpers behind a single test namespace to avoid coupling.
3. **Verify each chunk immediately**: after each change, sanity‑check by running a targeted test (either a unit check through the test runner, or a manual smoke check via console) before proceeding.
4. **Integrate the UI hook**: add the Debug panel button last, once test execution is stable.
5. **Final regression sweep**: confirm the app still loads, logs appear, and image operations are unaffected.

---

## `index.html`
**Scope checklist**
- [ ] Load new in‑app test scripts in a safe order (after core modules, before/after main as appropriate).
- [ ] Ensure the new Debug panel button has a unique id for wiring.

**Verification**
- Open the app and confirm the Debug tab renders the new button.
- Confirm no console errors on load and existing UI remains intact.

---

## `scripts/main.js`
**Scope checklist**
- [ ] Replace the inline `state` literal with a **factory** (e.g., `createDefaultState()`).
- [ ] Replace the inline `els` literal with a **factory** (e.g., `createDefaultEls(root)`), keeping behavior identical.
- [ ] Expose these factories on a test namespace for offline tests.

**Verification**
- Verify app still initializes normally (no missing element errors).
- Run a minimal smoke test in the console (e.g., call the factory and confirm it returns expected shape).

---

## `scripts/input.js`
**Scope checklist**
- [ ] Extract pure coordinate helpers (`rotatePoint`, `getRotatedAABB`, truth/visual transforms) into standalone functions.
- [ ] Keep wrappers that use `state`/`els` so runtime behavior is unchanged.
- [ ] Expose the pure helpers on the test namespace.

**Verification**
- Run a test that checks round‑trip mapping of truth↔visual coordinates for rotations.
- Confirm brush input still works normally (no regressions when drawing).

---

## `scripts/adjustments.js`
**Scope checklist**
- [ ] Expose pure color helpers (HSL/RGB conversion, band weighting, luminance weighting).
- [ ] Leave UI wiring and canvas operations unchanged.
- [ ] Expose helpers on the test namespace.

**Verification**
- Run tests that validate the HSL↔RGB round trip and expected band weight behavior.
- Confirm adjustment sliders still update the canvas normally.

---

## `scripts/brush.js`
**Scope checklist**
- [ ] Ensure existing pure brush helpers remain available for tests.

**Verification**
- Run a test that checks `getSoftness` and paint segment behavior with deterministic inputs.

---

## `scripts/kakushi.js`
**Scope checklist**
- [ ] Expose pure byte‑level helpers (`embedBytes`, `extractBytes`, header checks, mask helpers) on the test namespace.
- [ ] Leave public API (`peek`, `seal`, `reveal`) unchanged.

**Verification**
- Run a test that embeds a small payload into a synthetic buffer and re‑extracts it to confirm round‑trip integrity.

---

## `scripts/stego.js`
**Scope checklist**
- [ ] Expose payload helpers (mask/action extraction, adjustments/crop packet assembly) on the test namespace.
- [ ] Avoid behavioral changes in export or save paths.

**Verification**
- Run a test that checks defaults are detected correctly (clean vs. non‑clean adjustments).

---

## `scripts/watermark.js`
**Scope checklist**
- [ ] Expose deterministic watermark mask helpers on the test namespace (if present).
- [ ] Avoid changing existing watermark behavior.

**Verification**
- Run a test that confirms a known input mask produces expected pixels or counts.

---

## `scripts/logging.js`
**Scope checklist**
- [ ] Add a test‑specific log method or category for in‑app test output.
- [ ] Keep existing log formatting intact.

**Verification**
- Trigger a test run and confirm logs appear in both the DevTools console and Debug log viewer.

---

## `scripts/settings.js`
**Scope checklist**
- [ ] Add a **Run Tests** control to the Debug tab.
- [ ] Wire the button to the test runner with safe guards (handle missing runner gracefully).

**Verification**
- Click **Run Tests** in the Debug panel and confirm log output is appended to the Debug log viewer.

---

## `scripts/test_runner.js` (new)
**Scope checklist**
- [ ] Provide a lightweight offline test harness (`test`, `assert`, `runAll`).
- [ ] Support async tests with timeouts.
- [ ] Emit structured log output to `Logger` and console.

**Verification**
- Trigger test run in the Debug panel and confirm a summary line + individual pass/fail results.

---

## `scripts/tests.js` (new)
**Scope checklist**
- [ ] Register deterministic tests for the exposed helper functions.
- [ ] Use synthetic buffers and math inputs only (no network or file dependencies).

**Verification**
- Run tests via Debug panel and confirm all tests pass.

---

## `diary.md` (new)
**Scope checklist**
- [ ] Record progress after each meaningful chunk (helper exposure, test harness, UI wiring, etc.).

**Verification**
- Ensure diary entries are chronological and reflect actual steps taken.
