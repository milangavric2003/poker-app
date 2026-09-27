import type { AiRuntimeConfig } from './types.js';

const MODEL = /^[a-z0-9][a-z0-9._-]{1,79}$/;
function model(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;
  return MODEL.test(candidate) ? candidate : fallback;
}
export function loadAiConfig(env: Readonly<Record<string, string | undefined>> = process.env): AiRuntimeConfig {
  const apiKey = env.GEMINI_API_KEY?.trim() || null;
  const primaryModel = model(env.GEMINI_PRIMARY_MODEL, 'gemini-3.8-flash');
  const candidate = model(env.GEMINI_FALLBACK_MODEL, 'gemini-3.5-flash-lite');
  return { apiKey, primaryModel, fallbackModel: candidate === primaryModel ? null : candidate,
    maxAttempts: 2, botTotalMs: 12000, analysisTotalMs: 30000,
    botAttemptMs: 5000, analysisAttemptMs: 12000 };
}

export function unavailableAiConfig(): AiRuntimeConfig {
  return loadAiConfig({ GEMINI_API_KEY: undefined });
}
