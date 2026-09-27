import type { AiPurpose, AiRuntimeConfig, AttemptOutcome, AttemptRelation } from './types.js';

export interface RetryDecision { retry: boolean; relation: AttemptRelation; model: string; backoffMs: number; }
export function retryDecision(outcome: AttemptOutcome, purpose: AiPurpose, config: AiRuntimeConfig,
  currentModel: string, jitter = 0): RetryDecision {
  if (['safety_refusal', 'auth_config_error', 'cancelled', 'stale'].includes(outcome)) {
    return { retry: false, relation: 'same_model_retry', model: currentModel, backoffMs: 0 };
  }
  if (outcome === 'server_error' && config.fallbackModel) return { retry: true,
    relation: 'model_fallback', model: config.fallbackModel, backoffMs: (purpose === 'bot' ? 250 : 500) + jitter };
  if (['timeout', 'rate_limited', 'network_error', 'server_error'].includes(outcome)) return { retry: true,
    relation: 'same_model_retry', model: currentModel, backoffMs: (purpose === 'bot' ? 250 : 500) + jitter };
  if (['malformed', 'schema_rejected', 'semantic_rejected'].includes(outcome)) return { retry: true,
    relation: 'same_model_retry', model: currentModel, backoffMs: 0 };
  return { retry: false, relation: 'same_model_retry', model: currentModel, backoffMs: 0 };
}
