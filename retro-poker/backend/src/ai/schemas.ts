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
const identityProperties = { gameId: { type: 'string', format: 'uuid' },
  handId: { type: 'string', format: 'uuid' }, expectedVersion: { type: 'integer', minimum: 0 },
  actorId: { type: 'string', minLength: 1 } };
export const botProposalJsonSchema = Object.freeze({ type: 'object', additionalProperties: false,
  properties: { ...identityProperties, type: { type: 'string',
    enum: ['fold', 'check', 'call', 'all_in', 'bet', 'raise'] },
  amountTo: { type: 'integer', minimum: 1, maximum: 6000 } },
  required: ['gameId', 'handId', 'expectedVersion', 'actorId', 'type'] });
const analysisItem = { type: 'object', additionalProperties: false,
  properties: { decisionRef: { type: 'string', minLength: 1 },
    explanation: { type: 'string', minLength: 1, maxLength: 600 } },
  required: ['decisionRef', 'explanation'] };
export const analysisJsonSchema = Object.freeze({ type: 'object', additionalProperties: false,
  properties: { summary: { type: 'string', minLength: 1, maxLength: 1200 },
    goodDecisions: { type: 'array', maxItems: 6, items: analysisItem },
    possibleMistakes: { type: 'array', maxItems: 6, items: analysisItem },
    nextSteps: { type: 'array', minItems: 1, maxItems: 6,
      items: { type: 'string', minLength: 1, maxLength: 300 } } },
  required: ['summary', 'goodDecisions', 'possibleMistakes', 'nextSteps'] });
export const ProviderMatchAnalysisSchema = MatchAnalysisSchema.omit({ disclaimer: true });
export { MatchAnalysisSchema };

export function parseProviderCandidate(candidate: unknown): unknown {
  if (typeof candidate !== 'string') return candidate;
  try { return JSON.parse(candidate) as unknown; }
  catch { throw new Error('MALFORMED_JSON'); }
}
