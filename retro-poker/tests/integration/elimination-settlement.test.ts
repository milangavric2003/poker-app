import { describe, expect, it } from 'vitest';
import { act, createHand, createNextHand } from '../../backend/src/engine/hand.js';
import type { Card } from '../../backend/src/engine/types.js';
import { sequenceRandom } from '../helpers/fixtures.js';

const deck = ['Ks', 'Qs', 'Js', 'As', 'Kd', 'Qd', 'Jd', 'Ad',
  '6c', '2c', '3d', '7h', '8c', '9s', 'Tc', '4c'] satisfies Card[];

describe('R8 / AC21 obračun narednih ruku posle eliminacije', () => {
  it.each(['showdown', 'uncontested'] as const)('završava naredne ruke: %s', reason => {
    const dependencies = { deck, deckRandom: sequenceRandom([]) };
    let hand = createHand(3, 'hand-1', dependencies);
    hand = act(hand, 'player-3', { type: 'fold' });
    hand = act(hand, 'player-0', { type: 'all_in' });
    hand = act(hand, 'player-1', { type: 'call' });
    hand = act(hand, 'player-2', { type: 'fold' });
    expect(hand.players.map(p => p.stack)).toEqual([2010, 0, 990, 1000]);
    expect(hand.gameStatus).toBe('playing');

    for (let round = 2; round <= 4; round++) {
      hand = createNextHand(hand, `hand-${round}`, dependencies);
      expect(hand.players[1]).toMatchObject({ status: 'eliminated', holeCards: [], stack: 0 });
      let actions = 0;
      while (!hand.settled && actions++ < 30) {
        const actor = hand.players.find(p => p.id === hand.actorId)!;
        expect(actor.id).not.toBe('player-1');
        hand = act(hand, actor.id, { type: reason === 'uncontested' ? 'fold'
          : actor.streetContribution < hand.currentBet ? 'call' : 'check' });
      }
      expect(hand.result?.reason).toBe(reason);
      expect(hand.players.reduce((sum, p) => sum + p.stack, 0)).toBe(4000);
      expect(hand.result?.netChanges).toContainEqual({ playerId: 'player-1', amount: 0 });
      expect(hand.result?.revealedCards.some(p => p.playerId === 'player-1')).toBe(false);
    }
  });
});
