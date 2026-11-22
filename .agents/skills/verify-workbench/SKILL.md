---
name: verify-workbench
description: Launch and drive the Workbench LLD practice app (React + Monaco UI on :5173, Express API on :3001) in headless Chromium to prove a change works in the real app. Use after changing UI, roadmap, settings, panels, file explorer, or test-running behavior.
---

# Verify Workbench

Workbench is a local web app: Vite UI (default `127.0.0.1:5173`) proxying `/api` to an Express server (default `127.0.0.1:3001`) that runs real Go/Python/TypeScript/Java tests natively. The repo's own Playwright specs in `tests/e2e/` are the primary harness; `scripts/drive.mjs` adds evidence-capturing drives.

Paths below are relative to the repo root. Read `features/README.md` first, then the feature file you are proving.

## Launch

```sh
.agents/skills/verify-workbench/scripts/launch.sh
```

Starts `node scripts/dev.ts` with `PRACTICE_WORKSPACE_ROOT=.practice/verify-run/workspaces`, `PRACTICE_DATABASE_PATH=.practice/verify-run/workbench.db`, and `PRACTICE_MAX_WORKSPACES=100`, records its pid in `.practice/verify-run/pid`, and returns `READY` only when `/api/health` and the UI both answer. Log: `.practice/verify-run/dev.log`. Both `.practice/` and `test-results/` are gitignored.

**Isolation:** `launch.sh` picks two free ports (`PRACTICE_WEB_PORT`, `PRACTICE_API_PORT`; the app also honors `PRACTICE_PREVIEW_PORT`) and an isolated SQLite database (`PRACTICE_DATABASE_PATH`), recording them in `.practice/verify-run/env`, so instances in different checkouts or worktrees run side by side. One instance per checkout: it refuses (exit 2) if this checkout's instance is still running. Never drive or kill an instance you did not start; ask the user instead. Practice state (accounts, attempts, progress, drafts) lives in SQLite per user; display preferences live in localStorage. Each drive signs up a fresh unique user in a fresh browser context.

Production-mode check (`npm run build && npm start`, port 4173) is separate; build it only when the change touches bundling.

## Doctor

```sh
.agents/skills/verify-workbench/scripts/doctor.sh
```

Read-only. Checks our pid is alive, `/api/health`, 44 exercises from `/api/problems`, the UI serves, and `go`/`python3`/`node` exist. Java is `runtime:false` unless a JDK 21+ is on `PATH` (on macOS Homebrew `openjdk@21` is keg-only: `export JAVA_HOME=$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home PATH="$JAVA_HOME/bin:$PATH"` before launching) and `jdtls` for editing; Java features then report as unreachable, not passed. Run doctor first whenever anything looks off.

## Drive

- Existing specs (preferred for regression): `npx playwright test tests/e2e/<file>.spec.ts`. Load the ports first: `. .practice/verify-run/env && npx playwright test ...`. Playwright then reuses the launched server (`reuseExistingServer` outside CI). Files: account, roadmap, preferences, panels, files, workspace, language-switching, java.
- Evidence drive: `node .agents/skills/verify-workbench/scripts/drive.mjs run-tests <exercise-slug> <go|python|typescript|java>` opens `/practice/<slug>`, signs up a fresh user via the UI, clicks **Run tests**, waits for runner output, and writes proof (below).
- Ad hoc: write a Playwright script that resolves `@playwright/test` from the repo root like `drive.mjs` does.

Stable handles: ARIA names `Run tests`, `Submit`, `Programming language` (label), `Roadmap language` (label), `Account` (link), `Settings`, `New file`, `Collapse/Show requirements|file explorer|console`, separators `Resize requirements|file explorer|console`; classes `.monaco-editor`, `.raw-output`, `.file-list`, `.roadmap-exercises li`. Typing into Monaco: click `.monaco-editor`, `ControlOrMeta+a`, `keyboard.insertText(...)`.

## Evidence

Proof goes to `test-results/verify/<action>-<exercise>-<language>/`: `1-before.png`, `2-after-run.png`, `console.txt` (actual runner output), `api-calls.txt` (the `/api` requests the UI made), `aria.txt`. Standards:

- Exercise the real user path through the UI; do not POST to `/api/workspace/*` to fake a result.
- Capture the action and the resulting state, not only the final screen.
- Verify side effects: runner output text, and files under `.practice/verify-run/workspaces/` for file-creating features (read them before cleanup).
- Starter code is expected to FAIL level 1. A drive that "passes" with unmodified starters is suspect.
- Native runner executes code with local permissions; there is no dry-run mode.

## Cleanup

```sh
.agents/skills/verify-workbench/scripts/cleanup.sh
```

SIGTERMs only the recorded pid (dev.ts stops its children), then deletes `.practice/verify-run/`. Evidence under `test-results/verify/` is kept. Run it after failed attempts too, and confirm with `lsof -nP -iTCP:$PRACTICE_WEB_PORT -iTCP:$PRACTICE_API_PORT -sTCP:LISTEN` (source the env file first) that nothing remains.
