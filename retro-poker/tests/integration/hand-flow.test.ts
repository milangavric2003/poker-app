import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { GameResponseSchema, type GameView } from '../../shared/contracts.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const apps: FastifyInstance[] = [];
function app(botCount = 1) {
  const instance = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(50).fill(0.9)) });
  apps.push(instance);
  return { instance, botCount };
}
afterEach(async () => { await Promise.all(apps.splice(0).map(instance => instance.close())); });

async function create(instance: FastifyInstance, botCount = 1): Promise<GameView> {
  const response = await instance.inject({ method: 'POST', url: '/api/game',
    headers: { 'if-none-match': '*' }, payload: { botCount } });
  return GameResponseSchema.parse(response.json()).game!;
}
async function action(instance: FastifyInstance, game: GameView, type: 'fold' | 'check' | 'call') {
  const response = await instance.inject({ method: 'POST', url: '/api/game/actions', payload: {
    gameId: game.gameId, handId: game.handId, expectedVersion: game.version, type,
  } });
  expect(response.statusCode).toBe(200);
  return GameResponseSchema.parse(response.json()).game!;
}

describe('T018 bot loop, privatnost i AC23', () => {
  it('početni odgovor skriva bot karte, deck, burn, seed i observation', async () => {
    const { instance } = app();
    const game = await create(instance);
    expect(game.players[0]!.cards).toEqual(['As', 'Ah']);
    expect(game.players[1]!.cards).toBeNull();
    const json = JSON.stringify(game);
    for (const secret of ['Kc', 'Kd', 'deck', 'burnCards', 'seed', 'observation']) {
      expect(json).not.toContain(secret);
    }
  });

  it('AC23 izvršava bot loop do sledećeg ljudskog poteza i završava 1010/990', async () => {
    const { instance } = app();
    let game = await create(instance);
    game = await action(instance, game, 'call');
    expect(game.phase).toBe('flop');
    expect(game.actorId).toBe('player-0');
    for (const phase of ['turn', 'river', 'complete']) {
      game = await action(instance, game, 'check');
      expect(game.phase).toBe(phase);
    }
    expect(game.players.map(player => player.stack)).toEqual([1010, 990]);
    expect(game.result?.reason).toBe('showdown');
    expect(game.result?.pots[0]?.payouts).toEqual([{ playerId: 'player-0', amount: 20 }]);
    expect(game.players[1]!.cards).toEqual(['Kc', 'Kd']);
    expect(game.events.map(event => event.seq)).toEqual(
      Array.from({ length: game.events.length }, (_, index) => index + 1));
  });

  it('AC17 posle ljudskog fold-a botovi završavaju bez novog ljudskog poteza', async () => {
    const { instance } = app();
    let game = await create(instance);
    game = await action(instance, game, 'fold');
    expect(game.phase).toBe('complete');
    expect(game.result?.reason).toBe('uncontested');
    expect(game.actorId).toBeNull();
    expect(game.legalActions).toEqual([]);
  });
});
