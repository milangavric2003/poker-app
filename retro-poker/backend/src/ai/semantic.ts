import type { PokerAction } from '../engine/types.js';
import type { BotActionProposal, BotDecisionContext } from './types.js';

export function validateBotProposal(proposal: BotActionProposal,
  context: BotDecisionContext): PokerAction | null {
  if (proposal.gameId !== context.gameId || proposal.handId !== context.handId
    || proposal.expectedVersion !== context.expectedVersion || proposal.actorId !== context.actorId
    || proposal.decisionOrdinal !== context.decisionOrdinal) return null;
  const legal = context.legalActions.find(action => action.type === proposal.type);
  if (!legal) return null;
  if (proposal.type === 'bet' || proposal.type === 'raise') {
    if (legal.type !== proposal.type || proposal.amountTo < legal.minAmountTo
      || proposal.amountTo > legal.maxAmountTo) return null;
    return { type: proposal.type, amountTo: proposal.amountTo };
  }
  return { type: proposal.type };
}
