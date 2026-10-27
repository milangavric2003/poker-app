import type { ProviderCapacity, ProviderLease } from './capacity.js';

export type AdmissionResult = { lease: ProviderLease }
  | { code: 'AI_RATE_LIMITED'; retryAfterSeconds: number }
  | { code: 'AI_CAPACITY_EXCEEDED' };
export class AdmissionWindow {
  private accepted: number[] = [];
  /** Synchronous decision + reservation + token commit: no check/await/act race. */
  accept(now: number, capacity: ProviderCapacity): AdmissionResult {
    this.accepted = this.accepted.filter(at => at > now - 60000);
    if (this.accepted.length >= 5) return { code: 'AI_RATE_LIMITED',
      retryAfterSeconds: Math.max(1, Math.ceil((this.accepted[0]! + 60000 - now) / 1000)) };
    const lease = capacity.reserve();
    if (!lease) return { code: 'AI_CAPACITY_EXCEEDED' };
    this.accepted.push(now);
    return { lease };
  }
}
export const processAdmission = { current: new AdmissionWindow() };
