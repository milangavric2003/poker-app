import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import * as contracts from '../../shared/contracts.js';
function schema(name: string): z.ZodType {
  const value = (contracts as unknown as Record<string, z.ZodType>)[name];
  expect(value, `Missing Week05 runtime contract: ${name}`).toBeDefined();
  return value!;
}
const id = '00000000-0000-4000-8000-000000000001';
const request = { gameId: id, handId: id, expectedVersion: 3, goal: { focus: 'street' } };
const final = { summary: 'Pregled', recommendation: 'Vežbaj', confidence: 'low', completed: true,
  evidence: [{ decisionRef: 'hand:1', factCode: 'phase', finding: '"flop"' }] };
const run = { ...request, runId: id, factsRevision: 4, status: 'created',
  startedAt: '2026-10-04T16:00:00.000Z', deadlineAt: '2026-10-04T16:00:45.000Z',
  stepCount: 0, providerAttemptCount: 0, toolCallCount: 0, stopReason: null,
  failureCategory: null, result: null, sampleLimited: false };
const stopped = ['insufficient_evidence', 'invalid_input', 'invalid_model_proposal', 'unknown_tool',
  'invalid_tool_arguments', 'repeated_action', 'tool_call_limit', 'step_limit', 'call_budget',
  'deadline', 'cancelled', 'stale_state'];
describe('coach DTO contracts (T007)', () => {
  it('strict request preserves Week04 identity and bounds goal', () => {
    const s = schema('CoachRequestSchema');
    expect(s.safeParse(request).success).toBe(true);
    for (const patch of [{ gameId: 'x' }, { expectedVersion: -1 }, { expectedVersion: 1.5 },
      { expectedVersion: Number.MAX_SAFE_INTEGER + 1 }, { goal: { focus: 'all' } },
      { factsRevision: 4 }, { goal: { focus: 'street', prompt: 'x' } }]) {
      expect(s.safeParse({ ...request, ...patch }).success).toBe(false);
    }
  });
  it('enumerates all statuses and stop reasons with consistent terminal result', () => {
    const s = schema('CoachRunViewSchema');
    for (const status of ['created', 'running']) expect(s.safeParse({ ...run, status }).success).toBe(true);
    for (const stopReason of stopped) expect(s.safeParse({ ...run, status: 'stopped', stopReason }).success).toBe(true);
    for (const stopReason of ['provider_failed', 'tool_failed', 'malformed_output']) {
      expect(s.safeParse({ ...run, status: 'failed', stopReason, failureCategory: 'tool_error' }).success).toBe(true);
    }
    expect(s.safeParse({ ...run, status: 'completed', stopReason: 'completed', result: final,
      stepCount: 2, toolCallCount: 1, providerAttemptCount: 2 }).success).toBe(true);
    for (const patch of [{ status: 'insufficient_evidence' }, { stopReason: 'other' },
      { status: 'stopped' }, { status: 'stopped', stopReason: 'completed' },
      { status: 'failed', stopReason: 'deadline' }, { result: final },
      { status: 'completed', stopReason: 'completed' },
      { status: 'completed', stopReason: 'completed', result: final },
      { stepCount: 3 }, { toolCallCount: 2 }, { providerAttemptCount: 5 },
      { failureCategory: 'raw_exception' }, { raw: 'x' }, { startedAt: 'today' },
      { deadlineAt: '2026-10-04T15:00:00.000Z' }]) {
      expect(s.safeParse({ ...run, ...patch }).success).toBe(false);
    }
  });
  it('strict response wrapper rejects private fields', () => {
    expect(schema('CoachResponseSchema').safeParse({ run }).success).toBe(true);
    expect(schema('CoachResponseSchema').safeParse({ run, prompt: 'x' }).success).toBe(false);
  });
});
