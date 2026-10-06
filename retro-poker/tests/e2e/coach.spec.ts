import { expect, test, type Page } from '@playwright/test';
import { ProviderError } from '../../backend/src/ai/types.js';
import { CoachResponseSchema } from '../../shared/contracts.js';
import { startCoachServers } from '../helpers/coach-server.js';

test.use({ viewport: { width: 1280, height: 720 } });
async function keyboardStart(page: Page) {
  const goal = page.getByRole('combobox', { name: 'Coaching cilj' });
  // Tab from the page through native controls, without mouse/focus shortcuts.
  for (let i = 0; i < 20 && !await goal.evaluate(el => el === document.activeElement); i++) await page.keyboard.press('Tab');
  await expect(goal).toBeFocused();
  await expect(goal).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
  await expect(goal).toHaveValue('street');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Pokreni coaching' })).toBeFocused();
  const response = page.waitForResponse(r => r.url().endsWith('/api/game/coach') && r.request().method() === 'POST');
  await page.keyboard.press('Enter');
  return CoachResponseSchema.parse(await (await response).json()).run;
}
function noPrivateData(text: string) {
  expect(text).not.toMatch(/PRIVATE_PROVIDER|chain.of.thought|raw provider|stack trace|system prompt|api.key/i);
}
test('T023 keyboard success uses real backend validation and preserves poker result', async ({ page }) => {
  const servers = await startCoachServers();
  try {
    const before = await servers.snapshot();
    await page.goto(servers.origin);
    const resultText = await page.getByRole('region', { name: 'Rezultat ruke' }).innerText();
    const run = await keyboardStart(page);
    const coach = page.getByRole('region', { name: 'Coaching partije' });
    await expect(coach.getByRole('status')).toHaveText('Coaching je u toku…');
    await expect(coach.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await expect(coach.getByText('Izabrani cilj: Odluke po fazama')).toBeVisible();
    await expect.poll(() => servers.provider.pending.has('first')).toBe(true);
    servers.provider.enqueue({ kind: 'agent_final' });
    servers.provider.resolve('first', { candidate: { kind: 'tool_request', name: 'get_decision_evidence',
      arguments: { focus: 'street', limit: 10 } } });
    await expect(coach.getByRole('status')).toHaveText('Coaching je završen.');
    await expect(coach.getByText('Pregled dostupnih odluka.')).toBeVisible();
    await expect(coach.getByText('Proveri legalne opcije pre odluke.')).toBeVisible();
    const terminal = await servers.status(run.runId);
    expect(terminal).toMatchObject({ status: 'completed', stepCount: 2, toolCallCount: 1, providerAttemptCount: 2 });
    expect(servers.toolCount()).toBe(1);
    expect(servers.provider.agentCalls).toHaveLength(2);
    expect(terminal.result?.evidence.length).toBeGreaterThan(0);
    for (const evidence of terminal.result!.evidence) {
      await expect(coach.getByRole('listitem').filter({ hasText: evidence.decisionRef })).toContainText(evidence.finding);
    }
    expect(await servers.snapshot()).toEqual(before);
    expect(await page.getByRole('region', { name: 'Rezultat ruke' }).innerText()).toBe(resultText);
    noPrivateData(await page.locator('body').innerText());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await coach.scrollIntoViewIfNeeded();
    const statusBox = await coach.getByRole('status').boundingBox();
    expect(statusBox && statusBox.x >= 0 && statusBox.x + statusBox.width <= 1280).toBeTruthy();
    await expect(coach.getByRole('status')).toHaveCSS('font-size', '16px');
  } finally { await servers.close(); }
});

for (const scenario of ['unknown_tool', 'provider_timeout'] as const) {
  test(`T023 ${scenario} is safe, executes no tool and retries only by keyboard`, async ({ page }) => {
    const servers = await startCoachServers();
    try {
      const before = await servers.snapshot();
      let posts = 0; let gets = 0;
      page.on('request', request => {
        if (request.url().endsWith('/api/game/coach') && request.method() === 'POST') posts++;
        if (request.url().includes('/api/game/coach/') && request.method() === 'GET') gets++;
      });
      await page.goto(servers.origin);
      const run = await keyboardStart(page);
      const coach = page.getByRole('region', { name: 'Coaching partije' });
      await expect(coach.getByRole('status')).toHaveText('Coaching je u toku…');
      await expect.poll(() => servers.provider.pending.has('first')).toBe(true);
      if (scenario === 'unknown_tool') servers.provider.resolve('first', { candidate: { kind: 'tool_request',
        name: 'PRIVATE_PROVIDER_shell', arguments: { path: 'PRIVATE_PROVIDER_prompt' } } });
      else servers.provider.reject('first', new ProviderError('timeout'));
      await expect(coach.getByRole('alert')).toContainText(scenario === 'unknown_tool' ? 'zaustavljen' : 'nije uspeo');
      await expect(coach.getByText(scenario === 'unknown_tool'
        ? 'Razlog zaustavljanja: Predloženi alat nije dozvoljen.'
        : 'Razlog zaustavljanja: AI servis nije uspeo da završi zahtev.')).toBeVisible();
      const terminal = await servers.status(run.runId);
      expect(terminal).toMatchObject({ status: scenario === 'unknown_tool' ? 'stopped' : 'failed', result: null, toolCallCount: 0 });
      expect(servers.toolCount()).toBe(0);
      await expect(coach.getByRole('heading', { name: 'Coaching sažetak' })).toHaveCount(0);
      noPrivateData(await page.locator('body').innerText());
      expect(await servers.snapshot()).toEqual(before);
      const terminalGets = gets;
      await page.waitForTimeout(2200);
      expect(posts).toBe(1); expect(gets).toBe(terminalGets);
      expect(servers.provider.agentCalls).toHaveLength(1);
      servers.provider.enqueue({ kind: 'pending', id: 'retry' }, { kind: 'agent_final' });
      const retry = coach.getByRole('button', { name: 'Pokušaj coaching ponovo' });
      // Start button lost focus when disabled; recover with keyboard Tab navigation.
      for (let i = 0; i < 20 && !await retry.evaluate(el => el === document.activeElement); i++) await page.keyboard.press('Tab');
      await expect(retry).toBeFocused();
      await expect(retry).toHaveCSS('outline-style', 'solid');
      const response = page.waitForResponse(r => r.url().endsWith('/api/game/coach') && r.request().method() === 'POST');
      await page.keyboard.press('Enter');
      const newRun = CoachResponseSchema.parse(await (await response).json()).run;
      expect(newRun.runId).not.toBe(run.runId);
      await expect.poll(() => servers.provider.pending.has('retry')).toBe(true);
      servers.provider.resolve('retry', { candidate: { kind: 'tool_request', name: 'get_decision_evidence',
        arguments: { focus: 'street', limit: 10 } } });
      await expect(coach.getByRole('status')).toHaveText('Coaching je završen.');
      expect(posts).toBe(2); expect(servers.toolCount()).toBe(1);
      expect(await servers.snapshot()).toEqual(before);
      noPrivateData(await page.locator('body').innerText());
    } finally { await servers.close(); }
  });
}
