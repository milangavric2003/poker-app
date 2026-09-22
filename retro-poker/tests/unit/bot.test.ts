import { describe, expect, it } from 'vitest';
import { applyAction, legalActions } from '../../backend/src/engine/betting.js';
import { buildBotObservation, chooseBotAction, safeBotAction } from '../../backend/src/bots/strategy.js';
import type { ActiveHand } from '../../backend/src/engine/hand.js';
import { createHand } from '../../backend/src/engine/hand.js';
import type { Card, PokerAction } from '../../backend/src/engine/types.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const started = (): ActiveHand => createHand(1, '22222222-2222-4222-8222-222222222222', {
  deck: ac23Deck, deckRandom: sequenceRandom([0.1]),
});

describe('T016 BOT1–BOT6', () => {
  it('isti observation i bot RNG daju isti potez, nezavisno od deck RNG-a', () => {
    const hand = started();
    const bot = hand.players[1]!;
    const observation = buildBotObservation(hand, bot.id, []);
    const first = chooseBotAction(observation, sequenceRandom([0.1]));
    const second = chooseBotAction(observation, sequenceRandom([0.1]));
    expect(first).toEqual(second);

    const otherDeckRng = sequenceRandom([0.99, 0.88, 0.77]);
    otherDeckRng.next();
    expect(chooseBotAction(observation, sequenceRandom([0.1]))).toEqual(first);
  });

  it('observation sadrži samo botove karte, javno stanje, istoriju i legalne akcije', () => {
    const hand = started();
    const bot = hand.players[1]!;
    const humanCards = hand.players[0]!.holeCards;
    const observation = buildBotObservation({ ...hand, actorId: bot.id,
      pendingActors: [bot.id] }, bot.id, [{ seq: 1, type: 'action', playerId: 'player-0' }]);
    expect(observation.holeCards).toEqual(bot.holeCards);
    expect(observation.players.every(player => !('holeCards' in player))).toBe(true);
    expect(JSON.stringify(observation)).not.toContain(humanCards[0]);
    expect(JSON.stringify(observation)).not.toContain(humanCards[1]);
    expect(observation).not.toHaveProperty('deck');
    expect(observation.legalActions).toEqual(legalActions({ ...hand, actorId: bot.id,
      pendingActors: [bot.id] }, bot.id));
  });

  it('D3 jaka ruka bira minimalni raise sa verovatnoćom 1/4 i inače check/call', () => {
    const hand = started();
    const bot = hand.players[1]!;
    const acting = { ...hand, actorId: bot.id, pendingActors: [bot.id] };
    const observation = buildBotObservation(acting, bot.id, []);
    expect(chooseBotAction(observation, sequenceRandom([0.1]))).toEqual({ type: 'raise', amountTo: 20 });
    expect(chooseBotAction(observation, sequenceRandom([0.9]))).toEqual({ type: 'check' });
  });

  it('slaba ruka call-uje mali dug, a veliki dug fold-uje', () => {
    const weak = { ...started(), currentBet: 20 };
    weak.players = weak.players.map((p, index) => index === 1
      ? { ...p, holeCards: ['2c', '7d'] as Card[], streetContribution: 10 }
      : { ...p, streetContribution: 20 });
    weak.actorId = weak.players[1]!.id;
    weak.pendingActors = [weak.actorId];
    expect(chooseBotAction(buildBotObservation(weak, weak.actorId, []), sequenceRandom([0.9])))
      .toEqual({ type: 'call' });
    weak.currentBet = 40;
    expect(chooseBotAction(buildBotObservation(weak, weak.actorId, []), sequenceRandom([0.9])))
      .toEqual({ type: 'fold' });
  });

  it('izabrani bot potez prolazi isti validator kao ljudski potez', () => {
    const hand = started();
    const bot = hand.players[1]!;
    const acting = { ...hand, actorId: bot.id, pendingActors: [bot.id] };
    const action = chooseBotAction(buildBotObservation(acting, bot.id, []), sequenceRandom([0.9]));
    expect(() => applyAction(acting, bot.id, action)).not.toThrow();
    expect(() => applyAction(acting, bot.id, { type: 'raise', amountTo: 11 })).toThrow();
  });

  it('greška strategije daje detektovan check fallback, inače fold', () => {
    const check = safeBotAction([{ type: 'fold' }, { type: 'check' }], () => {
      throw new Error('strategy failed');
    });
    expect(check).toEqual({ action: { type: 'check' }, fallbackUsed: true,
      diagnostic: 'BOT_STRATEGY_FALLBACK' });
    const fold = safeBotAction([{ type: 'fold' }, { type: 'call', payAmount: 5, isAllIn: false }],
      () => ({ type: 'raise', amountTo: 999 } as PokerAction));
    expect(fold).toEqual({ action: { type: 'fold' }, fallbackUsed: true,
      diagnostic: 'BOT_STRATEGY_FALLBACK' });
  });
});
