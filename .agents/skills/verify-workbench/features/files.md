# Files

Users create and delete extra source and test files, which run with the suite, persist in their server-side draft, and stay scoped to their language.

## Sub-features

- `files-create` `New file` dialog creates `helper.go` in the active workspace.
- `files-run` extra files compile with and run alongside supplied tests.
- `files-persist` files remain after reload.
- `files-scope` files do not appear after switching language, and return when switching back.
- `files-validate` an unsafe path such as `../escape.go` shows an alert in `Create file` and creates nothing.
- `files-delete` `Delete <path>` exists only for user-created files; confirming `Remove file` removes it, also after reload.

## How to get to it (user POV)

- Practice page, Explorer `New file` button, dialog `Create file`, field `File path`.

## Driving it with Playwright

Preconditions: doctor exits 0.

- **Create, run, persist, scope, validate, delete.** Run `npx playwright test tests/e2e/files.spec.ts`. It creates `helper.go` and `helper_test.go`, runs tests expecting `ADDITIONAL_FILE_OUTPUT`, reloads and expects both in `.file-list`, switches to Python and back, rejects `../escape.go`, and deletes `temp_helper.go`.
- **Side effect check.** While the workspace page is open, `ls .practice/verify-run/workspaces/*/` shows the created files. The server removes the workspace directory on close or idle expiry. The draft in `.practice/verify-run/workbench.db` restores the files after reload.

## Gotchas

- Replacing Monaco content requires click + select-all + insertText.
- Other specs (`language-switching`, `java`) cover related paths; Java needs a JDK.
