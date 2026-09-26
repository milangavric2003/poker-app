import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const apps: FastifyInstance[] = [];
function makeApp() {
  const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(100).fill(0.9)) });
  apps.push(app);
  return app;
}
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

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

  it('offers a process-wide usage snapshot even when no game exists', async () => {
    const response = await makeApp().inject('/api/ai/usage');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({ usage: {
      revision: 0, logical: [], attempts: [], retryCount: 0,
      modelFallbackCount: 0, localFallbackCount: 0,
    } });
  });

  it('uses strict optimistic concurrency for usage reset', async () => {
    const app = makeApp();
    const reset = await app.inject({ method: 'POST', url: '/api/ai/usage/reset',
      headers: { 'content-type': 'application/json' }, payload: { expectedRevision: 0 } });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().usage.revision).toBe(1);
    const duplicate = await app.inject({ method: 'POST', url: '/api/ai/usage/reset',
      headers: { 'content-type': 'application/json' }, payload: { expectedRevision: 0 } });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('STALE_STATE');
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
