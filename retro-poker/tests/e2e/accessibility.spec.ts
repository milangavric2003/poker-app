import { expect, test } from '@playwright/test';
import { startTestServers } from '../helpers/server';

test.use({ viewport: { width: 1280, height: 720 } });

test('pet botova: raspored, semantika i tastatura ostaju dostupni na 1280x720', async ({ page }) => {
  const servers = await startTestServers();
  try {
    await page.goto(servers.origin);
    await page.getByLabel('Broj botova').selectOption('5');
    await page.getByRole('button', { name: 'Nova partija' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Poker sto' })).toBeVisible();
    await page.screenshot({ path: 'docs/evidence/T036-after-1280x720.png', fullPage: true });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const seats = page.getByRole('article');
    await expect(seats).toHaveCount(6);
    const boxes = await seats.evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }));
    for (let first = 0; first < boxes.length; first++) {
      for (let second = first + 1; second < boxes.length; second++) {
        const a = boxes[first]!; const b = boxes[second]!;
        const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        expect(overlapWidth <= 0 || overlapHeight <= 0).toBe(true);
      }
    }

    await expect(page.getByRole('article', { name: /Ti.*mesto 1/i })).toBeVisible();
    await expect(page.getByRole('article', { name: /Bot 5.*mesto 6/i })).toBeVisible();
    await expect(page.getByLabel('2 tref')).toContainText('2♣');
    await expect(page.getByLabel('Žandar tref')).toContainText('J♣');
    await expect(page.getByText(/Mali blind:/)).toBeVisible();
    await expect(page.getByText(/Veliki blind:/)).toBeVisible();
    await expect(page.getByText(/Pot:/)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Istorija ruke' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Akcije' })).toBeVisible();
    const actionBox = await page.getByRole('region', { name: 'Akcije' }).boundingBox();
    expect(actionBox && actionBox.y + actionBox.height <= 720).toBeTruthy();

    await page.getByRole('button', { name: 'Fold' }).focus();
    await expect(page.getByRole('button', { name: 'Fold' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Fold' })).toHaveCSS('outline-style', 'solid');
  } finally {
    await servers.close();
  }
});

test('jedan bot: rezultat ruke se objavljuje čitaču ekrana', async ({ page }) => {
  const servers = await startTestServers();
  try {
    await page.goto(servers.origin);
    await page.getByLabel('Broj botova').selectOption('1');
    await page.getByRole('button', { name: 'Nova partija' }).click();
    await page.getByRole('button', { name: 'Fold' }).focus();
    await page.keyboard.press('Enter');
    const result = page.getByRole('region', { name: 'Rezultat ruke' });
    await expect(result).toContainText('Svi protivnici su odustali');
    await expect(result).toHaveAttribute('aria-live', 'polite');
  } finally {
    await servers.close();
  }
});
