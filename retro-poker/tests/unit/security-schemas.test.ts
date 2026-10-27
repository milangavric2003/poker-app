import { expect, it } from 'vitest';
import { CoachEvidenceSchema, CoachFinalStepSchema, CoachFactCodeSchema, CoachFactSchema,
  CoachModelStepSchema, DecisionEvidenceArgumentsSchema, DecisionEvidenceResultSchema,
  jsonUtf8Bytes, type DecisionEvidenceResult } from '../../shared/contracts.js';

it.each([1, 10])('T08 schema accepts limit %s', limit =>
  expect(DecisionEvidenceArgumentsSchema.safeParse({ focus: 'street', limit }).success).toBe(true));
it.each([null, {}, { focus: 'street', limit: '1' }, { focus: 'street', limit: 0 },
  { focus: 'street', limit: 11 }, { focus: 'street', limit: 1, gameId: 'other' }])(
  'T08 strict args %#', value => expect(DecisionEvidenceArgumentsSchema.safeParse(value).success).toBe(false));

const final = { kind: 'final', summary: 'S', recommendation: 'R', completed: true, confidence: 'low',
  evidence: [{ decisionRef: 'hand:1', factCode: 'phase', finding: '"flop"' }] };
it('T06 text bounds count Unicode code points and trim summary/recommendation', () => {
  expect(CoachFinalStepSchema.safeParse({ ...final, summary: ` ${'😀'.repeat(1000)} `,
    recommendation: 'ž'.repeat(500) }).success).toBe(true);
  for (const patch of [{ summary: '😀'.repeat(1001) }, { summary: '  ' },
    { recommendation: 'ž'.repeat(501) }, { recommendation: '' }]) {
    expect(CoachFinalStepSchema.safeParse({ ...final, ...patch }).success).toBe(false);
  }
  expect(CoachFactSchema.safeParse({ factCode: 'phase', finding: '😀'.repeat(500) }).success).toBe(true);
  expect(CoachFactSchema.safeParse({ factCode: 'phase', finding: '😀'.repeat(501) }).success).toBe(false);
  expect(CoachFactSchema.parse({ factCode: 'phase', finding: ' ' }).finding).toBe(' ');
});
it('T10 reference is 1–128 ASCII characters, extra fields forbidden', () => {
  for (const [decisionRef, valid] of [['a', true], ['a'.repeat(128), true], ['', false],
    ['a'.repeat(129), false], ['ž', false]] as const) {
    expect(CoachEvidenceSchema.safeParse({ ...final.evidence[0], decisionRef }).success).toBe(valid);
  }
  expect(CoachEvidenceSchema.safeParse({ ...final.evidence[0], secret: 'sentinel' }).success).toBe(false);
});

function byteBoundaryResult(): DecisionEvidenceResult {
  const result: DecisionEvidenceResult = { factsRevision: 1, focus: 'street', sampleLimited: false,
    decisions: Array.from({ length: 10 }, (_, i) => ({ decisionRef: `hand:${i + 1}`,
      facts: CoachFactCodeSchema.options.map(factCode => ({ factCode, finding: 'a' })) })) };
  let remaining = 20480 - jsonUtf8Bytes(result);
  for (const decision of result.decisions) for (const fact of decision.facts) {
    const add = Math.min(499, remaining); fact.finding += 'a'.repeat(add); remaining -= add;
  }
  expect(remaining).toBe(0); return result;
}
it('T10 exact 20480-byte tool output accepted; next UTF-8 byte rejected independently of shape', () => {
  const result = byteBoundaryResult();
  expect(jsonUtf8Bytes(result)).toBe(20480);
  expect(DecisionEvidenceResultSchema.safeParse(result).success).toBe(true);
  // Same number of code points, one additional byte, every individual field valid.
  const last = result.decisions[9]!.facts[4]!; last.finding = 'ž';
  expect(jsonUtf8Bytes(result)).toBe(20481);
  expect(DecisionEvidenceResultSchema.safeParse(result).success).toBe(false);
});
it('T10 keeps decision/fact counts and unique membership strict', () => {
  const result: DecisionEvidenceResult = { factsRevision: 1, focus: 'street', sampleLimited: false,
    decisions: [{ decisionRef: 'hand:1', facts: [{ factCode: 'phase', finding: '"flop"' }] }] };
  expect(DecisionEvidenceResultSchema.safeParse(result).success).toBe(true);
  expect(DecisionEvidenceResultSchema.safeParse({ ...result, decisions: Array(11).fill(result.decisions[0]) }).success).toBe(false);
  expect(DecisionEvidenceResultSchema.safeParse({ ...result, decisions: [{ ...result.decisions[0],
    facts: Array(6).fill(result.decisions[0]!.facts[0]) }] }).success).toBe(false);
  expect(CoachFinalStepSchema.safeParse({ ...final, evidence: Array(11).fill(final.evidence[0]) }).success).toBe(false);
});
it('T06 exact model byte limit is independent of untrusted argument content', () => {
  const candidate = { kind: 'tool_request', name: 'get_decision_evidence', arguments: { untrusted: '' } };
  candidate.arguments.untrusted = 'a'.repeat(32768 - jsonUtf8Bytes(candidate));
  expect(jsonUtf8Bytes(candidate)).toBe(32768);
  expect(CoachModelStepSchema.safeParse(candidate).success).toBe(true);
  candidate.arguments.untrusted += 'a';
  expect(CoachModelStepSchema.safeParse(candidate).success).toBe(false);
  // Union parsing is not permission to execute: strict args reject either size.
  expect(DecisionEvidenceArgumentsSchema.safeParse(candidate.arguments).success).toBe(false);
});
