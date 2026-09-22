import { describe, expect, it } from 'vitest';
import { settleHand } from '../../backend/src/engine/hand.js';
import type { Card, HandState, Player } from '../../backend/src/engine/types.js';
import { handPlayer } from '../helpers/fixtures.js';

const board = ['2c', '3d', '7h', '9s', 'Jc'] satisfies Card[];
const player = (id: string, seat: number, cards: Card[], contribution: number,
  patch: Partial<Player> = {}) => handPlayer(id, seat, cards, {
    stack: 1000 - contribution, stackAtHandStart: 1000, streetContribution: contribution,
    handContribution: contribution, ...patch,
  });
const hand = (players: Player[], patch: Partial<HandState> = {}): HandState => ({
  handId: '22222222-2222-4222-8222-222222222222', phase: 'river', buttonSeat: 2,
  board, players, actorId: null, settled: false, result: null, gameStatus: 'playing', ...patch,
});

describe('T012 settlement cele ruke', () => {
  it('završava river showdown tek posle isplate i računa netChanges sa zbirom nula', () => {
    const result = settleHand(hand([
      player('A', 0, ['As', 'Ad'], 100), player('B', 1, ['Ks', 'Kd'], 250),
      player('C', 2, ['Qs', 'Qd'], 250),
    ]));

    expect(result.phase).toBe('complete');
    expect(result.settled).toBe(true);
    expect(result.actorId).toBeNull();
    expect(result.result?.reason).toBe('showdown');
    expect(result.result?.netChanges).toEqual([
      { playerId: 'A', amount: 200 }, { playerId: 'B', amount: 50 },
      { playerId: 'C', amount: -250 },
    ]);
    expect(result.result?.netChanges.reduce((sum, change) => sum + change.amount, 0)).toBe(0);
    expect(result.players.every(p => p.handContribution === 0 && p.streetContribution === 0)).toBe(true);
  });

  it('završava all-in showdown kada niko više ne može da odlučuje', () => {
    const result = settleHand(hand([
      player('A', 0, ['As', 'Ad'], 1000, { status: 'all_in' }),
      player('B', 1, ['Ks', 'Kd'], 1000, { status: 'all_in' }),
    ], { buttonSeat: 0 }));

    expect(result.result?.reason).toBe('showdown');
    expect(result.players.map(p => p.stack)).toEqual([2000, 0]);
    expect(result.result?.revealedCards).toHaveLength(2);
  });

  it('AC16 završava odmah posle folda, bez board-a i otkrivanja karata', () => {
    const result = settleHand(hand([
      player('A', 0, ['As', 'Ad'], 5, { status: 'folded' }),
      player('B', 1, ['Ks', 'Kd'], 10),
    ], { phase: 'preflop', board: [], buttonSeat: 0 }));

    expect(result.result?.reason).toBe('uncontested');
    expect(result.result?.refunds).toEqual([{ playerId: 'B', amount: 5 }]);
    expect(result.result?.pots[0]?.payouts).toEqual([{ playerId: 'B', amount: 10 }]);
    expect(result.players.map(p => p.stack)).toEqual([995, 1005]);
    expect(result.result?.revealedCards).toEqual([]);
  });

  it('ponovljeni settlement ne menja rezultat ili stackove', () => {
    const once = settleHand(hand([
      player('A', 0, ['As', 'Ad'], 10), player('B', 1, ['Ks', 'Kd'], 10),
    ]));
    expect(settleHand(once)).toEqual(once);
  });

  it('ne postavlja result/status kada stanje još nije terminalno', () => {
    const active = hand([
      player('A', 0, ['As', 'Ad'], 10), player('B', 1, ['Ks', 'Kd'], 10),
    ], { phase: 'flop', board: ['2c', '3d', '7h'], actorId: 'A' });
    expect(() => settleHand(active)).toThrow();
    expect(active.result).toBeNull();
    expect(active.phase).toBe('flop');
  });
});
