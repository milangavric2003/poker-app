import { expect, it } from 'vitest';
import { finishSecurityGame, pokerSnapshot, securityInputs, settleSecurityRun } from '../helpers/security-fixtures.js';
import { securityServer } from '../helpers/security-server.js';

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
