import { describe, expect, it } from 'vitest';
import { UsageStore } from '../../backend/src/ai/usage.js';
import { BoundedAgentRun } from '../../backend/src/agent/orchestrator.js';
import { GameSession } from '../../backend/src/session.js';
import { FakeAiProvider, type FakeAiStep } from '../helpers/fake-ai-provider.js';
import { FakeClock } from '../helpers/fake-clock.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';
import { UsageResponseSchema } from '../../shared/contracts.js';

async function completed(steps: FakeAiStep[] = [{ kind: 'agent_tool' }, { kind: 'agent_final' }]) {
  const session = new GameSession({ deck: ['As', 'Kc', 'Ah', 'Kd', ...ac23Deck.slice(4)],
    deckRandom: sequenceRandom([]), botRandom: sequenceRandom(Array<number>(100).fill(0.9)) });
  let game = session.create(1); game = session.action({ gameId: game.gameId, handId: game.hand.handId,
    expectedVersion: game.version, type: 'all_in' }); const before = JSON.stringify(game);
  const clock = new FakeClock(); const provider = new FakeAiProvider(steps);
  const run = new BoundedAgentRun({ runId: '00000000-0000-4000-8000-000000000001', goal: { focus: 'street' },
    snapshot: { gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version,
      factsRevision: game.facts.revision, facts: game.facts, status: 'lost' }, provider, clock, model: 'primary', fallbackModel: 'fallback' });
  const work = run.execute();
  for (let n = 0; n < 10; n++) { for (let i = 0; i < 80; i++) await Promise.resolve(); clock.advance(1000); }
  const state = await work; expect(JSON.stringify(game)).toBe(before); return state;
}
describe('T020 coach usage independent from Week04', () => {
  it('counts one run, two steps, two attempts, one tool and separate validation; no retry', async () => {
    const store = new UsageStore(); const state = await completed(); store.recordCoach(state);
    expect(store.snapshot().coach).toMatchObject({ runCount: 1, stepCount: 2, providerAttemptCount: 2,
      toolAttemptCount: 1, toolExecutionCount: 1, toolRejectionCount: 0, retryCount: 0,
      validationCount: 5, validationRejectedCount: 0, stopReasons: [{ reason: 'completed', count: 1 }] });
    expect(store.snapshot().retryCount).toBe(0); expect(store.snapshot().logical).toEqual([]);
    UsageResponseSchema.parse({ usage: store.snapshot() });
    const before = store.snapshot(); store.recordCoach(state); expect(store.snapshot()).toEqual(before);
    expect(store.snapshot().coach.attempts.map(row => row.stepOrdinal)).toEqual([1, 2]);
    expect(store.snapshot().coach.attempts[0]!.usage.totalTokens).toEqual({ knownCount: 0, missingCount: 1, sum: 0 });
    expect(store.snapshot().coach.attempts[0]!.usage.cost).toEqual({ knownCount: 0, missingCount: 1, sum: null, currency: null });
  });
  it.each(['429', '5xx'] as const)('records %s recovery within a step, fallback separately', async kind => {
    const state = await completed([{ kind }, { kind: 'agent_tool' }, { kind: 'agent_final' }]);
    const store = new UsageStore(); store.recordCoach(state);
    expect(store.snapshot().coach).toMatchObject({ runCount: 1, stepCount: 2, providerAttemptCount: 3,
      retryCount: kind === '429' ? 1 : 0, modelFallbackCount: kind === '5xx' ? 1 : 0, toolExecutionCount: 1 });
    expect(store.snapshot().retryCount).toBe(0);
  });
  it.each(['unknown_tool', 'invalid_arguments'] as const)('records rejected %s but zero executions', async kind => {
    const store = new UsageStore(); store.recordCoach(await completed([{ kind }]));
    expect(store.snapshot().coach).toMatchObject({ toolAttemptCount: 1, toolExecutionCount: 0, toolRejectionCount: 1 });
  });
  it('rejects late epoch and invalidated run records without affecting Week04', async () => {
    const store = new UsageStore(); const state = await completed(); const epoch = store.currentEpoch();
    store.reset(0); store.recordCoach(state, epoch); expect(store.snapshot().coach.runCount).toBe(0);
    store.recordCoach({ ...state, status: 'stopped', stopReason: 'stale_state', result: null });
    store.recordCoach({ ...state, status: 'stopped', stopReason: 'cancelled', result: null });
    expect(store.snapshot().coach.runCount).toBe(0);
    store.record({ purpose: 'analysis', initialModel: 'primary', finalOutcome: 'failed', attempts: [
      { model: 'primary', relation: 'initial', outcome: 'timeout', durationMs: 1 },
      { model: 'primary', relation: 'same_model_retry', outcome: 'timeout', durationMs: 1 }] });
    expect(store.snapshot().retryCount).toBe(1); expect(store.snapshot().coach.runCount).toBe(0);
  });
  it('bounds unsafe latency and stores only projected counters and metadata', async () => {
    const store = new UsageStore(); const state = await completed();
    const poisoned = { ...state, finishedAt: Infinity, prompt: 'private-secret', rawResponse: 'raw-body',
      privateCards: ['As'], chainOfThought: 'hidden', attempts: state.attempts.map(a => ({ ...a, durationMs: -100, secret: 'api-key' })) };
    store.recordCoach(poisoned); const snapshot = store.snapshot();
    UsageResponseSchema.parse({ usage: snapshot });
    expect(snapshot.coach.latency.sumMs).toBeGreaterThanOrEqual(0); expect(snapshot.coach.latency.maxMs).toBeLessThanOrEqual(45000);
    expect(snapshot.coach.attempts[0]!.latency.maxMs).toBe(0);
    for (const secret of ['private-secret', 'raw-body', 'As', 'hidden', 'api-key', 'validatedToolResult', 'recentActionKeys']) expect(JSON.stringify(snapshot)).not.toContain(secret);
  });
  it('rejects unknown aggregate fields and invalid counts while preserving old DTOs', async () => {
    const store = new UsageStore(); store.recordCoach(await completed()); const usage = store.snapshot();
    expect(UsageResponseSchema.safeParse({ usage: { ...usage, coach: { ...usage.coach, extra: 'secret' } } }).success).toBe(false);
    expect(UsageResponseSchema.safeParse({ usage: { ...usage, coach: { ...usage.coach, stepCount: -1 } } }).success).toBe(false);
    const legacy = { ...usage, coach: undefined }; expect(UsageResponseSchema.safeParse({ usage: legacy }).success).toBe(true);
    const copy = store.snapshot(); copy.coach.stopReasons[0]!.count = 100;
    expect(store.snapshot().coach.stopReasons[0]!.count).toBe(1);
  });
  it('records malformed candidate and final evidence rejection as validation failures', async () => {
    for (const steps of [[{ kind: 'malformed' }], [{ kind: 'agent_tool' }, { kind: 'invalid_final' }]] satisfies FakeAiStep[][]) {
      const store = new UsageStore(); store.recordCoach(await completed(steps));
      expect(store.snapshot().coach.validationRejectedCount).toBe(1);
      expect(store.snapshot().coach.stopReasons).toEqual([{ reason: 'malformed_output', count: 1 }]);
    }
  });
});
