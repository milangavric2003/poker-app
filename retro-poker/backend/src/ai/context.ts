import { legalActions } from '../engine/betting.js';
import type { ActiveHand } from '../engine/hand.js';
import type { GameState } from '../session.js';
import type { BotDecisionContext } from './types.js';

function pots(hand: ActiveHand): BotDecisionContext['pots'] {
  const levels = [...new Set(hand.players.map(p => p.handContribution).filter(n => n > 0))].sort((a, b) => a - b);
  let previous = 0;
  return levels.map((level, index) => {
    const contributors = hand.players.filter(p => p.handContribution >= level);
    const value = { id: `pot-${index + 1}`, amount: (level - previous) * contributors.length,
      contributionCap: level, contributorIds: contributors.map(p => p.id),
      eligibleIds: contributors.filter(p => p.status !== 'folded' && p.status !== 'eliminated').map(p => p.id) };
    previous = level; return value;
  });
}
export function buildBotDecisionContext(game: GameState, actorId: string,
  decisionOrdinal: number): BotDecisionContext {
  const actor = game.hand.players.find(p => p.id === actorId && p.kind === 'bot');
  if (!actor || game.hand.phase === 'complete') throw new Error('Invalid bot context');
  const context: BotDecisionContext = { gameId: game.gameId, handId: game.hand.handId,
    expectedVersion: game.version, actorId, decisionOrdinal, phase: game.hand.phase,
    board: [...game.hand.board], pots: pots(game.hand), players: game.hand.players.map(p => ({
      id: p.id, seat: p.seat, kind: p.kind, stack: p.stack, streetContribution: p.streetContribution,
      handContribution: p.handContribution, status: p.status })),
    holeCards: [actor.holeCards[0]!, actor.holeCards[1]!], legalActions: legalActions(game.hand, actorId),
    history: game.history.current.events.slice(-64).map(event => structuredClone(event)) };
  return structuredClone(context);
}
