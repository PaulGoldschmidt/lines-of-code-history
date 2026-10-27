export class LimiterFullError extends Error {
  constructor(message = 'too many requests waiting') {
    super(message);
    this.name = 'LimiterFullError';
  }
}

/**
 * Bounds how many tasks run at once and how many may wait for a slot.
 * Protects the GitHub token from secondary rate limits and keeps a flood of
 * cold repositories from piling up unbounded work.
 */
export class Limiter {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    readonly maxConcurrent: number,
    readonly maxQueued: number = Infinity,
  ) {
    if (!(maxConcurrent >= 1)) throw new RangeError('maxConcurrent must be at least 1');
  }

  get active(): number {
    return this.running;
  }

  get waiting(): number {
    return this.queue.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueued) throw new LimiterFullError();
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
