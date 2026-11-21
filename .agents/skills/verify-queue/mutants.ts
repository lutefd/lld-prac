// Proves check.ts can fail: applies each known break to a COPY of server/queue.ts and requires check.ts to reject it.
// Usage: node .agents/skills/verify-queue/mutants.ts   (exit 0 only if every mutant is caught)
// If a mutant's `old` text no longer matches server/queue.ts, update it to the equivalent line; do not delete the mutant.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const here = import.meta.dirname;
const source = readFileSync(path.join(here, "../../../server/queue.ts"), "utf8");
const dir = mkdtempSync(path.join(tmpdir(), "queue-mutants-"));
const mutants: [string, string, string][] = [
  ["slot never released", "            this.active--;\n", ""],
  ["no drain after a task settles", "            this.drain();\n          }\n        })();", "          }\n        })();"],
  ["timer not cleared when a waiter starts", "      clearTimeout(entry.timer);\n      entry.start();", "      entry.start();"],
  ["concurrency off by one", "if (this.active < this.concurrency) {\n        start();", "if (this.active <= this.concurrency) {\n        start();"],
  ["LIFO instead of FIFO", "const entry = this.waiting.shift();", "const entry = this.waiting.pop();"],
  ["waiting cap off by one", "this.waiting.length >= this.maxWaiting", "this.waiting.length > this.maxWaiting"],
  ["close() leaves waiters hanging", '      entry.reject(new QueueError("Test queue is shutting down", 503));\n    }\n  }', "    }\n  }"],
];
let missed = 0;
for (const [name, old, replacement] of mutants) {
  if (source.split(old).length !== 2) { console.log(`STALE  ${name}: text not found exactly once`); missed++; continue; }
  const file = path.join(dir, `${missed}-${name.replace(/\W+/g, "-")}.ts`);
  writeFileSync(file, source.replace(old, replacement));
  const r = spawnSync(process.execPath, [path.join(here, "check.ts"), "--queue", file], { encoding: "utf8" });
  const caught = r.status === 1;
  console.log(`${caught ? "caught" : "MISSED"}  ${name}`);
  if (!caught) missed++;
}
process.exit(missed ? 1 : 0);
