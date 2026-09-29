import type { AiRuntimeConfig } from './types.js';

export const ALLOWED_GEMINI_MODELS = Object.freeze([
  'gemini-3.8-flash', 'gemini-3.5-flash-lite',
] as const);
function allowed(value: string): value is typeof ALLOWED_GEMINI_MODELS[number] {
  return (ALLOWED_GEMINI_MODELS as readonly string[]).includes(value);
}
function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
export function loadAiConfig(env: Readonly<Record<string, string | undefined>> = process.env): AiRuntimeConfig {
  const requestedPrimary = env.GEMINI_PRIMARY_MODEL?.trim() || 'gemini-3.8-flash';
  const requestedFallback = env.GEMINI_FALLBACK_MODEL === undefined
    ? 'gemini-3.5-flash-lite' : env.GEMINI_FALLBACK_MODEL.trim();
  const invalidModel = !allowed(requestedPrimary)
    || (requestedFallback !== '' && !allowed(requestedFallback));
  const primaryModel = allowed(requestedPrimary) ? requestedPrimary : 'gemini-3.8-flash';
  const fallbackModel = !invalidModel && requestedFallback !== '' && requestedFallback !== primaryModel
    ? requestedFallback as typeof ALLOWED_GEMINI_MODELS[number] : null;
  const configuredKey = env.GEMINI_API_KEY?.trim() || null;
  const explicitlyEnabled = env.GEMINI_ENABLED?.trim().toLowerCase() !== 'false';
  const enabled = explicitlyEnabled && configuredKey !== null && !invalidModel;
  const apiKey = enabled ? configuredKey : null;
  const maxAttempts = integer(env.GEMINI_MAX_ATTEMPTS, 2, 1, 2) as 1 | 2;
  const botTotalMs = integer(env.GEMINI_BOT_TOTAL_MS, 12000, 12000, 35000);
  const botAttemptMs = integer(env.GEMINI_BOT_TIMEOUT_MS, 5000, 250,
    Math.min(30000, botTotalMs - 1000));
  const analysisAttemptMs = integer(env.GEMINI_ANALYSIS_TIMEOUT_MS, 12000, 250, 29000);
  const backoffMinMs = integer(env.GEMINI_BACKOFF_MIN_MS, 250, 0, 2000);
  const backoffMaxMs = Math.max(backoffMinMs,
    integer(env.GEMINI_BACKOFF_MAX_MS, 750, backoffMinMs, 5000));
  const configError = invalidModel ? 'MODEL_NOT_ALLOWED' as const : null;
  const publicConfig = { enabled, primaryModel, fallbackModel, maxAttempts, botTotalMs, botAttemptMs,
    analysisAttemptMs, backoffMinMs, backoffMaxMs, configError };
  return { ...publicConfig, apiKey, analysisTotalMs: 30000,
    botReserveMs: 500, analysisReserveMs: 1000,
    public: Object.freeze({ ...publicConfig }) };
}

export function unavailableAiConfig(): AiRuntimeConfig {
  return loadAiConfig({ GEMINI_API_KEY: undefined });
}
