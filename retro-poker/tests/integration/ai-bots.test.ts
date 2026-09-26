import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
function app() {
  const value = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(100).fill(0.9)) });
  apps.push(value); return value;
}

describe('AI bot mode public integration seam (FR-001, AIAC01, AIAC09)', () => {
  it.each([1, 2, 3, 4, 5])('starts botCount=%i with explicit AI mode off and no active interaction', async botCount => {
    const response = await app().inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*', 'content-type': 'application/json' },
      payload: { botCount, aiMode: false } });
    expect(response.statusCode).toBe(201);
    expect(response.json().game).toMatchObject({ botCount, ai: { mode: 'off', active: null } });
  });

  it('accepts AI mode on as a distinct server-side flow without a browser model or key', async () => {
    const response = await app().inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*', 'content-type': 'application/json' },
      payload: { botCount: 1, aiMode: true } });
    expect(response.statusCode).toBe(201);
    expect(response.json().game.ai.mode).toBe('on');
  });
});
