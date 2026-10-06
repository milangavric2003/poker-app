import { setTimeout as delay } from 'node:timers/promises';
import { ProviderError } from '../backend/src/ai/types.js';

export const COACH_EVAL_MODEL = 'gemini-3.5-flash-lite';
export interface CoachGateState { requestCount: number; lastDispatchAt: number | null; blockedUntil: number | null }
export interface CoachGateOptions { state?: CoachGateState; limit?: number; now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; save?: (state: CoachGateState) => void }
export class CoachRequestGate {
  private readonly options: CoachGateOptions;
  private readonly current: CoachGateState;
  private readonly limit: number;
  private busy = false;
  constructor(options: CoachGateOptions = {}) {
    this.options = options; this.limit = options.limit ?? 50;
    this.current = { ...(options.state ?? { requestCount: 0, lastDispatchAt: null, blockedUntil: null }) };
    if (!Number.isSafeInteger(this.limit) || this.limit < 1 || this.limit > 50
      || !Number.isSafeInteger(this.current.requestCount) || this.current.requestCount < 0 || this.current.requestCount > this.limit
      || [this.current.lastDispatchAt, this.current.blockedUntil].some(value => value !== null && (!Number.isSafeInteger(value) || value < 0))) {
      throw new ProviderError('config_error');
    }
  }
  get state(): CoachGateState { return { ...this.current }; }
  async wait(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (this.current.requestCount >= this.limit) throw new ProviderError('config_error');
    const now = this.options.now ?? Date.now;
    const target = Math.max(this.current.blockedUntil ?? 0,
      this.current.lastDispatchAt === null ? 0 : this.current.lastDispatchAt + 6000);
    while (now() < target) {
      const sleep = this.options.sleep ?? ((ms, signal) => delay(ms, undefined, signal ? { signal } : {}));
      await sleep(Math.min(60000, target - now()), signal);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    }
  }
  async dispatch<T>(model: string, operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (model !== COACH_EVAL_MODEL || this.busy) throw new ProviderError('config_error');
    this.busy = true;
    try {
      await this.wait(signal);
      this.current.requestCount++; this.current.lastDispatchAt = (this.options.now ?? Date.now)();
      this.options.save?.(this.state); // Charge before dispatch; persistence failure cannot spend a call.
      try { return await operation(); }
      catch (error) {
        if (error instanceof ProviderError && error.kind === 'rate_limited') {
          this.current.blockedUntil = (this.options.now ?? Date.now)() + Math.max(60000, error.retryAfterMs ?? 0);
          this.options.save?.(this.state);
        }
        throw error;
      }
    } finally { this.busy = false; }
  }
}
