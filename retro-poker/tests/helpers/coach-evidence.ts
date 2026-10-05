/** Offline evidence projection for T024/demo; no server, key or raw context output. */
import assert from 'node:assert/strict';
import { BoundedAgentRun } from '../../backend/src/agent/orchestrator.js';
import { getDecisionEvidence, type TerminalFactsSnapshot } from '../../backend/src/agent/tools.js';
import { FakeAiProvider, type FakeAiStep } from './fake-ai-provider.js';
import { FakeClock } from './fake-clock.js';

const gameId = '00000000-0000-4000-8000-000000000001';
const handId = '00000000-0000-4000-8000-000000000002';
const snapshot: TerminalFactsSnapshot = { gameId, handId, expectedVersion: 5,
  factsRevision: 1, status: 'lost', facts: { gameId, revision: 1, nextDecisionOrdinal: 2,
    aggregates: [], decisions: [{ gameId, handId, expectedVersion: 2,
      decisionRef: `${handId}:1`, decisionOrdinal: 1, handNumber: 1,
      knowledge: { phase: 'flop', board: [], holeCards: ['As', 'Kd'], humanStackAtHandStart: 1000,
        players: [], pots: [], events: [], legalActions: [{ type: 'call', payAmount: 10, isAllIn: false }] },
      chosenAction: { type: 'call' }, outcome: null }] } };
const success: FakeAiStep[] = [{ kind: 'agent_tool' }, { kind: 'agent_final' }];
const scenarios: Array<{ name: string; steps: FakeAiStep[]; reason: string; tools: number;
  empty?: boolean; stepLimit?: number }> = [
  { name: 'success', steps: success, reason: 'completed', tools: 1 },
  { name: 'unknown_tool', steps: [{ kind: 'unknown_tool' }], reason: 'unknown_tool', tools: 0 },
  { name: 'invalid_arguments', steps: [{ kind: 'invalid_arguments' }], reason: 'invalid_tool_arguments', tools: 0 },
  { name: 'provider_failure', steps: [{ kind: 'auth_config' }], reason: 'provider_failed', tools: 0 },
  { name: 'repeated_action', steps: [{ kind: 'agent_tool' }, { kind: 'agent_tool' }], reason: 'repeated_action', tools: 1 },
  { name: 'step_limit', steps: success, reason: 'step_limit', tools: 1, stepLimit: 1 },
  { name: 'invalid_final', steps: [{ kind: 'agent_tool' }, { kind: 'invalid_final' }], reason: 'malformed_output', tools: 1 },
  { name: 'insufficient', steps: [], reason: 'insufficient_evidence', tools: 0, empty: true },
];
for (const scenario of scenarios) {
  const provider = new FakeAiProvider(structuredClone(scenario.steps));
  const source = scenario.empty ? { ...structuredClone(snapshot),
    facts: { ...structuredClone(snapshot.facts), decisions: [] } } : structuredClone(snapshot);
  const before = JSON.stringify(source);
  let executions = 0;
  const run = new BoundedAgentRun({ runId: '00000000-0000-4000-8000-000000000003',
    snapshot: source, goal: { focus: 'street' }, provider, clock: new FakeClock(), model: 'offline-fake',
    limits: { maxAttemptsPerStep: 1, ...(scenario.stepLimit ? { maxSteps: scenario.stepLimit } : {}) },
    executeTool: (...args) => { executions++; return getDecisionEvidence(...args); } });
  const state = await run.execute();
  assert.equal(state.stopReason, scenario.reason);
  assert.equal(state.toolCallCount, scenario.tools);
  assert.equal(executions, scenario.tools);
  assert.equal(state.terminalTransitionCount, 1);
  assert.equal(JSON.stringify(source), before);
  if (scenario.name === 'success') {
    assert.equal(state.stepCount, 2); assert.equal(state.providerAttemptCount, 2);
    assert.equal(state.result?.completed, true);
  } else assert.equal(state.result, null);
  console.log(JSON.stringify({ scenario: scenario.name, provider: 'offline-fake',
    status: state.status, stopReason: state.stopReason, failureCategory: state.failureCategory,
    stepCount: state.stepCount, providerAttemptCount: state.providerAttemptCount,
    toolAttemptCount: state.toolAttemptCount, toolCallCount: state.toolCallCount,
    toolRejectionCount: state.toolRejectionCount, validationCount: state.validationCount,
    validationRejectedCount: state.validationRejectedCount, terminalTransitionCount: state.terminalTransitionCount,
    attempts: state.attempts.map(a => ({ step: a.stepOrdinal, attempt: a.attemptOrdinal, relation: a.relation, outcome: a.outcome })),
    result: state.result && { summary: state.result.summary, recommendation: state.result.recommendation,
      evidence: state.result.evidence, confidence: state.result.confidence, completed: state.result.completed },
    readOnlySnapshotPreserved: true }));
}
