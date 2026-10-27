import { expect, test, type Page } from '@playwright/test';
import { startTestServers } from '../helpers/server';
import { GameViewSchema } from '../../shared/contracts';
import { handResult, publicView } from '../helpers/public-fixtures';

async function assertLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const boxes = await page.locator('.seat, .table-center, .actions').evaluateAll(nodes => nodes.map(node => {
    const b = node.getBoundingClientRect();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]!; const b = boxes[j]!;
    expect(Math.min(a.right, b.right) <= Math.max(a.left, b.left)
      || Math.min(a.bottom, b.bottom) <= Math.max(a.top, b.top)).toBe(true);
  }
}

for (const width of [1280, 390]) {
  for (const bots of [1, 5]) {
    test(`table polish ${width}px ${bots} bots`, async ({ page }) => {
      const servers = await startTestServers(false, false, 0);
      try {
        await page.setViewportSize({ width, height: width === 1280 ? 720 : 844 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(servers.origin);
        await page.getByLabel('Broj botova').selectOption(String(bots));
        await page.getByRole('button', { name: 'Nova partija' }).click();
        await expect(page.getByRole('region', { name: 'Poker sto' })).toBeVisible();
        await expect(page.getByRole('article')).toHaveCount(bots + 1);
        await page.screenshot({ path: `specs/004-frontend-table-polish/evidence/${process.env.POKER_VISUAL_BASELINE ? 'before' : 'after'}-${width}-${bots}bots.png`, fullPage: true });
        await assertLayout(page);
        if (width === 390) {
          const actions = await page.getByRole('region', { name: 'Akcije' }).boundingBox();
          const history = await page.getByRole('complementary', { name: 'Istorija' }).boundingBox();
          expect(actions && history && actions.y < history.y).toBeTruthy();
        }
        await page.getByRole('button', { name: 'Fold', exact: true }).focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByRole('button', { name: 'Fold', exact: true })).toHaveCSS('outline-style', 'solid');
        await expect(page.getByRole('button', { name: 'Fold', exact: true })).toHaveCSS('transition-duration', '0s');
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: /Call/ })).toBeFocused();
        if (!process.env.POKER_VISUAL_BASELINE) {
          await expect(page.getByLabel('Skrivena karta')).toHaveCount(bots * 2);
          await expect(page.getByRole('article', { name: /Ti.*mesto 1/ })).toContainText('Na potezu');
          if (bots === 5) await expect(page.getByLabel('Potovi')).toContainText('Side pot');
        }
      } finally { await servers.close(); }
    });
  }
}

for (const width of [1280, 390]) {
  test(`public status and large amount fixtures ${width}px`, async ({ page }) => {
    const servers = await startTestServers(false, false, 0);
    try {
      await page.setViewportSize({ width, height: width === 1280 ? 720 : 844 });
      const base = publicView();
      const players = Array.from({ length: 6 }, (_, seat) => ({ ...base.players[seat === 0 ? 0 : 1],
        id: `p${seat}`, seat, stack: seat === 0 ? 1 : 0,
        status: seat === 0 ? 'active' : seat === 1 ? 'folded' : seat === 3 ? 'eliminated' : 'all_in',
        streetContribution: seat === 0 ? 999 : seat === 3 ? 0 : 1000,
        handContribution: seat === 0 ? 1999 : seat === 3 ? 0 : 1000,
      }));
      const contributorIds = ['p0', 'p1', 'p2', 'p4', 'p5'];
      const eligibleIds = ['p0', 'p2', 'p4', 'p5'];
      let snapshot = GameViewSchema.parse({ ...base, botCount: 5, phase: 'river',
        board: ['Ts', '6s', '5h', '4d', '3c'], totalPot: 5999, players,
        legalActions: [{ type: 'fold' }, { type: 'call', payAmount: 1, isAllIn: true }],
        pots: [{ id: 'main', amount: 5000, contributionCap: 1000, contributorIds, eligibleIds },
          { id: 'uncalled', amount: 999, contributionCap: 1999, contributorIds: ['p0'], eligibleIds: ['p0'] }],
        events: [...base.events, { seq: 2, handId: base.handId, street: 'river', type: 'refund', playerId: 'p0', amount: 10 }],
      });
      await page.route('**/api/game', route => route.fulfill({ json: { game: snapshot } }));
      await page.goto(servers.origin);
      const table = page.getByRole('region', { name: 'Poker sto' });
      await expect(table.getByLabel('10 pik')).toBeVisible();
      await expect(table.getByText('Fold', { exact: true })).toBeVisible();
      await expect(table.getByText('All-in', { exact: true })).toHaveCount(3);
      await expect(table.getByText('Eliminisan', { exact: true })).toBeVisible();
      await expect(table.getByLabel('Ukupni pot')).toContainText('Pot: 5999');
      await expect(table.getByLabel('Potovi')).toContainText('uncalled: 999');
      await expect(page.getByRole('list', { name: 'Istorija ruke' })).toContainText('povraćaj 10');
      await expect(table.getByLabel('Skrivena karta')).toHaveCount(8);
      await assertLayout(page);
      await page.screenshot({ path: `specs/004-frontend-table-polish/evidence/after-${width}-river-statuses.png`, fullPage: true });

      const result = { ...handResult(), gameStatus: 'won', reason: 'uncontested',
        pots: [{ id: 'main', amount: 5000, eligibleIds, winnerIds: ['p0'], payouts: [{ playerId: 'p0', amount: 5000 }] }],
        refunds: [{ playerId: 'p0', amount: 1000 }], revealedCards: [],
        netChanges: players.map(p => ({ playerId: p.id, amount: p.seat === 0 ? 5000 : -1000 })) };
      snapshot = GameViewSchema.parse({ ...snapshot, status: 'won', phase: 'complete', actorId: null,
        totalPot: 0, pots: [], legalActions: [], result,
        players: players.map(p => ({ ...p, stack: p.seat === 0 ? 6000 : 0,
          status: p.seat === 0 ? 'active' : 'eliminated', streetContribution: 0, handContribution: 0 })) });
      await page.reload();
      await expect(table.getByText('Stack: 6000')).toBeVisible();
      await expect(table.getByLabel('Ukupni pot')).toHaveText('Pot: 0');
      await expect(page.getByRole('region', { name: 'Rezultat ruke' })).toContainText('Povraćaj: p0 +1000');
      await assertLayout(page);
      await page.screenshot({ path: `specs/004-frontend-table-polish/evidence/after-${width}-6000-stack-refund.png`, fullPage: true });
    } finally { await servers.close(); }
  });
}
