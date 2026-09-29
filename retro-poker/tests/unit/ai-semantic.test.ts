import { describe, expect, it } from 'vitest';
import { BotActionProposalSchema, botProposalJsonSchema,
  parseProviderCandidate } from '../../backend/src/ai/schemas.js';
import { validateBotProposal } from '../../backend/src/ai/semantic.js';
import type { BotDecisionContext } from '../../backend/src/ai/types.js';

const context = {
  gameId: '11111111-1111-4111-8111-111111111111',
  handId: '22222222-2222-4222-8222-222222222222',
  expectedVersion: 3,
  actorId: 'bot-1',
  decisionOrdinal: 7,
  phase: 'preflop',
  board: [],
  pots: [],
  players: [],
  holeCards: ['As', 'Kd'],
  history: [],
  legalActions: [
    { type: 'fold' },
    { type: 'call', payAmount: 10, isAllIn: false },
    { type: 'raise', minAmountTo: 20, maxAmountTo: 100 },
  ],
} as BotDecisionContext;

const proposal = {
  gameId: context.gameId,
  handId: context.handId,
  expectedVersion: context.expectedVersion,
  actorId: context.actorId,
  decisionOrdinal: context.decisionOrdinal,
  type: 'raise' as const,
  amountTo: 20,
};

function parse(value: unknown) {
  const result = BotActionProposalSchema.safeParse(value);
  return result.success ? result.data : null;
}

describe('strict BotActionProposal schema', () => {
  it('parses JSON separately and rejects malformed content', () => {
    expect(parseProviderCandidate(JSON.stringify(proposal))).toEqual(proposal);
    expect(() => parseProviderCandidate('{not-json')).toThrow('MALFORMED_JSON');
  });

  it('requires the complete immutable decision fingerprint', () => {
    expect(parse(proposal)).toEqual(proposal);
    for (const field of ['gameId', 'handId', 'expectedVersion', 'actorId', 'decisionOrdinal'] as const) {
      const candidate = { ...proposal } as Record<string, unknown>;
      delete candidate[field];
      expect(parse(candidate), `missing ${field}`).toBeNull();
    }
  });

  it('rejects unknown fields, unsupported types and invalid amount shapes', () => {
    expect(parse({ ...proposal, rawResponse: '{}' })).toBeNull();
    expect(parse({ ...proposal, type: 'dance' })).toBeNull();
    expect(parse({ ...proposal, type: 'raise', amountTo: 19.5 })).toBeNull();
    expect(parse({ ...proposal, type: 'raise', amountTo: 0 })).toBeNull();
    expect(parse({ ...proposal, type: 'check', amountTo: 20 })).toBeNull();
    expect(parse({ ...proposal, type: 'raise', amountTo: undefined })).toBeNull();
  });

  it('publishes a strict manual provider schema with the decision ordinal', () => {
    expect(botProposalJsonSchema.anyOf).toHaveLength(2);
    for (const variant of botProposalJsonSchema.anyOf) {
      expect(variant).toMatchObject({ additionalProperties: false,
        properties: { decisionOrdinal: { type: 'integer', minimum: 1 } } });
      expect(variant.required).toContain('decisionOrdinal');
    }
  });
});

describe('BotActionProposal semantic validation', () => {
  it('accepts matching identity and both inclusive raise bounds', () => {
    for (const amountTo of [20, 100]) {
      const parsed = BotActionProposalSchema.parse({ ...proposal, amountTo });
      expect(validateBotProposal(parsed, context)).toEqual({ type: 'raise', amountTo });
    }
  });

  it.each([
    ['gameId', '33333333-3333-4333-8333-333333333333'],
    ['handId', '44444444-4444-4444-8444-444444444444'],
    ['expectedVersion', 2],
    ['actorId', 'bot-2'],
    ['decisionOrdinal', 6],
  ] as const)('rejects a stale or mismatched %s', (field, value) => {
    const parsed = BotActionProposalSchema.parse({ ...proposal, [field]: value });
    expect(validateBotProposal(parsed, context)).toBeNull();
  });

  it('rejects unavailable action types and amounts outside current engine bounds', () => {
    const checkCandidate = { ...proposal } as Record<string, unknown>;
    delete checkCandidate.amountTo;
    checkCandidate.type = 'check';
    expect(validateBotProposal(BotActionProposalSchema.parse(checkCandidate), context)).toBeNull();
    for (const amountTo of [19, 101]) {
      const parsed = BotActionProposalSchema.parse({ ...proposal, amountTo });
      expect(validateBotProposal(parsed, context)).toBeNull();
    }
  });

  it('does not mutate context, accepted history, version or RNG-like state on rejection', () => {
    const beforeContext = structuredClone(context);
    const state = { version: 3, acceptedHistory: [{ type: 'blind_posted', seq: 1 }],
      rng: { cursor: 4 }, clone: { hand: structuredClone(context) } };
    const beforeState = structuredClone(state);
    const rejected = BotActionProposalSchema.parse({ ...proposal, decisionOrdinal: 6 });

    expect(validateBotProposal(rejected, context)).toBeNull();
    expect(context).toEqual(beforeContext);
    expect(state).toEqual(beforeState);
  });
});
