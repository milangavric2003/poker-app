import { describe, expect, it } from 'vitest';
import { FakeAiProvider } from '../helpers/fake-ai-provider.js';
import type { AgentStepRequest } from '../../backend/src/ai/types.js';

const request: AgentStepRequest = { purpose: 'coach', runId: 'run', stepOrdinal: 1,
  attemptOrdinal: 1, runAttemptOrdinal: 1, model: 'test', deadlineAt: 45000, remainingMs: 45000,
  context: { goal: { focus: 'street' }, availableDecisionCount: 1, sampleLimited: false },
  responseSchema: { type: 'object' } };
describe('provider-neutral coach fake', () => {
  it.each(['agent_tool', 'agent_refusal', 'agent_final', 'unknown_tool', 'invalid_arguments',
    'invalid_final', 'malformed'] as const)('scripts %s without network', async kind => {
    const fake = new FakeAiProvider([{ kind }]);
    expect(fake.generateAgent, 'Missing agent-step provider behavior').toBeTypeOf('function');
    const signal = new AbortController().signal;
    const result = await fake.generateAgent(request, signal);
    expect(result).toHaveProperty('candidate');
    expect(fake.agentCalls[0]).toMatchObject({ request, signal, model: 'test', stepOrdinal: 1,
      attemptOrdinal: 1, runAttemptOrdinal: 1, deadlineAt: 45000 });
    const expected = { agent_tool: 'tool_request', agent_refusal: 'refusal', agent_final: 'final',
      unknown_tool: 'tool_request', invalid_arguments: 'tool_request', invalid_final: 'final' };
    if (kind !== 'malformed') expect(result.candidate).toMatchObject({ kind: expected[kind] });
    else expect(result.candidate).toBe('{not-json');
    if (kind === 'unknown_tool') expect(result.candidate).toMatchObject({ name: 'shell' });
    if (kind === 'invalid_arguments') expect(result.candidate).toMatchObject({ arguments: { limit: 0 } });
    if (kind === 'invalid_final') expect(result.candidate).toMatchObject({ evidence: [{ decisionRef: 'foreign:1' }] });
  });
  it.each([['timeout_error', 'timeout'], ['429', 'rate_limited'], ['5xx', 'server_error'],
    ['auth_config', 'auth_config_error'], ['network', 'network_error']] as const)('classifies %s', async (kind, expected) => {
    const fake = new FakeAiProvider([{ kind }]);
    expect(fake.generateAgent).toBeTypeOf('function');
    await expect(fake.generateAgent(request, new AbortController().signal)).rejects.toMatchObject({ kind: expected });
  });
  it('keeps retries in one step, repeats proposals and supports late pending replies', async () => {
    const fake = new FakeAiProvider([{ kind: 'agent_tool' }, { kind: 'agent_tool' }, { kind: 'pending', id: 'late' }]);
    expect(fake.generateAgent).toBeTypeOf('function');
    const controller = new AbortController();
    const first = await fake.generateAgent(request, controller.signal);
    expect(await fake.generateAgent({ ...request, attemptOrdinal: 2, runAttemptOrdinal: 2 }, controller.signal)).toEqual(first);
    const pending = fake.generateAgent({ ...request, stepOrdinal: 2, runAttemptOrdinal: 3 }, controller.signal);
    controller.abort(); fake.resolve('late', { candidate: { kind: 'refusal', reason: 'cannot_complete' } });
    await expect(pending).resolves.toHaveProperty('candidate');
    expect(fake.agentCalls.map(c => c.stepOrdinal)).toEqual([1, 1, 2]);
    expect(fake.calls).toHaveLength(0);
  });
  it('keeps automatically named pending agent responses independently resolvable', async () => {
    const fake = new FakeAiProvider([{ kind: 'pending' }, { kind: 'pending' }, { kind: 'timeout' }]);
    const signal = new AbortController().signal;
    const first = fake.generateAgent(request, signal);
    const second = fake.generateAgent({ ...request, attemptOrdinal: 2, runAttemptOrdinal: 2 }, signal);
    const third = fake.generateAgent({ ...request, stepOrdinal: 2, runAttemptOrdinal: 3 }, signal);
    expect(fake.pending.size, 'Pending agent requests must not overwrite one another').toBe(3);
    expect([...fake.pending.keys()]).toEqual(['pending-1', 'pending-2', 'timeout-3']);
    fake.resolve('pending-1', { candidate: 'first' }); fake.resolve('pending-2', { candidate: 'second' });
    fake.resolve('timeout-3', { candidate: 'third' });
    expect(await Promise.all([first, second, third])).toEqual([{ candidate: 'first' }, { candidate: 'second' }, { candidate: 'third' }]);
  });
});
