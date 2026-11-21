# Panels

Requirements, file explorer, and console panes resize by drag or keyboard, collapse, and remember their state across reload.

## Sub-features

- `panels-drag` dragging dividers changes sizes and persists.
- `panels-keyboard` arrow keys resize a focused divider.
- `panels-collapse` each pane collapses, stays collapsed after reload, and restores.

## How to get to it (user POV)

- Practice page `/practice/ride-dispatch`: separators `Resize requirements`, `Resize file explorer`, `Resize console`; buttons `Collapse <pane>` / `Show <pane>`.

## Driving it with Playwright

Preconditions: doctor exits 0.

- **All panel behavior.** Run `npx playwright test tests/e2e/panels.spec.ts`. It drags, uses arrow keys, collapses all three panes, reloads, and restores via `Show requirements|file explorer|console`.

## Gotchas

- Sizes are saved in localStorage; use a fresh context.
- `.editor-status` must stay in the viewport after resizing.
