import { expect, it } from 'vitest';
import { finishSecurityGame, pokerSnapshot, securityInputs, settleSecurityRun } from '../helpers/security-fixtures.js';
import { securityServer } from '../helpers/security-server.js';

it('T13 initial: sixth new completed-run start within 60 seconds is rate limited', async () => {
  const h = securityServer();
  try {
    const game = finishSecurityGame(h.session);
    const before = pokerSnapshot(h.session);
    const ids = new Set<string>();
    const statuses: number[] = [];
    const errors: unknown[] = [];
    for (const at of securityInputs.burstTimes) {
      h.clock.advance(at - h.clock.now());
      h.provider.enqueue({ kind: 'agent_tool' }, { kind: 'agent_final' });
      const response = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: {
        gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: securityInputs.goal,
      } });
      statuses.push(response.statusCode);
      if (response.statusCode === 202) {
        const id = response.json().run.runId as string;
        expect(ids.has(id)).toBe(false); ids.add(id);
        expect((await settleSecurityRun(h.session, id)).status).toBe('completed');
      } else errors.push(response.json());
    }
    const actual = { times: securityInputs.burstTimes, statuses, accepted: ids.size,
      provider: h.provider.agentCalls.length, executions: h.executions.length, errors };
    console.log('T13 actual', JSON.stringify(actual));
    expect(pokerSnapshot(h.session)).toBe(before);
    expect(statuses.slice(0, 5)).toEqual([202, 202, 202, 202, 202]);
    expect(statuses[5]).toBe(429);
    expect(errors).toEqual([{ error: expect.objectContaining({ code: 'AI_RATE_LIMITED' }) }]);
    expect(ids.size).toBe(5);
    expect(h.provider.agentCalls).toHaveLength(10);
    expect(h.executions).toHaveLength(5);
  } finally { await h.app.close(); }
});
