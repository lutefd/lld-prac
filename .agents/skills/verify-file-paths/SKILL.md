---
name: verify-file-paths
description: Exhaustively checks validateNewFile in server/index.ts, which vets user-created file paths, for path traversal, hidden-test exposure, extension and case-collision bugs. Use whenever validateNewFile, restoreCreatedFiles, sanitizeDraftFiles, or the create-file / delete-file / import endpoints change, or the allowed file naming rules change.
---

# Verify user-created file paths

**Property (plain words):** any path `validateNewFile` accepts stays inside the exercise workspace, never touches hidden tests, has the right extension for the language, and never collides with an existing file (even ignoring case). **Harm if broken:** a crafted path could write outside the workspace (`../`, absolute, backslash), shadow or reveal hidden test files, or silently replace a supplied file on case-insensitive filesystems such as macOS.

## What is checked

`check.ts` calls the **real** `validateNewFile` on every path built from 1-3 segments of a hostile alphabet (`..`, `.`, empty, `hidden_x`/`HIDDEN_y`, casing variants of existing names like `Implementation`/`models`, spaces, non-ASCII, backslash segments) plus suffixes (`.go`, `.py`, `.ts`, `.java`, trailing `/`, `/..`, `/a.go`), plus non-string and oversized inputs, for all four languages against realistic existing-file sets. About 0.7M path/language pairs, around 1.5s. Every accepted path is judged by an independent oracle written from the property above (not copied from the code): resolves inside the workspace root, no empty/`.`/`..` segment, no `hidden_` segment, correct extension, allowed characters, length and depth limits, no case-insensitive equality with, nesting inside, or parent folder of an existing file, and consistent folder casing. It also requires a few ordinary paths (`helper.go`, `helpers/pricing.go`) to be accepted so "reject everything" cannot pass.

**Not covered:** more than 3 segments (the 12-segment limit is checked only with a 14-segment case); real filesystem behavior (symlinks, Windows reserved names, Unicode normalization on disk); what `create-file` does after validation (`mkdir`, `writeFile` with `wx`, the reserved-name race in `server/index.ts`); `validateFiles` for saved edits; Java-specific class-name rules.

## Tool choice

No verifier runs on this TypeScript, and this is a pure function over strings, so enumerating the real function over a bounded hostile input space finds the same bugs a model would without a second description that can drift. Needs only Node 24.

## Run

```sh
node .agents/skills/verify-file-paths/check.ts     # exit 0 = PASS, 1 = FAIL with the offending path and why
node .agents/skills/verify-file-paths/mutants.ts   # proves the check can fail: every break must be "caught"
```

## Real bug or modeling error?

1. A `FAIL` line names the path the code accepted and the rule it breaks. Call `validateNewFile` with that input and the same language. If it is accepted, it is a **finding**: report it in plain words, fix the code only if asked, never loosen the oracle.
2. If the oracle is wrong (e.g. the product intentionally allows something new), change the oracle in `check.ts` and the list above in the same change, then run `mutants.ts`; add a mutant for each new rule.
3. `mutants.ts` writes a temporary `server/.mutant-N.ts` and deletes it; if a run is killed, delete leftovers. A `STALE` line means the mutated source text moved: update that mutant's text to the equivalent line, keep the mutant.

Some rules are defended twice (e.g. backslash is rejected explicitly and by the segment character class), so those mutants loosen both.

## Coverage record

| Covered code | What |
| --- | --- |
| `server/index.ts` `validateNewFile` | everything above |
| `server/index.ts` `restoreCreatedFiles`, `create-file` endpoint | callers only; their use of the result is not modeled |
| `server/index.ts` `sanitizeDraftFiles` (workspace open from the stored SQLite draft, `POST /api/import` legacy drafts) | callers only, added in `8215bd0`: every user-created path from a stored draft or a browser import passes through `restoreCreatedFiles` → `validateNewFile`, and invalid entries are dropped, not fatal; the dropping is not modeled |

**Last confirmed in sync at commit `9347cc3`** (`validateNewFile` and `restoreCreatedFiles` unchanged since `9ed82e7`). Check drift with `git diff 9347cc3 -- server/index.ts`. If `validateNewFile` changed, rerun both commands. Move this commit forward only after confirming the oracle still describes the code at the new commit.

## Tool version

Node >= 24 (runs `.ts` directly). No other dependencies.
