# Panels

Requirements, file explorer, and console panes resize by drag or keyboard, collapse, and remember their state across reload.

## Sub-features

- `panels-drag` dragging dividers changes sizes and persists.
- `panels-keyboard` arrow keys resize a focused divider by 10px, `Shift+Arrow` by 40px, `Home`/`End` jump to min/max; double-click resets (requirements 355, explorer 195, console 235).
- `panels-toolbar` the compact practice toolbar holds the library, roadmap, timer, language, `Account`, `Settings`, `Run tests`, and `Submit` controls. The `Practice timer` setting hides the timer and persists.
- `panels-collapse` each pane collapses, stays collapsed after reload, and restores.

## How to get to it (user POV)

- Sign in, then practice page `/practice/ride-dispatch`: separators `Resize requirements`, `Resize file explorer`, `Resize console`; buttons `Collapse <pane>` / `Show <pane>`.

## Driving it with Playwright

Preconditions: doctor exits 0.

- **All panel behavior.** Run `npx playwright test tests/e2e/panels.spec.ts`. It drags, uses arrow keys, collapses all three panes, reloads, and restores via `Show requirements|file explorer|console`; a fourth test covers the compact toolbar and timer.

## Gotchas

- Sizes, collapsed state, and timer visibility are saved in localStorage (not per account); use a fresh context.
- **Run tests** and **Submit** reopen a collapsed console.
- `.editor-status` must stay in the viewport after resizing.
