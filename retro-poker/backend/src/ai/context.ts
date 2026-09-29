import type { ActiveHand } from '../engine/hand.js';
import type { GameState } from '../session.js';
import type { BotDecisionContext } from './types.js';
import { buildBotObservation } from '../bots/strategy.js';
import type { PublicEvent } from '../../../shared/contracts.js';

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

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
  const phase = game.hand.phase;
  if (!actor || phase === 'complete') throw new Error('Invalid bot context');
  const observation = buildBotObservation(game.hand, actorId, game.history.current.events.slice(-64));
  const context: BotDecisionContext = { gameId: game.gameId, handId: game.hand.handId,
    expectedVersion: game.version, actorId, decisionOrdinal, phase,
    board: [...observation.board], pots: pots(game.hand), players: observation.players.map(p => ({
      id: p.id, seat: p.seat, kind: p.kind, stack: p.stack, streetContribution: p.streetContribution,
      handContribution: p.handContribution, status: p.status })),
    holeCards: [observation.holeCards[0]!, observation.holeCards[1]!],
    legalActions: structuredClone(observation.legalActions),
    history: structuredClone(observation.history) as PublicEvent[] };
  return deepFreeze(structuredClone(context));
}
