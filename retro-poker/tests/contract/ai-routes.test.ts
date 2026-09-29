import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';
import { GameResponseSchema, type GameView } from '../../shared/contracts.js';

const apps: FastifyInstance[] = [];
function makeApp() {
  const snapshot = processUsageStore.snapshot(); processUsageStore.reset(snapshot.revision);
  const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(100).fill(0.9)) });
  apps.push(app);
  return app;
}
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
afterEach(() => { const current = processUsageStore.snapshot(); processUsageStore.reset(current.revision); });

describe('Week04 HTTP contracts (AIAC01, AIAC12–AIAC13)', () => {
  it('keeps omitted aiMode backward-compatible and exposes mode off', async () => {
    const response = await makeApp().inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 1 } });
    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().game.ai).toMatchObject({ mode: 'off', active: null });
  });

  it('accepts explicit aiMode boolean and rejects wrong types and unknown fields', async () => {
    const app = makeApp();
    const accepted = await app.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*', 'content-type': 'application/json' },
      payload: { botCount: 1, aiMode: true } });
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json().game.ai.mode).toBe('on');

    for (const payload of [
      { botCount: 1, aiMode: 'true' }, { botCount: 1, aiMode: null },
      { botCount: 1, aiMode: false, model: 'browser-must-not-select-model' },
    ]) {
      const rejected = await makeApp().inject({ method: 'POST', url: '/api/game',
        headers: { 'if-none-match': '*', 'content-type': 'application/json' }, payload });
      expect(rejected.statusCode).toBe(400);
      expect(rejected.json().error.code).toBe('INVALID_INPUT');
    }
  });

  it('keeps additive GameView.ai and no-store through create, GET, action and next-hand', async () => {
    const app = makeApp();
    const assertResponse = (response: Awaited<ReturnType<typeof app.inject>>): GameView => {
      expect(response.statusCode).toBeLessThan(300);
      expect(response.headers['cache-control']).toBe('no-store');
      const game = GameResponseSchema.parse(response.json()).game;
      expect(game?.ai).toMatchObject({ mode: 'off', active: null });
      const serialized = JSON.stringify(response.json()).toLowerCase();
      for (const forbidden of ['prompt', 'proposal', 'apikey', 'api_key', 'rawresponse', 'raw_response'])
        expect(serialized).not.toContain(forbidden);
      if (!game) throw new Error('Očekivano je stanje partije.');
      return game;
    };

    assertResponse(await app.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*', 'content-type': 'application/json' },
      payload: { botCount: 1 } }));
    let game = assertResponse(await app.inject({ method: 'GET', url: '/api/game' }));

    for (let turn = 0; game.phase !== 'complete' && turn < 20; turn++) {
      const action = game.legalActions.find(candidate => candidate.type === 'check')
        ?? game.legalActions.find(candidate => candidate.type === 'call')
        ?? game.legalActions.find(candidate => candidate.type === 'all_in')
        ?? game.legalActions[0];
      if (!action) throw new Error('Očekivana je legalna ljudska akcija.');
      const payload = { gameId: game.gameId, handId: game.handId, expectedVersion: game.version,
        type: action.type, ...((action.type === 'bet' || action.type === 'raise')
          ? { amountTo: action.minAmountTo } : {}) };
      game = assertResponse(await app.inject({ method: 'POST', url: '/api/game/actions',
        headers: { 'content-type': 'application/json' }, payload }));
    }
    expect(game.phase).toBe('complete');

    assertResponse(await app.inject({ method: 'POST', url: '/api/game/next-hand',
      headers: { 'content-type': 'application/json' }, payload: {
        gameId: game.gameId, handId: game.handId, expectedVersion: game.version,
      } }));
  });

  it('offers a process-wide usage snapshot even when no game exists', async () => {
    const app = makeApp();
    const response = await app.inject('/api/ai/usage');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().usage).toMatchObject({ logical: [], attempts: [], retryCount: 0,
      modelFallbackCount: 0, localFallbackCount: 0 });
    expect(response.json().usage.revision).toBe(processUsageStore.snapshot().revision);
  });

  it('uses strict optimistic concurrency for usage reset', async () => {
    const app = makeApp();
    const created = await app.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 1 } });
    expect(created.statusCode).toBe(201);
    processUsageStore.record({ purpose: 'bot', initialModel: 'model-a', finalOutcome: 'model_success', attempts: [
      { model: 'model-a', relation: 'initial', outcome: 'success', durationMs: 12,
        usage: { promptTokens: 0 } },
    ] });
    const before = (await app.inject('/api/game')).json().game;
    const expectedRevision = processUsageStore.snapshot().revision;
    const reset = await app.inject({ method: 'POST', url: '/api/ai/usage/reset',
      headers: { 'content-type': 'application/json' }, payload: { expectedRevision } });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().usage.logical).toEqual([]);
    expect(reset.json().usage.revision).toBe(expectedRevision + 1);
    expect((await app.inject('/api/game')).json().game).toEqual(before);
    const duplicate = await app.inject({ method: 'POST', url: '/api/ai/usage/reset',
      headers: { 'content-type': 'application/json' }, payload: { expectedRevision } });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('STALE_STATE');
  });

  it('rejects unknown reset fields and preserves the process aggregate after game replacement', async () => {
    const app = makeApp();
    processUsageStore.record({ purpose: 'analysis', initialModel: 'model-a', finalOutcome: 'failed', attempts: [] });
    const resetWithUnknown = await app.inject({ method: 'POST', url: '/api/ai/usage/reset',
      headers: { 'content-type': 'application/json' }, payload: { expectedRevision: processUsageStore.snapshot().revision, apiKey: 'secret' } });
    expect(resetWithUnknown.statusCode).toBe(400);
    const create = (headers: Record<string, string>, payload: object) => app.inject({ method: 'POST', url: '/api/game',
      headers: { ...headers, 'content-type': 'application/json' }, payload });
    const started = await create({ 'if-none-match': '*' }, { botCount: 1 });
    const game = started.json().game;
    const replacement = await create({ 'if-match': `"${game.gameId}:${game.version}"` }, { botCount: 1 });
    expect(replacement.statusCode).toBe(201);
    expect((await app.inject('/api/ai/usage')).json().usage.logical).toHaveLength(1);
  });

  it('rejects analysis before a terminal game with a stable semantic error', async () => {
    const app = makeApp();
    const created = await app.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 1 } });
    const game = created.json().game;
    const response = await app.inject({ method: 'POST', url: '/api/game/analysis',
      headers: { 'content-type': 'application/json' }, payload: {
        gameId: game.gameId, handId: game.handId, expectedVersion: game.version,
      } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ANALYSIS_NOT_ALLOWED');
  });
});
