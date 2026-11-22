# Roadmap

The home page lists all 44 exercises in recommended order with per-language progress and a "Continue the path" shortcut.

## Sub-features

- `roadmap-catalog` 44 items, first is `Bounded stack`.
- `roadmap-progress` progress counts follow the chosen `Roadmap language`.
- `roadmap-continue` `Continue the path` opens the next unfinished exercise in that language.
- `roadmap-mobile` no horizontal overflow at 375px.

## How to get to it (user POV)

- Sign in and open `/` (or `/roadmap`), or click `Practice roadmap` in the practice toolbar, its Settings `Workspace` section, or the `Exercise not found` page.
- The nav shows `Start practicing`, then `Resume practice` once an exercise was opened, plus `Account` and `Settings`.

## Driving it with Playwright

Preconditions: doctor exits 0; signed-in user.

- **Full flow.** Run `npx playwright test tests/e2e/roadmap.spec.ts`. It signs up a fresh user, imports `bounded-stack` Python level 4 progress via `/api/import`, selects Python, expects `1 of 44 exercises completed`, clicks `Continue the path`, expects `/practice/fifo-queue`. Screenshots land in `test-results/roadmap*.png`.

## Gotchas

- Progress comes from `GET /api/progress` for the signed-in user; each test signs up a fresh user.
- Count is `.roadmap-exercises li`, not link count.
- `Roadmap language` is stored in localStorage and becomes the practice page's `Programming language`.
- `/api/import` only writes for an account with no attempts and no drafts; otherwise it returns `{ imported: false }`. Seed progress on a fresh user.
