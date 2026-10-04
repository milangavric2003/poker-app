import { describe, expect, it, vi } from 'vitest';
import { BoundedAgentRun } from '../../backend/src/agent/orchestrator.js';
import { getDecisionEvidence, type TerminalFactsSnapshot } from '../../backend/src/agent/tools.js';
import { GameSession } from '../../backend/src/session.js';
import type { AgentRunOptions } from '../../backend/src/agent/types.js';
import { FakeAiProvider, type FakeAiStep } from '../helpers/fake-ai-provider.js';
import { FakeClock } from '../helpers/fake-clock.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

function harness(steps: FakeAiStep[] = [{ kind: 'agent_tool' }, { kind: 'agent_final' }], overrides: Partial<AgentRunOptions> = {}) {
  const session = new GameSession({ deck: ['As', 'Kc', 'Ah', 'Kd', ...ac23Deck.slice(4)],
    deckRandom: sequenceRandom([]), botRandom: sequenceRandom(Array<number>(100).fill(0.9)) });
  let game = session.create(1, false);
  game = session.action({ gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, type: 'all_in' });
  expect(game.hand.gameStatus).toBe('lost');
  const pokerBefore = JSON.stringify(game); const factsBefore = structuredClone(game.facts);
  const snapshot: TerminalFactsSnapshot = { gameId: game.gameId, handId: game.hand.handId,
    expectedVersion: game.version, factsRevision: game.facts.revision, status: 'lost', facts: game.facts };
  const provider = new FakeAiProvider(steps); const clock = new FakeClock();
  const executeTool = vi.fn(getDecisionEvidence); const onTerminal = vi.fn();
  const options: AgentRunOptions = { runId: '00000000-0000-4000-8000-000000000003', snapshot,
    goal: { focus: 'street' }, provider, clock, model: 'test-primary', fallbackModel: 'test-fallback',
    backoffMinMs: 0, backoffMaxMs: 0, executeTool, onTerminal, ...overrides };
  const run = new BoundedAgentRun(options);
  const unchanged = () => { expect(JSON.stringify(game)).toBe(pokerBefore); expect(game.facts).toEqual(factsBefore); };
  return { run, provider, clock, executeTool, onTerminal, unchanged, snapshot, session, options };
}
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
async function settle(run: BoundedAgentRun, clock: FakeClock) {
  const work = run.execute();
  for (let i = 0; i < 6; i++) { await flush(); clock.advance(0); }
  return work;
}
function safeFailure(result: Awaited<ReturnType<BoundedAgentRun['execute']>>) {
  expect(result.result).toBeNull();
  const text = JSON.stringify(result);
  for (const forbidden of ['private-secret', 'raw-response', 'raw-prompt', 'stack-trace']) expect(text).not.toContain(forbidden);
  expect(result.terminalTransitionCount).toBe(1);
}
describe('direct offline agent integration T016', () => {
  it('completes two accepted steps around one canonical executor without poker/facts mutation', async () => {
    const h = harness(); const result = await settle(h.run, h.clock);
    expect(result).toMatchObject({ status: 'completed', stopReason: 'completed', stepCount: 2,
      toolCallCount: 1, providerAttemptCount: 2, result: { completed: true } });
    expect(h.executeTool).toHaveBeenCalledTimes(1);
    expect(h.provider.agentCalls[1]!.request.context.toolResult).toEqual(result.validatedToolResult);
    expect(h.provider.agentCalls[0]!.request.context).not.toHaveProperty('facts');
    h.unchanged();
  });
  it.each([['unknown_tool', 'unknown_tool'], ['invalid_arguments', 'invalid_tool_arguments']] as const)('rejects %s before executor', async (kind, reason) => {
    const h = harness([{ kind }]); const result = await settle(h.run, h.clock);
    expect(result).toMatchObject({ status: 'stopped', stopReason: reason, toolCallCount: 0 });
    expect(h.executeTool).not.toHaveBeenCalled(); safeFailure(result); h.unchanged();
  });
  it.each([
    { steps: [{ kind: 'malformed' }], reason: 'malformed_output', category: 'invalid_structured_response' },
    { steps: [{ kind: 'agent_tool' }, { kind: 'malformed' }], reason: 'malformed_output', category: 'invalid_structured_response' },
    { steps: [{ kind: 'auth_config' }], reason: 'provider_failed', category: 'authentication_configuration' },
    { steps: [{ kind: 'timeout_error' }], reason: 'provider_failed', category: 'provider_timeout' },
    { steps: [{ kind: '429' }], reason: 'provider_failed', category: 'rate_limit' },
    { steps: [{ kind: '5xx' }], reason: 'provider_failed', category: 'provider_unavailable' },
    { steps: [{ kind: 'network' }], reason: 'provider_failed', category: 'provider_transport' },
    { steps: [{ kind: 'safety_refusal' }], reason: 'provider_failed', category: 'provider_refusal' },
    { steps: [{ kind: 'agent_tool' }, { kind: 'invalid_final' }], reason: 'malformed_output', category: 'evidence_rejected' },
  ] satisfies Array<{ steps: FakeAiStep[]; reason: string; category: string }>)('safe failure $category / $reason', async ({ steps, reason, category }) => {
    const h = harness(steps, { limits: { maxAttemptsPerStep: 1 } }); const result = await settle(h.run, h.clock);
    expect(result).toMatchObject({ status: 'failed', stopReason: reason, failureCategory: category });
    safeFailure(result); h.unchanged();
  });
  it('tool exception cannot expose secrets or replay the executor', async () => {
    const executeTool = vi.fn(() => { throw new Error('private-secret raw-response raw-prompt stack-trace'); });
    const h = harness(undefined, { executeTool }); const result = await settle(h.run, h.clock);
    expect(result).toMatchObject({ status: 'failed', stopReason: 'tool_failed', failureCategory: 'tool_error', toolCallCount: 1 });
    expect(executeTool).toHaveBeenCalledTimes(1); expect(h.provider.agentCalls).toHaveLength(1);
    safeFailure(result); h.unchanged();
  });
  it('model refusal withholds success', async () => {
    const h = harness([{ kind: 'agent_refusal' }]); const result = await settle(h.run, h.clock);
    expect(result).toMatchObject({ status: 'stopped', stopReason: 'insufficient_evidence', toolCallCount: 0 });
    safeFailure(result); h.unchanged();
  });
  it('429 and 5xx recover within steps, with configured fallback and shared budget', async () => {
    const h = harness([{ kind: '429' }, { kind: 'agent_tool' }, { kind: '5xx' }, { kind: 'agent_final' }]);
    const result = await settle(h.run, h.clock);
    expect(result).toMatchObject({ status: 'completed', stepCount: 2, providerAttemptCount: 4, toolCallCount: 1 });
    expect(h.provider.agentCalls.map(c => c.model)).toEqual(['test-primary', 'test-primary', 'test-primary', 'test-fallback']);
    expect(h.executeTool).toHaveBeenCalledTimes(1); h.unchanged();
  });
  it('rejects negative facts revision before provider or tool calls', async () => {
    const h = harness();
    const input = { ...structuredClone(h.snapshot), factsRevision: -1 };
    const facts = { ...structuredClone(input.facts), revision: -1 };
    const run = new BoundedAgentRun({ ...h.options, snapshot: { ...input, facts } });
    const result = await settle(run, h.clock);
    expect(result).toMatchObject({ status: 'stopped', stopReason: 'invalid_input', providerAttemptCount: 0, toolCallCount: 0 });
    expect(h.provider.agentCalls).toHaveLength(0); h.unchanged();
  });
});

describe('limits, races and ownership injection T017', () => {
  it('same canonical proposal stops before second tool execution', async () => {
    const h = harness([{ kind: 'agent_tool' }, { candidate: { kind: 'tool_request', name: 'get_decision_evidence',
      arguments: { limit: 10, focus: 'street' } } }]);
    const result = await settle(h.run, h.clock);
    expect(result).toMatchObject({ status: 'stopped', stopReason: 'repeated_action', toolCallCount: 1, stepCount: 2 });
    expect(h.executeTool).toHaveBeenCalledTimes(1); h.unchanged();
  });
  it('new proposal after the tool cap stops without executing twice', async () => {
    const h = harness([{ kind: 'agent_tool' }, { candidate: { kind: 'tool_request', name: 'get_decision_evidence',
      arguments: { focus: 'street', limit: 1 } } }]);
    expect(await settle(h.run, h.clock)).toMatchObject({ stopReason: 'tool_call_limit', toolCallCount: 1 });
    expect(h.executeTool).toHaveBeenCalledTimes(1); h.unchanged();
  });
  it.each([{ maxSteps: 1, reason: 'step_limit', calls: 1 }, { maxProviderAttempts: 1, reason: 'call_budget', calls: 1 },
    { maxToolCalls: 0, reason: 'tool_call_limit', calls: 1 }])('narrowed $reason guard prevents extra calls', async ({ reason, calls, ...limits }) => {
    const h = harness(undefined, { limits });
    expect(await settle(h.run, h.clock)).toMatchObject({ stopReason: reason });
    expect(h.provider.agentCalls).toHaveLength(calls); h.unchanged();
  });
  it('uses all four attempts across steps, never sends a fifth after failures', async () => {
    const h = harness([{ kind: '429' }, { kind: 'agent_tool' }, { kind: '5xx' }, { kind: '5xx' }, { kind: 'agent_final' }]);
    const result = await settle(h.run, h.clock);
    expect(result).toMatchObject({ stopReason: 'provider_failed', providerAttemptCount: 4, stepCount: 2, toolCallCount: 1 });
    expect(h.provider.agentCalls).toHaveLength(4); expect(h.executeTool).toHaveBeenCalledTimes(1);
    safeFailure(result); h.unchanged();
  });
  it('retry cannot send an attempt after narrowed run budget is exhausted', async () => {
    const h = harness([{ kind: '429' }, { kind: 'agent_tool' }], { limits: { maxProviderAttempts: 1 } });
    expect(await settle(h.run, h.clock)).toMatchObject({ stopReason: 'call_budget', providerAttemptCount: 1 });
    expect(h.provider.agentCalls).toHaveLength(1); expect(h.executeTool).not.toHaveBeenCalled(); h.unchanged();
  });
  it('cannot raise hard Core caps through injected configuration', async () => {
    const h = harness(undefined, { limits: { maxSteps: 3, maxToolCalls: 2, maxProviderAttempts: 5 } });
    expect(await settle(h.run, h.clock)).toMatchObject({ stopReason: 'invalid_input', providerAttemptCount: 0 });
    h.unchanged();
  });
  it('aggregate-only preflight exposes limited sample and makes zero model/tool calls', async () => {
    const h = harness();
    const snapshot = { ...h.snapshot, facts: { ...h.snapshot.facts, decisions: [], aggregates: [{
      handId: h.snapshot.handId, handNumber: 1, decisionCount: 1, actionCounts: { call: 1 },
      startingStack: 1000, endingStack: 0, humanNetChange: -1000 }] } };
    const run = new BoundedAgentRun({ ...h.options, snapshot });
    expect(await run.execute()).toMatchObject({ stopReason: 'insufficient_evidence', sampleLimited: true,
      providerAttemptCount: 0, toolCallCount: 0 });
    expect(h.provider.agentCalls).toHaveLength(0); h.unchanged();
  });
  it('shares deadline across timeout/retry/tool and step two, shortening the last timeout', async () => {
    const h = harness([{ kind: 'pending', id: 'first' }, { kind: 'pending', id: 'retry' }, { kind: 'pending', id: 'final' }],
      { limits: { totalDeadlineMs: 40000 } });
    const work = h.run.execute(); await flush();
    h.clock.advance(15000); await flush(); h.clock.advance(0); await flush();
    expect(h.provider.agentCalls).toHaveLength(2);
    expect(h.provider.agentCalls[0]!.signal.aborted).toBe(true);
    h.clock.advance(14000);
    h.provider.resolve('retry', { candidate: { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 10 } } });
    await flush();
    expect(h.provider.agentCalls).toHaveLength(3);
    expect(h.provider.agentCalls[2]!.request).toMatchObject({ stepOrdinal: 2, remainingMs: 11000, deadlineAt: 40000 });
    expect(h.clock.sleeps.at(-1)).toBe(11000);
    h.clock.advance(11000); await flush();
    const result = await work;
    expect(result).toMatchObject({ status: 'stopped', stopReason: 'deadline', providerAttemptCount: 3 });
    expect(h.provider.agentCalls[2]!.signal.aborted).toBe(true);
    h.provider.resolve('first', { candidate: { kind: 'refusal', reason: 'cannot_complete' } });
    h.provider.resolve('final', { candidate: { kind: 'refusal', reason: 'cannot_complete' } });
    await flush(); expect(h.run.state).toEqual(result); safeFailure(result); h.unchanged();
  });
  it('does not start retry when backoff consumes the remaining deadline', async () => {
    const h = harness([{ kind: '429' }], { limits: { totalDeadlineMs: 100 }, backoffMinMs: 500, backoffMaxMs: 1000 });
    const work = h.run.execute(); await flush(); h.clock.advance(100); await flush();
    expect(await work).toMatchObject({ stopReason: 'deadline', providerAttemptCount: 1 });
    expect(h.provider.agentCalls).toHaveLength(1); h.unchanged();
  });
  it('times out a noncooperative provider, aborts it and ignores late success', async () => {
    const h = harness([{ kind: 'pending', id: 'late' }], { limits: { maxAttemptsPerStep: 1 } });
    const work = h.run.execute(); await flush(); h.clock.advance(15000); await flush();
    const result = await work;
    expect(result).toMatchObject({ stopReason: 'provider_failed', failureCategory: 'provider_timeout' });
    expect(h.provider.agentCalls[0]!.signal.aborted).toBe(true);
    h.provider.resolve('late', { candidate: { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 10 } } });
    await flush(); expect(h.run.state).toEqual(result); expect(h.executeTool).not.toHaveBeenCalled(); h.unchanged();
  });
  it('cancellation settles a pending provider and freezes the terminal state immediately', async () => {
    const controller = new AbortController();
    const h = harness([{ kind: 'pending', id: 'cancelled' }], { signal: controller.signal });
    const work = h.run.execute(); await flush(); controller.abort();
    const terminal = h.run.state;
    expect(terminal).toMatchObject({ status: 'stopped', stopReason: 'cancelled' });
    expect(await work).toEqual(terminal);
    h.provider.resolve('cancelled', { candidate: { kind: 'refusal', reason: 'cannot_complete' } });
    await flush(); expect(h.run.state).toEqual(terminal); expect(h.onTerminal).toHaveBeenCalledTimes(1);
    expect(h.provider.agentCalls[0]!.signal.aborted).toBe(true); h.unchanged();
  });
  it('pre-aborted run has zero provider/tool calls', async () => {
    const controller = new AbortController(); controller.abort();
    const h = harness(undefined, { signal: controller.signal });
    expect(await settle(h.run, h.clock)).toMatchObject({ stopReason: 'cancelled', providerAttemptCount: 0, toolCallCount: 0 });
    h.unchanged();
  });
  it('does not dispatch a deferred provider operation after cancellation', async () => {
    const controller = new AbortController(); const h = harness(undefined, { signal: controller.signal });
    const work = h.run.execute(); await Promise.resolve(); controller.abort();
    expect(await work).toMatchObject({ stopReason: 'cancelled', providerAttemptCount: 0, stepCount: 0 });
    expect(h.provider.agentCalls).toHaveLength(0); h.unchanged();
  });
  it.each(['runId', 'gameId', 'handId', 'expectedVersion', 'factsRevision'] as const)('stale %s cannot publish a final result', async field => {
    const owner: Record<string, string | number> = {};
    const h = harness([{ kind: 'agent_tool' }, { kind: 'pending', id: 'stale-final' }],
      { isCurrent: identity => Object.entries(owner).every(([key, value]) => identity[key as keyof typeof identity] === value) });
    Object.assign(owner, { runId: h.options.runId, gameId: h.snapshot.gameId, handId: h.snapshot.handId,
      expectedVersion: h.snapshot.expectedVersion, factsRevision: h.snapshot.factsRevision });
    const work = h.run.execute(); await flush();
    owner[field] = typeof owner[field] === 'number' ? Number(owner[field]) + 1 : 'new-identity';
    h.provider.resolve('stale-final', { candidate: { kind: 'refusal', reason: 'cannot_complete' } });
    await flush(); const result = await work;
    expect(result).toMatchObject({ status: 'stopped', stopReason: 'stale_state', result: null });
    h.unchanged();
  });
  it('controlled reset/new-game owner aborts old run without changing its poker snapshot', async () => {
    const controller = new AbortController(); let gameEpoch = 1;
    const h = harness([{ kind: 'pending', id: 'old-game' }], { signal: controller.signal, isCurrent: () => gameEpoch === 1 });
    const work = h.run.execute(); await flush(); gameEpoch++; controller.abort(); await flush();
    expect(await work).toMatchObject({ stopReason: 'cancelled', result: null });
    h.provider.resolve('old-game', { candidate: { kind: 'refusal', reason: 'cannot_complete' } });
    await flush(); expect(h.onTerminal).toHaveBeenCalledTimes(1); h.unchanged();
  });
  it('trusted owner rejects a concurrent second run without replacing the active one', async () => {
    const ownerRunId = '00000000-0000-4000-8000-000000000003';
    const h = harness([{ kind: 'pending', id: 'owned' }], { isCurrent: identity => identity.runId === ownerRunId });
    const active = h.run.execute(); await flush();
    const duplicate = new BoundedAgentRun({ ...h.options, runId: '00000000-0000-4000-8000-000000000004' });
    expect(await duplicate.execute()).toMatchObject({ stopReason: 'stale_state', providerAttemptCount: 0 });
    expect(h.run.state.status).toBe('running'); expect(h.provider.agentCalls).toHaveLength(1);
    h.run.cancel(); await active; expect(h.run.state.stopReason).toBe('cancelled'); h.unchanged();
  });
  it('duplicate starts, cancellation and late replies cannot commit terminal status twice', async () => {
    const h = harness(); const [a, b] = await Promise.all([h.run.execute(), h.run.execute()]);
    h.run.cancel(); expect(await h.run.execute()).toEqual(a); expect(a).toEqual(b);
    expect(h.onTerminal).toHaveBeenCalledTimes(1); expect(h.provider.agentCalls).toHaveLength(2); h.unchanged();
  });
  it('bounds a pending tool and never enters step two after timeout', async () => {
    const executeTool = vi.fn(() => new Promise<unknown>(() => {}));
    const h = harness(undefined, { executeTool }); const work = h.run.execute(); await flush();
    h.clock.advance(1000); await flush();
    expect(await work).toMatchObject({ stopReason: 'tool_failed', failureCategory: 'tool_timeout', toolCallCount: 1 });
    expect(h.provider.agentCalls).toHaveLength(1); expect(executeTool).toHaveBeenCalledTimes(1); h.unchanged();
  });
});
