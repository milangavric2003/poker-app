import type { BettingPlayer, BettingState, Card, Player, RandomSource } from '../../backend/src/engine/types.js';
export function player(id: string, seat: number, patch: Partial<BettingPlayer> = {}): BettingPlayer {
  return { id, seat, stack: 1000, streetContribution: 0, handContribution: 0,
    status: 'active', acted: false, lastFacedBet: 0, ...patch };
}
export function handPlayer(id: string, seat: number, holeCards: Card[],
  patch: Partial<Player> = {}): Player {
  return { ...player(id, seat), kind: id === 'A' ? 'human' : 'bot', holeCards,
    stackAtHandStart: 1000, ...patch };
}
export function betting(players: BettingPlayer[], patch: Partial<BettingState> = {}): BettingState {
  return { players, currentBet: 0, lastFullRaise: 10, actorId: players[0]?.id ?? null,
    pendingActors: players.filter(p => p.status === 'active' && p.stack > 0).map(p => p.id), ...patch };
}
export function headsUp(): BettingState {
  return betting([player('A', 0, { stack: 995, streetContribution: 5, handContribution: 5 }),
    player('B', 1, { stack: 990, streetContribution: 10, handContribution: 10 })], { currentBet: 10 });
}
export function sequenceRandom(values: readonly number[], cursor = 0): RandomSource {
  return {
    next() {
      const value = values[cursor++];
      if (value === undefined || value < 0 || value >= 1) throw new Error('Invalid/exhausted random fixture');
      return value;
    },
    clone: () => sequenceRandom(values, cursor),
  };
}
export const ac23Deck: readonly Card[] = ['Kc','As','Kd','Ah','6c','2c','3d','7h','8c','9s','Tc','Jc'];
// Shared oracle data, not member B's evaluator implementation or tests.
export const evaluatorOracles = [
  { id: 'EV01A', cards: ['2c','3d','4h','5s','Kc','Ah','Qd'], rank: [4,5] },
  { id: 'EV01B', cards: ['2c','3d','4h','5s','Kc','6h','Jd'], rank: [4,6] },
  { id: 'EV02A', cards: ['Kc','Kd','8h','5s','2c','Ah','Qd'], rank: [1,13,14,12,8] },
  { id: 'EV02B', cards: ['Kc','Kd','8h','5s','2c','Jh','Td'], rank: [1,13,11,10,8] },
  { id: 'EV03', cards: ['As','Ah','Ad','Ks','Kh','Kd','2c'], rank: [6,14,13] },
  { id: 'EV04', cards: ['As','Ah','Ks','Kh','Qs','Qh','2c'], rank: [2,14,13,12] },
  { id: 'EV05', cards: ['Ac','Kd','Qh','Js','2c','7d','8h'], rank: [0,14,13,12,11,8] },
  { id: 'EV06', cards: ['9c','9d','9h','As','Kd','4c','2h'], rank: [3,9,14,13] },
  { id: 'EV07', cards: ['Ah','Jh','8h','5h','2h','Kc','Qd'], rank: [5,14,11,8,5,2] },
  { id: 'EV08', cards: ['7c','7d','7h','7s','Ac','Kd','2h'], rank: [7,7,14] },
  { id: 'EV09', cards: ['5s','6s','7s','8s','9s','Ad','Kc'], rank: [8,9] },
  { id: 'EV10A', cards: ['As','Ks','Qs','Js','Ts','2c','3d'], rank: [8,14] },
  { id: 'EV10B', cards: ['As','Ks','Qs','Js','Ts','Ah','Ad'], rank: [8,14] },
] satisfies { id: string; cards: Card[]; rank: number[] }[];
export const positionOracles = [
  { id: 'BL01', active: [0,1,2,3,4,5], previous: [0,1,2], out: [], next: [1,2,3], actors: [4,2] },
  { id: 'BL02', active: [0,1,2,3,4,5], previous: [0,1,2], out: [0], next: [1,2,3], actors: [4,2] },
  { id: 'BL03', active: [0,1,2,3,4,5], previous: [0,1,2], out: [1], next: [1,2,3], actors: [4,2] },
  { id: 'BL04', active: [0,1,2,3,4,5], previous: [0,1,2], out: [2], next: [1,2,3], actors: [4,3] },
  { id: 'BL05', active: [0,1,2,3,4,5], previous: [0,1,2], out: [1,2,3], next: [1,2,4], actors: [5,4] },
  { id: 'BL06', active: [0,1,3,4,5], previous: [1,2,3], out: [], next: [2,3,4], actors: [5,3] },
  { id: 'BL07', active: [0,1,2], previous: [0,1,2], out: [0], next: [2,2,1], actors: [2,1] },
  { id: 'BL08', active: [0,1,2], previous: [0,1,2], out: [1], next: [2,2,0], actors: [2,0] },
  { id: 'BL09', active: [0,1,2], previous: [0,1,2], out: [2], next: [1,1,0], actors: [1,0] },
  { id: 'BL10', active: [0,1], previous: [0,0,1], out: [], next: [1,1,0], actors: [1,0] },
];
