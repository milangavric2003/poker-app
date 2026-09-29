import { describe, expect, it } from 'vitest';
import * as contracts from '../../shared/contracts.js';
import { publicView } from '../helpers/public-fixtures.js';

const { GameConfigSchema, GameErrorSchema, GameViewSchema, MatchAnalysisSchema } = contracts;
type RuntimeSchema = { safeParse(value: unknown): { success: boolean }; parse(value: unknown): unknown };

function schema(name: string): RuntimeSchema {
  const candidate = (contracts as Record<string, unknown>)[name];
  expect(candidate, `${name} mora biti deljeni runtime ugovor`).toBeDefined();
  return candidate as RuntimeSchema;
}

const idleAi = {
  mode: 'off', availability: 'unavailable', active: null, lastBotOutcome: null,
  analysis: { status: 'idle', interactionId: null, result: null },
};

describe('Week04 provider-neutral public contracts (FR-001, FR-015–FR-023)', () => {
  it('defaults omitted aiMode to false while preserving the Week03 request', () => {
    expect(GameConfigSchema.parse({ botCount: 3 })).toEqual({ botCount: 3, aiMode: false });
  });

  it.each([true, false])('accepts boolean aiMode=%s without coercion', aiMode => {
    expect(GameConfigSchema.parse({ botCount: 1, aiMode })).toEqual({ botCount: 1, aiMode });
  });

  it.each(['true', 1, null])('rejects non-boolean aiMode %j', aiMode => {
    expect(GameConfigSchema.safeParse({ botCount: 1, aiMode }).success).toBe(false);
  });

  it('keeps GameConfig strict after adding aiMode', () => {
    expect(GameConfigSchema.safeParse({ botCount: 1, aiMode: false, apiKey: 'must-not-cross-browser-boundary' }).success)
      .toBe(false);
  });

  it('requires and runtime-validates the additive public AI snapshot', () => {
    const value = { ...publicView(), ai: idleAi };
    const legacyView = Object.fromEntries(Object.entries(publicView()).filter(([key]) => key !== 'ai'));
    expect(GameViewSchema.parse(value)).toEqual(value);
    expect(GameViewSchema.safeParse(legacyView).success).toBe(false);
    expect(GameViewSchema.safeParse({ ...value, ai: { ...idleAi, rawResponse: '{}' } }).success).toBe(false);
  });

  it('strictly validates analysis request and documented result boundaries', () => {
    const request = schema('AnalysisRequestSchema');
    const identity = { gameId: '11111111-1111-4111-8111-111111111111',
      handId: '22222222-2222-4222-8222-222222222222', expectedVersion: 18 };
    expect(request.safeParse(identity).success).toBe(true);
    expect(request.safeParse({ ...identity, source: 'internal' }).success).toBe(false);
    expect(request.safeParse({ ...identity, expectedVersion: 1.5 }).success).toBe(false);

    const item = { decisionRef: 'hand-1:decision-1', explanation: 'x'.repeat(600) };
    const result = { summary: 's'.repeat(1200), goodDecisions: Array(6).fill(item),
      possibleMistakes: [], nextSteps: Array(6).fill('n'.repeat(300)) };
    expect(MatchAnalysisSchema.safeParse(result).success).toBe(true);
    expect(MatchAnalysisSchema.safeParse({ ...result, summary: 's'.repeat(1201) }).success).toBe(false);
    expect(MatchAnalysisSchema.safeParse({ ...result, goodDecisions: Array(7).fill(item) }).success).toBe(false);
    expect(MatchAnalysisSchema.safeParse({ ...result, nextSteps: [] }).success).toBe(false);
    expect(MatchAnalysisSchema.safeParse({ ...result, rawResponse: '{}' }).success).toBe(false);
  });

  it('strictly validates usage snapshot/reset and safe-integer boundaries', () => {
    const reset = schema('UsageResetSchema');
    const dashboard = schema('UsageDashboardSchema');
    const count = { knownCount: 1, missingCount: 0, sum: 3 };
    const usage = { promptTokens: count, candidateTokens: count, thoughtTokens: count,
      cachedTokens: count, totalTokens: count,
      cost: { knownCount: 0, missingCount: 1, sum: null, currency: null } };
    const snapshot = { revision: 4,
      logical: [{ purpose: 'bot', initialModel: 'model-a', finalOutcome: 'model_success', count: 1 }],
      attempts: [{ purpose: 'bot', model: 'model-a', relation: 'initial', outcome: 'success',
        count: 1, latency: { count: 1, sumMs: 12, maxMs: 12 }, usage }],
      retryCount: 0, modelFallbackCount: 0, localFallbackCount: 0 };

    expect(reset.safeParse({ expectedRevision: 4 }).success).toBe(true);
    expect(reset.safeParse({ expectedRevision: 4, apiKey: 'secret' }).success).toBe(false);
    expect(reset.safeParse({ expectedRevision: -1 }).success).toBe(false);
    expect(dashboard.safeParse(snapshot).success).toBe(true);
    expect(dashboard.safeParse({ ...snapshot, revision: Number.MAX_SAFE_INTEGER + 1 }).success).toBe(false);
    expect(dashboard.safeParse({ ...snapshot, retryCount: 0.5 }).success).toBe(false);
    expect(dashboard.safeParse({ ...snapshot, attempts: [{ ...snapshot.attempts[0], rawLog: 'x' }] }).success)
      .toBe(false);
  });

  it.each(['AI_UNAVAILABLE', 'AI_ALREADY_PENDING', 'ANALYSIS_NOT_ALLOWED'])(
    'accepts the safe Week04 error code %s and still rejects internal details', code => {
    const value = { error: { code, message: 'AI zahtev nije dostupan.' } };
    expect(GameErrorSchema.parse(value)).toEqual(value);
    expect(GameErrorSchema.safeParse({ error: { ...value.error, apiKey: 'secret' } }).success).toBe(false);
    });
});
