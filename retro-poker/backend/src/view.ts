import { legalActions } from './engine/betting.js';
import type { GameState } from './session.js';
import type { GameView, HandResult, PublicEvent } from '../../shared/contracts.js';

function publicResult(result: GameState['previousResult']): HandResult | null {
  if (!result) return null;
  return { handId: result.handId, reason: result.reason, gameStatus: result.gameStatus,
    pots: result.pots.map(p => ({ id: p.id, amount: p.amount, eligibleIds: [...p.eligibleIds],
      winnerIds: [...p.winnerIds], payouts: p.payouts.map(a => ({ playerId: a.playerId, amount: a.amount })) })),
    refunds: result.refunds.map(a => ({ playerId: a.playerId, amount: a.amount })),
    revealedCards: result.reason === 'showdown' ? result.revealedCards.map(a => ({ playerId: a.playerId, cards: [a.cards[0]!, a.cards[1]!] })) : [],
    netChanges: result.netChanges.map(a => ({ playerId: a.playerId, amount: a.amount })) };
}
function publicEvent(event: PublicEvent): PublicEvent {
  const base = { seq: event.seq, handId: event.handId, street: event.street };
  switch (event.type) {
    case 'hand_started': return { ...base, type: event.type, number: event.number, buttonSeat: event.buttonSeat, smallBlindSeat: event.smallBlindSeat, bigBlindSeat: event.bigBlindSeat };
    case 'blind_posted': return { ...base, type: event.type, playerId: event.playerId, blind: event.blind, amount: event.amount };
    case 'action': return { ...base, type: event.type, playerId: event.playerId, actionType: event.actionType, payAmount: event.payAmount, amountTo: event.amountTo };
    case 'board_dealt': return { ...base, type: event.type, cards: [...event.cards] };
    case 'refund': return { ...base, type: event.type, playerId: event.playerId, amount: event.amount };
    case 'settled': return { ...base, type: event.type, reason: event.reason };
  }
}

function currentPots(game: GameState): GameView['pots'] {
  const levels = [...new Set(game.hand.players.map(player => player.handContribution)
    .filter(amount => amount > 0))].sort((a, b) => a - b);
  let previous = 0;
  return levels.map((level, index) => {
    const contributors = game.hand.players.filter(player => player.handContribution >= level);
    const contributorIds = contributors.map(player => player.id);
    const eligibleIds = contributors.filter(player => player.status !== 'folded'
      && player.status !== 'eliminated').map(player => player.id);
    const amount = (level - previous) * contributors.length;
    previous = level;
    return { id: `pot-${index + 1}`, amount, contributionCap: level,
      contributorIds, eligibleIds };
  });
}

export function toGameView(game: GameState): GameView {
  const hand = game.hand;
  const showdown = hand.result?.reason === 'showdown';
  const revealed = new Map(hand.result?.revealedCards.map(item => [item.playerId, item.cards]) ?? []);
  const pots = currentPots(game);
  const human = hand.players.find(player => player.kind === 'human');
  return {
    gameId: game.gameId, handId: hand.handId, version: game.version,
    botCount: game.botCount, handNumber: game.handNumber, status: hand.gameStatus,
    phase: hand.phase, buttonSeat: hand.buttonSeat, smallBlindSeat: hand.smallBlindSeat,
    bigBlindSeat: hand.bigBlindSeat, actorId: hand.actorId, board: [...hand.board],
    players: hand.players.map(player => ({
      id: player.id, seat: player.seat, kind: player.kind, stack: player.stack,
      streetContribution: player.streetContribution, handContribution: player.handContribution,
      status: player.status,
      cards: player.kind === 'human' ? [player.holeCards[0]!, player.holeCards[1]!]
        : showdown && player.status !== 'folded' ? revealed.get(player.id) ?? null : null,
    })),
    totalPot: pots.reduce((sum, pot) => sum + pot.amount, 0), pots,
    legalActions: human && hand.actorId === human.id ? legalActions(hand, human.id) : [],
    events: game.history.current.events.map(publicEvent),
    result: publicResult(hand.result),
    previousResult: publicResult(game.previousResult),
  };
}
