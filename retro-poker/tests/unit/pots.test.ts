import { describe, expect, it } from 'vitest';
import { settlePots } from '../../backend/src/engine/pots.js';
import type { Card, Player, PotSettlementState } from '../../backend/src/engine/types.js';
import { handPlayer } from '../helpers/fixtures.js';

const board = ['2c', '3d', '7h', '9s', 'Jc'] satisfies Card[];

function state(players: Player[], patch: Partial<PotSettlementState> = {}): PotSettlementState {
  return { players, board, buttonSeat: 2, settled: false, pots: [], refunds: [], ...patch };
}

function contributed(id: string, seat: number, cards: Card[], amount: number,
  patch: Partial<Player> = {}): Player {
  return handPlayer(id, seat, cards, { stack: 1000 - amount, stackAtHandStart: 1000,
    streetContribution: amount, handContribution: amount, ...patch });
}

describe('T010 potovi — unapred izračunati AC11–AC13 oracle-i', () => {
  it('AC11 pravi glavni i side pot na svakom nivou doprinosa', () => {
    const settled = settlePots(state([
      contributed('A', 0, ['As', 'Ad'], 100),
      contributed('B', 1, ['Ks', 'Kd'], 250),
      contributed('C', 2, ['Qs', 'Qd'], 250),
    ]));

    expect(settled.pots).toEqual([
      { id: 'pot-1', amount: 300, eligibleIds: ['A', 'B', 'C'], winnerIds: ['A'],
        payouts: [{ playerId: 'A', amount: 300 }] },
      { id: 'pot-2', amount: 300, eligibleIds: ['B', 'C'], winnerIds: ['B'],
        payouts: [{ playerId: 'B', amount: 300 }] },
    ]);
    expect(settled.players.map(p => [p.id, p.stack])).toEqual([['A', 1200], ['B', 1050], ['C', 750]]);
  });

  it('AC12 vraća neupareni višak 120 i isplaćuje pot 160', () => {
    const settled = settlePots(state([
      contributed('A', 0, ['As', 'Ad'], 200),
      contributed('B', 1, ['Ks', 'Kd'], 80, { status: 'all_in' }),
    ]));

    expect(settled.refunds).toEqual([{ playerId: 'A', amount: 120 }]);
    expect(settled.pots).toEqual([{ id: 'pot-1', amount: 160, eligibleIds: ['A', 'B'],
      winnerIds: ['A'], payouts: [{ playerId: 'A', amount: 160 }] }]);
    expect(settled.players.map(p => [p.id, p.stack])).toEqual([['A', 1080], ['B', 920]]);
  });

  it('AC13 uključuje foldovan doprinos i daje neparni žeton prvom pobedniku levo od button-a', () => {
    const royalBoard = ['As', 'Ks', 'Qs', 'Js', 'Ts'] satisfies Card[];
    const settled = settlePots(state([
      contributed('A', 0, ['2c', '3d'], 5),
      contributed('B', 1, ['4c', '5d'], 5),
      contributed('C', 2, ['6c', '7d'], 5, { status: 'folded' }),
    ], { board: royalBoard }));

    expect(settled.pots[0]).toEqual({ id: 'pot-1', amount: 15, eligibleIds: ['A', 'B'],
      winnerIds: ['A', 'B'], payouts: [{ playerId: 'A', amount: 8 }, { playerId: 'B', amount: 7 }] });
    expect(settled.players.map(p => [p.id, p.stack])).toEqual([['A', 1003], ['B', 1002], ['C', 995]]);
  });

  it('deli svaki od više tied side potova zasebno, sa različitim eligible skupovima', () => {
    const royalBoard = ['As', 'Ks', 'Qs', 'Js', 'Ts'] satisfies Card[];
    const settled = settlePots(state([
      contributed('A', 0, ['2c', '3d'], 5),
      contributed('B', 1, ['4c', '5d'], 10),
      contributed('C', 2, ['6c', '7d'], 10),
      contributed('D', 3, ['8c', '9d'], 15),
      contributed('E', 4, ['2d', '3h'], 15, { status: 'folded' }),
    ], { board: royalBoard, buttonSeat: 4 }));

    expect(settled.pots).toEqual([
      { id: 'pot-1', amount: 25, eligibleIds: ['A', 'B', 'C', 'D'], winnerIds: ['A', 'B', 'C', 'D'],
        payouts: [{ playerId: 'A', amount: 7 }, { playerId: 'B', amount: 6 },
          { playerId: 'C', amount: 6 }, { playerId: 'D', amount: 6 }] },
      { id: 'pot-2', amount: 20, eligibleIds: ['B', 'C', 'D'], winnerIds: ['B', 'C', 'D'],
        payouts: [{ playerId: 'B', amount: 7 }, { playerId: 'C', amount: 7 },
          { playerId: 'D', amount: 6 }] },
      { id: 'pot-3', amount: 10, eligibleIds: ['D'], winnerIds: ['D'],
        payouts: [{ playerId: 'D', amount: 10 }] },
    ]);
  });

  it('ponovljeni settlement vraća isto stanje i ne isplaćuje žetone dvaput', () => {
    const initial = state([
      contributed('A', 0, ['As', 'Ad'], 100),
      contributed('B', 1, ['Ks', 'Kd'], 100),
    ]);
    const once = settlePots(initial);
    const twice = settlePots(once);

    expect(twice).toEqual(once);
    expect(twice.players.reduce((sum, p) => sum + p.stack + p.handContribution, 0)).toBe(2000);
    expect(initial.settled).toBe(false);
    expect(initial.players.map(p => p.stack)).toEqual([900, 900]);
  });

  it('odbija negativne, razlomljene i nebezbedne chip vrednosti bez mutacije', () => {
    for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const input = state([contributed('A', 0, ['As', 'Ad'], 0),
        contributed('B', 1, ['Ks', 'Kd'], 0)]);
      input.players[0]!.handContribution = invalid;
      expect(() => settlePots(input)).toThrow();
      expect(input.players[0]!.stack).toBe(1000);
    }
  });
});
