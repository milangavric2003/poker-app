import { describe, expect, it } from 'vitest';
import { ALLOWED_GEMINI_MODELS, loadAiConfig } from '../../backend/src/ai/config.js';

describe('AI runtime config', () => {
  it('is unavailable without a key and keeps fixed budgets', () => {
    expect(loadAiConfig({})).toMatchObject({ apiKey: null, maxAttempts: 2,
      botTotalMs: 12000, analysisTotalMs: 30000, botAttemptMs: 5000, analysisAttemptMs: 12000 });
  });
  it('normalizes duplicate fallback model to null', () => {
    expect(loadAiConfig({ GEMINI_API_KEY: ' test ', GEMINI_PRIMARY_MODEL: 'gemini-3.8-flash',
      GEMINI_FALLBACK_MODEL: 'gemini-3.8-flash' })).toMatchObject({ apiKey: 'test',
      primaryModel: 'gemini-3.8-flash', fallbackModel: null });
  });
  it('allows only documented stable models and supports either through configuration', () => {
    expect(ALLOWED_GEMINI_MODELS).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
    expect(loadAiConfig({ GEMINI_API_KEY: 'test', GEMINI_PRIMARY_MODEL: 'gemini-3.5-flash-lite',
      GEMINI_FALLBACK_MODEL: 'gemini-3.8-flash' })).toMatchObject({ enabled: true,
      primaryModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemini-3.8-flash', configError: null });
  });
  it.each(['unknown-model', 'gemini-3.8-flash-preview'])('rejects disallowed model %s without requiring a key or crashing', name => {
    expect(loadAiConfig({ GEMINI_API_KEY: 'do-not-log', GEMINI_PRIMARY_MODEL: name })).toMatchObject({
      enabled: false, apiKey: null, configError: 'MODEL_NOT_ALLOWED' });
  });
  it('supports bounded operational settings and explicit disable', () => {
    expect(loadAiConfig({ GEMINI_API_KEY: 'test', GEMINI_ENABLED: 'false', GEMINI_MAX_ATTEMPTS: '9',
      GEMINI_BOT_TIMEOUT_MS: '6500', GEMINI_ANALYSIS_TIMEOUT_MS: '14000',
      GEMINI_BACKOFF_MIN_MS: '300', GEMINI_BACKOFF_MAX_MS: '900' })).toMatchObject({
      enabled: false, maxAttempts: 2, botAttemptMs: 6500, analysisAttemptMs: 14000,
      backoffMinMs: 300, backoffMaxMs: 900 });
  });
  it('does not expose the key when serialized for public diagnostics', () => {
    const config = loadAiConfig({ GEMINI_API_KEY: 'super-secret' });
    expect(JSON.stringify(config.public)).not.toContain('super-secret');
  });
});
