import { expect, test, type Page } from '@playwright/test';
import { startTestServers, type TestServers } from '../helpers/server.js';

async function withGame(page: Page, run: (servers: TestServers) => Promise<void>) {
  const servers = await startTestServers();
  try {
    await page.goto(servers.origin);
    await expect(page.getByText('Izaberi broj botova')).toBeVisible();
    await page.getByLabel('Broj botova').selectOption('1');
    await page.getByRole('button', { name: 'Nova partija' }).click();
    await expect(page.getByRole('region', { name: 'Poker sto' })).toBeVisible();
    await run(servers);
  } finally {
    await servers.close();
  }
}

test('AC23: call 5 i check do showdown-a daje stackove 1010/990', async ({ page }) => {
  await withGame(page, async () => {
    const table = page.getByRole('region', { name: 'Poker sto' });
    await expect(table.getByText('As')).toBeVisible();
    await expect(table.getByText('Ah')).toBeVisible();
    await expect(table.getByText('Pot: 15')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fold' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Call 5' })).toBeVisible();
    await expect(table.getByText('Kc')).toHaveCount(0);
    await expect(table.getByText('Kd')).toHaveCount(0);

    await page.getByRole('button', { name: 'Call 5' }).click();
    await expect(table.getByLabel('Board')).toContainText('2c3d7h');
    await expect(table.getByText('Pot: 20')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check' })).toBeVisible();

    await page.getByRole('button', { name: 'Check' }).click();
    await expect(table.getByLabel('Board')).toContainText('9s');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(table.getByLabel('Board')).toContainText('Jc');
    await page.getByRole('button', { name: 'Check' }).click();

    await expect(page.getByRole('region', { name: 'Rezultat ruke' })).toContainText('Showdown');
    await expect(table.getByText('Stack: 1010')).toBeVisible();
    await expect(table.getByText('Stack: 990')).toBeVisible();
    await expect(table.getByText('Kc')).toBeVisible();
    await expect(table.getByText('Kd')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Istorija ruke' })).toContainText('call');
    await expect(page.getByRole('list', { name: 'Istorija ruke' })).toContainText('showdown');
    await expect(page.getByRole('button', { name: 'Sledeća ruka' })).toBeVisible();
    await page.screenshot({ path: 'docs/evidence/T024-first-hand.png', fullPage: true });

    await page.getByRole('button', { name: 'Sledeća ruka' }).click();
    await expect(table).toContainText('Ruka 2');
    await expect(table).toContainText('Stack: 1015');
    await expect(table).toContainText('Stack: 985');
    await expect(page.getByRole('region', { name: 'Rezultat ruke' })).toBeVisible();
  });
});

test('AC16: fold zavrÅ¡ava ruku bez boarda i daje stackove 995/1005', async ({ page }) => {
  await withGame(page, async () => {
    const table = page.getByRole('region', { name: 'Poker sto' });
    await page.getByRole('button', { name: 'Fold' }).click();

    await expect(page.getByRole('region', { name: 'Rezultat ruke' }))
      .toContainText('Svi protivnici su odustali');
    await expect(table.getByText('Stack: 995')).toBeVisible();
    await expect(table.getByText('Stack: 1005')).toBeVisible();
    await expect(table.getByLabel('Board')).toContainText('flop');
    await expect(table.getByText('Kc')).toHaveCount(0);
    await expect(table.getByText('Kd')).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Istorija ruke' })).toContainText('fold');
    await expect(page.getByRole('list', { name: 'Istorija ruke' })).toContainText('5');
  });
});
