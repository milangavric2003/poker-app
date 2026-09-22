import { legalActions } from './engine/betting.js';
import type { GameState } from './session.js';
import type { GameView, HandResult } from '../../shared/contracts.js';

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
    events: game.history.current.events.map(event => ({ ...event })),
    result: hand.result as HandResult | null,
    previousResult: game.previousResult as HandResult | null,
  };
}
