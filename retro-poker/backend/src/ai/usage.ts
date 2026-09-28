import type { AiPurpose, AttemptOutcome, AttemptRelation, ProviderUsage } from './types.js';

export interface UsageAttemptInput {
  model: string; relation: AttemptRelation; outcome: AttemptOutcome; durationMs: number;
  usage?: Partial<ProviderUsage>;
}
export interface UsageInteractionInput {
  purpose: AiPurpose; initialModel: string; finalOutcome: string; attempts: UsageAttemptInput[];
}
type Metric = { knownCount: number; missingCount: number; sum: number };
type CostMetric = { knownCount: number; missingCount: number; sum: number | null; currency: string | null };
const tokenFields = ['promptTokens', 'candidateTokens', 'thoughtTokens', 'cachedTokens', 'totalTokens'] as const;
type TokenField = typeof tokenFields[number];
type UsageView = Record<TokenField, Metric> & { cost: CostMetric };
type LogicalRow = { purpose: AiPurpose; initialModel: string; finalOutcome: string; count: number };
type AttemptRow = { purpose: AiPurpose; model: string; relation: AttemptRelation; outcome: AttemptOutcome;
  count: number; latency: { count: number; sumMs: number; maxMs: number }; usage: UsageView };

function emptyUsage(): UsageView {
  return { promptTokens: emptyMetric(), candidateTokens: emptyMetric(), thoughtTokens: emptyMetric(),
    cachedTokens: emptyMetric(), totalTokens: emptyMetric(),
    cost: { knownCount: 0, missingCount: 0, sum: null, currency: null } };
}
function emptyMetric(): Metric { return { knownCount: 0, missingCount: 0, sum: 0 }; }
function key(parts: readonly (string | number)[]) { return JSON.stringify(parts); }
function safeAdd(left: number, right: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, left + right);
}

export class UsageStore {
  private revision = 0;
  private logical = new Map<string, LogicalRow>();
  private attempts = new Map<string, AttemptRow>();
  private retryCount = 0;
  private modelFallbackCount = 0;
  private localFallbackCount = 0;
  private recordedInteractions = new Set<string>();
  private epoch = 0;

  currentEpoch(): number { return this.epoch; }

  record(interaction: UsageInteractionInput, interactionId?: string, startedEpoch = this.epoch): void {
    if (startedEpoch !== this.epoch) return;
    if (interactionId && this.recordedInteractions.has(interactionId)) return;
    if (interactionId) this.recordedInteractions.add(interactionId);
    const logicalKey = key([interaction.purpose, interaction.initialModel, interaction.finalOutcome]);
    const logical = this.logical.get(logicalKey) ?? { purpose: interaction.purpose,
      initialModel: interaction.initialModel, finalOutcome: interaction.finalOutcome, count: 0 };
    logical.count = safeAdd(logical.count, 1);
    this.logical.set(logicalKey, logical);
    if (interaction.attempts.length > 1) this.retryCount = safeAdd(this.retryCount, 1);
    if (interaction.attempts.some(attempt => attempt.relation === 'model_fallback')) {
      this.modelFallbackCount = safeAdd(this.modelFallbackCount, 1);
    }
    if (interaction.finalOutcome === 'local_fallback') this.localFallbackCount = safeAdd(this.localFallbackCount, 1);
    for (const attempt of interaction.attempts) this.recordAttempt(interaction.purpose, attempt);
  }

  private recordAttempt(purpose: AiPurpose, attempt: UsageAttemptInput): void {
    const attemptKey = key([purpose, attempt.model, attempt.relation, attempt.outcome]);
    const row = this.attempts.get(attemptKey) ?? { purpose, model: attempt.model,
      relation: attempt.relation, outcome: attempt.outcome, count: 0,
      latency: { count: 0, sumMs: 0, maxMs: 0 }, usage: emptyUsage() };
    row.count = safeAdd(row.count, 1);
    const durationMs = Number.isFinite(attempt.durationMs)
      ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(attempt.durationMs))) : 0;
    row.latency.count = safeAdd(row.latency.count, 1);
    row.latency.sumMs = safeAdd(row.latency.sumMs, durationMs);
    row.latency.maxMs = Math.max(row.latency.maxMs, durationMs);
    for (const field of tokenFields) {
      const value = attempt.usage?.[field];
      const metric = row.usage[field];
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
        metric.knownCount = safeAdd(metric.knownCount, 1);
        metric.sum = safeAdd(metric.sum, value);
      } else metric.missingCount = safeAdd(metric.missingCount, 1);
    }
    row.usage.cost.missingCount = safeAdd(row.usage.cost.missingCount, 1);
    this.attempts.set(attemptKey, row);
  }

  snapshot() {
    return { revision: this.revision,
      logical: [...this.logical.values()].map(row => ({ ...row })).sort((a, b) => key([a.purpose, a.initialModel, a.finalOutcome]).localeCompare(key([b.purpose, b.initialModel, b.finalOutcome]))),
      attempts: [...this.attempts.values()].map(row => structuredClone(row)).sort((a, b) => key([a.purpose, a.model, a.relation, a.outcome]).localeCompare(key([b.purpose, b.model, b.relation, b.outcome]))),
      retryCount: this.retryCount, modelFallbackCount: this.modelFallbackCount, localFallbackCount: this.localFallbackCount };
  }

  reset(expectedRevision: number): boolean {
    if (expectedRevision !== this.revision) return false;
    if (this.revision === Number.MAX_SAFE_INTEGER) return false;
    this.revision++;
    this.epoch++;
    this.logical.clear(); this.attempts.clear();
    this.retryCount = 0; this.modelFallbackCount = 0; this.localFallbackCount = 0;
    return true;
  }
}

export const processUsageStore = new UsageStore();
