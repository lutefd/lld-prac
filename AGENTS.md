# Agent instructions

Works with any coding agent (Claude Code, Codex, Cursor, Antigravity, others).

## Skills

Project skills live in `.agents/skills/<name>/SKILL.md` (the canonical copy). `.claude/skills`, `.cursor/skills`, and `.agent/skills` are symlinks to it, so every agent finds the same files. If your agent does not discover skills on its own, read the `SKILL.md` directly and follow it. Every command in a skill runs from the repo root with `bash` and `node` 24, so no agent-specific tooling is needed.

- `verify-workbench`: launch and drive the real app (headless Chromium) to prove a UI or test-run change works.
- `verify-queue`: exhaustively check `server/queue.ts` (`TestQueue`) for slot leaks, ordering, timeout and close bugs; run when the queue or its call sites change.

- `verify-file-paths`: exhaustively check `validateNewFile` (user-created file paths) for traversal, hidden-test, extension and case-collision bugs; run when it or the create-file endpoints change.

## Checks

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.
