import { describe, expect, it } from 'vitest';
import { validateBotProposal } from '../../backend/src/ai/semantic.js';
import type { BotDecisionContext } from '../../backend/src/ai/types.js';

const context = { gameId: '11111111-1111-4111-8111-111111111111', handId: '22222222-2222-4222-8222-222222222222',
  expectedVersion: 3, actorId: 'bot', decisionOrdinal: 1, phase: 'preflop', board: [], pots: [], players: [],
  holeCards: ['As', 'Kd'], history: [], legalActions: [{ type: 'raise', minAmountTo: 20, maxAmountTo: 100 }] } as BotDecisionContext;
describe('AI semantic validation', () => {
  it('accepts only matching identity and legal bounds', () => {
    expect(validateBotProposal({ gameId: context.gameId, handId: context.handId, expectedVersion: 3,
      actorId: 'bot', type: 'raise', amountTo: 20 }, context)).toEqual({ type: 'raise', amountTo: 20 });
    expect(validateBotProposal({ gameId: context.gameId, handId: context.handId, expectedVersion: 2,
      actorId: 'bot', type: 'raise', amountTo: 20 }, context)).toBeNull();
    expect(validateBotProposal({ gameId: context.gameId, handId: context.handId, expectedVersion: 3,
      actorId: 'bot', type: 'raise', amountTo: 19 }, context)).toBeNull();
  });
});
