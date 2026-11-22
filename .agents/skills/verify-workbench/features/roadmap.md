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

Preconditions: doctor exits 0; signed-in user.

- **Full flow.** Run `npx playwright test tests/e2e/roadmap.spec.ts`. It signs up a fresh user, imports `bounded-stack` Python level 4 progress via `/api/import`, selects Python, expects `1 of 44 exercises completed`, clicks `Continue the path`, expects `/practice/fifo-queue`. Screenshots land in `test-results/roadmap*.png`.

## Gotchas

- Progress comes from `GET /api/progress` for the signed-in user; each test signs up a fresh user.
- Count is `.roadmap-exercises li`, not link count.
