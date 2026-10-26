import { expect, it, vi } from 'vitest';
import { securityFixture, finishSecurityGame, pokerSnapshot, settleSecurityRun } from '../helpers/security-fixtures.js';
import { processCapacity } from '../../backend/src/security/capacity.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';

async function flush() { for (let i = 0; i < 120; i++) await Promise.resolve(); }
it.each(['resolve', 'reject'])('T17 noncooperative job -> new game + usage reset -> new start -> late %s', async late => {
  const commits = vi.spyOn(processUsageStore, 'recordCoach');
  const h = securityFixture(); let active = 0; let maximum = 0;
  const original = h.provider.generateAgent.bind(h.provider);
  vi.spyOn(h.provider, 'generateAgent').mockImplementation(async (...args) => {
    active++; maximum = Math.max(active, maximum);
    try { return await original(...args); } finally { active--; }
  });
  const start = () => {
    const game = h.session.get()!;
    return h.session.startCoach({ gameId: game.gameId, handId: game.hand.handId,
      expectedVersion: game.version, goal: { focus: 'street' } });
  };
  finishSecurityGame(h.session); h.provider.enqueue({ kind: 'pending', id: 'old' });
  const old = start(); await flush(); expect(active).toBe(1);
  const epoch = processUsageStore.currentEpoch();
  finishSecurityGame(h.session); // Actual create/action lifecycle, terminal fixture via legal all-in.
  processUsageStore.reset(processUsageStore.snapshot().revision);
  expect(processUsageStore.currentEpoch()).toBeGreaterThan(epoch);
  expect(h.provider.agentCalls[0]!.signal.aborted).toBe(true); expect(processCapacity.current.active).toBe(1);
  expect(() => h.session.coachStatus(old.runId)).toThrow('pronađen');
  h.provider.enqueue({ kind: 'pending', id: 'new' }); const current = start(); await flush();
  const gameBefore = pokerSnapshot(h.session); const coachBefore = h.session.coachStatus(current.runId);
  const usageBefore = processUsageStore.snapshot();
  expect({ active, maximum }).toEqual({ active: 2, maximum: 2 });
  const other = securityFixture(); finishSecurityGame(other.session); const g = other.session.get()!;
  expect(() => other.session.startCoach({ gameId: g.gameId, handId: g.hand.handId, expectedVersion: g.version,
    goal: { focus: 'street' } })).toThrow('kapacitet'); expect(other.provider.agentCalls).toHaveLength(0);
  if (late === 'resolve') h.provider.resolve('old', { candidate: { kind: 'tool_request', name: 'get_decision_evidence',
    arguments: { focus: 'street', limit: 10 } } });
  else h.provider.reject('old', new Error('late failure'));
  await flush(); expect(active).toBe(1); expect(processCapacity.current.active).toBe(1);
  expect(pokerSnapshot(h.session)).toBe(gameBefore); expect(h.session.coachStatus(current.runId)).toEqual(coachBefore);
  expect(processUsageStore.snapshot()).toEqual(usageBefore); expect(h.executions).toHaveLength(0);
  h.provider.enqueue({ kind: 'agent_final' });
  h.provider.resolve('new', { candidate: { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 10 } } });
  expect((await settleSecurityRun(h.session, current.runId)).status).toBe('completed'); await flush();
  expect(active).toBe(0); expect(processCapacity.current.active).toBe(0); expect(maximum).toBe(2);
  expect(h.executions).toHaveLength(1); expect(processUsageStore.snapshot().coach?.runCount).toBe(1);
  expect(commits.mock.calls.filter(([state]) => state.runId === current.runId)).toHaveLength(1);
  expect(commits.mock.calls.find(([state]) => state.runId === current.runId)![0].terminalTransitionCount).toBe(1);
  // The cancelled accepted old run still consumes one of five tokens after reset.
  for (let i = 0; i < 3; i++) {
    h.provider.enqueue({ kind: 'agent_refusal' }); const run = start(); await settleSecurityRun(h.session, run.runId);
  }
  expect(() => start()).toThrow('ograničenje');
  const usage = processUsageStore.snapshot(); await flush(); expect(processUsageStore.snapshot()).toEqual(usage);
  commits.mockRestore();
});
