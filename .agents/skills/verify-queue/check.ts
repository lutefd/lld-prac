// Bounded exhaustive check of server/queue.ts (TestQueue).
// Usage: node .agents/skills/verify-queue/check.ts [--queue <path-to-queue.ts>] [--tasks N] [--full]
// Explores every ordering of: submit (normal or synchronously-throwing task), task resolve/reject,
// wait-timeout firing, and close(), for several concurrency/maxWaiting settings, on the REAL class.
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const queuePath = path.resolve(
  opt("--queue", path.join(import.meta.dirname, "../../../server/queue.ts")),
);
const N = Number(opt("--tasks", "5"));
const full = args.includes("--full");
const { TestQueue, QueueError } = await import(pathToFileURL(queuePath).href);

type Mode = "async" | "throw";
type Action =
  | { k: "submit"; i: number; mode: Mode }
  | { k: "settle"; i: number; how: "resolve" | "reject" }
  | { k: "timeout"; i: number }
  | { k: "close" };

const label = (a: Action) =>
  a.k === "submit"
    ? `submit(task${a.i}${a.mode === "throw" ? ", throws synchronously" : ""})`
    : a.k === "settle"
      ? `task${a.i} ${a.how}s`
      : a.k === "timeout"
        ? `wait-timeout fires for task${a.i}`
        : "close()";

class Violation extends Error {}

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

class Run {
  q: any;
  conc: number;
  maxWaiting: number;
  timers = new Map<object, { fn: () => void; task: number }>();
  currentSubmit = -1;
  submitted = 0;
  started: number[] = [];
  deferred = new Map<number, { resolve: (v: number) => void; reject: (e: Error) => void }>();
  taskDone = new Map<number, "resolve" | "reject">();
  outcome = new Map<number, { ok: boolean; value: unknown }>();
  closed = false;
  startedAtClose = -1;

  constructor(conc: number, maxWaiting: number) {
    this.conc = conc;
    this.maxWaiting = maxWaiting;
    const self = this;
    (globalThis as any).setTimeout = (fn: () => void) => {
      const h = {};
      self.timers.set(h, { fn, task: self.currentSubmit });
      return h;
    };
    (globalThis as any).clearTimeout = (h: object) => void self.timers.delete(h);
    this.q = new TestQueue({ concurrency: conc, maxWaiting, waitTimeoutMs: 1000 });
  }
  dispose() {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
  }
  status(i: number): "new" | "waiting" | "running" | "finished" | "rejected" {
    if (i >= this.submitted) return "new";
    if (this.started.includes(i)) return this.taskDone.has(i) ? "finished" : "running";
    return this.outcome.has(i) ? "rejected" : "waiting";
  }
  ids(s: string) {
    const r: number[] = [];
    for (let i = 0; i < this.submitted; i++) if (this.status(i) === s) r.push(i);
    return r;
  }
  enabled(): Action[] {
    const out: Action[] = [];
    if (this.submitted < N) {
      out.push({ k: "submit", i: this.submitted, mode: "async" });
      out.push({ k: "submit", i: this.submitted, mode: "throw" });
    }
    for (const i of this.ids("running")) {
      out.push({ k: "settle", i, how: "resolve" });
      out.push({ k: "settle", i, how: "reject" });
    }
    for (const i of this.ids("waiting")) out.push({ k: "timeout", i });
    if (!this.closed) out.push({ k: "close" });
    return out;
  }
  async flush() {
    for (let n = 0; n < 12; n++) await Promise.resolve();
  }
  async apply(a: Action) {
    const preRunning = this.ids("running").length;
    const preWaiting = this.ids("waiting").length;
    const preStarted = this.started.length;
    if (a.k === "submit") {
      const i = a.i;
      this.submitted++;
      this.currentSubmit = i;
      const task = () => {
        this.started.push(i);
        if (a.mode === "throw") {
          this.taskDone.set(i, "reject");
          throw new Error(`sync-${i}`);
        }
        return new Promise<number>((resolve, reject) => this.deferred.set(i, { resolve, reject }));
      };
      this.q.run(task).then(
        (value: unknown) => this.outcome.set(i, { ok: true, value }),
        (value: unknown) => this.outcome.set(i, { ok: false, value }),
      );
      await this.flush();
      let expect: "start" | "wait" | "full" | "closed";
      if (this.closed) expect = "closed";
      else if (preRunning < this.conc) expect = "start";
      else if (preWaiting >= this.maxWaiting) expect = "full";
      else expect = "wait";
      const s = this.status(i);
      const o = this.outcome.get(i);
      const got =
        s === "waiting" ? "wait"
        : s === "rejected" ? (o && !o.ok && (o.value as any)?.status === 503 && /shutting/.test((o.value as any).message) ? "closed" : "full")
        : "start";
      if (got !== expect)
        throw new Violation(`submit(task${i}) with ${preRunning} running and ${preWaiting} waiting must ${expect}, but it did ${got}`);
      if (expect === "full") {
        const e = (o as any).value;
        if (!(e instanceof QueueError) || e.status !== 503 || !/full/.test(e.message))
          throw new Violation(`full-queue rejection for task${i} was not a 503 QueueError about a full queue`);
      }
    } else if (a.k === "settle") {
      const d = this.deferred.get(a.i)!;
      this.taskDone.set(a.i, a.how);
      if (a.how === "resolve") d.resolve(a.i);
      else d.reject(new Error(`task-${a.i}`));
      await this.flush();
      const o = this.outcome.get(a.i);
      if (!o) throw new Violation(`task${a.i} ${a.how}d but its run() promise never settled (slot or promise leaked)`);
      if (o.ok !== (a.how === "resolve")) throw new Violation(`task${a.i} outcome ${a.how} was reported to the caller as the opposite`);
    } else if (a.k === "timeout") {
      const handle = [...this.timers.entries()].find(([, t]) => t.task === a.i)?.[0];
      const entry = handle && this.timers.get(handle);
      if (handle) this.timers.delete(handle);
      if (!entry) throw new Violation(`waiting task${a.i} has no pending wait-timeout timer`);
      entry.fn();
      await this.flush();
      const o = this.outcome.get(a.i);
      const e = o && !o.ok ? (o.value as any) : null;
      if (!e || e.status !== 504) throw new Violation(`wait-timeout for task${a.i} did not reject it with a 504 QueueError`);
    } else {
      this.closed = true;
      this.startedAtClose = this.started.length;
      this.q.close();
      await this.flush();
      for (let i = 0; i < this.submitted; i++) {
        if (this.status(i) === "waiting") throw new Violation(`close() left task${i} waiting forever`);
      }
    }
    this.checkInvariants(preStarted);
  }
  checkInvariants(_preStarted: number) {
    const running = this.ids("running");
    const waiting = this.ids("waiting");
    if (running.length > this.conc)
      throw new Violation(`${running.length} tasks running with concurrency ${this.conc}`);
    if (waiting.length > this.maxWaiting)
      throw new Violation(`${waiting.length} tasks waiting with maxWaiting ${this.maxWaiting}`);
    for (let k = 1; k < this.started.length; k++)
      if (this.started[k] < this.started[k - 1]) throw new Violation(`task${this.started[k]} started before earlier-submitted task${this.started[k - 1]} (FIFO broken)`);
    if (!this.closed && running.length < this.conc && waiting.length > 0)
      throw new Violation(`slot free (${running.length}/${this.conc} running) while task${waiting[0]} still waits`);
    const timerTasks = [...this.timers.values()].map((t) => t.task).sort();
    if (JSON.stringify(timerTasks) !== JSON.stringify(waiting))
      throw new Violation(`pending wait-timeout timers for tasks [${timerTasks}] but waiting tasks are [${waiting}]`);
    if (this.closed && this.started.length > this.startedAtClose)
      throw new Violation(`a task started after close()`);
    for (let i = 0; i < this.submitted; i++) {
      if (this.status(i) === "rejected" && this.started.includes(i)) throw new Violation(`task${i} both ran and was rejected by the queue`);
      if (this.status(i) === "finished" && !this.outcome.has(i)) throw new Violation(`task${i} finished but its run() promise is unsettled`);
    }
  }
  signature() {
    const st = [];
    for (let i = 0; i < N; i++) st.push(this.status(i)[0] + (this.timers.size ? [...this.timers.values()].some((t) => t.task === i) : 0));
    return `${st.join("")}|${this.closed}|${this.started.length}`;
  }
}

const configs = [
  [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2],
];
let nodes = 0;
let failure: { config: number[]; trace: Action[]; message: string } | null = null;

async function replay(conc: number, mw: number, trace: Action[]) {
  const r = new Run(conc, mw);
  try {
    for (const a of trace) await r.apply(a);
  } finally {
    r.dispose();
  }
}

async function explore(conc: number, mw: number, trace: Action[], seen: Set<string>) {
  if (failure) return;
  nodes++;
  const r = new Run(conc, mw);
  let enabled: Action[] = [];
  try {
    for (const a of trace) await r.apply(a);
    enabled = r.enabled();
    const sig = r.signature();
    if (!full) {
      if (seen.has(sig)) return;
      seen.add(sig);
    }
  } catch (e) {
    if (e instanceof Violation) {
      failure = { config: [conc, mw], trace, message: e.message };
      return;
    }
    throw e;
  } finally {
    r.dispose();
  }
  for (const a of enabled) {
    await explore(conc, mw, [...trace, a], seen);
    if (failure) return;
  }
}

const start = Date.now();
for (const [conc, mw] of configs) await explore(conc, mw, [], new Set());
const secs = ((Date.now() - start) / 1000).toFixed(1);
if (failure) {
  const f = failure as { config: number[]; trace: Action[]; message: string };
  console.log(`FAIL  concurrency=${f.config[0]} maxWaiting=${f.config[1]}`);
  console.log(`Violation: ${f.message}`);
  console.log("A failing sequence (steps in order; not necessarily the shortest):");
  f.trace.forEach((a, n) => console.log(`  ${n + 1}. ${label(a)}`));
  process.exit(1);
}
console.log(`PASS  ${nodes} states explored in ${secs}s (tasks=${N}, concurrency 1-2, maxWaiting 0-2${full ? ", no state merging" : ""}) on ${path.relative(process.cwd(), queuePath)}`);
