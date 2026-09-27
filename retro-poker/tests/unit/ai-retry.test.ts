import { describe, expect, it } from 'vitest';
import { retryDecision } from '../../backend/src/ai/retry-policy.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';

const config = loadAiConfig({ GEMINI_API_KEY: 'test', GEMINI_PRIMARY_MODEL: 'primary', GEMINI_FALLBACK_MODEL: 'secondary' });
describe('bounded retry policy', () => {
  it('retries transient same-model and uses second model for 5xx', () => {
    expect(retryDecision('rate_limited', 'bot', config, 'primary', 10)).toEqual({ retry: true,
      relation: 'same_model_retry', model: 'primary', backoffMs: 260 });
    expect(retryDecision('server_error', 'bot', config, 'primary', 0)).toMatchObject({ retry: true,
      relation: 'model_fallback', model: 'secondary' });
  });
  it.each(['auth_config_error', 'safety_refusal'] as const)('does not retry %s', outcome => {
    expect(retryDecision(outcome, 'bot', config, 'primary').retry).toBe(false);
  });
});
