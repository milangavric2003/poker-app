import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import * as contracts from '../../shared/contracts.js';

// Namespace lookup keeps the pre-contract RED an explicit missing runtime capability
// assertion rather than a failed named import. No permissive replacement schema.
export function schema(name: string): z.ZodType {
  const value = (contracts as unknown as Record<string, z.ZodType>)[name];
  expect(value, `Missing Week05 runtime contract: ${name}`).toBeDefined();
  return value!;
}
const fact = { factCode: 'phase', finding: '"flop"' };
const evidence = { decisionRef: 'hand:1', ...fact };
const result = { summary: 'Pregled', recommendation: 'Vežbaj', evidence: [evidence],
  confidence: 'low', completed: true };
const output = { factsRevision: 4, focus: 'street', sampleLimited: false,
  decisions: [{ decisionRef: 'hand:1', facts: [fact] }] };

describe('Week05 strict runtime schemas (T007)', () => {
  it.each(['betting', 'street', 'showdown'])('allows focus %s', focus => {
    expect(schema('CoachGoalSchema').safeParse({ focus }).success).toBe(true);
  });
  it.each([{ focus: 'all' }, { focus: 1 }, {}, { focus: 'street', prompt: 'x' }, null])(
    'rejects invalid goal %j', value => {
      expect(schema('CoachGoalSchema').safeParse(value).success).toBe(false);
    });
  it.each([1, 10])('allows integer limit %i', limit => {
    expect(schema('DecisionEvidenceArgumentsSchema').safeParse({ focus: 'street', limit }).success).toBe(true);
  });
  it.each([0, 11, 1.5, '1', NaN, Infinity, null])('rejects limit %j', limit => {
    expect(schema('DecisionEvidenceArgumentsSchema').safeParse({ focus: 'street', limit }).success).toBe(false);
  });
  it('rejects argument scope/unknown fields', () => {
    for (const key of ['gameId', 'path', 'decisionRef']) {
      expect(schema('DecisionEvidenceArgumentsSchema').safeParse({ focus: 'street', limit: 1, [key]: 'x' }).success).toBe(false);
    }
  });
  it('discriminates strict model steps; unknown names remain classifiable by allowlist', () => {
    const s = schema('CoachModelStepSchema');
    for (const value of [
      { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 1 } },
      { kind: 'tool_request', name: 'foreign_tool', arguments: {} },
      { kind: 'refusal', reason: 'insufficient_context' },
      { kind: 'refusal', reason: 'cannot_complete' }, { kind: 'final', ...result },
    ]) expect(s.safeParse(value).success).toBe(true);
    for (const value of [{ kind: 'other' }, { kind: 'refusal', reason: 'other' },
      { kind: 'tool_request', name: '', arguments: {} },
      { kind: 'tool_request', name: 'x'.repeat(129), arguments: {} },
      { kind: 'tool_request', name: 1, arguments: {} },
      { kind: 'tool_request', name: 'x' },
      { kind: 'refusal', reason: 'cannot_complete', raw: 'x' }]) {
      expect(s.safeParse(value).success).toBe(false);
    }
  });
  it('bounds final text by trimmed Unicode code points', () => {
    const s = schema('CoachResultSchema');
    expect(s.safeParse({ ...result, summary: '😀'.repeat(1000), recommendation: '😀'.repeat(500) }).success).toBe(true);
    for (const patch of [{ summary: '' }, { summary: '   ' }, { summary: '😀'.repeat(1001) },
      { recommendation: 'x'.repeat(501) }, { recommendation: '' }, { summary: 1 },
      { confidence: 'certain' }, { completed: 'true' }, { raw: 'x' }]) {
      expect(s.safeParse({ ...result, ...patch }).success).toBe(false);
    }
    expect(s.parse({ ...result, summary: ' Pregled ' })).toMatchObject({ summary: 'Pregled' });
  });
  it('bounds/uniquifies evidence and enforces completed', () => {
    const s = schema('CoachResultSchema');
    expect(s.safeParse({ ...result, evidence: [], completed: false }).success).toBe(true);
    expect(s.safeParse({ ...result, evidence: [] }).success).toBe(false);
    expect(s.safeParse({ ...result, evidence: [evidence, evidence] }).success).toBe(false);
    const items = Array.from({ length: 10 }, (_, i) => ({ ...evidence, decisionRef: `hand:${i}` }));
    expect(s.safeParse({ ...result, evidence: items }).success).toBe(true);
    expect(s.safeParse({ ...result, evidence: [...items, { ...evidence, decisionRef: 'extra' }] }).success).toBe(false);
    for (const patch of [{ decisionRef: '' }, { decisionRef: 'x'.repeat(129) },
      { decisionRef: 'ž' }, { finding: '' }, { finding: 'x'.repeat(501) },
      { finding: 1 }, { factCode: 'secret' }, { hidden: 'x' }]) {
      expect(s.safeParse({ ...result, evidence: [{ ...evidence, ...patch }] }).success).toBe(false);
    }
    expect(s.safeParse({ ...result, evidence: [{ ...evidence, decisionRef: 'x'.repeat(128), finding: '😀'.repeat(500) }] }).success).toBe(true);
  });
  it('strictly bounds output decisions/facts, unique refs/codes and UTF-8 bytes', () => {
    const s = schema('DecisionEvidenceResultSchema');
    expect(s.safeParse(output).success).toBe(true);
    expect(s.safeParse({ ...output, decisions: [] }).success).toBe(true);
    for (const patch of [{ factsRevision: -1 }, { factsRevision: '4' }, { focus: 'all' },
      { sampleLimited: 1 }, { hidden: 'x' }, { decisions: [output.decisions[0], output.decisions[0]] },
      { decisions: [{ decisionRef: 'hand:1', facts: [] }] },
      { decisions: [{ decisionRef: 'hand:1', facts: [fact, fact] }] },
      { decisions: [{ ...output.decisions[0], hidden: 'x' }] }]) {
      expect(s.safeParse({ ...output, ...patch }).success).toBe(false);
    }
    const codes = ['action', 'phase', 'legal_options', 'known_cards', 'hand_outcome'];
    const full = Array.from({ length: 10 }, (_, i) => ({ decisionRef: `hand:${i}`,
      facts: codes.map(factCode => ({ factCode, finding: 'x' })) }));
    expect(s.safeParse({ ...output, decisions: full }).success).toBe(true);
    expect(s.safeParse({ ...output, decisions: [...full, { ...full[0], decisionRef: 'extra' }] }).success).toBe(false);
    expect(s.safeParse({ ...output, decisions: full.map(d => ({ ...d,
      facts: d.facts.map(f => ({ ...f, finding: '😀'.repeat(500) })) })) }).success).toBe(false);
  });
  it('context-bound evidence schema rejects refs/codes/findings not actually supplied', () => {
    const factory = (contracts as unknown as Record<string, (value: unknown) => z.ZodType>).coachResultForEvidence;
    expect(factory, 'Missing context-bound evidence contract').toBeTypeOf('function');
    const s = factory!(output);
    expect(s.safeParse(result).success).toBe(true);
    for (const patch of [{ decisionRef: 'foreign:1' }, { factCode: 'action' }, { finding: 'invented' }]) {
      expect(s.safeParse({ ...result, evidence: [{ ...evidence, ...patch }] }).success).toBe(false);
    }
  });
});
