import { describe, expect, it } from 'vitest';
import { buildBotDecisionContext } from '../../backend/src/ai/context.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import type { GameState } from '../../backend/src/session.js';
import { GameSession } from '../../backend/src/session.js';
import type { PublicEvent } from '../../shared/contracts.js';
import { FakeAiProvider } from '../helpers/fake-ai-provider.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const contextKeys = [
  'actorId', 'board', 'decisionOrdinal', 'expectedVersion', 'gameId', 'handId', 'history',
  'holeCards', 'legalActions', 'phase', 'players', 'pots',
];
const playerKeys = [
  'handContribution', 'id', 'kind', 'seat', 'stack', 'status', 'streetContribution',
];

function gameWithBotActor(): { game: GameState; actorId: string } {
  const session = new GameSession({
    deck: ac23Deck,
    deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom([0.9]),
    aiProvider: new FakeAiProvider([{ kind: 'pending' }]),
    aiConfig: loadAiConfig({ GEMINI_API_KEY: 'test-only-placeholder' }),
  });
  const game = session.create(3, true);
  const actor = game.hand.players.find(player => player.id === game.hand.actorId && player.kind === 'bot');
  if (!actor) throw new Error('Fixture mora ostaviti bota na potezu.');
  return { game, actorId: actor.id };
}

function actionEvent(handId: string, seq: number): PublicEvent {
  return { type: 'action', handId, seq, street: 'preflop', playerId: 'player-0',
    actionType: 'check', payAmount: 0, amountTo: 0 };
}

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeepFrozen(nested);
}

describe('BotDecisionContext privacy allowlist (AIAC02/SC-002)', () => {
  it.each([
    ['preflop', 0], ['flop', 3], ['turn', 4], ['river', 5],
  ] as const)('zadrzava privacy allowlist u %s fazi', (phase, boardLength) => {
    const { game, actorId } = gameWithBotActor();
    game.hand.phase = phase;
    game.hand.board = game.hand.deck.slice(game.hand.deckCursor + 1,
      game.hand.deckCursor + 1 + boardLength);

    const context = buildBotDecisionContext(game, actorId, 6);

    expect(context.phase).toBe(phase);
    expect(context.board).toHaveLength(boardLength);
    expect(context.holeCards).toEqual(game.hand.players.find(player => player.id === actorId)?.holeCards);
    expect(Object.keys(context).sort()).toEqual(contextKeys);
  });

  it('sadrzi samo ugovorena identity/revision/actor/public polja i dve karte aktuelnog bota', () => {
    const { game, actorId } = gameWithBotActor();
    const actor = game.hand.players.find(player => player.id === actorId)!;
    const opponents = game.hand.players.filter(player => player.id !== actorId);

    const context = buildBotDecisionContext(game, actorId, 7);

    expect(Object.keys(context).sort()).toEqual(contextKeys);
    expect(context).toMatchObject({ gameId: game.gameId, handId: game.hand.handId,
      expectedVersion: game.version, actorId, decisionOrdinal: 7, phase: game.hand.phase,
      board: game.hand.board, holeCards: actor.holeCards });
    expect(context.holeCards).toHaveLength(2);
    expect(context.legalActions.length).toBeGreaterThan(0);
    expect(context.players).toHaveLength(game.hand.players.length);
    for (const player of context.players) expect(Object.keys(player).sort()).toEqual(playerKeys);
    for (const opponent of opponents) {
      expect(context).not.toHaveProperty(`players.${opponent.seat}.holeCards`);
      for (const card of opponent.holeCards) expect(context.holeCards).not.toContain(card);
    }
  });

  it('uzima najvise 64 prethodna javna dogadjaja i ne dobija kasnije dogadjaje', () => {
    const { game, actorId } = gameWithBotActor();
    game.history.current.events = Array.from({ length: 70 }, (_, index) =>
      actionEvent(game.hand.handId, index + 1));

    const context = buildBotDecisionContext(game, actorId, 8);
    const futureEvent = actionEvent(game.hand.handId, 71);
    game.history.current.events.push(futureEvent);

    expect(context.history).toHaveLength(64);
    expect(context.history.map(event => event.seq)).toEqual(Array.from({ length: 64 }, (_, index) => index + 7));
    expect(context.history).not.toContainEqual(futureEvent);
  });

  it('ne moze da procuri hidden state, runtime tajne, source ili raw log preko GameState spread-a', () => {
    const { game, actorId } = gameWithBotActor();
    const internal = game as GameState & Record<string, unknown>;
    Object.assign(internal, { burnCards: ['LEAK_BURN'], deck: ['LEAK_DECK'], seed: 'LEAK_SEED',
      rng: 'LEAK_RNG', environment: { GEMINI_API_KEY: 'LEAK_KEY' }, apiKey: 'LEAK_API_KEY',
      source: 'LEAK_SOURCE', rawLog: 'LEAK_RAW_LOG', futureEvents: ['LEAK_FUTURE'] });

    const serialized = JSON.stringify(buildBotDecisionContext(game, actorId, 9));

    for (const forbidden of [
      'burnCards', 'deck', 'seed', 'rng', 'environment', 'apiKey', 'source', 'rawLog',
      'futureEvents', 'LEAK_', 'deckRandom', 'botRandom', 'facts', 'previousResult',
    ]) expect(serialized).not.toContain(forbidden);
  });

  it('vraca duboko immutable snapshot odvojen od GameState-a', () => {
    const { game, actorId } = gameWithBotActor();
    const context = buildBotDecisionContext(game, actorId, 10);

    expectDeepFrozen(context);
  });
});
