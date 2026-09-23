import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { GameSession, SessionError } from '../../backend/src/session.js';
import { GameResponseSchema, type GameView } from '../../shared/contracts.js';
import type { Card } from '../../backend/src/engine/types.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const apps: FastifyInstance[] = [];
function makeApp() {
  const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(100).fill(0.9)) });
  apps.push(app); return app;
}
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
async function create(app: FastifyInstance) {
  const response = await app.inject({ method: 'POST', url: '/api/game',
    headers: { 'if-none-match': '*' }, payload: { botCount: 1 } });
  return GameResponseSchema.parse(response.json()).game!;
}
async function action(app: FastifyInstance, game: GameView, type: 'call'|'check') {
  const response = await app.inject({ method: 'POST', url: '/api/game/actions', payload: {
    gameId: game.gameId, handId: game.handId, expectedVersion: game.version, type } });
  return GameResponseSchema.parse(response.json()).game!;
}
async function complete(app: FastifyInstance) {
  let game = await create(app);
  game = await action(app, game, 'call');
  for (let i = 0; i < 3; i++) game = await action(app, game, 'check');
  return game;
}

describe('T027/T028 session lifecycle', () => {
  it('prenosi stackove, rotira heads-up blindove i čuva samo poslednji rezultat', async () => {
    const app = makeApp(); const finished = await complete(app);
    const response = await app.inject({ method: 'POST', url: '/api/game/next-hand', payload: {
      gameId: finished.gameId, handId: finished.handId, expectedVersion: finished.version } });
    expect(response.statusCode).toBe(200);
    const game = GameResponseSchema.parse(response.json()).game!;
    expect(game.handNumber).toBe(2);
    expect([game.buttonSeat, game.smallBlindSeat, game.bigBlindSeat]).toEqual([1,1,0]);
    // Session transaction also advances the bot (SB calls 5) before returning control to the human.
    expect(game.players.map(player => [player.stack, player.handContribution])).toEqual([[1000,10],[980,10]]);
    expect(game.previousResult?.handId).toBe(finished.handId);
    expect(game.result).toBeNull();
  });

  it('istorija posle next-hand sadrži samo aktuelnu i poslednju završenu ruku', () => {
    const session = new GameSession({ deck: ac23Deck, deckRandom: sequenceRandom([]),
      botRandom: sequenceRandom(Array<number>(100).fill(0.9)) });
    let game = session.create(1);
    game = session.action({ gameId: game.gameId, handId: game.hand.handId,
      expectedVersion: game.version, type: 'call' });
    for (let i = 0; i < 3; i++) game = session.action({ gameId: game.gameId,
      handId: game.hand.handId, expectedVersion: game.version, type: 'check' });
    const completedHandId = game.hand.handId;
    game = session.nextHand({ gameId: game.gameId, handId: game.hand.handId,
      expectedVersion: game.version });
    expect(game.history.previous?.handId).toBe(completedHandId);
    expect(game.history.previous?.events.at(-1)?.type).toBe('settled');
    expect(game.history.current.handId).toBe(game.hand.handId);
    expect(game.history.current.events[0]?.type).toBe('hand_started');
  });

  it('odbija prerani i dupli next-hand bez mutacije', async () => {
    const app = makeApp(); const initial = await create(app);
    const early = await app.inject({ method: 'POST', url: '/api/game/next-hand', payload: {
      gameId: initial.gameId, handId: initial.handId, expectedVersion: initial.version } });
    expect(early.statusCode).toBe(409);
    const finished = await complete(makeApp());
    const owner = apps.at(-1)!;
    const body = { gameId: finished.gameId, handId: finished.handId, expectedVersion: finished.version };
    expect((await owner.inject({ method: 'POST', url: '/api/game/next-hand', payload: body })).statusCode).toBe(200);
    expect((await owner.inject({ method: 'POST', url: '/api/game/next-hand', payload: body })).statusCode).toBe(409);
  });

  it('reset vraća početne stackove, a nov proces nema memorijsko stanje', async () => {
    const app = makeApp(); const finished = await complete(app);
    const reset = await app.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-match': `"${finished.gameId}:${finished.version}"` }, payload: { botCount: 1 } });
    expect(GameResponseSchema.parse(reset.json()).game!.players.map(player => player.stack)).toEqual([995,990]);
    const fresh = makeApp();
    expect(GameResponseSchema.parse((await fresh.inject('/api/game')).json()).game).toBeNull();
  });

  it('stvarni settlement postavlja won i terminalni session odbija next-hand', () => {
    const session = new GameSession({ deck: ac23Deck, deckRandom: sequenceRandom([]),
      botRandom: sequenceRandom(Array<number>(20).fill(0.9)) });
    const game = session.create(1);
    const bot = game.hand.players[1]!;
    bot.stack = 0; bot.stackAtHandStart = 10; bot.status = 'all_in';
    game.hand.pendingActors = ['player-0']; game.hand.actorId = 'player-0';
    const terminal = session.action({ gameId: game.gameId, handId: game.hand.handId,
      expectedVersion: game.version, type: 'call' });
    expect(terminal.hand.gameStatus).toBe('won');
    expect(terminal.hand.result?.gameStatus).toBe('won');
    const before = { version: terminal.version, handId: terminal.hand.handId,
      stacks: terminal.hand.players.map(player => player.stack) };
    expect(() => session.nextHand({ gameId: terminal.gameId, handId: terminal.hand.handId,
      expectedVersion: terminal.version })).toThrowError(SessionError);
    expect({ version: session.get()!.version, handId: session.get()!.hand.handId,
      stacks: session.get()!.hand.players.map(player => player.stack) }).toEqual(before);
  });

  it('stvarni settlement postavlja lost i odmah završava session', () => {
    const losingDeck: readonly Card[] = ['As','Kc','Ah','Kd', ...ac23Deck.slice(4)];
    const session = new GameSession({ deck: losingDeck, deckRandom: sequenceRandom([]),
      botRandom: sequenceRandom(Array<number>(20).fill(0.9)) });
    const game = session.create(1);
    const human = game.hand.players[0]!;
    human.stack = 5; human.stackAtHandStart = 10;
    const terminal = session.action({ gameId: game.gameId, handId: game.hand.handId,
      expectedVersion: game.version, type: 'call' });
    expect(terminal.hand.gameStatus).toBe('lost');
    expect(terminal.hand.result?.gameStatus).toBe('lost');
    expect(terminal.hand.players[0]!.status).toBe('eliminated');
    const before = { version: terminal.version, handId: terminal.hand.handId,
      stacks: terminal.hand.players.map(player => player.stack) };
    expect(() => session.nextHand({ gameId: terminal.gameId, handId: terminal.hand.handId,
      expectedVersion: terminal.version })).toThrowError(SessionError);
    expect({ version: session.get()!.version, handId: session.get()!.hand.handId,
      stacks: session.get()!.hand.players.map(player => player.stack) }).toEqual({
      version: before.version, handId: before.handId, stacks: before.stacks });
  });

  it('rollback next-hand kandidata čuva verziju, ruku, istoriju i RNG', async () => {
    let shouldFail = true;
    const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
      botRandom: sequenceRandom(Array<number>(100).fill(0.9)),
      beforeNextHandCommit: () => { if (shouldFail) throw new Error('fixture fault'); } });
    apps.push(app);
    const finished = await complete(app);
    const before = await app.inject('/api/game');
    const response = await app.inject({ method: 'POST', url: '/api/game/next-hand', payload: {
      gameId: finished.gameId, handId: finished.handId, expectedVersion: finished.version } });
    expect(response.statusCode).toBe(500);
    const after = await app.inject('/api/game');
    expect(after.json()).toEqual(before.json());
    shouldFail = false;
    const retry = await app.inject({ method: 'POST', url: '/api/game/next-hand', payload: {
      gameId: finished.gameId, handId: finished.handId, expectedVersion: finished.version } });
    expect(retry.statusCode).toBe(200);
    const retried = GameResponseSchema.parse(retry.json()).game!;
    expect({ phase: retried.phase, status: retried.status,
      stacks: retried.players.map(player => [player.stack, player.handContribution]),
      actions: retried.events.filter(event => event.type === 'action').map(event => event.actionType) })
      .toEqual({ phase: 'preflop', status: 'playing', stacks: [[1000,10],[980,10]], actions: ['call'] });
  });
});
