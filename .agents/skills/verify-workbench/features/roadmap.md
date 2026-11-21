# Roadmap

The home page lists all 44 exercises in recommended order with per-language progress and a "Continue the path" shortcut.

## Sub-features

- `roadmap-catalog` 44 items, first is `Bounded stack`.
- `roadmap-progress` progress counts follow the chosen `Roadmap language`.
- `roadmap-continue` `Continue the path` opens the next unfinished exercise in that language.
- `roadmap-mobile` no horizontal overflow at 375px.

## How to get to it (user POV)

- Open `/`, or click the `Practice roadmap` link from any exercise.

## Driving it with Playwright

Preconditions: doctor exits 0; empty localStorage.

- **Full flow.** Run `npx playwright test tests/e2e/roadmap.spec.ts`. It seeds `workbench.progress.bounded-stack.python=4`, selects Python, expects `1 of 44 exercises completed`, clicks `Continue the path`, expects `/practice/fifo-queue`. Screenshots land in `test-results/roadmap*.png`.

## Gotchas

- Progress lives in localStorage; a reused browser profile changes counts.
- Count is `.roadmap-exercises li`, not link count.
