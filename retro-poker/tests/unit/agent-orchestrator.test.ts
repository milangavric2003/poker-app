import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FakeAiProvider } from '../helpers/fake-ai-provider.js';
import { FakeClock } from '../helpers/fake-clock.js';
import { getDecisionEvidence, type TerminalFactsSnapshot } from '../../backend/src/agent/tools.js';
import type { AgentRunOptions } from '../../backend/src/agent/types.js';
import type { BoundedAgentRun } from '../../backend/src/agent/orchestrator.js';
let Run: typeof BoundedAgentRun | undefined;
beforeAll(async () => {
  const file = new URL('../../backend/src/agent/orchestrator.ts', import.meta.url);
  if (existsSync(file)) Run = (await import(file.href)).BoundedAgentRun;
});
export function snapshot(): TerminalFactsSnapshot {
  const gameId = '00000000-0000-4000-8000-000000000001';
  const handId = '00000000-0000-4000-8000-000000000002';
  return { gameId, handId, expectedVersion: 5, factsRevision: 1, status: 'lost',
    facts: { gameId, revision: 1, nextDecisionOrdinal: 2, aggregates: [], decisions: [{ gameId, handId,
      expectedVersion: 2, decisionRef: `${handId}:1`, decisionOrdinal: 1, handNumber: 1,
      knowledge: { phase: 'flop', board: ['2c', '3d', '4h'], holeCards: ['As', 'Kd'],
        humanStackAtHandStart: 1000, players: [], pots: [], events: [],
        legalActions: [{ type: 'call', payAmount: 10, isAllIn: false }] },
      chosenAction: { type: 'call' }, outcome: { reason: 'showdown', gameStatus: 'lost', humanNetChange: -10 } }] } };
}
function make(overrides: Partial<AgentRunOptions> = {}) {
  expect(Run, 'Missing bounded run state machine behavior').toBeTypeOf('function');
  const provider = new FakeAiProvider([{ kind: 'agent_tool' }, { kind: 'agent_final' }]);
  const clock = new FakeClock(); const executeTool = vi.fn(getDecisionEvidence);
  const run = new Run!({ runId: '00000000-0000-4000-8000-000000000003', snapshot: snapshot(),
    goal: { focus: 'street' }, provider, clock, model: 'test', executeTool, ...overrides });
  return { run, provider, clock, executeTool };
}
describe('bounded coach state machine T014', () => {
  it('runs two distinct steps and one validated read-only tool', async () => {
    const { run, provider, executeTool } = make();
    expect(run.state.status).toBe('created');
    const result = await run.execute();
    expect(result).toMatchObject({ status: 'completed', stepCount: 2, toolCallCount: 1,
      providerAttemptCount: 2, stopReason: 'completed', terminalTransitionCount: 1 });
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(provider.agentCalls.map(c => c.stepOrdinal)).toEqual([1, 2]);
    expect(provider.agentCalls[0]!.context).not.toHaveProperty('toolResult');
    expect(provider.agentCalls[1]!.request.context.toolResult).toEqual(getDecisionEvidence(snapshot(), { focus: 'street', limit: 10 }));
    expect(provider.agentCalls.map(c => c.deadlineAt)).toEqual([45000, 45000]);
    expect(await run.execute()).toEqual(result);
    expect(provider.agentCalls).toHaveLength(2);
  });
  it('does not forward corrupted tool results into step two', async () => {
    const { run, provider } = make({ executeTool: () => ({ raw: 'secret' }) });
    expect(await run.execute()).toMatchObject({ status: 'failed', stopReason: 'tool_failed', result: null });
    expect(provider.agentCalls).toHaveLength(1);
  });
  it('counts retry as attempt and retains one deadline', async () => {
    const provider = new FakeAiProvider([{ kind: 'timeout_error' }, { kind: 'agent_tool' }, { kind: 'agent_final' }]);
    const { run, clock } = make({ provider, backoffMinMs: 0, backoffMaxMs: 0 });
    const promise = run.execute();
    for (let i = 0; i < 20; i++) { await Promise.resolve(); clock.advance(0); }
    expect(await promise).toMatchObject({ status: 'completed', stepCount: 2, providerAttemptCount: 3, toolCallCount: 1 });
    expect(provider.agentCalls.map(c => [c.stepOrdinal, c.attemptOrdinal, c.runAttemptOrdinal]))
      .toEqual([[1, 1, 1], [1, 2, 2], [2, 1, 3]]);
    expect(provider.agentCalls.every(c => c.deadlineAt === 45000)).toBe(true);
  });
  it('deduplicates concurrent execution and terminal transition', async () => {
    const onTerminal = vi.fn(); const { run, provider } = make({ onTerminal });
    const [a, b] = await Promise.all([run.execute(), run.execute()]);
    expect(a).toEqual(b); expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(provider.agentCalls).toHaveLength(2);
  });
  it.each([{ maxSteps: 1, reason: 'step_limit', calls: 1, tools: 1 },
    { maxToolCalls: 0, reason: 'tool_call_limit', calls: 1, tools: 0 },
    { maxProviderAttempts: 1, reason: 'call_budget', calls: 1, tools: 1 }])('stops at narrowed $reason without an extra call', async ({ reason, calls, tools, ...limits }) => {
    const { run, provider, executeTool } = make({ limits });
    expect(await run.execute()).toMatchObject({ status: 'stopped', stopReason: reason, result: null });
    expect(provider.agentCalls).toHaveLength(calls); expect(executeTool).toHaveBeenCalledTimes(tools);
  });
  it('rejects repeated canonical action before a second executor call', async () => {
    const provider = new FakeAiProvider([{ kind: 'agent_tool' }, { candidate: { kind: 'tool_request',
      name: 'get_decision_evidence', arguments: { limit: 10, focus: 'street' } } }]);
    const { run, executeTool } = make({ provider });
    expect(await run.execute()).toMatchObject({ stopReason: 'repeated_action', toolCallCount: 1 });
    expect(executeTool).toHaveBeenCalledTimes(1);
  });
});
