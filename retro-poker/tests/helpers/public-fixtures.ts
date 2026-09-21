export const gameId = '11111111-1111-4111-8111-111111111111';
export const handId = '22222222-2222-4222-8222-222222222222';

export function publicView() {
  return {
    gameId, handId, version: 0, botCount: 1, handNumber: 1, status: 'playing', phase: 'preflop',
    buttonSeat: 0, smallBlindSeat: 0, bigBlindSeat: 1, actorId: 'p0', board: [],
    players: [
      { id: 'p0', seat: 0, kind: 'human', stack: 995, streetContribution: 5,
        handContribution: 5, status: 'active', cards: ['As', 'Ah'] },
      { id: 'p1', seat: 1, kind: 'bot', stack: 990, streetContribution: 10,
        handContribution: 10, status: 'active', cards: null },
    ],
    totalPot: 15,
    pots: [
      { id: 'main', amount: 10, contributionCap: 5, contributorIds: ['p0', 'p1'], eligibleIds: ['p0', 'p1'] },
      { id: 'uncalled', amount: 5, contributionCap: 10, contributorIds: ['p1'], eligibleIds: ['p1'] },
    ],
    legalActions: [{ type: 'fold' }, { type: 'call', payAmount: 5, isAllIn: false }],
    events: [{ seq: 1, handId, street: 'preflop', type: 'hand_started', number: 1,
      buttonSeat: 0, smallBlindSeat: 0, bigBlindSeat: 1 }],
    result: null, previousResult: null,
  };
}

export function handResult() {
  return { handId, reason: 'showdown', gameStatus: 'playing',
    pots: [{ id: 'main', amount: 20, eligibleIds: ['p0', 'p1'], winnerIds: ['p0'],
      payouts: [{ playerId: 'p0', amount: 20 }] }], refunds: [],
    revealedCards: [{ playerId: 'p0', cards: ['As', 'Ah'] }, { playerId: 'p1', cards: ['Kc', 'Kd'] }],
    netChanges: [{ playerId: 'p0', amount: 10 }, { playerId: 'p1', amount: -10 }],
  };
}
