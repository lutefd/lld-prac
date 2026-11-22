# Workbench verification map

Maintained source for verifying user-facing behavior of Workbench. Read this index, then the matching feature file.

## Baseline preconditions

- Instance started by `scripts/launch.sh`; `scripts/doctor.sh` exits 0.
- Fresh browser context (empty localStorage) at the UI port `launch.sh` printed (`PRACTICE_WEB_PORT` in `.practice/verify-run/env`; it is not 5173).
- Every route is behind sign-in: sign up a fresh user first (`createAccount` in `tests/e2e/auth.ts`, or `drive.mjs`, which does it for you).
- Never drive an instance this run did not start.

## Driving conventions

- Prefer ARIA roles and labels over CSS classes; the few stable classes are listed in `SKILL.md`.
- Wait on UI state (`.raw-output` text, headings), never fixed sleeps. Test runs can take up to 30s.
- Monaco edits: click `.monaco-editor`, `ControlOrMeta+a`, `keyboard.insertText`.
- Existing specs in `tests/e2e/` cover each feature; run them for regression, use `drive.mjs` for proof artifacts.
- Every `npx playwright test ...` below assumes `. .practice/verify-run/env` was sourced first, so Playwright reuses the launched instance instead of starting its own on 5173.

## Proof and skip reporting

- UI proof: screenshot plus ARIA snapshot, with the exercise heading visible.
- Test-run proof: the runner output text from `.raw-output`.
- Record the feature ID with every artifact. Report an unreachable path (e.g. Java without a JDK) with the unmet precondition; never claim it verified through another path.

## Features

- [Account](./account.md): sign up, sign in, sign out, server-owned progress and drafts, legacy browser import, API keys and `/api/v1/report`.
- [Run tests and submit](./run-tests.md): check drafts, record attempts, unlock levels, and restore drafts.
- [Roadmap](./roadmap.md): ordered catalog, language-specific progress, continue-the-path.
- [Settings](./settings.md): theme, locale, persistence of preferences.
- [Panels](./panels.md): resize, keyboard resize, collapse and restore.
- [Files](./files.md): create extra files, language scoping, persistence.
