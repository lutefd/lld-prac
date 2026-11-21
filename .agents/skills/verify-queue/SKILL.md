---
name: verify-queue
description: Exhaustively checks the test-run queue (TestQueue in server/queue.ts) for slot leaks, over-concurrency, FIFO and timeout/close bugs. Use whenever server/queue.ts changes, or the queue's call sites in server/index.ts (run endpoint, shutdown) or PRACTICE_TEST_CONCURRENCY / _QUEUE_LIMIT / _QUEUE_TIMEOUT_MS handling change.
---

# Verify the test-run queue

**Property (plain words):** the queue never runs more tests than its concurrency, never loses a slot, never leaves a caller hanging, and serves waiting runs in order. **Harm if broken:** one stuck run permanently disables "Run tests" for everyone using the local server, or too many Go/Java processes start at once and runs time out.

## What is checked

`check.ts` runs the **real** `TestQueue` (not a model) through every ordering of these events, for `concurrency` 1-2 x `maxWaiting` 0-2, up to 5 tasks:

- `run()` called with a normal task, or a task that throws synchronously
- a running task resolves or rejects
- a waiting run's wait-timeout fires (fake timers replace `setTimeout`/`clearTimeout`)
- `close()`

After every event it asserts: running <= concurrency; waiting <= maxWaiting; tasks start in submission order; a free slot never coexists with a waiting task; exactly one pending timer per waiting task and none otherwise; submit outcome (start / wait / "queue is full" 503) matches the counts at that moment; timeout rejects with 504; `close()` rejects all waiters with 503 and nothing starts afterward; every started task's `run()` promise settles with the task's own outcome; a task is never both run and rejected.

**Not covered:** real time (timeout duration, actual delays); real task bodies (`runTests`, processes, workspace logic in `server/index.ts`); more than 5 tasks or concurrency > 2 (small-scope argument, not a proof); `/api/workspace/:id/run`'s own `session.running` guard. States are merged by a signature of per-task status + pending timers; use `--full` to disable merging (slower, 4 tasks ~65k states, under 1s).

## Tool choice

No verifier runs on this TypeScript, and the queue's logic is event ordering over promises. A TLA+ model would be a second description that could drift from the code, and needs TLC installed. Driving the actual class over all bounded orderings needs only Node 24 (already required) and checks the code itself.

## Run

```sh
node .agents/skills/verify-queue/check.ts          # one command, about 0.1s; exit 0 = PASS, 1 = violation
node .agents/skills/verify-queue/check.ts --full   # no state merging (tasks default 5 is slow; add --tasks 4)
node .agents/skills/verify-queue/mutants.ts        # proves the check can fail: every break must be "caught"
```

`FAIL` prints the violated property and a numbered event sequence (not necessarily the shortest). Read it as: tasks 0-4 are `run()` calls in order; "settles/resolves/rejects" is the task's own promise.

## Real bug or modeling error?

1. Replay the printed sequence by hand against `server/queue.ts`. If the code really does that, it is a **finding**: report the sequence in plain words and fix the code only if asked. Never loosen an invariant to make it pass.
2. If the sequence is impossible in production (e.g. the harness's fake timers behave unlike `setTimeout`), fix `check.ts` and say why in the commit.
3. If the change intentionally alters behavior (new status code, new rule), update the matching invariant in `check.ts` and the list above in the same change, then run `mutants.ts`; add a mutant for any new rule.

## Coverage record

| Covered code | What |
| --- | --- |
| `server/queue.ts` `TestQueue.run`, `drain`, `close`, constructor | everything above |
| `server/index.ts` `queue.run(...)` (run endpoint), `queue.close()` (shutdown) | callers only; their use of the queue is not modeled |

**Last confirmed in sync at commit `6c4923e`** (queue.ts last changed in `9106ede`). Check drift with `git diff 6c4923e -- server/queue.ts server/index.ts`. If `queue.ts` changed, rerun `check.ts` and `mutants.ts`. Move this commit forward only after you have confirmed the invariants and event list still describe the code at the new commit; update `mutants.ts` if a mutant's text went stale.

## Tool version

Node >= 24 (runs `.ts` directly). No other dependencies. Works the same from any agent: `node .agents/skills/verify-queue/check.ts`.
