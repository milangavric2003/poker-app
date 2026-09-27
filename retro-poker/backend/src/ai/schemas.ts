import { z } from 'zod';
import { MatchAnalysisSchema } from '../../../shared/contracts.js';

const Identity = { gameId: z.uuid(), handId: z.uuid(), expectedVersion: z.number().int().min(0),
  actorId: z.string().min(1) };
export const BotActionProposalSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...Identity, type: z.literal('fold') }),
  z.strictObject({ ...Identity, type: z.literal('check') }),
  z.strictObject({ ...Identity, type: z.literal('call') }),
  z.strictObject({ ...Identity, type: z.literal('all_in') }),
  z.strictObject({ ...Identity, type: z.literal('bet'), amountTo: z.number().int().min(1).max(6000) }),
  z.strictObject({ ...Identity, type: z.literal('raise'), amountTo: z.number().int().min(1).max(6000) }),
]);
export const botProposalJsonSchema = Object.freeze({ type: 'object', additionalProperties: false,
  required: ['gameId', 'handId', 'expectedVersion', 'actorId', 'type'] });
export const analysisJsonSchema = Object.freeze({ type: 'object', additionalProperties: false,
  required: ['summary', 'goodDecisions', 'possibleMistakes', 'nextSteps'] });
export const ProviderMatchAnalysisSchema = MatchAnalysisSchema.omit({ disclaimer: true });
export { MatchAnalysisSchema };

export function parseProviderCandidate(candidate: unknown): unknown {
  if (typeof candidate !== 'string') return candidate;
  try { return JSON.parse(candidate) as unknown; }
  catch { throw new Error('MALFORMED_JSON'); }
}
