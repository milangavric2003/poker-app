import { describe, expect, it } from 'vitest';
import { settleHand } from '../../backend/src/engine/hand.js';
import type { Card, HandState } from '../../backend/src/engine/types.js';
import { handPlayer } from '../helpers/fixtures.js';

const royal = ['As', 'Ks', 'Qs', 'Js', 'Ts'] satisfies Card[];

describe('T012 settlement invarijante', () => {
  it.each([
    [5, 5, 5], [10, 20, 20], [1, 2, 3], [80, 200, 200], [333, 777, 1000],
  ])('čuva celobrojne žetone za generisani legalni doprinos %j', (a, b, c) => {
    const contributions = [a, b, c];
    const players = contributions.map((amount, seat) => handPlayer(String.fromCharCode(65 + seat), seat,
      ([['2c', '3d'], ['4c', '5d'], ['6c', '7d']][seat] as Card[]), {
        stack: 1000 - amount, stackAtHandStart: 1000, streetContribution: amount,
        handContribution: amount, status: amount === 1000 ? 'all_in' : 'active',
      }));
    const input: HandState = { handId: `hand-${a}-${b}-${c}`, phase: 'river', buttonSeat: 2,
      board: royal, players, actorId: null, settled: false, result: null, gameStatus: 'playing' };

    const output = settleHand(input);
    expect(output.players.reduce((sum, p) => sum + p.stack + p.handContribution, 0)).toBe(3000);
    expect(output.players.every(p => Number.isSafeInteger(p.stack) && p.stack >= 0
      && p.handContribution === 0 && p.streetContribution === 0)).toBe(true);
    expect(output.result?.netChanges.reduce((sum, change) => sum + change.amount, 0)).toBe(0);
  });

  it('odbija razlomljene žetone bez delimične isplate', () => {
    const bad = handPlayer('A', 0, ['As', 'Ad'], { stack: 999.5, stackAtHandStart: 1000,
      streetContribution: 0.5, handContribution: 0.5 });
    const other = handPlayer('B', 1, ['Ks', 'Kd']);
    const input: HandState = { handId: 'bad', phase: 'river', buttonSeat: 0, board: royal,
      players: [bad, other], actorId: null, settled: false, result: null, gameStatus: 'playing' };
    expect(() => settleHand(input)).toThrow();
    expect(input.players.map(p => p.stack)).toEqual([999.5, 1000]);
    expect(input.result).toBeNull();
  });
});
