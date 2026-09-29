import { afterAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { BotActionProposalSchema, botProposalJsonSchema } from '../../backend/src/ai/schemas.js';

const identity = { gameId: '00000000-0000-4000-8000-000000000001',
  handId: '00000000-0000-4000-8000-000000000002', actorId: 'bot-1', expectedVersion: 2, decisionOrdinal: 1 };
// Use Fastify's JSON Schema validator with property stripping disabled. Converting
// anyOf to Zod objects would silently strip unknown fields instead of rejecting them.
const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
app.post('/validate', { schema: { body: botProposalJsonSchema } }, async (_request, reply) => reply.code(204).send());
afterAll(async () => { await app.close(); });
async function accepts(payload: unknown): Promise<boolean> {
  return (await app.inject({ method: 'POST', url: '/validate', payload: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' } })).statusCode === 204;
}
describe('provider and local bot schema agreement', () => {
  it.each(['fold', 'check', 'call', 'all_in'])('permits %s only without amountTo', async type => {
    const valid = { ...identity, type };
    const invalid = { ...identity, type, amountTo: 1000 };
    expect(await accepts(valid)).toBe(true);
    expect(BotActionProposalSchema.safeParse(valid).success).toBe(true);
    expect(await accepts(invalid)).toBe(false);
    expect(BotActionProposalSchema.safeParse(invalid).success).toBe(false);
  });
  it.each(['bet', 'raise'])('requires amountTo for %s', async type => {
    expect(await accepts({ ...identity, type, amountTo: 20 })).toBe(true);
    expect(await accepts({ ...identity, type })).toBe(false);
    expect(BotActionProposalSchema.safeParse({ ...identity, type }).success).toBe(false);
  });
});
