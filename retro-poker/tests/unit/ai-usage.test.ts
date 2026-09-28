import { describe, expect, it } from 'vitest';
import { UsageStore } from '../../backend/src/ai/usage.js';

const unknownCost = (missingCount: number) => ({ knownCount: 0, missingCount, sum: null, currency: null });
const missingTokens = (missingCount: number) => ({ knownCount: 0, missingCount, sum: 0 });

describe('privacy safe AI usage aggregation', () => {
  it('groups every dimension and counts retry and fallback semantics exactly', () => {
    const store = new UsageStore();
    store.record({ purpose: 'bot', initialModel: 'model-a', finalOutcome: 'model_success', attempts: [
      { model: 'model-a', relation: 'initial', outcome: 'timeout', durationMs: 10,
        usage: { promptTokens: 0, totalTokens: null } },
      { model: 'model-b', relation: 'model_fallback', outcome: 'success', durationMs: 30,
        usage: { promptTokens: 4, candidateTokens: 2, totalTokens: 6 } },
    ] });
    store.record({ purpose: 'bot', initialModel: 'model-a', finalOutcome: 'local_fallback', attempts: [
      { model: 'model-a', relation: 'initial', outcome: 'network_error', durationMs: 7 },
      { model: 'model-a', relation: 'same_model_retry', outcome: 'network_error', durationMs: 9 },
    ] });
    store.record({ purpose: 'analysis', initialModel: 'model-a', finalOutcome: 'failed', attempts: [
      { model: 'model-a', relation: 'initial', outcome: 'server_error', durationMs: 125.7 },
    ] });

    const snapshot = store.snapshot();
    expect(snapshot.logical).toEqual([
      { purpose: 'analysis', initialModel: 'model-a', finalOutcome: 'failed', count: 1 },
      { purpose: 'bot', initialModel: 'model-a', finalOutcome: 'local_fallback', count: 1 },
      { purpose: 'bot', initialModel: 'model-a', finalOutcome: 'model_success', count: 1 },
    ]);
    expect(snapshot.attempts.map(({ purpose, model, relation, outcome, count }) =>
      ({ purpose, model, relation, outcome, count }))).toEqual([
      { purpose: 'analysis', model: 'model-a', relation: 'initial', outcome: 'server_error', count: 1 },
      { purpose: 'bot', model: 'model-a', relation: 'initial', outcome: 'network_error', count: 1 },
      { purpose: 'bot', model: 'model-a', relation: 'initial', outcome: 'timeout', count: 1 },
      { purpose: 'bot', model: 'model-a', relation: 'same_model_retry', outcome: 'network_error', count: 1 },
      { purpose: 'bot', model: 'model-b', relation: 'model_fallback', outcome: 'success', count: 1 },
    ]);
    expect(snapshot.attempts[0]!.latency).toEqual({ count: 1, sumMs: 126, maxMs: 126 });
    expect(snapshot.attempts[2]!.usage).toEqual({
      promptTokens: { knownCount: 1, missingCount: 0, sum: 0 },
      candidateTokens: missingTokens(1), thoughtTokens: missingTokens(1), cachedTokens: missingTokens(1),
      totalTokens: missingTokens(1), cost: unknownCost(1),
    });
    expect(snapshot.attempts[4]!.usage).toEqual({
      promptTokens: { knownCount: 1, missingCount: 0, sum: 4 },
      candidateTokens: { knownCount: 1, missingCount: 0, sum: 2 },
      thoughtTokens: missingTokens(1), cachedTokens: missingTokens(1),
      totalTokens: { knownCount: 1, missingCount: 0, sum: 6 }, cost: unknownCost(1),
    });
    expect({ retryCount: snapshot.retryCount, modelFallbackCount: snapshot.modelFallbackCount,
      localFallbackCount: snapshot.localFallbackCount }).toEqual({
      retryCount: 2, modelFallbackCount: 1, localFallbackCount: 1,
    });
  });

  it('combines latency and every usage field while preserving partial unknown metadata', () => {
    const store = new UsageStore();
    store.record({ purpose: 'analysis', initialModel: 'model-a', finalOutcome: 'model_success', attempts: [
      { model: 'model-a', relation: 'initial', outcome: 'success', durationMs: 10,
        usage: { promptTokens: 3, candidateTokens: 2, thoughtTokens: 1, cachedTokens: 4, totalTokens: 6 } },
    ] });
    store.record({ purpose: 'analysis', initialModel: 'model-a', finalOutcome: 'model_success', attempts: [
      { model: 'model-a', relation: 'initial', outcome: 'success', durationMs: 20,
        usage: { promptTokens: 5, candidateTokens: null, thoughtTokens: 0, totalTokens: 5 } },
    ] });

    const row = store.snapshot().attempts[0]!;
    expect(row.latency).toEqual({ count: 2, sumMs: 30, maxMs: 20 });
    expect(row.usage).toEqual({
      promptTokens: { knownCount: 2, missingCount: 0, sum: 8 },
      candidateTokens: { knownCount: 1, missingCount: 1, sum: 2 },
      thoughtTokens: { knownCount: 2, missingCount: 0, sum: 1 },
      cachedTokens: { knownCount: 1, missingCount: 1, sum: 4 },
      totalTokens: { knownCount: 2, missingCount: 0, sum: 11 },
      cost: unknownCost(2),
    });
    const serialized = JSON.stringify(store.snapshot());
    expect(serialized).not.toContain('tokens*price');
    expect(serialized).not.toMatch(/holeCards|apiKey|rawResponse|stackTrace/);
  });
});
