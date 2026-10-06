import { describe, expect, it, vi } from 'vitest';
import { CoachRequestGate, COACH_EVAL_MODEL } from '../../scripts/coach-request-gate.js';
import { ProviderError } from '../../backend/src/ai/types.js';

function harness(limit = 50) {
  let time = 100000;
  const sleep = vi.fn(async (ms: number) => { time += ms; });
  const save = vi.fn();
  const gate = new CoachRequestGate({ limit, now: () => time, sleep, save });
  return { gate, sleep, save, now: () => time };
}
describe('T035 provider request gate', () => {
  it('enforces 6000ms between starts even after a failed request and persists each charge', async () => {
    const h = harness(); const starts: number[] = [];
    const call = async () => { starts.push(h.now()); return 'ok'; };
    expect(await h.gate.dispatch(COACH_EVAL_MODEL, call)).toBe('ok');
    await expect(h.gate.dispatch(COACH_EVAL_MODEL, async () => { starts.push(h.now()); throw new ProviderError('malformed'); }))
      .rejects.toMatchObject({ kind: 'malformed' });
    await h.gate.dispatch(COACH_EVAL_MODEL, call);
    expect(starts).toEqual([100000, 106000, 112000]);
    expect(h.gate.state.requestCount).toBe(3); expect(h.save).toHaveBeenCalledTimes(3);
  });
  it('never dispatches request51, including after reloading a persisted ledger', async () => {
    const operation = vi.fn(async () => 'ok');
    const gate = new CoachRequestGate({ state: { requestCount: 49, lastDispatchAt: 0, blockedUntil: null }, now: () => 100000 });
    await gate.dispatch(COACH_EVAL_MODEL, operation);
    const reloaded = new CoachRequestGate({ state: gate.state });
    await expect(reloaded.dispatch(COACH_EVAL_MODEL, operation)).rejects.toMatchObject({ kind: 'config_error' });
    expect(operation).toHaveBeenCalledTimes(1);
  });
  it('rejects another model and a pre-aborted call without spending a request', async () => {
    const h = harness(); const operation = vi.fn(async () => 'ok');
    await expect(h.gate.dispatch('gemini-3.8-flash', operation)).rejects.toMatchObject({ kind: 'config_error' });
    const controller = new AbortController(); controller.abort();
    await expect(h.gate.dispatch(COACH_EVAL_MODEL, operation, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.gate.state.requestCount).toBe(0); expect(operation).not.toHaveBeenCalled();
  });
  it('rejects corrupt ledgers or enlarged budgets', () => {
    for (const limit of [0, 51, 1.5]) expect(() => new CoachRequestGate({ limit })).toThrow();
    expect(() => new CoachRequestGate({ state: { requestCount: 51, lastDispatchAt: null, blockedUntil: null } })).toThrow();
  });
  it('does not dispatch when persistence fails', async () => {
    const operation = vi.fn(async () => 'ok');
    const gate = new CoachRequestGate({ save: () => { throw new Error('save failed'); } });
    await expect(gate.dispatch(COACH_EVAL_MODEL, operation)).rejects.toThrow();
    expect(operation).not.toHaveBeenCalled();
  });
  it('rejects concurrent dispatch and abort during the wait without spending another request', async () => {
    let resolveCall: () => void = () => {};
    const gate = new CoachRequestGate();
    const pending = gate.dispatch(COACH_EVAL_MODEL, () => new Promise<void>(resolve => { resolveCall = resolve; }));
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const another = vi.fn(async () => 'extra');
    await expect(gate.dispatch(COACH_EVAL_MODEL, another)).rejects.toMatchObject({ kind: 'config_error' });
    resolveCall(); await pending;
    expect(gate.state.requestCount).toBe(1); expect(another).not.toHaveBeenCalled();
    const controller = new AbortController();
    const abortGate = new CoachRequestGate({ state: { requestCount: 1, lastDispatchAt: 100000, blockedUntil: null },
      now: () => 100000, sleep: async () => { controller.abort(); } });
    await expect(abortGate.dispatch(COACH_EVAL_MODEL, another, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(abortGate.state.requestCount).toBe(1); expect(another).not.toHaveBeenCalled();
  });
  it('keeps a rate-limit cooldown across gate reloads', async () => {
    const h = harness();
    await expect(h.gate.dispatch(COACH_EVAL_MODEL, async () => { throw new ProviderError('rate_limited'); }))
      .rejects.toMatchObject({ kind: 'rate_limited' });
    expect(h.gate.state.blockedUntil).toBe(160000);
    await h.gate.wait(); expect(h.now()).toBe(160000);
  });
});
