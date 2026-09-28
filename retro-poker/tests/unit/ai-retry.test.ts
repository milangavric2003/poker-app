import { describe, expect, it } from 'vitest';
import { coordinateAnalysis, coordinateBot } from '../../backend/src/ai/coordinator.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { retryDecision } from '../../backend/src/ai/retry-policy.js';
import { ProviderError, type AiClock, type AiProvider, type BotDecisionContext,
  type ProviderRequest, type ProviderResult } from '../../backend/src/ai/types.js';

const config = loadAiConfig({ GEMINI_API_KEY: 'offline-test-placeholder',
  GEMINI_PRIMARY_MODEL: 'gemini-3.8-flash', GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite' });
const noFallback = loadAiConfig({ GEMINI_API_KEY: 'offline-test-placeholder',
  GEMINI_PRIMARY_MODEL: 'gemini-3.8-flash', GEMINI_FALLBACK_MODEL: '' });

const context = Object.freeze({ gameId: '11111111-1111-4111-8111-111111111111',
  handId: '22222222-2222-4222-8222-222222222222', expectedVersion: 3,
  actorId: 'bot-1', decisionOrdinal: 1, phase: 'preflop' as const, board: [], pots: [],
  players: [], holeCards: ['Ac', 'Kd'], legalActions: [{ type: 'check' as const }], history: [] }) as unknown as BotDecisionContext;

class AdvancingClock implements AiClock {
  value = 0;
  readonly sleeps: number[] = [];
  constructor(private readonly autoAdvance: ReadonlySet<number> = new Set()) {}
  now(): number { return this.value; }
  async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    this.sleeps.push(ms);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (this.autoAdvance.has(ms)) { this.value += ms; return; }
    await new Promise<void>((_resolve, reject) => signal?.addEventListener('abort',
      () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  }
}

class ScriptedProvider implements AiProvider {
  readonly calls: ProviderRequest[] = [];
  constructor(private readonly steps: Array<ProviderResult | Error>) {}
  async generate(request: ProviderRequest): Promise<ProviderResult> {
    this.calls.push(structuredClone(request));
    const step = this.steps.shift()!;
    if (step instanceof Error) throw step;
    return step;
  }
}

describe('bounded retry policy (FR-009–FR-010, AIAC03–AIAC07)', () => {
  it.each([
    ['rate_limited', 'bot', 100, 350], ['timeout', 'bot', 0, 250],
    ['network_error', 'bot', 60, 310], ['rate_limited', 'analysis', 250, 750],
    ['timeout', 'analysis', 0, 500], ['network_error', 'analysis', 125, 625],
  ] as const)('retries %s for %s on the same model with bounded jitter', (outcome, purpose, jitter, backoffMs) => {
    expect(retryDecision(outcome, purpose, config, config.primaryModel, jitter)).toEqual({ retry: true,
      relation: 'same_model_retry', model: config.primaryModel, backoffMs });
  });

  it('uses a distinct fallback model for 5xx and the same model when no fallback exists', () => {
    expect(retryDecision('server_error', 'bot', config, config.primaryModel, 0)).toEqual({ retry: true,
      relation: 'model_fallback', model: config.fallbackModel, backoffMs: 250 });
    expect(retryDecision('server_error', 'analysis', noFallback, noFallback.primaryModel, 0)).toEqual({ retry: true,
      relation: 'same_model_retry', model: noFallback.primaryModel, backoffMs: 500 });
  });

  it.each(['malformed', 'schema_rejected', 'semantic_rejected'] as const)(
    'uses one same-model corrective retry without backoff for %s', outcome => {
      expect(retryDecision(outcome, 'bot', config, config.primaryModel, 100)).toEqual({ retry: true,
        relation: 'same_model_retry', model: config.primaryModel, backoffMs: 0 });
    });

  it.each(['auth_config_error', 'safety_refusal', 'cancelled', 'stale'] as const)(
    'does not retry terminal outcome %s', outcome => {
      expect(retryDecision(outcome, 'bot', config, config.primaryModel).retry).toBe(false);
    });

  it('caps the chain at two attempts and marks the second malformed attempt corrective', async () => {
    const provider = new ScriptedProvider([{ candidate: '{bad-json' }, { candidate: '{still-bad' }]);
    const result = await coordinateBot(provider, config, context, new AbortController().signal,
      new AdvancingClock(), { next: () => 0 });
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls.map(call => ({ ordinal: call.attemptOrdinal, model: call.model,
      corrective: call.corrective ?? false }))).toEqual([
      { ordinal: 1, model: config.primaryModel, corrective: false },
      { ordinal: 2, model: config.primaryModel, corrective: true },
    ]);
    expect(result.attempts.map(attempt => attempt.outcome)).toEqual(['malformed', 'malformed']);
  });

  it('honours provider Retry-After when it fits the bot budget', async () => {
    const provider = new ScriptedProvider([
      new ProviderError('rate_limited', 'redacted', 700), { candidate: {
        gameId: context.gameId, handId: context.handId, expectedVersion: context.expectedVersion,
        actorId: context.actorId, decisionOrdinal: context.decisionOrdinal, type: 'check' } },
    ]);
    const clock = new AdvancingClock(new Set([700]));
    const result = await coordinateBot(provider, config, context, new AbortController().signal,
      clock, { next: () => 0 });
    expect(result.ok).toBe(true);
    expect(clock.sleeps).toContain(700);
  });

  it('does not start attempt two when backoff would consume the 500 ms commit reserve', async () => {
    const tight = { ...config, botTotalMs: 12000 as const, botAttemptMs: 11000 };
    const clock = new AdvancingClock(new Set([800]));
    const calls: ProviderRequest[] = [];
    const provider: AiProvider = { generate: async request => {
      calls.push(request); clock.value += 10800;
      throw new ProviderError('rate_limited', 'redacted', 800);
    } };
    const result = await coordinateBot(provider, tight, context, new AbortController().signal,
      clock, { next: () => 0 });
    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(false);
  });

  it('keeps the 1000 ms analysis reserve at the 30 second total boundary', async () => {
    const clock = new AdvancingClock();
    const calls: ProviderRequest[] = [];
    const provider: AiProvider = { generate: async request => {
      calls.push(request); clock.value = config.analysisTotalMs - config.analysisReserveMs;
      throw new ProviderError('network_error');
    } };
    const result = await coordinateAnalysis(provider, config, { decisions: [] },
      new AbortController().signal, clock, { next: () => 0 });
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, failure: 'network_error' });
  });
});
