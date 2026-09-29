import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { coordinateBot } from '../../backend/src/ai/coordinator.js';
import type { AiProvider, BotDecisionContext } from '../../backend/src/ai/types.js';

const env = { GEMINI_API_KEY: 'offline-key', GEMINI_PRIMARY_MODEL: 'gemini-3.5-flash-lite',
  GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite', GEMINI_MAX_ATTEMPTS: '1',
  GEMINI_BOT_TOTAL_MS: '35000', GEMINI_BOT_TIMEOUT_MS: '30000' };
const context: BotDecisionContext = { gameId: '00000000-0000-4000-8000-000000000001',
  handId: '00000000-0000-4000-8000-000000000002', expectedVersion: 1,
  actorId: 'bot-1', decisionOrdinal: 1, phase: 'preflop', board: [], pots: [], players: [],
  holeCards: ['As', 'Kh'], legalActions: [{ type: 'check' }], history: [] };
afterEach(() => vi.useRealTimers());

describe('explicit slower Lite profile', () => {
  it('loads bounded opt-in deadlines without changing the default profile', () => {
    expect(loadAiConfig(env)).toMatchObject({ primaryModel: 'gemini-3.5-flash-lite',
      fallbackModel: null, maxAttempts: 1, botTotalMs: 35000, botAttemptMs: 30000,
      public: { botTotalMs: 35000 } });
    expect(loadAiConfig({})).toMatchObject({ botTotalMs: 12000, botAttemptMs: 5000 });
    expect(loadAiConfig({ GEMINI_BOT_TIMEOUT_MS: '30000' })).toMatchObject({ botAttemptMs: 11000 });
    expect(loadAiConfig({ ...env, GEMINI_BOT_TOTAL_MS: '999999', GEMINI_BOT_TIMEOUT_MS: '999999' }))
      .toMatchObject({ botTotalMs: 35000, botAttemptMs: 30000 });
  });

  it('accepts a legal reply after 12.6 seconds instead of silently falling back', async () => {
    vi.useFakeTimers();
    const generate = vi.fn<AiProvider['generate']>(async () => {
      await new Promise(resolve => setTimeout(resolve, 12574));
      return { candidate: { gameId: context.gameId, handId: context.handId,
        expectedVersion: 1, actorId: 'bot-1', type: 'check' } };
    });
    const task = coordinateBot({ generate }, loadAiConfig(env), context, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(12574);
    expect(await task).toMatchObject({ ok: true, value: { type: 'check' }, attempts: [{ outcome: 'success' }] });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('still aborts a stuck request at 30 seconds with no extra attempt', async () => {
    vi.useFakeTimers();
    let providerSignal: AbortSignal | undefined;
    const generate = vi.fn<AiProvider['generate']>(async (_request, signal) => {
      providerSignal = signal;
      return await new Promise(() => {});
    });
    const task = coordinateBot({ generate }, loadAiConfig(env), context, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(30000);
    const result = await task;
    expect(result).toMatchObject({ ok: false, failure: 'timeout', attempts: [{ outcome: 'timeout', durationMs: 30000 }] });
    expect(providerSignal?.aborted).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
