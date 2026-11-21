# Files

Users create extra source and test files, which run with the suite, persist, and stay scoped to their language.

## Sub-features

- `files-create` `New file` dialog creates `helper.go` in the active workspace.
- `files-run` extra files compile with and run alongside supplied tests.
- `files-persist` files remain after reload.
- `files-scope` files do not appear after switching language.

## How to get to it (user POV)

- Practice page, Explorer `New file` button, dialog `Create file`, field `File path`.

## Driving it with Playwright

Preconditions: doctor exits 0.

- **Create, run, persist, scope.** Run `npx playwright test tests/e2e/files.spec.ts`. It creates `helper.go` and `helper_test.go`, runs tests expecting `ADDITIONAL_FILE_OUTPUT`, reloads and expects both in `.file-list`, then switches to Python.
- **Side effect check.** Before cleanup, `ls .practice/verify-run/workspaces/*/` shows the created files.

## Gotchas

- Replacing Monaco content requires click + select-all + insertText.
- Other specs (`language-switching`, `java`) cover related paths; Java needs a JDK.
