import { describe, expect, it, vi } from 'vitest';
import { GameSession } from '../../backend/src/session.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { getDecisionEvidence } from '../../backend/src/agent/tools.js';
import { CoachResponseSchema } from '../../shared/contracts.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';
import { FakeAiProvider, type FakeAiStep } from '../helpers/fake-ai-provider.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

function harness(steps: FakeAiStep[]) {
  const provider = new FakeAiProvider(steps); const tool = vi.fn(getDecisionEvidence);
  const session = new GameSession({ deck: ['As', 'Kc', 'Ah', 'Kd', ...ac23Deck.slice(4)],
    deckRandom: sequenceRandom([]), botRandom: sequenceRandom(Array<number>(100).fill(0.9)),
    aiConfig: loadAiConfig({ GEMINI_API_KEY: 'fake' }), aiProvider: provider, coachExecuteTool: tool });
  let game = session.create(1); game = session.action({ gameId: game.gameId, handId: game.hand.handId,
    expectedVersion: game.version, type: 'all_in' });
  const input = { gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: { focus: 'street' as const } };
  return { session, game, input, provider, tool };
}
async function flush() { for (let i = 0; i < 100; i++) await Promise.resolve(); }
describe('T019 session coach ownership', () => {
  it('dispatches only after the start mutation lock has been released', async () => {
    const h = harness([{ kind: 'pending', id: 'lock' }]);
    let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
    const start = h.session.serial(async () => { const run = h.session.startCoach(h.input); await barrier; return run; });
    await flush(); const callsWhileLocked = h.provider.agentCalls.length;
    release(); await start; await flush(); h.session.create(1); await flush();
    expect(callsWhileLocked).toBe(0); expect(h.provider.agentCalls).toHaveLength(1);
  });
  it.each(['epoch', 'replacement', 'revision'] as const)('does not record late evidence after %s invalidation', async mode => {
    processUsageStore.reset(processUsageStore.snapshot().revision);
    const h = harness([{ kind: 'pending', id: 'late-usage' }, { kind: 'agent_final' }]);
    const run = await h.session.serial(() => h.session.startCoach(h.input)); await flush();
    if (mode === 'epoch') processUsageStore.reset(processUsageStore.snapshot().revision);
    else if (mode === 'replacement') await h.session.serial(() => h.session.create(1));
    else h.game.facts = { ...h.game.facts, revision: h.game.facts.revision + 1 };
    h.provider.pending.get('late-usage')!.resolve({ candidate: { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 10 } } });
    await flush(); expect(processUsageStore.snapshot().coach.runCount).toBe(0);
    if (mode !== 'epoch') { expect(h.tool).not.toHaveBeenCalled(); expect(() => h.session.coachStatus(run.runId)).toThrow(); }
    else expect(h.session.coachStatus(run.runId).status).toBe('completed');
  });
  it('completes only validated final output and preserves the entire poker snapshot', async () => {
    const h = harness([{ kind: 'agent_tool' }, { kind: 'agent_final' }]); const before = JSON.stringify(h.game);
    const started = await h.session.serial(() => h.session.startCoach(h.input));
    expect(['running', 'created']).toContain(started.status); await flush();
    const run = h.session.coachStatus(started.runId);
    CoachResponseSchema.parse({ run }); expect(run).toMatchObject({ status: 'completed', stepCount: 2, toolCallCount: 1, providerAttemptCount: 2 });
    expect(h.tool).toHaveBeenCalledTimes(1); expect(JSON.stringify(h.game)).toBe(before);
    const publicText = JSON.stringify(run);
    for (const field of ['prompt', 'chainOfThought', 'candidate', 'apiKey', 'stack', 'validatedToolResult', 'attempts']) expect(publicText).not.toContain(field);
  });
  it.each(['unknown_tool', 'invalid_arguments', 'auth_config', 'invalid_final'] as const)('safely terminates %s and explicit retry gets a new ID', async kind => {
    const h = harness(kind === 'invalid_final' ? [{ kind: 'agent_tool' }, { kind }] : [{ kind }]);
    const first = await h.session.serial(() => h.session.startCoach(h.input)); await flush();
    expect(['failed', 'stopped']).toContain(h.session.coachStatus(first.runId).status);
    expect(h.session.coachStatus(first.runId).result).toBeNull();
    if (kind !== 'invalid_final') expect(h.tool).not.toHaveBeenCalled();
    h.provider.enqueue({ kind: 'agent_tool' }, { kind: 'agent_final' });
    const retry = await h.session.serial(() => h.session.startCoach(h.input)); expect(retry.runId).not.toBe(first.runId);
    await flush(); expect(h.session.coachStatus(retry.runId).status).toBe('completed');
  });
  it('releases serial lock, deduplicates, aborts replacement and ignores a late provider', async () => {
    const h = harness([{ kind: 'pending', id: 'late' }]);
    const first = await h.session.serial(() => h.session.startCoach(h.input)); await flush();
    const same = await h.session.serial(() => h.session.startCoach(h.input)); expect(same.runId).toBe(first.runId);
    expect(h.provider.agentCalls).toHaveLength(1);
    const replacement = await h.session.serial(() => h.session.create(1)); const before = JSON.stringify(replacement);
    expect(h.provider.agentCalls[0]!.signal.aborted).toBe(true);
    h.provider.pending.get('late')!.resolve({ candidate: { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 10 } } });
    await flush(); expect(JSON.stringify(h.session.get())).toBe(before); expect(h.tool).not.toHaveBeenCalled();
    expect(() => h.session.coachStatus(first.runId)).toThrow();
  });
  it('rejects stale versions with no provider/tool or poker mutation', async () => {
    const h = harness([]); const before = JSON.stringify(h.game);
    await expect(h.session.serial(() => h.session.startCoach({ ...h.input, expectedVersion: 0 }))).rejects.toThrow();
    expect(h.provider.agentCalls).toHaveLength(0); expect(h.tool).not.toHaveBeenCalled(); expect(JSON.stringify(h.game)).toBe(before);
  });
  it('contains a raw tool exception inside safe terminal DTO and records one terminal outcome', async () => {
    processUsageStore.reset(processUsageStore.snapshot().revision);
    const h = harness([{ kind: 'agent_tool' }]);
    h.tool.mockImplementation(() => { throw new Error('raw-prompt private-secret raw-provider-body stack-trace'); });
    const started = await h.session.serial(() => h.session.startCoach(h.input)); await flush();
    const run = h.session.coachStatus(started.runId);
    expect(run).toMatchObject({ status: 'failed', stopReason: 'tool_failed', failureCategory: 'tool_error', result: null });
    for (const secret of ['raw-prompt', 'private-secret', 'raw-provider-body', 'stack-trace']) expect(JSON.stringify(run)).not.toContain(secret);
    for (let i = 0; i < 3; i++) h.session.coachStatus(started.runId);
    expect(processUsageStore.snapshot().coach).toMatchObject({ runCount: 1, toolExecutionCount: 1, stopReasons: [{ reason: 'tool_failed', count: 1 }] });
  });
});
