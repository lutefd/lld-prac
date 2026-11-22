# Account

Users sign in with email and password; attempts, unlocked levels, and code drafts live on the server per account, and API keys grant read-only access to `/api/v1/report`.

## Sub-features

- `account-auth` signed-out visitors see the sign-in screen and can create an account or sign in.
- `account-sync` unlocked levels and drafts persist across reloads and fresh browser contexts for the same user, while staying isolated from other users.
- `account-api-keys` users create and delete API keys in Settings; the full key and curl snippet appear once on creation and authenticate `GET /api/v1/report`.
- `account-legacy-import` pre-existing `workbench.progress.*` and `workbench.draft.*` localStorage entries import once on first sign-in and are cleared from the browser.
- `account-signout` signing out from Settings flushes pending edits and returns to the sign-in screen.

## How to get to it (user POV)

- Any route while signed out opens the sign-in screen (`Create an account` toggles Name/Email/Password sign-up).
- Signed-in users open `Settings` from either the roadmap or practice toolbar to view the `Account` section (identity, `Sign out`, and `API keys`).

## Driving it with Playwright

Preconditions: doctor exits 0.

- **Full account suite.** Run `npx playwright test tests/e2e/account.spec.ts`. It exercises sign-up, level unlock + reload, cross-context sync, user isolation, sign-out, API key creation/report/revocation, and one-time localStorage legacy import.
- **Shared helper.** Other specs call `createAccount(page)` from `tests/e2e/auth.ts` before navigating.

## Gotchas

- `launch.sh` isolates SQLite in `.practice/verify-run/workbench.db`; clean up between runs if testing from an empty database.
- API keys are shown only once on creation; deleting a key immediately returns `401` on `/api/v1/report`.
