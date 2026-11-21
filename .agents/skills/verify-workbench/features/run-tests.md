# Run tests

A user edits code in Monaco, clicks **Run tests**, and sees real runner output; passing cumulative checks unlocks the next level and drafts survive reload.

## Sub-features

- `run-fail-starter` unmodified starter fails level 1 with real output.
- `run-personal-test` a user test in `sandbox_test.go` runs and its log output appears.
- `run-unlock` passing level 1 enables the `Level 2` button.
- `run-draft-restore` edited code survives a reload.

## How to get to it (user POV)

- Open `/practice/<slug>` (e.g. `/practice/ride-dispatch`) and click `Run tests`, or press `ControlOrMeta+Enter`.
- Pick the language with the `Programming language` select.

## Driving it with Playwright

Preconditions: doctor exits 0; language runtime present (Go by default).

- **Starter fails.** Run `node .agents/skills/verify-workbench/scripts/drive.mjs run-tests ride-dispatch go`. `console.txt` contains `--- FAIL: TestLevel1_ride_dispatch` and `FAIL`; `TestUser_Smoke` passes.
- **Solution + personal test + unlock + restore.** Run `npx playwright test tests/e2e/workspace.spec.ts`. It types a solution and a sandbox test, expects `PASS` and `MY_EDGE_CASE_OUTPUT` in `.raw-output`, expects `Level 2` enabled, reloads, and expects the draft in `.monaco-editor`.
- **Other languages.** Run `drive.mjs run-tests fifo-queue python` (or `typescript`); `console.txt` shows unittest / `node --test` output.

## Gotchas

- First Go run may take several seconds (module setup); allow 30s.
- Java reports unreachable when `/api/health` shows `java.runtime:false`.
- `drive.mjs` proves only the failing-starter path; use the spec for the pass path.
- Hidden test source must not appear in `.file-list`.
