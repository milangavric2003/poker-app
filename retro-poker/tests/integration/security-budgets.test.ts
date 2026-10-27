import { expect, it, vi } from 'vitest';
import { BoundedAgentRun } from '../../backend/src/agent/orchestrator.js';
import type { AgentRunOptions } from '../../backend/src/agent/types.js';
import { ProviderError } from '../../backend/src/ai/types.js';
import { getDecisionEvidence } from '../../backend/src/agent/tools.js';
import { securityFixture, finishSecurityGame } from '../helpers/security-fixtures.js';

async function flush() { for (let i = 0; i < 80; i++) await Promise.resolve(); }
function make(overrides: Partial<AgentRunOptions> = {}) {
  const h = securityFixture(); const game = finishSecurityGame(h.session);
  const executeTool = vi.fn(getDecisionEvidence);
  const options: AgentRunOptions = { runId: '00000000-0000-4000-8000-000000000003',
    snapshot: { gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version,
      factsRevision: game.facts.revision, status: 'lost', facts: game.facts },
    goal: { focus: 'street' }, provider: h.provider, clock: h.clock, model: 'primary',
    fallbackModel: 'fallback', executeTool, ...overrides };
  const run = new BoundedAgentRun(options);
  return { ...h, run, options, executeTool };
}
it.each([
  { limits: {}, second: 10, reason: 'repeated_action', calls: 2, tools: 1 },
  { limits: {}, second: 1, reason: 'tool_call_limit', calls: 2, tools: 1 },
  { limits: { maxSteps: 1 }, second: 1, reason: 'step_limit', calls: 1, tools: 1 },
  { limits: { maxToolCalls: 0 }, second: 1, reason: 'tool_call_limit', calls: 1, tools: 0 },
  { limits: { maxProviderAttempts: 1 }, second: 1, reason: 'call_budget', calls: 1, tools: 1 },
])('T11 independently enforces $reason/$calls/$tools', async ({ limits, second, reason, calls, tools }) => {
  const h = make({ limits });
  h.provider.enqueue({ kind: 'agent_tool' }, { candidate: { kind: 'tool_request',
    name: 'get_decision_evidence', arguments: { focus: 'street', limit: second } } });
  expect(await h.run.execute()).toMatchObject({ stopReason: reason });
  expect(h.provider.agentCalls).toHaveLength(calls); expect(h.executeTool).toHaveBeenCalledTimes(tools);
});
it('T11 retry and fallback share four total attempts, two per model step', async () => {
  const h = make(); h.provider.enqueue({ kind: '5xx' }, { kind: 'agent_tool' }, { kind: 'network' }, { kind: 'agent_final' });
  const work = h.run.execute(); await flush(); h.clock.advance(500); await flush(); h.clock.advance(500); await flush();
  expect(await work).toMatchObject({ status: 'completed', stepCount: 2, providerAttemptCount: 4, toolCallCount: 1 });
  expect(h.provider.agentCalls.map(c => [c.stepOrdinal, c.attemptOrdinal, c.runAttemptOrdinal, c.model]))
    .toEqual([[1, 1, 1, 'primary'], [1, 2, 2, 'fallback'], [2, 1, 3, 'primary'], [2, 2, 4, 'primary']]);
});
it('T11 never sends a third attempt in one step', async () => {
  const h = make(); h.provider.enqueue({ kind: 'network' }, { kind: '5xx' }, { kind: 'agent_tool' });
  const work = h.run.execute(); await flush(); h.clock.advance(500); await flush();
  expect(await work).toMatchObject({ stopReason: 'provider_failed', stepCount: 1, providerAttemptCount: 2 });
  expect(h.provider.agentCalls).toHaveLength(2);
});
it.each(['resolve', 'reject'])('T12 call timeout aborts at 15000 and handles late %s', async late => {
  const h = make({ limits: { maxAttemptsPerStep: 1 } }); h.provider.enqueue({ kind: 'pending', id: 'old' });
  const work = h.run.execute(); await flush(); h.clock.advance(14999); await flush();
  expect(h.run.state.stopReason).toBeNull(); h.clock.advance(1); await flush();
  const terminal = await work; expect(terminal.failureCategory).toBe('provider_timeout');
  expect(h.provider.agentCalls[0]!.signal.aborted).toBe(true);
  if (late === 'reject') h.provider.reject('old', new Error('late'));
  else h.provider.resolve('old', { candidate: { kind: 'refusal', reason: 'insufficient_context' } });
  await flush(); expect(h.run.state).toEqual(terminal); expect(h.provider.agentCalls).toHaveLength(1);
});
it('T12 accepts provider success at 14999ms', async () => {
  const h = make(); h.provider.enqueue({ kind: 'pending', id: 'ok' }, { kind: 'agent_final' });
  const work = h.run.execute(); await flush(); h.clock.advance(14999);
  h.provider.resolve('ok', { candidate: { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 10 } } });
  expect(await work).toMatchObject({ status: 'completed', providerAttemptCount: 2 });
});
it.each([999, 1000])('T12 tool boundary %ims propagates abort and prevents late continuation', async elapsed => {
  let resolve!: (value: unknown) => void; let signal: AbortSignal | undefined;
  const h = make({ executeTool: (_s, _a, controls) => { signal = controls.signal;
    return new Promise(r => { resolve = r; }); } });
  h.provider.enqueue({ kind: 'agent_tool' }, { kind: 'agent_final' });
  const work = h.run.execute(); await flush(); h.clock.advance(elapsed); await flush();
  resolve(getDecisionEvidence(h.options.snapshot, { focus: 'street', limit: 10 }));
  const result = await work;
  expect(result).toMatchObject(elapsed === 999 ? { status: 'completed' } : { failureCategory: 'tool_timeout', result: null });
  expect(h.provider.agentCalls).toHaveLength(elapsed === 999 ? 2 : 1); expect(signal?.aborted).toBe(true);
});
it('T12 total deadline uses individually short calls plus backoff; no new step at 45000', async () => {
  const h = make();
  h.provider.enqueue({ kind: 'pending', id: 'a' }, { kind: 'pending', id: 'b' }, { kind: 'pending', id: 'c' });
  const work = h.run.execute(); await flush();
  h.clock.advance(14000); h.provider.reject('a', new ProviderError('network_error')); await flush();
  h.clock.advance(500); await flush(); h.clock.advance(14000);
  h.provider.resolve('b', { candidate: { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 10 } } }); await flush();
  h.clock.advance(14000); h.provider.reject('c', new ProviderError('rate_limited', undefined, 5000)); await flush();
  expect(h.clock.now()).toBe(42500); expect(h.provider.agentCalls).toHaveLength(3);
  h.clock.advance(2499); await flush(); expect(h.provider.agentCalls).toHaveLength(3);
  expect(h.run.state.stopReason).toBeNull(); h.clock.advance(1); await flush();
  expect(await work).toMatchObject({ stopReason: 'deadline', providerAttemptCount: 3 });
  expect(h.provider.agentCalls).toHaveLength(3);
});
it.each([1000, 1001])('T12 total deadline accepts 44999, rejects 45000 including late success (%i)', async finalMs => {
  const h = make({ executeTool: async (snapshot, args, controls) => {
    await h.clock.sleep(999, controls.signal); return getDecisionEvidence(snapshot, args, controls);
  } });
  h.provider.enqueue(...['a', 'b', 'c', 'd'].map(id => ({ kind: 'pending' as const, id })));
  const work = h.run.execute(); await flush();
  h.clock.advance(14000); h.provider.reject('a', new ProviderError('network_error')); await flush();
  h.clock.advance(500); await flush(); h.clock.advance(14000);
  h.provider.resolve('b', { candidate: { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 10 } } }); await flush();
  h.clock.advance(999); await flush(); h.clock.advance(14000);
  h.provider.reject('c', new ProviderError('network_error')); await flush(); h.clock.advance(500); await flush();
  expect(h.clock.now()).toBe(43999); expect(h.provider.agentCalls).toHaveLength(4);
  const decision = h.run.state.validatedToolResult!.decisions[0]!;
  h.clock.advance(finalMs); await flush();
  h.provider.resolve('d', { candidate: { kind: 'final', completed: true, confidence: 'low', summary: 'Pregled.',
    recommendation: 'Vežbaj.', evidence: [{ decisionRef: decision.decisionRef, ...decision.facts[0]! }] } });
  const result = await work;
  expect(result.stopReason).toBe(finalMs === 1000 ? 'completed' : 'deadline');
  expect(result.terminalTransitionCount).toBe(1); expect(h.provider.agentCalls).toHaveLength(4);
  await flush(); expect(h.run.state).toEqual(result);
});
