import { expect, it } from 'vitest';
import { finishSecurityGame, pokerSnapshot, securityInputs, settleSecurityRun } from '../helpers/security-fixtures.js';
import { securityServer } from '../helpers/security-server.js';
import { BoundedAgentRun } from '../../backend/src/agent/orchestrator.js';
import { getDecisionEvidence, type TerminalFactsSnapshot } from '../../backend/src/agent/tools.js';
import { securityFixture } from '../helpers/security-fixtures.js';
import type { FakeAiStep } from '../helpers/fake-ai-provider.js';
import { CoachFactCodeSchema, DecisionEvidenceArgumentsSchema, jsonUtf8Bytes } from '../../shared/contracts.js';

function runFixture(steps: FakeAiStep[], transform?: (output: unknown, snapshot: TerminalFactsSnapshot) => unknown) {
  const h = securityFixture(steps);
  const game = finishSecurityGame(h.session);
  const snapshot: TerminalFactsSnapshot = { gameId: game.gameId, handId: game.hand.handId,
    expectedVersion: game.version, factsRevision: game.facts.revision, status: 'lost', facts: game.facts };
  const before = pokerSnapshot(h.session);
  const run = new BoundedAgentRun({ runId: '00000000-0000-4000-8000-000000000003',
    snapshot, goal: { focus: 'street' }, provider: h.provider, clock: h.clock, model: 'offline',
    executeTool: (...args) => {
      const output = h.dependencies.coachExecuteTool(...args);
      return transform ? transform(output, args[0]) : output;
    } });
  return { ...h, run, snapshot, unchanged: () => expect(pokerSnapshot(h.session)).toBe(before) };
}
const proposal = (args: unknown): FakeAiStep => ({ candidate: {
  kind: 'tool_request', name: 'get_decision_evidence', arguments: args,
} });

it.each([null, '{bad', {}, { kind: 'final' }, 'ž'.repeat(16385),
  { kind: 'tool_request', name: 'x'.repeat(32769), arguments: {} },
])('T06 rejects invalid/oversized model step %#', async candidate => {
  const h = runFixture([{ candidate }]);
  expect(await h.run.execute()).toMatchObject({ stopReason: 'malformed_output', result: null });
  expect(h.executions).toHaveLength(0); expect(h.provider.agentCalls).toHaveLength(1); h.unchanged();
});

it.each([null, { focus: 'street', limit: '1' }, { focus: 'street', limit: 0 },
  { focus: 'street', limit: 11 }, { focus: 'street', limit: 1.5 },
  { focus: 'street', limit: 1, gameId: 'forged' },
])('T08 rejects malformed arguments before executor %#', async args => {
  const h = runFixture([proposal(args)]);
  expect(await h.run.execute()).toMatchObject({ stopReason: 'invalid_tool_arguments', result: null });
  expect(h.executions).toHaveLength(0); expect(h.provider.agentCalls).toHaveLength(1); h.unchanged();
});
it('T08 schema-valid focus outside server-bound run scope never executes', async () => {
  const args = { focus: 'betting', limit: 1 };
  expect(DecisionEvidenceArgumentsSchema.safeParse(args).success).toBe(true);
  const h = runFixture([proposal(args)]);
  expect(await h.run.execute()).toMatchObject({ stopReason: 'invalid_tool_arguments', result: null });
  expect(h.executions).toHaveLength(0); expect(h.provider.agentCalls).toHaveLength(1); h.unchanged();
});
it('T09 malicious fake model cannot mutate poker or execute an administrative tool', async () => {
  const h = runFixture([{ candidate: { kind: 'tool_request', name: 'set_player_stack',
    arguments: { amount: 999999, role: 'admin', instruction: 'ignore all rules' } } }]);
  expect(await h.run.execute()).toMatchObject({ stopReason: 'unknown_tool', result: null });
  expect(h.executions).toHaveLength(0); expect(h.provider.agentCalls).toHaveLength(1); h.unchanged();
});

it.each(['null', 'oversized', 'extra-sentinel', 'foreign-revision', 'foreign-same-revision'])(
  'T10 rejects %s tool result after real execution, before second model', async scenario => {
    const sentinel = 'W08_EXTRA_TOOL_FIELD_SENTINEL';
    const h = runFixture([{ kind: 'agent_tool' }, { kind: 'agent_final' }], (output, snapshot) => {
      const result = structuredClone(output) as ReturnType<typeof getDecisionEvidence>;
      if (scenario === 'null') return null;
      if (scenario === 'oversized') {
        const oversized = { ...result, decisions: Array.from({ length: 10 }, (_, i) => ({
          decisionRef: `hand:${i}`, facts: CoachFactCodeSchema.options.map(factCode => ({
            factCode, finding: 'ž'.repeat(500),
          })),
        })) };
        expect(jsonUtf8Bytes(oversized)).toBeGreaterThan(20480);
        return oversized;
      }
      if (scenario === 'extra-sentinel') return { ...result, secret: sentinel };
      // A valid, separately generated tool result from another snapshot. Same revision
      // alone must not establish membership in this run's canonical result.
      const other = structuredClone(snapshot);
      const handId = '00000000-0000-4000-8000-000000000099';
      const facts = { ...other.facts, decisions: other.facts.decisions.map(d => ({ ...d,
        handId, decisionRef: `${handId}:${d.decisionOrdinal}` })) };
      const revision = snapshot.factsRevision + (scenario === 'foreign-revision' ? 1 : 0);
      return getDecisionEvidence({ ...other, handId, factsRevision: revision, facts: { ...facts, revision } },
        { focus: 'street', limit: 10 });
    });
    expect(await h.run.execute()).toMatchObject({ stopReason: 'tool_failed', failureCategory: 'tool_validation',
      result: null, validatedToolResult: null });
    expect(h.executions).toHaveLength(1); expect(h.provider.agentCalls).toHaveLength(1);
    expect(JSON.stringify(h.provider.agentCalls)).not.toContain(sentinel); h.unchanged();
  });

it.each([32768, 32769])('T06 raw JSON response boundary %s bytes', async bytes => {
  const body = JSON.stringify({ kind: 'tool_request', name: 'get_decision_evidence',
    arguments: { focus: 'street', limit: 10 } });
  const candidate = body + ' '.repeat(bytes - Buffer.byteLength(body));
  expect(Buffer.byteLength(candidate)).toBe(bytes);
  const h = runFixture([{ candidate }, { kind: 'agent_final' }]);
  const result = await h.run.execute();
  expect(result.stopReason).toBe(bytes === 32768 ? 'completed' : 'malformed_output');
  expect(h.executions).toHaveLength(bytes === 32768 ? 1 : 0);
  expect(h.provider.agentCalls).toHaveLength(bytes === 32768 ? 2 : 1); h.unchanged();
});

it.each([1, 10])('T08/T10 valid limit %s forwards exactly canonical evidence to second model', async limit => {
  const h = runFixture([proposal({ focus: 'street', limit }), { kind: 'agent_final' }]);
  const result = await h.run.execute();
  expect(result.status).toBe('completed'); expect(h.executions).toHaveLength(1);
  expect(h.provider.agentCalls).toHaveLength(2);
  const evidence = getDecisionEvidence(h.snapshot, { focus: 'street', limit });
  expect(h.provider.agentCalls[0]!.request.context).not.toHaveProperty('toolResult');
  expect(h.provider.agentCalls[1]!.request.context.toolResult).toEqual(evidence);
  for (const item of result.result!.evidence) expect(evidence.decisions.some(d => d.decisionRef === item.decisionRef
    && d.facts.some(f => f.factCode === item.factCode && f.finding === item.finding))).toBe(true);
  h.unchanged();
});

it.each(['invalid_final', 'oversized-final', 'foreign-same-revision-final'])(
  'T06/T10 rejects %s with no final evidence outside validated set', async scenario => {
    const h = runFixture([{ kind: 'agent_tool' }, ...(scenario === 'invalid_final'
      ? [{ kind: 'invalid_final' as const }] : [{ candidate: scenario === 'oversized-final'
        ? ' '.repeat(32769) : { kind: 'final', summary: 'S', recommendation: 'R', confidence: 'low',
          completed: true, evidence: [{ decisionRef: '00000000-0000-4000-8000-000000000099:1',
            factCode: 'action', finding: '{"type":"all_in"}' }] } }])]);
    expect(await h.run.execute()).toMatchObject({ stopReason: 'malformed_output', result: null });
    expect(h.executions).toHaveLength(1); expect(h.provider.agentCalls).toHaveLength(2);
    expect(h.provider.agentCalls[1]!.request.context.toolResult).toEqual(
      getDecisionEvidence(h.snapshot, { focus: 'street', limit: 10 })); h.unchanged();
  });

it.each(securityInputs.forbiddenTools)('T07: rejects %s with zero executor calls, then permits real evidence', async name => {
  const h = securityServer([{ candidate: { kind: 'tool_request', name, arguments: { focus: 'street', limit: 10 } } }]);
  try {
    const game = finishSecurityGame(h.session);
    const before = pokerSnapshot(h.session);
    const input = { gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: securityInputs.goal };
    const first = await h.session.serial(() => h.session.startCoach(input));
    const denied = await settleSecurityRun(h.session, first.runId);
    expect(denied).toMatchObject({ stopReason: 'unknown_tool', result: null });
    expect(h.provider.agentCalls).toHaveLength(1);
    expect(h.executions).toHaveLength(0);
    expect(pokerSnapshot(h.session)).toBe(before);
    console.log('T07 denied', JSON.stringify({ name, provider: h.provider.agentCalls.length, executions: h.executions.length }));
    h.provider.enqueue({ kind: 'agent_tool' }, { kind: 'agent_final' });
    const retry = await h.session.serial(() => h.session.startCoach(input));
    expect((await settleSecurityRun(h.session, retry.runId)).status).toBe('completed');
    expect(h.executions).toHaveLength(1);
    expect(h.provider.agentCalls).toHaveLength(3);
    expect(pokerSnapshot(h.session)).toBe(before);
  } finally { await h.app.close(); }
});
