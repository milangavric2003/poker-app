import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { GameResponseSchema } from '../../shared/contracts.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const apps: FastifyInstance[] = [];
function app() {
  const instance = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(20).fill(0.9)) });
  apps.push(instance);
  return instance;
}
afterEach(async () => { await Promise.all(apps.splice(0).map(instance => instance.close())); });

async function create(instance: FastifyInstance) {
  const response = await instance.inject({ method: 'POST', url: '/api/game',
    headers: { 'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 1 } });
  expect(response.statusCode).toBe(201);
  return GameResponseSchema.parse(response.json()).game!;
}

describe('T018 create/get/action i transakcije', () => {
  it('GET je prazan, create pravi UUID partiju, a GET vraća javni snapshot', async () => {
    const instance = app();
    expect((await instance.inject({ method: 'GET', url: '/api/game' })).json()).toEqual({ game: null });
    const game = await create(instance);
    expect(game.gameId).toMatch(/^[0-9a-f-]{36}$/);
    expect(game.handId).toMatch(/^[0-9a-f-]{36}$/);
    expect(game.version).toBe(1);
    expect(GameResponseSchema.parse((await instance.inject({ method: 'GET', url: '/api/game' })).json()).game)
      .toEqual(game);
  });

  it('nevalidan config i pogrešan reset uslov ne zamenjuju postojeću partiju', async () => {
    const instance = app();
    const before = await create(instance);
    const invalid = await instance.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-match': `"${before.gameId}:${before.version}"`, 'content-type': 'application/json' },
      payload: { botCount: 0 } });
    expect(invalid.statusCode).toBe(400);
    const stale = await instance.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-match': '"wrong:0"', 'content-type': 'application/json' }, payload: { botCount: 2 } });
    expect(stale.statusCode).toBe(409);
    expect(GameResponseSchema.parse((await instance.inject({ method: 'GET', url: '/api/game' })).json()).game)
      .toEqual(before);
  });

  it('stale dupli potez ima jedan serijski commit i version raste samo jednom', async () => {
    const instance = app();
    const game = await create(instance);
    const payload = { gameId: game.gameId, handId: game.handId,
      expectedVersion: game.version, type: 'call' };
    const [a, b] = await Promise.all([
      instance.inject({ method: 'POST', url: '/api/game/actions', payload }),
      instance.inject({ method: 'POST', url: '/api/game/actions', payload }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const committed = GameResponseSchema.parse((a.statusCode === 200 ? a : b).json()).game!;
    expect(committed.version).toBe(game.version + 1);
    expect(committed.players[0]!.handContribution).toBe(10);
  });

  it('nelegalna akcija vraća stabilnu grešku bez privatnog stanja i rollback-uje stanje/istoriju/RNG', async () => {
    const instance = app();
    const before = await create(instance);
    const error = await instance.inject({ method: 'POST', url: '/api/game/actions', payload: {
      gameId: before.gameId, handId: before.handId, expectedVersion: before.version, type: 'check',
    } });
    expect(error.statusCode).toBe(409);
    expect(error.json()).toEqual({ error: { code: 'ILLEGAL_ACTION', message: expect.any(String) } });
    expect(JSON.stringify(error.json())).not.toContain('As');
    expect(GameResponseSchema.parse((await instance.inject({ method: 'GET', url: '/api/game' })).json()).game)
      .toEqual(before);
  });

  it('interna greška posle bot odluke rollback-uje stanje, istoriju i bot RNG', async () => {
    let fail = true;
    const instance = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
      botRandom: sequenceRandom([0.1, 0.9]), beforeActionCommit: () => {
        if (fail) throw new Error('injected transaction failure');
      } });
    apps.push(instance);
    const before = await create(instance);
    const payload = { gameId: before.gameId, handId: before.handId,
      expectedVersion: before.version, type: 'call' };
    const failed = await instance.inject({ method: 'POST', url: '/api/game/actions', payload });
    expect(failed.statusCode).toBe(500);
    expect(GameResponseSchema.parse((await instance.inject({ method: 'GET', url: '/api/game' })).json()).game)
      .toEqual(before);
    fail = false;
    const retried = GameResponseSchema.parse((await instance.inject({ method: 'POST',
      url: '/api/game/actions', payload })).json()).game!;
    const botAction = retried.events.filter(event => event.type === 'action').at(-1);
    expect(botAction).toMatchObject({ playerId: 'player-1', actionType: 'raise', amountTo: 20 });
  });
});
