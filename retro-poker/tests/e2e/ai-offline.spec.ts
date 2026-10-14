import { expect, test } from '@playwright/test';
import { startTestServers } from '../helpers/server.js';
import { GameResponseSchema } from '../../shared/contracts.js';

test('offline fake provider covers bot, analysis retry, dashboard and independent resets', async ({ page }) => {
  const servers = await startTestServers(false, true, 0);
  try {
    let analysisPosts = 0;
    let navigations = 0;
    page.on('request', request => {
      if (request.url().endsWith('/api/game/analysis') && request.method() === 'POST') analysisPosts++;
      if (request.isNavigationRequest()) navigations++;
    });
    await page.goto(servers.origin);
    await page.getByLabel('Broj botova').selectOption('1');
    await page.getByLabel(/AI re/).check();
    await page.getByRole('button', { name: 'Nova partija' }).click();
    await expect(page.getByRole('region', { name: 'Poker sto' })).toBeVisible();
    await page.getByRole('button', { name: /All-in/i }).click();
    await expect(page.getByLabel(/AI obrađuje potez/i)).toBeVisible();
    await expect.poll(async () => (await (await page.request.get(`${servers.origin}/api/game`)).json()).game)
      .toMatchObject({ status: expect.stringMatching(/won|lost/), ai: {
        active: null, lastBotOutcome: { outcome: 'model' },
      } });
    const terminalResponse = await (await page.request.get(`${servers.origin}/api/game`)).json();
    const parsedTerminal = GameResponseSchema.safeParse(terminalResponse);
    if (!parsedTerminal.success) throw new Error(JSON.stringify(parsedTerminal.error.issues));
    await expect(page.getByText(/Pobeda u partiji|Poraz u partiji/)).toBeVisible();
    const terminal = await (await page.request.get(`${servers.origin}/api/game`)).json();

    await page.getByRole('button', { name: 'Zatraži analizu' }).click();
    await expect(page.getByLabel('AI priprema analizu partije')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Analiza nije uspela' })).toBeVisible();
    await page.getByRole('button', { name: 'Pokušaj ponovo' }).click();
    await expect(page.getByRole('heading', { name: 'Sažetak' })).toBeVisible();
    await expect(page.getByText('Offline fake analiza.')).toBeVisible();
    await expect(page.getByText(/obrazovna pomoć/i)).toBeVisible();
    const first = (await (await page.request.get(`${servers.origin}/api/game`)).json()).game;
    await page.getByRole('button', { name: 'Generiši analizu ponovo' }).click();
    await expect(page.getByText('Ponovo generisana offline analiza.')).toBeVisible();
    await expect(page.getByText('Offline fake analiza.', { exact: true })).toHaveCount(0);
    const second = (await (await page.request.get(`${servers.origin}/api/game`)).json()).game;
    expect(second.ai.analysis.interactionId).not.toBe(first.ai.analysis.interactionId);
    expect(second.players).toEqual(terminal.game.players);
    expect(analysisPosts).toBe(3); // failed, manual retry, explicit regeneration
    expect(navigations).toBe(1);
    expect(await (await page.request.get(`${servers.origin}/api/game`)).json()).toMatchObject({
      game: { gameId: terminal.game.gameId, handId: terminal.game.handId,
        version: terminal.game.version, result: terminal.game.result },
    });
    await expect.poll(async () => (await (await page.request.get(`${servers.origin}/api/ai/usage`)).json()).usage.logical
      .filter((row: { purpose: string }) => row.purpose === 'bot').reduce((sum: number, row: { count: number }) => sum + row.count, 0))
      .toBeGreaterThanOrEqual(1);
    await expect.poll(async () => (await (await page.request.get(`${servers.origin}/api/ai/usage`)).json()).usage.logical
      .filter((row: { purpose: string }) => row.purpose === 'analysis').reduce((sum: number, row: { count: number }) => sum + row.count, 0))
      .toBe(3);
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

