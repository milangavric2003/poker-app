import { describe, expect, it } from 'vitest';
import { loadAiConfig } from '../../backend/src/ai/config.js';

describe('AI runtime config', () => {
  it('is unavailable without a key and keeps fixed budgets', () => {
    expect(loadAiConfig({})).toMatchObject({ apiKey: null, maxAttempts: 2,
      botTotalMs: 12000, analysisTotalMs: 30000, botAttemptMs: 5000, analysisAttemptMs: 12000 });
  });
  it('normalizes duplicate fallback model to null', () => {
    expect(loadAiConfig({ GEMINI_API_KEY: ' test ', GEMINI_PRIMARY_MODEL: 'model-a',
      GEMINI_FALLBACK_MODEL: 'model-a' })).toMatchObject({ apiKey: 'test', primaryModel: 'model-a', fallbackModel: null });
  });
});
