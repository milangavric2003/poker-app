import { expect, test } from '@playwright/test';
import { startTestServers } from '../helpers/server.js';

test('offline fake provider fills dashboard; either reset leaves the other state alone', async ({ page }) => {
  const servers = await startTestServers(false, true);
  try {
    await page.goto(servers.origin);
    await page.getByLabel('Broj botova').selectOption('1');
    await page.getByLabel(/AI re/).check();
    await page.getByRole('button', { name: 'Nova partija' }).click();
    await expect(page.getByRole('region', { name: 'Poker sto' })).toBeVisible();
    await page.getByRole('button', { name: 'Call 5' }).click();
    await expect.poll(async () => {
      const response = await page.request.get(`${servers.origin}/api/game`);
      return (await response.json()).game?.version ?? 0;
    }).toBeGreaterThan(1);
    await expect.poll(async () => (await (await page.request.get(`${servers.origin}/api/ai/usage`)).json()).usage.logical
      .filter((row: { purpose: string }) => row.purpose === 'bot').reduce((sum: number, row: { count: number }) => sum + row.count, 0))
      .toBeGreaterThanOrEqual(1);
    await page.getByRole('button', { name: 'AI upotreba' }).click();
    await expect(page.getByText('Logical requests')).toBeVisible();
    await expect(page.getByText('Attempts')).toBeVisible();
    await page.getByText('Logical requests').click();
    await page.getByText('Attempts').click();
    await expect(page.getByRole('table').first()).toContainText('model_success');
    const beforeMetricReset = await (await page.request.get(`${servers.origin}/api/game`)).json();
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Resetuj metrike' }).click();
    await expect.poll(async () => await (await page.request.get(`${servers.origin}/api/ai/usage`)).json())
      .toMatchObject({ usage: { logical: [], attempts: [] } });
    expect(await (await page.request.get(`${servers.origin}/api/game`)).json()).toEqual(beforeMetricReset);
    const usageRevision = (await (await page.request.get(`${servers.origin}/api/ai/usage`)).json()).usage.revision;
    const game = beforeMetricReset.game;
    const replacement = await page.request.post(`${servers.origin}/api/game`, {
      headers: { 'if-match': `"${game.gameId}:${game.version}"` }, data: { botCount: 1, aiMode: false } });
    expect(replacement.status()).toBe(201);
    expect((await (await page.request.get(`${servers.origin}/api/ai/usage`)).json()).usage.revision).toBe(usageRevision);
  } finally { await servers.close(); }
});

