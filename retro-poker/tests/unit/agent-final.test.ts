import { describe, expect, it } from 'vitest';
import * as validation from '../../backend/src/agent/validation.js';
import type { FinalOutputValidation } from '../../backend/src/agent/validation.js';
import type { DecisionEvidenceResult } from '../../shared/contracts.js';
const output: DecisionEvidenceResult = { factsRevision: 1, focus: 'street', sampleLimited: false,
  decisions: [{ decisionRef: 'hand:1', facts: [{ factCode: 'phase', finding: '"flop"' }] }] };
const final = { kind: 'final', summary: 'S', recommendation: 'R', completed: true, confidence: 'low',
  evidence: [{ decisionRef: 'hand:1', factCode: 'phase', finding: '"flop"' }] };
function validate(candidate: unknown, evidence = output): FinalOutputValidation {
  expect(validation.validateFinalOutput, 'Missing pure final lifecycle validator').toBeTypeOf('function');
  return validation.validateFinalOutput(candidate, evidence);
}
describe('strict snapshot-bound final lifecycle', () => {
  it('accepts canonical supporting facts and does not mutate inputs', () => {
    const before = structuredClone({ final, output });
    expect(validate(final)).toMatchObject({ status: 'valid', result: { completed: true } });
    expect({ final, output }).toEqual(before);
  });
  it.each([
    { ...final, evidence: [{ ...final.evidence[0], decisionRef: 'foreign:1' }] },
    { ...final, evidence: [{ ...final.evidence[0], factCode: 'action' }] },
    { ...final, evidence: [{ ...final.evidence[0], factCode: 'secret' }] },
    { ...final, evidence: [{ ...final.evidence[0], finding: 'invented' }] },
    { ...final, evidence: [...final.evidence, ...final.evidence] },
    { ...final, evidence: [] }, { ...final, confidence: 'certain' },
    { ...final, summary: 's'.repeat(1001) }, { ...final, recommendation: 'r'.repeat(501) },
    { ...final, evidence: [{ ...final.evidence[0], finding: 'f'.repeat(501) }] },
    { ...final, raw: 'provider-payload' }, { ...final, evidence: [{ ...final.evidence[0], raw: 'x' }] },
    null, '{bad', {}, { ...final, kind: 'tool_request' },
  ])('rejects invalid final %j', candidate => expect(validate(candidate)).toEqual({ status: 'rejected', category: 'evidence_rejected' }));
  it('rejects fabricated completion on empty evidence', () => {
    expect(validate(final, { ...output, decisions: [] })).toEqual({ status: 'rejected', category: 'evidence_rejected' });
  });
  it('withholds a recommendation when the model declares insufficient evidence', () => {
    expect(validate({ ...final, completed: false, evidence: [] })).toEqual({ status: 'insufficient_evidence' });
  });
  it('parses bounded JSON and trims text', () => {
    expect(validate(JSON.stringify({ ...final, summary: ' S ' }))).toMatchObject({ status: 'valid', result: { summary: 'S' } });
    expect(validate(' '.repeat(32769))).toEqual({ status: 'rejected', category: 'evidence_rejected' });
  });
});
