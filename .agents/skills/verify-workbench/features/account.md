# Account

Users sign in with email and password; attempts, unlocked levels, and code drafts live on the server per account, and API keys grant read-only access to `/api/v1/report`.

## Sub-features

- `account-auth` signed-out visitors see the sign-in screen and can create an account or sign in.
- `account-sync` unlocked levels and drafts persist across reloads and fresh browser contexts for the same user, while staying isolated from other users.
- `account-api-keys` users create and delete API keys on `/account`; the full key and curl snippet appear once on creation and authenticate `GET /api/v1/report`.
- `account-legacy-import` pre-existing `workbench.progress.*` and `workbench.draft.*` localStorage entries import once on first sign-in and are cleared from the browser.
- `account-signout` signing out from `/account` returns to the sign-in screen (and leaving a workspace via the Account link flushes pending edits first).
- `account-back-link` `/account` shows `Back to practice` when opened from an exercise, `Back to roadmap` on direct load or reload.
- `account-signup-rules` sign-up needs a name and an 8+ character password; with `PRACTICE_DISABLE_SIGNUP=true` it shows `New account registration is disabled on this server.`

## How to get to it (user POV)

- Any route while signed out opens the sign-in screen (`Create an account` toggles Name/Email/Password sign-up).
- Signed-in users click the `Account` link (`Conta` in Portuguese) in either the roadmap nav or the practice toolbar, or visit `/account` directly, to view Profile (`Sign out`), `API keys`, and the `Progress report API` reference. The `Settings` dialog only holds display and workspace preferences.

## Driving it with Playwright

Preconditions: doctor exits 0.

- **Full account suite.** Run `npx playwright test tests/e2e/account.spec.ts`. It exercises sign-up, level unlock + reload, cross-context sync, user isolation, sign-out, API key creation/report/revocation, `/account` deep link/reload, Settings isolation, autosave flush before navigation, and one-time localStorage legacy import.
- **Shared helper.** Other specs call `createAccount(page)` from `tests/e2e/auth.ts` before navigating.

## Gotchas

- `launch.sh` passes its environment through: `PRACTICE_DISABLE_SIGNUP=true .agents/skills/verify-workbench/scripts/launch.sh` drives the disabled sign-up path (no user can be created in that instance).
- `GET /api/v1/report` supports `since` for attempts strictly after an ISO 8601 timestamp with a timezone or a date at midnight UTC. It applies `limit` after filtering (default 100, clamped to 1–1000). The summary and per-exercise progress cover all saved history. API keys allow 120 requests a minute.
- `/api/import` writes nothing for an account that already has attempts or drafts; it still answers 200 `{ imported: false }`, and the browser clears its legacy keys either way.

- `launch.sh` isolates SQLite in `.practice/verify-run/workbench.db`; clean up between runs if testing from an empty database.
- API keys are shown only once on creation; deleting a key immediately returns `401` on `/api/v1/report`.
