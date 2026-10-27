import { expect, test } from '@playwright/test';
import { startCoachServers } from '../helpers/coach-server.js';

test('T15 browser display, storage and forged requests cannot become server poker state or limits', async ({ page }) => {
  const servers = await startCoachServers();
  try {
    const before = await servers.snapshot();
    await page.goto(servers.origin);
    const result = page.getByRole('region', { name: 'Rezultat ruke' });
    const actualText = await result.innerText();
    await result.evaluate(el => { el.textContent = 'FORGED WIN 999999'; });
    await page.evaluate(() => {
      for (const key of ['game', 'pokerState', 'role', 'maxSteps']) localStorage.setItem(key,
        JSON.stringify({ status: 'won', stacks: [999999], role: 'admin', maxSteps: 999 }));
    });
    expect(await servers.snapshot()).toEqual(before);
    await page.reload();
    await expect(result).toHaveText(actualText, { useInnerText: true });
    expect(await servers.snapshot()).toEqual(before);

    const input = { gameId: servers.terminal.gameId, handId: servers.terminal.handId,
      expectedVersion: servers.terminal.version, goal: { focus: 'street' } };
    const denied = await page.evaluate(async body => {
      const response = await fetch('/api/game/coach', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, role: 'admin', maxSteps: 999, model: 'forged',
          result: { status: 'won', stacks: [999999] } }) });
      return { status: response.status, body: await response.json() };
    }, input);
    expect(denied).toMatchObject({ status: 400, body: { error: { code: 'INVALID_INPUT' } } });
    expect(servers.provider.agentCalls).toHaveLength(0); expect(servers.toolCount()).toBe(0);
    expect(await servers.snapshot()).toEqual(before);

    await page.getByRole('combobox', { name: 'Coaching cilj' }).selectOption('street');
    await page.getByRole('button', { name: 'Pokreni coaching' }).click();
    await expect.poll(() => servers.provider.pending.has('first')).toBe(true);
    servers.provider.enqueue({ kind: 'agent_final' });
    servers.provider.resolve('first', { candidate: { kind: 'tool_request', name: 'get_decision_evidence',
      arguments: { focus: 'street', limit: 10 } } });
    const coach = page.getByRole('region', { name: 'Coaching partije' });
    await expect(coach.getByRole('status')).toHaveText('Coaching je završen.');
    expect(servers.provider.agentCalls.map(c => c.stepOrdinal)).toEqual([1, 2]);
    expect(servers.provider.agentCalls.every(c => c.model !== 'forged')).toBe(true);
    expect(servers.toolCount()).toBe(1);
    expect(await servers.snapshot()).toEqual(before);
    await expect(result).toHaveText(actualText, { useInnerText: true });
    // App has no poker-state storage reader: reload obtains the real GET /api/game.
    // Credentials/cookies are absent; origin rejection is asserted at HTTP boundary.
    expect(await page.context().cookies()).toEqual([]);
  } finally { await servers.close(); }
});
