import { settlePots } from './pots.js';
import type { Card, HandResult, HandState, Player } from './types.js';

function gameStatus(players: readonly Player[]): HandState['gameStatus'] {
  const human = players.find(player => player.kind === 'human');
  if (!human) throw new Error('Hand has no human player');
  if (human.stack === 0) return 'lost';
  if (players.every(player => player.kind === 'human' || player.stack === 0)) return 'won';
  return 'playing';
}

export function settleHand(hand: HandState): HandState {
  if (hand.settled) {
    if (!hand.result || hand.phase !== 'complete') throw new Error('Invalid settled hand');
    return hand;
  }
  if (hand.result || hand.phase === 'complete') throw new Error('Invalid unsettled hand');
  const contenders = hand.players.filter(player => player.status !== 'folded'
    && player.status !== 'eliminated');
  const reason: HandResult['reason'] = contenders.length === 1 ? 'uncontested' : 'showdown';
  const terminalShowdown = hand.phase === 'river' && hand.actorId === null;
  if (reason === 'showdown' && !terminalShowdown) throw new Error('Hand is not ready for settlement');

  const paid = settlePots({ players: hand.players, board: hand.board,
    buttonSeat: hand.buttonSeat, settled: false, pots: [], refunds: [] });
  const netChanges = paid.players.map(player => ({ playerId: player.id,
    amount: player.stack - player.stackAtHandStart }));
  if (netChanges.reduce((sum, change) => sum + change.amount, 0) !== 0) {
    throw new Error('Net changes are not balanced');
  }
  const status = gameStatus(paid.players);
  const players = paid.players.map(player => ({ ...player,
    status: player.stack === 0 ? 'eliminated' : player.status } as Player));
  const revealedCards = reason === 'showdown' ? contenders.map(player => {
    if (player.holeCards.length !== 2) throw new Error('Invalid showdown cards');
    return { playerId: player.id,
      cards: [player.holeCards[0]!, player.holeCards[1]!] as [Card, Card] };
  }) : [];
  const result = { handId: hand.handId, reason, gameStatus: status, pots: paid.pots,
    refunds: paid.refunds, revealedCards, netChanges };
  return { ...hand, players, actorId: null, settled: true, phase: 'complete',
    gameStatus: status, result };
}
