import { expect, test } from '@playwright/test';
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

for (const fault of ['lost', 'invalid', 'timeout'] as const) {
  test(`${fault}: snapshot ostaje, GET usklađuje, POST se ne ponavlja`, async ({ page }) => {
    const servers = await startTestServers(); let posts = 0;
    try {
      await page.goto(servers.origin);
      await page.getByLabel('Broj botova').selectOption('1');
      await page.getByRole('button', { name: 'Nova partija' }).click();
      await expect(page.getByRole('button', { name: 'Call 5' })).toBeVisible();
      if (fault === 'timeout') await page.clock.install();
      await page.route('**/api/game/actions', async route => {
        posts++;
        await route.fetch(); // Backend commits, only the response is damaged/lost.
        if (fault === 'lost') await route.abort('failed');
        if (fault === 'invalid') await route.fulfill({ status: 200, json: { game: { deck: ['Kc'] } } });
        // timeout deliberately leaves response pending until the browser aborts.
      });
      await page.getByRole('button', { name: 'Call 5' }).click();
      if (fault === 'timeout') await page.clock.fastForward(11000);
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText('Pot: 15', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Call 5' })).toBeDisabled();
      await page.getByRole('button', { name: 'Učitaj stanje' }).click();
      await expect(page.getByLabel('Board')).toContainText('2c3d7h');
      await expect(page.getByText('Pot: 20', { exact: true })).toBeVisible();
      expect(posts).toBe(1);
    } finally { await servers.close(); }
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
