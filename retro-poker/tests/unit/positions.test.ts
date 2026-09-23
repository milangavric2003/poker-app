import { describe, expect, it } from 'vitest';
import { initialPositions, nextPositions } from '../../backend/src/engine/positions.js';
import { createHand, createNextHand } from '../../backend/src/engine/hand.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const fixtures = [
  ['BL01', [0,1,2,3,4,5], [0,1,2,3,4,5], [0,1,2], [1,2,3,4,2]],
  ['BL02', [0,1,2,3,4,5], [1,2,3,4,5], [0,1,2], [1,2,3,4,2]],
  ['BL03', [0,1,2,3,4,5], [0,2,3,4,5], [0,1,2], [1,2,3,4,2]],
  ['BL04', [0,1,2,3,4,5], [0,1,3,4,5], [0,1,2], [1,2,3,4,3]],
  ['BL05', [0,1,2,3,4,5], [0,4,5], [0,1,2], [1,2,4,5,4]],
  ['BL06', [0,1,3,4,5], [0,1,3,4,5], [1,2,3], [2,3,4,5,3]],
  ['BL07', [0,1,2], [1,2], [0,1,2], [2,2,1,2,1]],
  ['BL08', [0,1,2], [0,2], [0,1,2], [2,2,0,2,0]],
  ['BL09', [0,1,2], [0,1], [0,1,2], [1,1,0,1,0]],
  ['BL10', [0,1], [0,1], [0,0,1], [1,1,0,1,0]],
] as const;

describe('AC21 dead-button pozicije', () => {
  it.each(fixtures)('%s', (_id, configured, active, previous, expected) => {
    const actual = nextPositions(configured, active, {
      buttonSeat: previous[0], smallBlindSeat: previous[1], bigBlindSeat: previous[2] });
    expect([actual.buttonSeat, actual.smallBlindSeat, actual.bigBlindSeat,
      actual.firstPreflopSeat, actual.firstPostflopSeat]).toEqual(expected);
  });
  it('primenjuje heads-up početni izuzetak', () => {
    expect(initialPositions(1)).toEqual({ buttonSeat: 0, smallBlindSeat: 0, bigBlindSeat: 1 });
  });
  it('odbija ring sa manje od dva aktivna mesta', () => {
    expect(() => nextPositions([0,1], [0], { buttonSeat: 0, smallBlindSeat: 0, bigBlindSeat: 1 })).toThrow();
  });

  it('naplaćuje kratke SB/BB kao all-in uz nominalni preflop minimum 10', () => {
    const previous = createHand(2, 'previous', { deck: ac23Deck,
      deckRandom: sequenceRandom([]) });
    previous.players[0]!.stack = 7;
    previous.players[1]!.stack = 1990;
    previous.players[2]!.stack = 3;
    const next = createNextHand(previous, 'next', { deck: ac23Deck,
      deckRandom: sequenceRandom([]) });
    expect([next.buttonSeat, next.smallBlindSeat, next.bigBlindSeat]).toEqual([1, 2, 0]);
    expect(next.players.map(player => [player.stack, player.handContribution, player.status]))
      .toEqual([[0, 7, 'all_in'], [1990, 0, 'active'], [0, 3, 'all_in']]);
    expect(next.currentBet).toBe(10);
    expect(next.actorId).toBe('player-1');
  });

  it('ne naplaćuje dead small blind', () => {
    const previous = createHand(3, 'previous', { deckRandom: sequenceRandom([]), deck: ac23Deck });
    previous.players[2]!.stack = 0;
    const before = previous.players.map(player => player.stack);
    const next = createNextHand(previous, 'next', { deckRandom: sequenceRandom([]), deck: ac23Deck });
    expect(next.smallBlindSeat).toBe(2);
    expect(next.players[2]!.handContribution).toBe(0);
    expect(next.players[2]!.status).toBe('eliminated');
    expect(next.players[2]!.stack).toBe(before[2]);
  });

  it('AC23 druga ruka pre bot akcije ima prenete stackove i blindove 1000/985', () => {
    const previous = createHand(1, 'previous', { deckRandom: sequenceRandom([]), deck: ac23Deck });
    previous.players[0]!.stack = 1010;
    previous.players[1]!.stack = 990;
    const next = createNextHand(previous, 'next', { deckRandom: sequenceRandom([]), deck: ac23Deck });
    expect([next.buttonSeat, next.smallBlindSeat, next.bigBlindSeat]).toEqual([1, 1, 0]);
    expect(next.players.map(player => [player.stack, player.handContribution]))
      .toEqual([[1000, 10], [985, 5]]);
    expect(next.actorId).toBe('player-1');
  });

  it('automatski završava heads-up ruku kada su oba kratka blinda all-in', () => {
    const previous = createHand(1, 'previous', { deckRandom: sequenceRandom([]), deck: ac23Deck });
    previous.players[0]!.stack = 7;
    previous.players[1]!.stack = 3;
    const next = createNextHand(previous, 'next', { deckRandom: sequenceRandom([]), deck: ac23Deck });
    expect(next.phase).toBe('complete');
    expect(next.board).toHaveLength(5);
    expect(next.result?.reason).toBe('showdown');
    expect(next.players.reduce((sum, player) => sum + player.stack, 0)).toBe(10);
  });
});
