import type { AiPurpose, AttemptOutcome, AttemptRelation, ProviderUsage } from './types.js';
import { AiDiagnosticSchema, type AiDiagnostic } from '../../../shared/ai-diagnostic.js';
import { CoachStopReasonSchema, type CoachUsageSchema } from '../../../shared/contracts.js';
import type { z } from 'zod';
import type { AgentRunState } from '../agent/types.js';

export interface UsageAttemptInput {
  diagnostic?: AiDiagnostic;
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
  diagnostic?: AiDiagnostic;
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
function emptyCoach(): z.infer<typeof CoachUsageSchema> {
  return { runCount: 0, stepCount: 0, providerAttemptCount: 0, toolAttemptCount: 0,
    toolExecutionCount: 0, toolRejectionCount: 0, validationCount: 0, validationRejectedCount: 0,
    retryCount: 0, modelFallbackCount: 0, stopReasons: [], latency: { count: 0, sumMs: 0, maxMs: 0 }, attempts: [] };
}
function boundedDuration(value: number, cap: number): number {
  return Number.isFinite(value) ? Math.min(cap, Math.max(0, Math.round(value))) : 0;
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
  private coach = emptyCoach();
  private coachAttempts = [new Map<string, AttemptRow>(), new Map<string, AttemptRow>()];
  private recordedCoachRuns = new Set<string>();

  currentEpoch(): number { return this.epoch; }

  recordCoach(state: AgentRunState, startedEpoch = this.epoch): void {
    if (startedEpoch !== this.epoch || this.recordedCoachRuns.has(state.runId)
      || !['completed', 'stopped', 'failed'].includes(state.status)
      || !CoachStopReasonSchema.safeParse(state.stopReason).success
      || state.stopReason === 'stale_state' || state.stopReason === 'cancelled') return;
    this.recordedCoachRuns.add(state.runId);
    const row = this.coach;
    row.runCount = safeAdd(row.runCount, 1);
    for (const [field, value, cap] of [
      ['stepCount', state.stepCount, 2], ['providerAttemptCount', state.providerAttemptCount, 4],
      ['toolAttemptCount', state.toolAttemptCount, 2], ['toolExecutionCount', state.toolCallCount, 1],
      ['toolRejectionCount', state.toolRejectionCount, 2], ['validationCount', state.validationCount, 8],
      ['validationRejectedCount', state.validationRejectedCount, 8],
    ] as const) row[field] = safeAdd(row[field], Number.isSafeInteger(value) ? Math.min(cap, Math.max(0, value)) : 0);
    const stop = row.stopReasons.find(item => item.reason === state.stopReason);
    if (stop) stop.count = safeAdd(stop.count, 1);
    else row.stopReasons.push({ reason: state.stopReason!, count: 1 });
    row.stopReasons.sort((a, b) => a.reason.localeCompare(b.reason));
    const duration = boundedDuration((state.finishedAt ?? state.startedAt) - state.startedAt, 45000);
    row.latency.count = safeAdd(row.latency.count, 1);
    row.latency.sumMs = safeAdd(row.latency.sumMs, duration); row.latency.maxMs = Math.max(row.latency.maxMs, duration);
    for (const attempt of state.attempts.slice(0, 4)) {
      if (![1, 2].includes(attempt.stepOrdinal)) continue;
      if (attempt.relation === 'same_model_retry') row.retryCount = safeAdd(row.retryCount, 1);
      if (attempt.relation === 'model_fallback') row.modelFallbackCount = safeAdd(row.modelFallbackCount, 1);
      // Whitelist projection: never retain state, context, tool output or proposal.
      this.recordAttempt('analysis', { model: attempt.model.slice(0, 128), relation: attempt.relation,
        outcome: attempt.outcome, durationMs: attempt.durationMs,
        ...(attempt.usage ? { usage: attempt.usage } : {}) }, this.coachAttempts[attempt.stepOrdinal - 1]!, 15000);
    }
  }

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

  private recordAttempt(purpose: AiPurpose, attempt: UsageAttemptInput,
    target = this.attempts, latencyCap = Number.MAX_SAFE_INTEGER): void {
    const parsed = AiDiagnosticSchema.safeParse(attempt.diagnostic);
    const diagnostic = parsed.success ? parsed.data : undefined;
    const attemptKey = key([purpose, attempt.model, attempt.relation, attempt.outcome,
      diagnostic?.httpStatus ?? '', diagnostic?.providerCode ?? '', diagnostic?.reason ?? '']);
    const row = target.get(attemptKey) ?? { purpose, model: attempt.model,
      relation: attempt.relation, outcome: attempt.outcome, count: 0,
      ...(diagnostic ? { diagnostic } : {}),
      latency: { count: 0, sumMs: 0, maxMs: 0 }, usage: emptyUsage() };
    row.count = safeAdd(row.count, 1);
    const durationMs = Number.isFinite(attempt.durationMs)
      ? Math.min(latencyCap, Math.max(0, Math.round(attempt.durationMs))) : 0;
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
    target.set(attemptKey, row);
  }

  snapshot() {
    return { revision: this.revision,
      logical: [...this.logical.values()].map(row => ({ ...row })).sort((a, b) => key([a.purpose, a.initialModel, a.finalOutcome]).localeCompare(key([b.purpose, b.initialModel, b.finalOutcome]))),
      attempts: [...this.attempts.values()].map(row => structuredClone(row)).sort((a, b) => key([a.purpose, a.model, a.relation, a.outcome]).localeCompare(key([b.purpose, b.model, b.relation, b.outcome]))),
      retryCount: this.retryCount, modelFallbackCount: this.modelFallbackCount, localFallbackCount: this.localFallbackCount,
      coach: { ...structuredClone(this.coach), attempts: this.coachAttempts.flatMap((map, index) =>
        [...map.values()].map(({ model, relation, outcome, count, latency, usage }) => ({ stepOrdinal: index + 1,
          model, relation, outcome, count, latency: structuredClone(latency), usage: structuredClone(usage) })))
        .sort((a, b) => key([a.stepOrdinal, a.model, a.relation, a.outcome]).localeCompare(key([b.stepOrdinal, b.model, b.relation, b.outcome]))) } };
  }

  reset(expectedRevision: number): boolean {
    if (expectedRevision !== this.revision) return false;
    if (this.revision === Number.MAX_SAFE_INTEGER) return false;
    this.revision++;
    this.epoch++;
    this.logical.clear(); this.attempts.clear();
    this.retryCount = 0; this.modelFallbackCount = 0; this.localFallbackCount = 0;
    this.coach = emptyCoach(); this.coachAttempts.forEach(map => map.clear()); this.recordedCoachRuns.clear();
    return true;
  }
}

export const processUsageStore = new UsageStore();
