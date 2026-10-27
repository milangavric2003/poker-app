import { expect, it } from 'vitest';
import { CoachResponseSchema } from '../../shared/contracts.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';
import { finishSecurityGame, pokerSnapshot, securityInputs, settleSecurityRun } from '../helpers/security-fixtures.js';
import { securityServer } from '../helpers/security-server.js';

it('T00: terminal game, two model steps, real evidence executor and read-only poker', async () => {
  const h = securityServer([{ kind: 'agent_tool' }, { kind: 'agent_final' }]);
  processUsageStore.reset(processUsageStore.snapshot().revision);
  try {
    const game = finishSecurityGame(h.session);
    expect(game.hand.phase).toBe('complete');
    expect(game.hand.gameStatus).toBe('lost');
    expect(game.hand.players.map(player => player.stack)).toEqual([0, 2000]);
    const before = pokerSnapshot(h.session);
    const response = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: {
      gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: securityInputs.goal,
    } });
    expect(response.statusCode).toBe(202);
    const started = CoachResponseSchema.parse(response.json()).run;
    const run = await settleSecurityRun(h.session, started.runId);
    CoachResponseSchema.parse({ run });
    expect(run).toMatchObject({ status: 'completed', stepCount: 2, providerAttemptCount: 2, toolCallCount: 1 });
    expect(h.provider.agentCalls).toHaveLength(2);
    expect(h.executions).toHaveLength(1);
    expect(run.result?.completed).toBe(true);
    expect(run.result?.evidence.length).toBeGreaterThan(0);
    expect(pokerSnapshot(h.session)).toBe(before);
    expect(processUsageStore.snapshot().coach).toMatchObject({ runCount: 1, toolExecutionCount: 1 });
    console.log('T00 actual', JSON.stringify({ steps: h.provider.agentCalls.length, executions: h.executions.length,
      status: run.status, pokerPreserved: pokerSnapshot(h.session) === before }));
  } finally { await h.app.close(); }
});
