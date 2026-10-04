import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { HumanDecisionFact, MatchFacts } from '../../backend/src/ai/match-facts.js';
import { DecisionEvidenceResultSchema, type DecisionEvidenceResult } from '../../shared/contracts.js';

const gameId = '00000000-0000-4000-8000-000000000001';
const handId = '00000000-0000-4000-8000-000000000002';
interface Snapshot { gameId: string; handId: string; expectedVersion: number;
  factsRevision: number; status: string; facts: MatchFacts; }
interface Controls { signal?: AbortSignal; now?: () => number; deadlineAt?: number; }
type Executor = (snapshot: Snapshot, args: unknown, controls?: Controls) => DecisionEvidenceResult;
type Validation = { status: 'valid' | 'insufficient_evidence'; result: DecisionEvidenceResult }
  | { status: 'rejected'; category: 'tool_validation' };
let validator: undefined | ((candidate: unknown, snapshot: Snapshot, args: unknown) => Validation);
let api: { getDecisionEvidence?: Executor; AGENT_TOOLS?: Record<string, { name: string; execute: Executor }> } = {};
beforeAll(async () => {
  const file = new URL('../../backend/src/agent/tools.ts', import.meta.url);
  if (existsSync(file)) api = await import(file.href);
  const validationFile = new URL('../../backend/src/agent/validation.ts', import.meta.url);
  if (existsSync(validationFile)) validator = (await import(validationFile.href)).validateDecisionEvidence;
});

function validate(candidate: unknown, input: Snapshot, args: unknown): Validation {
  expect(validator, 'Missing snapshot-bound tool result validator').toBeTypeOf('function');
  return validator!(candidate, input, args);
}
describe('snapshot-bound result validation and expected-first evals (T011)', () => {
  it('E1: accepts sufficient canonical betting evidence', () => {
    const candidate = expected('betting', [expectedDecision(2), expectedDecision(3, '{"type":"raise","amountTo":20}')]);
    expect(validate(candidate, snapshot(), { focus: 'betting', limit: 10 }))
      .toEqual({ status: 'valid', result: candidate });
  });
  it('E2: accepts newest evidence at lower limit', () => {
    const candidate = expected('betting', [expectedDecision(3, '{"type":"raise","amountTo":20}')], true);
    expect(validate(candidate, snapshot(), { focus: 'betting', limit: 1 }))
      .toEqual({ status: 'valid', result: candidate });
  });
  it('E3: accepts latest ten at upper limit', () => {
    const input = snapshot(Array.from({ length: 12 }, (_, i) => decision(i + 1)));
    const candidate = expected('street', Array.from({ length: 10 }, (_, i) => expectedDecision(i + 3)), true);
    expect(validate(candidate, input, { focus: 'street', limit: 10 })).toEqual({ status: 'valid', result: candidate });
  });
  it('E4: empty/aggregate-only source returns safe insufficient_evidence signal', () => {
    const input = snapshot([]);
    const candidate = expected('street', []);
    expect(validate(candidate, input, { focus: 'street', limit: 1 }))
      .toEqual({ status: 'insufficient_evidence', result: candidate });
    input.facts.aggregates = [{ handId, handNumber: 1, decisionCount: 100, actionCounts: { call: 100 },
      startingStack: 1000, endingStack: 0, humanNetChange: -1000 }];
    expect(validate({ ...candidate, sampleLimited: true }, input, { focus: 'street', limit: 1 }))
      .toEqual({ status: 'insufficient_evidence', result: { ...candidate, sampleLimited: true } });
  });
  it('E5: rejects foreign/stale evidence and oversized output', () => {
    const candidate = expected('street', [expectedDecision(1)]);
    const oversized = expected('street', Array.from({ length: 10 }, (_, i) => ({
      ...expectedDecision(i + 1), facts: expectedDecision(i + 1).facts.map(f => ({ ...f, finding: '😀'.repeat(500) })),
    })));
    for (const value of [{ ...candidate, decisions: [{ ...candidate.decisions[0], decisionRef: 'foreign:1' }] },
      { ...candidate, factsRevision: 19 }, oversized]) {
      expect(validate(value, snapshot([decision(1)]), { focus: 'street', limit: 1 }))
        .toEqual({ status: 'rejected', category: 'tool_validation' });
    }
  });
  it('rejects malformed/unknown fields/types, codes, findings, omitted facts and false empty output', () => {
    const candidate = expected('street', [expectedDecision(1)]);
    const first = candidate.decisions[0]!;
    const cases: unknown[] = [null, {}, { ...candidate, raw: 'private' }, { ...candidate, focus: 'betting' },
      { ...candidate, sampleLimited: 'false' }, { ...candidate, decisions: [] },
      { ...candidate, decisions: [first, first] }, { ...candidate, decisions: [{ ...first, raw: 'private' }] },
      { ...candidate, decisions: [{ ...first, facts: first.facts.slice(1) }] },
      { ...candidate, decisions: [{ ...first, facts: [...first.facts].reverse() }] },
      { ...candidate, decisions: [{ ...first, facts: [{ factCode: 'secret', finding: 'x' }] }] },
      { ...candidate, decisions: [{ ...first, facts: [{ factCode: 'phase', finding: 'invented' }] }] },
      { ...candidate, decisions: [{ ...first, facts: [{ factCode: 'phase', finding: '"flop"', raw: 'x' }] }] },
    ];
    for (const value of cases) expect(validate(value, snapshot([decision(1)]), { focus: 'street', limit: 1 }))
      .toEqual({ status: 'rejected', category: 'tool_validation' });
  });
  it('rejects valid-looking output from a different run snapshot, stale source, wrong limit/order/sample flag', () => {
    const input = snapshot([decision(1), decision(2)]);
    const candidate = expected('street', [expectedDecision(1), expectedDecision(2)]);
    const changed = structuredClone(input); changed.facts.decisions[0]!.chosenAction = { type: 'fold' };
    for (const [value, source, args] of [
      [candidate, changed, { focus: 'street', limit: 10 }],
      [candidate, { ...input, factsRevision: 19 }, { focus: 'street', limit: 10 }],
      [candidate, { ...input, status: 'playing' }, { focus: 'street', limit: 10 }],
      [candidate, { ...input, gameId: 'foreign' }, { focus: 'street', limit: 10 }],
      [candidate, input, { focus: 'street', limit: 1 }],
      [{ ...candidate, decisions: [...candidate.decisions].reverse() }, input, { focus: 'street', limit: 10 }],
      [{ ...candidate, sampleLimited: true }, input, { focus: 'street', limit: 10 }],
      [candidate, input, { focus: 'street', limit: 10, gameId }],
    ] as const) {
      expect(validate(value, source, args)).toEqual({ status: 'rejected', category: 'tool_validation' });
    }
  });
  it('accepts deterministic byte-truncated output and whole oversized-fact omissions without mutation', () => {
    const input = snapshot(Array.from({ length: 10 }, (_, i) => decision(i + 1)));
    input.facts.decisions.forEach(d => { d.knowledge.phase = '😀'.repeat(498); });
    const before = structuredClone(input); freezeDeep(input);
    const candidate = execute(input, { focus: 'street', limit: 10 });
    expect(validate(candidate, input, { focus: 'street', limit: 10 })).toEqual({ status: 'valid', result: candidate });
    expect(input).toEqual(before);
    const omitted = snapshot([decision(1)]); omitted.facts.decisions[0]!.knowledge.phase = 'x'.repeat(499);
    const oracle = expected('street', [{ ...expectedDecision(1),
      facts: expectedDecision(1).facts.filter(f => f.factCode !== 'phase') }], true);
    expect(validate(oracle, omitted, { focus: 'street', limit: 1 })).toEqual({ status: 'valid', result: oracle });
  });
  it('rejects incomplete fingerprint and corrupt source refs even for otherwise canonical output', () => {
    const candidate = expected('street', [expectedDecision(1)]);
    for (const [index, input] of [snapshot([decision(1)]), snapshot([decision(1)]), snapshot([decision(1)]),
      snapshot([decision(1)]), snapshot([decision(1)])].entries()) {
      // The first source has no terminal hand identity; the others exercise source
      // membership independently of candidate output shape.
      if (index === 0) input.handId = '';
      if (index === 1) input.facts.decisions[0]!.gameId = 'foreign';
      if (index === 2) input.facts.decisions[0]!.decisionRef = 'stale:1';
      if (index === 3) input.facts.decisions[0]!.expectedVersion = 301;
      if (index === 4) input.facts.decisions.push(decision(1));
      expect(validate(candidate, input, { focus: 'street', limit: 1 }))
        .toEqual({ status: 'rejected', category: 'tool_validation' });
    }
  });
});
function execute(snapshot: Snapshot, args: unknown, controls?: Controls) {
  expect(api.getDecisionEvidence, 'Missing local read-only evidence executor').toBeTypeOf('function');
  return api.getDecisionEvidence!(snapshot, args, controls);
}
function decision(ordinal: number, type: HumanDecisionFact['chosenAction']['type'] = 'call',
  reason: 'showdown' | 'uncontested' = 'showdown'): HumanDecisionFact {
  return { decisionRef: `${handId}:${ordinal}`, gameId, handId, expectedVersion: ordinal,
    handNumber: 1, decisionOrdinal: ordinal, chosenAction: type === 'bet' || type === 'raise'
      ? { type, amountTo: 20 } : { type },
    knowledge: { phase: 'flop', board: ['2c', '3d', '4h'], holeCards: ['As', 'Kd'],
      humanStackAtHandStart: 1000, players: [], pots: [], events: [],
      legalActions: [{ type: 'fold' }, { type: 'call', payAmount: 10, isAllIn: false }] },
    outcome: { reason, gameStatus: 'lost', humanNetChange: -10 } };
}
function snapshot(decisions: HumanDecisionFact[] = [decision(3, 'raise'), decision(1, 'fold', 'uncontested'),
  decision(4, 'check'), decision(2, 'call')]): Snapshot {
  return { gameId, handId, expectedVersion: 300, factsRevision: 20, status: 'lost',
    facts: { gameId, revision: 20, nextDecisionOrdinal: 301, decisions, aggregates: [] } };
}
// Expected-first projection: literal canonical JSON, no call to production projection.
function expectedDecision(ordinal: number, action = '{"type":"call"}', phase = '"flop"',
  reason = 'showdown') {
  return { decisionRef: `${handId}:${ordinal}`, facts: [
    { factCode: 'action', finding: action }, { factCode: 'phase', finding: phase },
    { factCode: 'legal_options', finding: '[{"type":"fold"},{"type":"call","payAmount":10,"isAllIn":false}]' },
    { factCode: 'known_cards', finding: '{"board":["2c","3d","4h"],"holeCards":["As","Kd"]}' },
    { factCode: 'hand_outcome', finding: `{"reason":"${reason}","gameStatus":"lost","humanNetChange":-10}` },
  ] };
}
function expected(focus: string, decisions: ReturnType<typeof expectedDecision>[], sampleLimited = false) {
  return { factsRevision: 20, focus, sampleLimited, decisions };
}
function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
}

describe('get_decision_evidence contract (T009)', () => {
  it('registers only the explicit allowlisted name', () => {
    expect(api.AGENT_TOOLS, 'Missing trusted allowlist').toBeDefined();
    expect(Object.keys(api.AGENT_TOOLS!)).toEqual(['get_decision_evidence']);
    expect(api.AGENT_TOOLS!.get_decision_evidence!.name).toBe('get_decision_evidence');
    expect(api.AGENT_TOOLS!.get_decision_evidence!.execute).toBe(api.getDecisionEvidence);
    expect(Object.isFrozen(api.AGENT_TOOLS)).toBe(true);
  });
  it.each([
    ['betting', [expectedDecision(2), expectedDecision(3, '{"type":"raise","amountTo":20}')]],
    ['street', [expectedDecision(1, '{"type":"fold"}', '"flop"', 'uncontested'), expectedDecision(2),
      expectedDecision(3, '{"type":"raise","amountTo":20}'), expectedDecision(4, '{"type":"check"}')]],
    ['showdown', [expectedDecision(2), expectedDecision(3, '{"type":"raise","amountTo":20}'),
      expectedDecision(4, '{"type":"check"}')]],
  ])('selects known decisions for %s with independent oracle', (focus, decisions) => {
    expect(execute(snapshot(), { focus, limit: 10 })).toEqual(expected(focus as string,
      decisions as ReturnType<typeof expectedDecision>[]));
  });
  it('includes each betting action but excludes check/fold', () => {
    const types = ['fold', 'check', 'call', 'bet', 'raise', 'all_in'] as const;
    const out = execute(snapshot(types.map((type, i) => decision(i + 1, type))), { focus: 'betting', limit: 10 });
    expect(out.decisions.map(d => d.decisionRef)).toEqual([3, 4, 5, 6].map(i => `${handId}:${i}`));
  });
  it('E2: lower limit chooses only newest matching decision', () => {
    expect(execute(snapshot(), { focus: 'betting', limit: 1 })).toEqual(expected('betting',
      [expectedDecision(3, '{"type":"raise","amountTo":20}')], true));
  });
  it('E3: upper limit keeps latest ten in increasing ordinal order', () => {
    const input = snapshot(Array.from({ length: 12 }, (_, i) => decision(12 - i)));
    expect(execute(input, { focus: 'street', limit: 10 })).toEqual(expected('street',
      Array.from({ length: 10 }, (_, i) => expectedDecision(i + 3)), true));
  });
  it.each([0, 11, 1.5, '1', null])('rejects invalid limit %j before projection', limit => {
    expect(api.getDecisionEvidence, 'Missing executor').toBeTypeOf('function');
    expect(() => execute(snapshot(), { focus: 'street', limit })).toThrow();
  });
  it.each([{ focus: 'all', limit: 1 }, { focus: 'street', limit: 1, gameId: 'foreign' },
    { focus: 'street', limit: 1, path: '/private' }, { focus: 'street', limit: 1, decisionRef: 'stale:1' }])(
    'rejects unknown fields and foreign/stale reference input %j', args => {
      expect(api.getDecisionEvidence, 'Missing executor').toBeTypeOf('function');
      expect(() => execute(snapshot(), args)).toThrow();
    });
  it('E4: empty and aggregate-only snapshots cannot fabricate details', () => {
    const empty = snapshot([]);
    expect(execute(empty, { focus: 'street', limit: 10 })).toEqual(expected('street', []));
    empty.facts.aggregates = [{ handId, handNumber: 1, decisionCount: 100, actionCounts: { call: 100 },
      startingStack: 1000, endingStack: 0, humanNetChange: -1000 }];
    expect(execute(empty, { focus: 'street', limit: 10 })).toEqual(expected('street', [], true));
  });
  it('is deterministic under input permutation and preserves deeply frozen snapshot', () => {
    const input = snapshot(); const before = structuredClone(input); freezeDeep(input);
    const args = { focus: 'street', limit: 10 }; freezeDeep(args);
    const a = execute(input, args); const b = execute(snapshot([...input.facts.decisions].reverse()), args);
    expect(a).toEqual(b); expect(input).toEqual(before);
    a.decisions[0]!.facts[0]!.finding = 'changed output';
    expect(input).toEqual(before);
  });
  it('projects only allowlisted fields and keeps later outcome separate from knowledge', () => {
    const input = snapshot([decision(1)]);
    Object.assign(input.facts.decisions[0]!.knowledge, { opponentCards: ['Ah', 'Ad'], deck: ['Qs'] });
    Object.assign(input.facts.decisions[0]!.chosenAction, { raw: 'private' });
    Object.assign(input.facts.decisions[0]!.outcome!, { raw: 'private' });
    Object.assign(input.facts.decisions[0]!.knowledge.legalActions[0]!, { raw: 'private' });
    expect(execute(input, { focus: 'street', limit: 1 })).toEqual(expected('street', [expectedDecision(1)]));
    input.facts.decisions[0]!.outcome = null;
    expect(execute(input, { focus: 'street', limit: 1 }).decisions[0]!.facts)
      .toEqual(expectedDecision(1).facts.slice(0, 4));
  });
  it('omits whole oversized facts without slicing and marks limited sample', () => {
    const input = snapshot([decision(1)]);
    input.facts.decisions[0]!.knowledge.phase = 'x'.repeat(499); // JSON quotes make 501 code points.
    expect(execute(input, { focus: 'street', limit: 1 })).toEqual(expected('street', [{
      ...expectedDecision(1), facts: expectedDecision(1).facts.filter(f => f.factCode !== 'phase'),
    }], true));
  });
  it('removes oldest whole decisions until JSON UTF-8 fits 20480 bytes', () => {
    const phase = '😀'.repeat(498);
    const input = snapshot(Array.from({ length: 10 }, (_, i) => {
      const d = decision(i + 1); d.knowledge.phase = phase; return d;
    }));
    const oracle = Array.from({ length: 10 }, (_, i) => expectedDecision(i + 1, '{"type":"call"}', `"${phase}"`));
    expect(Buffer.byteLength(JSON.stringify(expected('street', oracle)))).toBeGreaterThan(20480);
    while (Buffer.byteLength(JSON.stringify(expected('street', oracle, true))) > 20480) oracle.shift();
    const out = execute(input, { focus: 'street', limit: 10 });
    expect(out).toEqual(expected('street', oracle, true));
    expect(Buffer.byteLength(JSON.stringify(out))).toBeLessThanOrEqual(20480);
    expect(DecisionEvidenceResultSchema.safeParse(out).success).toBe(true);
  });
  it('rejects nonterminal, mismatched revision/game and corrupt detailed references', () => {
    expect(api.getDecisionEvidence, 'Missing executor').toBeTypeOf('function');
    for (const patch of [{ status: 'playing' }, { factsRevision: 19 }, { gameId: 'foreign' }]) {
      expect(() => execute({ ...snapshot(), ...patch }, { focus: 'street', limit: 1 })).toThrow();
    }
    for (const patch of [{ gameId: 'foreign' }, { decisionRef: 'stale:1' }, { expectedVersion: 301 }]) {
      const input = snapshot([decision(1)]); Object.assign(input.facts.decisions[0]!, patch);
      expect(() => execute(input, { focus: 'street', limit: 1 })).toThrow();
    }
    expect(() => execute(snapshot(Array.from({ length: 201 }, (_, i) => decision(i + 1))),
      { focus: 'street', limit: 1 })).toThrow();
  });
  it('cooperatively stops on abort, local 1000ms timeout and shorter run deadline', () => {
    expect(api.getDecisionEvidence, 'Missing executor').toBeTypeOf('function');
    const controller = new AbortController(); controller.abort();
    expect(() => execute(snapshot(), { focus: 'street', limit: 1 }, { signal: controller.signal })).toThrow();
    let now = 0;
    expect(() => execute(snapshot(), { focus: 'street', limit: 1 }, { now: () => now += 600 })).toThrow();
    now = 0;
    expect(() => execute(snapshot(), { focus: 'street', limit: 1 }, { now: () => ++now, deadlineAt: 3 })).toThrow();
  });
});
