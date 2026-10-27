import { expect, test, type Locator, type Page } from '@playwright/test';
import { startCoachServers } from '../helpers/coach-server.js';
import { renderingFinal, renderingInputs } from '../helpers/security-fixtures.js';
import { securityRenderingProbe } from '../helpers/security-server.js';
import { AdmissionWindow, processAdmission } from '../../backend/src/security/admission.js';
import { ProviderCapacity, processCapacity } from '../../backend/src/security/capacity.js';

test.beforeEach(() => {
  // A new isolated server fixture represents a fresh process, with real limits.
  processAdmission.current = new AdmissionWindow();
  processCapacity.current = new ProviderCapacity();
});

async function assertPlainText(page: Page, panel: Locator, text: string) {
  await expect(panel).toContainText(text);
  expect(await panel.locator('script,img,a,iframe,object,embed,link,base,svg,math').count()).toBe(0);
  expect(await panel.evaluate(el => [...el.querySelectorAll('*')].flatMap(node =>
    [...node.attributes].filter(a => /^on/i.test(a.name)).map(a => a.name)))).toEqual([]);
  expect(await page.evaluate(marker => Reflect.get(window, marker), renderingInputs.marker)).toBeUndefined();
}

for (const [label, input] of Object.entries({ attack: renderingInputs.attack, normal: renderingInputs.normal })) {
  test(`T04/T05 ${label}: validated coaching and analysis remain literal text`, async ({ page }, testInfo) => {
    const servers = await startCoachServers();
    const probe = await securityRenderingProbe();
    const text = input.replace(renderingInputs.resource, probe.resource);
    const external: string[] = [];
    page.on('request', r => { if (r.url().includes('/w08-unwanted.png')) external.push(r.url()); });
    try {
      expect((await page.request.get(probe.resource)).status()).toBe(200);
      const probeRequestsBefore = probe.requests();
      const before = await servers.snapshot();
      await page.goto(servers.origin);
      const originalURL = page.url();
      await page.getByRole('combobox', { name: 'Coaching cilj' }).selectOption('street');
      await page.getByRole('button', { name: 'Pokreni coaching' }).click();
      await expect.poll(() => servers.provider.pending.has('first')).toBe(true);
      servers.provider.enqueue({ kind: 'pending', id: 'final' });
      servers.provider.resolve('first', { candidate: { kind: 'tool_request', name: 'get_decision_evidence',
        arguments: { focus: 'street', limit: 10 } } });
      await expect.poll(() => servers.provider.pending.has('final')).toBe(true);
      servers.provider.resolve('final', renderingFinal(servers.provider.agentCalls[1]!.context, text));
      const coach = page.getByRole('region', { name: 'Coaching partije' });
      await expect(coach.getByRole('status')).toHaveText('Coaching je završen.');
      await expect(coach.locator('.analysis-content > p').nth(0)).toHaveText(text);
      await expect(coach.locator('.analysis-content > p').nth(1)).toHaveText(text);
      await assertPlainText(page, coach, text);
      expect(servers.provider.agentCalls).toHaveLength(2);
      expect(servers.toolCount()).toBe(1);
      expect(await servers.snapshot()).toEqual(before);

      servers.provider.enqueue({ candidate: { summary: text, goodDecisions: [], possibleMistakes: [], nextSteps: [text] } });
      await page.getByRole('button', { name: 'Zatraži analizu' }).click();
      const analysis = page.getByRole('region', { name: 'AI analiza partije' });
      await expect(analysis.locator('.analysis-content > p').first()).toHaveText(text);
      await expect(analysis.locator('.analysis-content li')).toHaveText(text);
      await assertPlainText(page, analysis, text);
      expect(servers.provider.calls).toHaveLength(1);
      const after = await servers.snapshot();
      expect({ ...after.game, ai: before.game.ai }).toEqual(before.game);
      expect(page.url()).toBe(originalURL);
      expect(page.context().pages()).toHaveLength(1);
      expect(external).toEqual([]);
      expect(probe.requests()).toBe(probeRequestsBefore);
      const actual = {
        text, coach: await coach.innerText(), analysis: await analysis.innerText(), external,
        providerSteps: 2, realTools: servers.toolCount(), pokerUnchanged: true, executableDOM: 0,
        executionMarker: false, navigationUnchanged: true,
        resource: probe.resource, resourceStatus: 200, automaticResourceRequests: probe.requests() - probeRequestsBefore,
      };
      console.log(`T04/T05 ${label} actual`, JSON.stringify(actual));
      await testInfo.attach(`rendering-${label}.json`, { contentType: 'application/json', body: JSON.stringify(actual, null, 2) });
    } finally { await servers.close(); await probe.close(); }
  });
}
