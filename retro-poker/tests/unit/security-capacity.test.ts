import { expect, it } from 'vitest';
import { ProviderCapacity } from '../../backend/src/security/capacity.js';
import { AdmissionWindow } from '../../backend/src/security/admission.js';

it('T13 reserves synchronously, has no queue, and releases each lease exactly once', async () => {
  const capacity = new ProviderCapacity();
  const a = capacity.reserve()!; const b = capacity.reserve()!;
  expect(capacity.reserve()).toBeNull(); expect(capacity.active).toBe(2);
  a.releaseUnused(); a.releaseUnused(); expect(capacity.active).toBe(1);
  let resolve!: (value: number) => void;
  const work = b.run(() => new Promise<number>(r => { resolve = r; }));
  b.releaseUnused(); expect(capacity.active).toBe(1);
  const c = capacity.reserve()!; expect(capacity.reserve()).toBeNull();
  resolve(42); expect(await work).toBe(42); expect(capacity.active).toBe(1);
  b.releaseUnused(); expect(capacity.active).toBe(1); c.releaseUnused(); expect(capacity.active).toBe(0);
});
it('T13 sync throw and rejection release actual work; started lease cannot be reused', async () => {
  const capacity = new ProviderCapacity(); const lease = capacity.reserve()!;
  await expect(lease.run(() => { throw new Error('sync'); })).rejects.toThrow('sync');
  expect(capacity.active).toBe(0);
  await expect(lease.run(async () => 1)).rejects.toThrow(); expect(capacity.active).toBe(0);
  await expect(capacity.reserve()!.run(() => Promise.reject(new Error('late')))).rejects.toThrow('late');
  expect(capacity.active).toBe(0);
});
it('T13 window is sliding, capacity rejection consumes no accepted token', () => {
  const gate = new AdmissionWindow(); const capacity = new ProviderCapacity();
  const a = capacity.reserve()!; const b = capacity.reserve()!;
  expect(gate.accept(0, capacity)).toMatchObject({ code: 'AI_CAPACITY_EXCEEDED' });
  a.releaseUnused(); b.releaseUnused();
  for (const at of [0, 1000, 2000, 3000, 4000]) {
    const result = gate.accept(at, capacity); expect(result).toHaveProperty('lease');
    if ('lease' in result) result.lease.releaseUnused();
  }
  expect(gate.accept(59999, capacity)).toEqual({ code: 'AI_RATE_LIMITED', retryAfterSeconds: 1 });
  const result = gate.accept(60000, capacity); expect(result).toHaveProperty('lease');
  if ('lease' in result) result.lease.releaseUnused();
  expect(gate.accept(60000, capacity)).toEqual({ code: 'AI_RATE_LIMITED', retryAfterSeconds: 1 });
});
