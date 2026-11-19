import { test } from "node:test";
import assert from "node:assert/strict";
import { QueueError, TestQueue } from "./queue.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("bounds execution, rejects excess waiting work, and starts in FIFO order", async () => {
  const queue = new TestQueue({ concurrency: 2, maxWaiting: 2 });
  const gate = deferred();
  const started: number[] = [];
  let active = 0;
  let peak = 0;
  const run = (id: number) =>
    queue.run(async () => {
      started.push(id);
      peak = Math.max(peak, ++active);
      await gate.promise;
      active--;
      return id;
    });
  const work = [run(1), run(2), run(3), run(4)];
  assert.deepEqual(started, [1, 2]);
  await assert.rejects(
    run(5),
    (error: unknown) => error instanceof QueueError && error.status === 503,
  );
  gate.resolve();
  assert.deepEqual(await Promise.all(work), [1, 2, 3, 4]);
  assert.deepEqual(started, [1, 2, 3, 4]);
  assert.equal(peak, 2);
  queue.close();
});

test("synchronous throws and asynchronous failures release slots", async () => {
  const queue = new TestQueue({ concurrency: 1 });
  const gate = deferred();
  const first = queue.run(() => gate.promise);
  const throwing = queue.run(() => {
    throw new Error("sync");
  });
  const rejected = queue.run(async () => {
    throw new Error("async");
  });
  const last = queue.run(() => 42);
  const syncCheck = assert.rejects(throwing, /sync/);
  const asyncCheck = assert.rejects(rejected, /async/);
  gate.resolve();
  await Promise.all([first, syncCheck, asyncCheck]);
  assert.equal(await last, 42);
  queue.close();
});

test("queue wait timeout removes work without invoking it or timing out running tasks", async () => {
  const queue = new TestQueue({
    concurrency: 1,
    maxWaiting: 1,
    waitTimeoutMs: 15,
  });
  const gate = deferred();
  const running = queue.run(() => gate.promise);
  let invoked = false;
  await assert.rejects(
    queue.run(() => {
      invoked = true;
    }),
    (error: unknown) => error instanceof QueueError && error.status === 504,
  );
  const replacement = queue.run(() => 7);
  gate.resolve();
  await running;
  assert.equal(await replacement, 7);
  assert.equal(invoked, false);
  queue.close();
});

test("closing rejects waiting and future work but lets running work settle", async () => {
  const queue = new TestQueue({ concurrency: 1 });
  const gate = deferred();
  const running = queue.run(() => gate.promise);
  const waiting = queue.run(() =>
    assert.fail("closed queue invoked waiting work"),
  );
  const check = assert.rejects(
    waiting,
    (error: unknown) => error instanceof QueueError && error.status === 503,
  );
  queue.close();
  queue.close();
  await check;
  await assert.rejects(
    queue.run(() => 1),
    /shutting down/,
  );
  gate.resolve();
  await running;
});
