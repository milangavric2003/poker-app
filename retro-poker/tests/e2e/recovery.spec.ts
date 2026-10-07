import { expect, test, type APIResponse } from '@playwright/test';
import { GameResponseSchema } from '../../shared/contracts';
import { startTestServers } from '../helpers/server';

test('refresh ponovo GET-uje potvrđeno stanje', async ({ page }) => {
  const servers = await startTestServers();
  try {
    await page.goto(servers.origin);
    await page.getByLabel('Broj botova').selectOption('1');
    await page.getByRole('button', { name: 'Nova partija' }).click();
    await page.getByRole('button', { name: 'Call 5' }).click();
    await expect(page.getByLabel('Board')).toContainText('2c3d7h');
    const before = await (await page.request.get(`${servers.origin}/api/game`)).json();
    await page.reload();
    await expect(page.getByLabel('Board')).toContainText('2c3d7h');
    expect(await (await page.request.get(`${servers.origin}/api/game`)).json()).toEqual(before);
  } finally { await servers.close(); }
});

for (const fault of ['lost', 'invalid', 'timeout', 'timeout-slow-forward'] as const) {
  test(`${fault}: snapshot ostaje, GET usklađuje, POST se ne ponavlja`, async ({ page }) => {
    const servers = await startTestServers(); let posts = 0;
    const isTimeout = fault === 'timeout' || fault === 'timeout-slow-forward';
    let committedResponse: APIResponse | undefined;
    try {
      if (isTimeout) await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      await page.goto(servers.origin);
      await page.getByLabel('Broj botova').selectOption('1');
      await page.getByRole('button', { name: 'Nova partija' }).click();
      await expect(page.getByRole('button', { name: 'Call 5' })).toBeVisible();
      if (isTimeout) await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
      await page.route('**/api/game/actions', async route => {
        posts++;
        // Fault injection: transport delay, independent of the browser's fake clock.
        if (fault === 'timeout-slow-forward') await new Promise(resolve => setTimeout(resolve, 1000));
        committedResponse = await route.fetch(); // Only damage/lose the response after the backend commits.
        if (fault === 'lost') await route.abort('failed');
        if (fault === 'invalid') await route.fulfill({ status: 200, json: { game: { deck: ['Kc'] } } });
        // timeout deliberately leaves response pending until the browser aborts.
      });
      await page.getByRole('button', { name: 'Call 5' }).click();
      // Browser time must not outrun the real backend: recovery GET follows the committed POST.
      await expect.poll(() => committedResponse?.status(), { message: 'Backend accepted the single action POST' }).toBe(200);
      const committed = GameResponseSchema.parse(await committedResponse?.json());
      expect(committed.game).toMatchObject({ phase: 'flop', board: ['2c', '3d', '7h'], totalPot: 20 });
      if (isTimeout) await page.clock.fastForward(11000);
      await expect(page.getByRole('alert')).toBeVisible();
      if (isTimeout) await expect(page.getByRole('alert')).toContainText('Vreme čekanja je isteklo.');
      await expect(page.getByText('Pot: 15', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Call 5' })).toBeDisabled();
      await page.getByRole('button', { name: 'Učitaj stanje' }).click();
      await expect(page.getByLabel('Board')).toContainText('2c3d7h');
      await expect(page.getByText('Pot: 20', { exact: true })).toBeVisible();
      expect(await (await page.request.get(`${servers.origin}/api/game`)).json()).toEqual(committed);
      expect(posts).toBe(1);
    } finally {
      // Closing the page releases the deliberately unanswered timeout route.
      try { await page.close(); }
      finally { await servers.close(); }
    }
  });
}

test('novi backend bez memorije vraća game:null i novu partiju', async ({ page }) => {
  const servers = await startTestServers(true);
  try {
    await page.goto(servers.origin);
    await page.getByLabel('Broj botova').selectOption('1');
    await page.getByRole('button', { name: 'Nova partija' }).click();
    await expect(page.getByRole('button', { name: 'Call 5' })).toBeVisible();
    await servers.restartBackend!();
    await page.getByRole('button', { name: 'Call 5' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'Učitaj stanje' }).click();
    await expect(page.getByText('Izaberi broj botova i pokreni lokalnu partiju.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Poker sto' })).toHaveCount(0);
  } finally { await servers.close(); }
});
