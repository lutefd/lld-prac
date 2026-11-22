# Run tests

A signed-in user edits code in Monaco and clicks **Run tests** to see runner output. **Submit** runs the same checks and records an attempt. A passing submission unlocks the next level. The server keeps the draft and submission history per user, exercise, and language.

## Sub-features

- `run-fail-starter` unmodified starter fails level 1 with real output.
- `run-personal-test` a user test in `sandbox_test.go` runs and its log output appears.
- `run-unlock` passing level 1 with **Run tests** leaves `Level 2` locked. Passing with **Submit** enables it.
- `run-draft-restore` edited code survives a reload (autosave after 300ms of no typing, flushed before runs, navigation, sign-out, and page close).
- `run-results` a passing Run on an unfinished level prompts you to submit. A passing Submit shows `Submission passed` and offers `Continue to level N` when there is a next level.
- `run-reset` Settings, `Reset this language's solution`, confirm `Reset solution`: restores starter files and relocks to level 1 (deletes the server draft and attempts for that language).

## How to get to it (user POV)

- Sign in, open `/practice/<slug>` (for example, `/practice/ride-dispatch`), and click **Run tests** or press `ControlOrMeta+Enter`. Click **Submit** to save the result as an attempt.
- Pick the language with the `Programming language` select.

## Driving it with Playwright

Preconditions: doctor exits 0; language runtime present (Go by default).

- **Starter fails.** Run `node .agents/skills/verify-workbench/scripts/drive.mjs run-tests ride-dispatch go`. `console.txt` contains `--- FAIL: TestLevel1_ride_dispatch` and `FAIL`; `TestUser_Smoke` passes.
- **Solution, personal test, unlock, and restore.** Run `npx playwright test tests/e2e/workspace.spec.ts`. It types a solution and a sandbox test, expects `PASS` and `MY_EDGE_CASE_OUTPUT` in `.raw-output`, submits to unlock level 2, then reloads and checks the restored draft in `.monaco-editor`.
- **Other languages.** Run `drive.mjs run-tests fifo-queue python` (or `typescript`); `console.txt` shows unittest / `node --test` output.

## Gotchas

- First Go run may take several seconds (module setup); allow 30s.
- Java reports unreachable when `/api/health` shows `java.runtime:false`.
- `drive.mjs` proves only the failing-starter path; use the spec for the pass path.
- Hidden test source must not appear in `.file-list`.
- While either action is queued or running, the editor and file controls lock, and the API answers 409 to saves.
