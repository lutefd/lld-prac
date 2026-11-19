export class QueueError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "QueueError";
    this.status = status;
  }
}

type Waiting = {
  start: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** A process-local FIFO queue. Running work owns a slot until it settles. */
export class TestQueue {
  private active = 0;
  private waiting: Waiting[] = [];
  private closed = false;
  private concurrency: number;
  private maxWaiting: number;
  private waitTimeoutMs: number;

  constructor({
    concurrency = 2,
    maxWaiting = 10,
    waitTimeoutMs = 60000,
  }: {
    concurrency?: number;
    maxWaiting?: number;
    waitTimeoutMs?: number;
  } = {}) {
    if (!Number.isInteger(concurrency) || concurrency < 1)
      throw new Error("Queue concurrency must be a positive integer");
    if (!Number.isInteger(maxWaiting) || maxWaiting < 0)
      throw new Error("Queue capacity must be a nonnegative integer");
    if (!Number.isFinite(waitTimeoutMs) || waitTimeoutMs <= 0)
      throw new Error("Queue wait timeout must be positive");
    this.concurrency = concurrency;
    this.maxWaiting = maxWaiting;
    this.waitTimeoutMs = waitTimeoutMs;
  }

  run<T>(task: () => Promise<T> | T): Promise<T> {
    if (this.closed)
      return Promise.reject(new QueueError("Test queue is shutting down", 503));
    if (
      this.active >= this.concurrency &&
      this.waiting.length >= this.maxWaiting
    )
      return Promise.reject(
        new QueueError("Test queue is full; try again shortly", 503),
      );
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active++;
        // Wrap invocation so synchronous task errors release the slot as well.
        void (async () => {
          try {
            resolve(await task());
          } catch (error) {
            reject(error);
          } finally {
            this.active--;
            this.drain();
          }
        })();
      };
      if (this.active < this.concurrency) {
        start();
        return;
      }
      const entry: Waiting = {
        start,
        reject,
        timer: setTimeout(() => {
          const index = this.waiting.indexOf(entry);
          if (index === -1) return;
          this.waiting.splice(index, 1);
          reject(
            new QueueError("Timed out waiting for a test slot; try again", 504),
          );
        }, this.waitTimeoutMs),
      };
      this.waiting.push(entry);
    });
  }

  private drain() {
    while (
      !this.closed &&
      this.active < this.concurrency &&
      this.waiting.length
    ) {
      const entry = this.waiting.shift()!;
      clearTimeout(entry.timer);
      entry.start();
    }
  }

  close() {
    this.closed = true;
    for (const entry of this.waiting.splice(0)) {
      clearTimeout(entry.timer);
      entry.reject(new QueueError("Test queue is shutting down", 503));
    }
  }
}
