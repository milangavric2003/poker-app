import type { AiClock, AiJitter } from '../../backend/src/ai/types.js';

export class FakeClock implements AiClock {
  private value: number;
  readonly sleeps: number[] = [];
  constructor(start = 0) { this.value = start; }
  now(): number { return this.value; }
  private waiters: Array<{ at: number; resolve: () => void; reject: (error: unknown) => void;
    signal?: AbortSignal }> = [];
  advance(ms: number): void {
    this.value += ms;
    const ready = this.waiters.filter(waiter => waiter.at <= this.value);
    this.waiters = this.waiters.filter(waiter => waiter.at > this.value);
    for (const waiter of ready) waiter.resolve();
  }
  async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    this.sleeps.push(ms);
    await new Promise<void>((resolve, reject) => {
      const waiter = { at: this.value + ms, resolve, reject, ...(signal ? { signal } : {}) };
      this.waiters.push(waiter);
      signal?.addEventListener('abort', () => {
        this.waiters = this.waiters.filter(item => item !== waiter);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }
  runAll(): void {
    while (this.waiters.length) this.advance(Math.max(...this.waiters.map(w => w.at)) - this.value);
  }
}
export class FakeJitter implements AiJitter {
  constructor(private readonly values: number[] = [0]) {}
  next(maxInclusive: number): number {
    const value = this.values.shift() ?? 0;
    return Math.max(0, Math.min(maxInclusive, value));
  }
}
