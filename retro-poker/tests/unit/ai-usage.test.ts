import { describe, expect, it } from 'vitest';
import { UsageStore } from '../../backend/src/ai/usage.js';

describe('privacy safe AI usage aggregation', () => {
  it('aggregates logical outcomes, attempts, retries, latency and partial usage', () => {
    const store = new UsageStore();
    store.record({ purpose: 'bot', initialModel: 'model-a', finalOutcome: 'model_success', attempts: [
      { model: 'model-a', relation: 'initial', outcome: 'timeout', durationMs: 10,
        usage: { promptTokens: 0, totalTokens: null } },
      { model: 'model-b', relation: 'model_fallback', outcome: 'success', durationMs: 30,
        usage: { promptTokens: 4, candidateTokens: 2, totalTokens: 6 } },
    ] });
    store.record({ purpose: 'analysis', initialModel: 'model-a', finalOutcome: 'local_fallback', attempts: [
      { model: 'model-a', relation: 'initial', outcome: 'cancelled', durationMs: 8 },
    ] });
    expect(store.snapshot()).toEqual({ revision: 0,
      logical: [
        { purpose: 'analysis', initialModel: 'model-a', finalOutcome: 'local_fallback', count: 1 },
        { purpose: 'bot', initialModel: 'model-a', finalOutcome: 'model_success', count: 1 },
      ],
      attempts: expect.arrayContaining([
        expect.objectContaining({ purpose: 'bot', model: 'model-a', relation: 'initial', outcome: 'timeout', count: 1,
          latency: { count: 1, sumMs: 10, maxMs: 10 }, usage: expect.objectContaining({
            promptTokens: { knownCount: 1, missingCount: 0, sum: 0 }, totalTokens: { knownCount: 0, missingCount: 1, sum: 0 },
            cost: { knownCount: 0, missingCount: 1, sum: null, currency: null } }) }),
        expect.objectContaining({ purpose: 'bot', model: 'model-b', relation: 'model_fallback', outcome: 'success', count: 1 }),
      ]), retryCount: 1, modelFallbackCount: 1, localFallbackCount: 1 });
  });
});
