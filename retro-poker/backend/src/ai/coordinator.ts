import { BotActionProposalSchema, ProviderMatchAnalysisSchema, analysisJsonSchema,
  botProposalJsonSchema, parseProviderCandidate } from './schemas.js';
import { validateBotProposal } from './semantic.js';
import { retryDecision } from './retry-policy.js';
import { ProviderError, type AIAttempt, type AiClock, type AiJitter, type AiProvider,
  type AiRuntimeConfig, type AttemptOutcome, type BotDecisionContext, type CoordinatorResult,
  type ProviderResult } from './types.js';
import type { PokerAction } from '../engine/types.js';
import type { MatchAnalysis } from '../../../shared/contracts.js';
import { processUsageStore } from './usage.js';

function finalOutcome(result: CoordinatorResult<unknown>): string {
  return result.ok ? 'model_success'
    : result.failure === 'cancelled' ? 'cancelled'
    : result.failure === 'stale' ? 'stale' : 'local_fallback';
}

export function recordUsageOnce(interactionId: string, purpose: 'bot' | 'analysis', initialModel: string,
  result: CoordinatorResult<unknown>, startedEpoch: number): void {
  processUsageStore.record({ purpose, initialModel, finalOutcome: purpose === 'analysis' && !result.ok ? 'failed' : finalOutcome(result),
    attempts: result.attempts }, interactionId, startedEpoch);
}

export const systemClock: AiClock = {
  now: () => performance.now(),
  sleep: (ms, signal) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  }),
};
export const zeroJitter: AiJitter = { next: () => 0 };
export type AttemptProgress = (status: 'retrying' | 'model_fallback', attemptCount: number,
  model: string) => void | Promise<void>;

function outcome(error: unknown): AttemptOutcome {
  if (error instanceof ProviderError) {
    if (error.kind === 'rate_limited') return 'rate_limited';
    if (error.kind === 'server_error') return 'server_error';
    if (error.kind === 'network_error') return 'network_error';
    if (error.kind === 'timeout') return 'timeout';
    if (error.kind === 'safety_refusal') return 'safety_refusal';
    if (error.kind === 'malformed') return 'malformed';
    return 'auth_config_error';
  }
  if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  if (error instanceof Error && error.message === 'ATTEMPT_TIMEOUT') return 'timeout';
  if (error instanceof Error && error.message === 'MALFORMED_JSON') return 'malformed';
  return 'network_error';
}

async function attemptWithTimeout(provider: AiProvider, request: Parameters<AiProvider['generate']>[0],
  parentSignal: AbortSignal, clock: AiClock, timeoutMs: number): Promise<ProviderResult> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal.addEventListener('abort', abort, { once: true });
  const timeout = clock.sleep(timeoutMs, controller.signal).then(() => {
    controller.abort(); throw new Error('ATTEMPT_TIMEOUT');
  });
  try { return await Promise.race([provider.generate(request, controller.signal), timeout]); }
  finally { parentSignal.removeEventListener('abort', abort); controller.abort(); }
}

export async function coordinateBot(provider: AiProvider, config: AiRuntimeConfig,
  context: BotDecisionContext, signal: AbortSignal, clock: AiClock = systemClock,
  jitter: AiJitter = zeroJitter, onProgress?: AttemptProgress): Promise<CoordinatorResult<PokerAction>> {
  const started = clock.now();
  let model = config.primaryModel;
  let relation: AIAttempt['relation'] = 'initial';
  const attempts: AIAttempt[] = [];
  for (let ordinal = 1 as 1 | 2; ordinal <= config.maxAttempts; ordinal = 2) {
    if (signal.aborted || clock.now() - started >= config.botTotalMs - config.botReserveMs) break;
    const attemptStarted = clock.now();
    let attemptOutcome: AttemptOutcome = 'success';
    let retryAfterMs: number | undefined;
    let result: ProviderResult | undefined;
    try {
      const remaining = config.botTotalMs - (clock.now() - started) - config.botReserveMs;
      result = await attemptWithTimeout(provider, { purpose: 'bot', model, context,
        responseSchema: botProposalJsonSchema, attemptOrdinal: ordinal,
        ...(ordinal === 2 ? { corrective: true } : {}) }, signal, clock,
      Math.min(config.botAttemptMs, Math.max(1, remaining)));
      let candidate: unknown;
      try { candidate = parseProviderCandidate(result.candidate); }
      catch { attemptOutcome = 'malformed'; }
      if (attemptOutcome === 'success') {
        const parsed = BotActionProposalSchema.safeParse(candidate);
        if (!parsed.success) attemptOutcome = 'schema_rejected';
        else {
          const action = validateBotProposal(parsed.data, context);
          if (!action) attemptOutcome = 'semantic_rejected';
          else {
            attempts.push({ ordinal, model: result.model ?? model, relation, outcome: 'success',
              durationMs: Math.max(0, clock.now() - attemptStarted), ...(result.usage ? { usage: result.usage } : {}) });
            return { ok: true, value: action, attempts, finalModel: result.model ?? model };
          }
        }
      }
    } catch (error) {
      attemptOutcome = outcome(error);
      if (error instanceof ProviderError) retryAfterMs = error.retryAfterMs;
    }
    attempts.push({ ordinal, model, relation, outcome: attemptOutcome,
      durationMs: Math.max(0, clock.now() - attemptStarted), ...(result?.usage ? { usage: result.usage } : {}) });
    if (ordinal === config.maxAttempts) break;
    const maxJitter = 100;
    const decision = retryDecision(attemptOutcome, 'bot', config, model, jitter.next(maxJitter), retryAfterMs);
    if (!decision.retry) break;
    await onProgress?.(decision.relation === 'model_fallback' ? 'model_fallback' : 'retrying',
      attempts.length, decision.model);
    if (decision.backoffMs > 0) {
      const remaining = config.botTotalMs - (clock.now() - started) - config.botReserveMs;
      if (decision.backoffMs >= remaining) break;
      try { await clock.sleep(decision.backoffMs, signal); } catch { break; }
    }
    model = decision.model; relation = decision.relation;
  }
  return { ok: false, attempts, finalModel: attempts.at(-1)?.model ?? null,
    failure: signal.aborted ? 'cancelled' : attempts.at(-1)?.outcome ?? 'timeout' };
}

export async function coordinateAnalysis(provider: AiProvider, config: AiRuntimeConfig,
  context: unknown, signal: AbortSignal, clock: AiClock = systemClock,
  jitter: AiJitter = zeroJitter, onProgress?: AttemptProgress): Promise<CoordinatorResult<MatchAnalysis>> {
  const started = clock.now();
  let model = config.primaryModel;
  let relation: AIAttempt['relation'] = 'initial';
  const attempts: AIAttempt[] = [];
  for (let ordinal = 1 as 1 | 2; ordinal <= config.maxAttempts; ordinal = 2) {
    const attemptStarted = clock.now();
    let attemptOutcome: AttemptOutcome = 'success';
    let retryAfterMs: number | undefined;
    let result: ProviderResult | undefined;
    try {
      const remaining = config.analysisTotalMs - (clock.now() - started) - config.analysisReserveMs;
      if (remaining <= 0) break;
      result = await attemptWithTimeout(provider, { purpose: 'analysis', model, context,
        responseSchema: analysisJsonSchema, attemptOrdinal: ordinal,
        ...(ordinal === 2 ? { corrective: true } : {}) }, signal, clock,
      Math.min(config.analysisAttemptMs, remaining));
      let candidate: unknown;
      try { candidate = parseProviderCandidate(result.candidate); } catch { attemptOutcome = 'malformed'; }
      if (attemptOutcome === 'success') {
        const parsed = ProviderMatchAnalysisSchema.safeParse(candidate);
        if (!parsed.success) attemptOutcome = 'schema_rejected';
        else {
          const refs = new Set((context as { decisions?: Array<{ decisionRef?: string }> }).decisions
            ?.map(d => d.decisionRef).filter((ref): ref is string => !!ref) ?? []);
          const items = [...parsed.data.goodDecisions, ...parsed.data.possibleMistakes];
          if (items.some(item => !refs.has(item.decisionRef))) attemptOutcome = 'semantic_rejected';
          else {
            attempts.push({ ordinal, model: result.model ?? model, relation, outcome: 'success', durationMs: Math.max(0, clock.now() - attemptStarted), ...(result.usage ? { usage: result.usage } : {}) });
            return { ok: true, value: { ...parsed.data,
              disclaimer: 'AI analiza je obrazovna pomoć, ne garantovano optimalna strategija.' },
              attempts, finalModel: result.model ?? model };
          }
        }
      }
    } catch (error) {
      attemptOutcome = outcome(error);
      if (error instanceof ProviderError) retryAfterMs = error.retryAfterMs;
    }
    attempts.push({ ordinal, model, relation, outcome: attemptOutcome,
      durationMs: Math.max(0, clock.now() - attemptStarted) });
    if (ordinal === config.maxAttempts) break;
    const decision = retryDecision(attemptOutcome, 'analysis', config, model, jitter.next(250), retryAfterMs);
    if (!decision.retry) break;
    await onProgress?.(decision.relation === 'model_fallback' ? 'model_fallback' : 'retrying',
      attempts.length, decision.model);
    if (decision.backoffMs > 0) {
      const remaining = config.analysisTotalMs - (clock.now() - started) - config.analysisReserveMs;
      if (decision.backoffMs >= remaining) break;
      try { await clock.sleep(decision.backoffMs, signal); } catch { break; }
    }
    model = decision.model; relation = decision.relation;
  }
  return { ok: false, attempts, finalModel: attempts.at(-1)?.model ?? null,
    failure: signal.aborted ? 'cancelled' : attempts.at(-1)?.outcome ?? 'timeout' };
}
