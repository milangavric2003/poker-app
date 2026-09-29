import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGeminiProvider, geminiBotResponseSchema } from '../../backend/src/ai/providers/gemini.js';
import { coordinateBot, coordinateAnalysis } from '../../backend/src/ai/coordinator.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { UsageStore } from '../../backend/src/ai/usage.js';
import type { BotDecisionContext } from '../../backend/src/ai/types.js';
import { loadUsage } from '../../frontend/src/api.js';

afterEach(() => vi.unstubAllGlobals());
const context: BotDecisionContext = {
  gameId: '00000000-0000-4000-8000-000000000001', handId: '00000000-0000-4000-8000-000000000002',
  expectedVersion: 1, actorId: 'bot-1', decisionOrdinal: 1, phase: 'preflop',
  board: [], pots: [], players: [], holeCards: ['As', 'Kh'], legalActions: [{ type: 'check' }], history: [],
};
const config = loadAiConfig({ GEMINI_API_KEY: 'fake-secret', GEMINI_MAX_ATTEMPTS: '1' });
const signal = () => new AbortController().signal;

function transport(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status,
    headers: { 'content-type': 'application/json' } }));
  // Every fetch is intercepted. No real key or network is used.
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('real Gemini SDK over intercepted HTTP', () => {
  it.each([
    { type: 'call', amountTo: 10 },
    { type: 'bet', amountTo: null },
    { type: 'check', amountTo: null, unexpected: true },
  ])('rejects invalid action fields after transport normalization: %j', async fields => {
    transport({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({
      gameId: context.gameId, handId: context.handId, expectedVersion: 1, actorId: 'bot-1',
      decisionOrdinal: context.decisionOrdinal, ...fields,
    }) }] }, finishReason: 'STOP' }] });
    const result = await coordinateBot(createGeminiProvider('fake-secret'), config, context, signal());
    expect(result.ok).toBe(false);
    expect(result.attempts[0]?.outcome).toBe('schema_rejected');
  });
  it('serializes the production schema and accepts a valid bot response', async () => {
    const proposal = { gameId: context.gameId, handId: context.handId,
      expectedVersion: 1, actorId: 'bot-1', decisionOrdinal: context.decisionOrdinal, type: 'check' };
    const fetchMock = transport({ candidates: [{ content: { role: 'model',
      parts: [{ text: JSON.stringify({ ...proposal, amountTo: null }) }] }, finishReason: 'STOP' }],
    modelVersion: config.primaryModel, usageMetadata: { totalTokenCount: 23 } });
    const result = await coordinateBot(createGeminiProvider('fake-secret'), config, context, signal());
    expect(result).toMatchObject({ ok: true, value: { type: 'check' },
      attempts: [{ outcome: 'success', usage: { totalTokens: 23 } }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0]!;
    expect(String(url)).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${config.primaryModel}:generateContent`);
    expect(String(url)).not.toContain('fake-secret');
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json',
      responseJsonSchema: geminiBotResponseSchema });
    expect(body.generationConfig.responseJsonSchema.required).toContain('decisionOrdinal');
    expect(body.systemInstruction.parts[0].text).toContain('decisionOrdinal');
  });

  it.each([undefined, 2])('rejects a missing or stale decision ordinal %j', async decisionOrdinal => {
    transport({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({
      gameId: context.gameId, handId: context.handId, expectedVersion: 1,
      actorId: 'bot-1', decisionOrdinal, type: 'check', amountTo: null,
    }) }] }, finishReason: 'STOP' }] });
    const result = await coordinateBot(createGeminiProvider('fake-secret'), config, context, signal());
    expect(result).toMatchObject({ ok: false, attempts: [{
      outcome: decisionOrdinal === undefined ? 'schema_rejected' : 'semantic_rejected',
    }] });
  });

  it.each(['bot', 'analysis'] as const)('preserves safe overload evidence through %s and dashboard parsing', async purpose => {
    const fetchMock = transport({ error: { code: 503, status: 'UNAVAILABLE',
      message: 'This model is currently experiencing high demand. secret-payload',
      details: [{ secret: 'must-not-leak' }] } }, 503);
    const provider = createGeminiProvider('fake-secret');
    const result = purpose === 'bot' ? await coordinateBot(provider, config, context, signal())
      : await coordinateAnalysis(provider, config, { decisions: [] }, signal());
    expect(result.ok).toBe(false);
    expect(result.attempts[0]).toMatchObject({ outcome: 'server_error', diagnostic: {
      httpStatus: 503, providerCode: 'UNAVAILABLE', reason: 'high_demand' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const store = new UsageStore();
    store.record({ purpose, initialModel: config.primaryModel, finalOutcome: 'failed', attempts: result.attempts });
    transport({ usage: store.snapshot() });
    const usage = await loadUsage();
    expect(usage.attempts[0]).toMatchObject({ diagnostic: {
      httpStatus: 503, providerCode: 'UNAVAILABLE', reason: 'high_demand' } });
    expect(JSON.stringify(usage)).not.toMatch(/secret-payload|must-not-leak|fake-secret/);
  });

  it('keeps a retired model 404 distinct from authentication failures', async () => {
    transport({ error: { code: 404, status: 'NOT_FOUND', message: 'Model retired' } }, 404);
    const result = await coordinateBot(createGeminiProvider('fake-secret'), config, context, signal());
    expect(result.failure).toBe('invalid_request');
  });
});
