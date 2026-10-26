import { expect, test } from '@playwright/test';
import { securityProductionServer } from '../helpers/security-server.js';
import { securityInputs } from '../helpers/security-fixtures.js';
import { AdmissionWindow, processAdmission } from '../../backend/src/security/admission.js';
import { ProviderCapacity, processCapacity } from '../../backend/src/security/capacity.js';

test.beforeEach(() => {
  processAdmission.current = new AdmissionWindow();
  processCapacity.current = new ProviderCapacity();
});

test('T16 initial: production CSP blocks an available second-origin script', async ({ page, context }, testInfo) => {
  const servers = await securityProductionServer();
  try {
    const script = `${servers.probeOrigin}${securityInputs.scriptPath}`;
    const available = await page.request.get(script);
    expect(available.status()).toBe(200);
    // A real browser control without policy: proves that this exact script executes.
    const control = await context.newPage();
    await control.goto(servers.probeOrigin);
    expect((await control.request.get(servers.probeOrigin)).headers()['content-security-policy']).toBeUndefined();
    await control.addScriptTag({ url: script });
    expect(await control.evaluate(marker => Reflect.get(window, marker), securityInputs.marker)).toBe(true);
    await control.close();

    const response = await page.goto(servers.origin);
    await expect(page.getByLabel('Broj botova')).toBeVisible();
    await page.getByLabel('Broj botova').selectOption('1');
    await page.getByRole('button', { name: 'Nova partija' }).click();
    await expect(page.getByRole('button', { name: 'Call 5', exact: true })).toBeVisible();
    await page.evaluate(() => {
      Reflect.set(window, '__w08Violations', []);
      document.addEventListener('securitypolicyviolation', event => {
        (Reflect.get(window, '__w08Violations') as unknown[]).push({
          directive: event.effectiveDirective, blockedURI: event.blockedURI, disposition: event.disposition,
        });
      });
    });
    const requestsBefore = servers.scriptRequests();
    await page.evaluate(url => new Promise<void>(resolve => {
      const node = document.createElement('script'); node.src = url;
      node.onload = () => resolve(); node.onerror = () => resolve(); document.head.append(node);
    }), script);
    const actual = await page.evaluate(marker => ({ executed: Reflect.get(window, marker) === true,
      violations: Reflect.get(window, '__w08Violations') as Array<{ directive: string; blockedURI: string; disposition: string }>,
    }), securityInputs.marker);
    const result = { ...actual, headers: response?.headers(), script,
      requestsBefore, requestsAfter: servers.scriptRequests(), positiveControlStatus: available.status() };
    console.log('T16 actual', JSON.stringify(result));
    await testInfo.attach('T16-initial.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(actual.executed).toBe(false);
    expect(actual.violations).toEqual(expect.arrayContaining([expect.objectContaining({
      directive: expect.stringMatching(/^script-src/), blockedURI: script, disposition: 'enforce',
    })]));
    expect(servers.scriptRequests()).toBe(requestsBefore);
    expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
    expect(response?.headers()['content-security-policy']).toBe("default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'");
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    expect(response?.headers()['referrer-policy']).toBe('no-referrer');

    // Existing T16 input above is preserved. Exercise controls, CSS/assets, API and
    // validated two-step coaching under that same production document policy.
    await expect(page.locator('.poker-table')).toHaveCSS('background-color', 'rgb(20, 85, 63)');
    const assets = await page.evaluate(() => performance.getEntriesByType('resource')
      .map(entry => entry.name).filter(url => url.includes('/assets/')));
    expect(assets.some(url => url.endsWith('.js'))).toBe(true);
    expect(assets.some(url => url.endsWith('.css'))).toBe(true);
    await page.getByRole('button', { name: /All-in/i }).click();
    await expect(page.getByText(/Pobeda u partiji|Poraz u partiji/)).toBeVisible();
    const before = await (await page.request.get(`${servers.origin}/api/game`)).json();
    await page.getByRole('combobox', { name: 'Coaching cilj' }).selectOption('street');
    await page.getByRole('button', { name: 'Pokreni coaching' }).click();
    const coach = page.getByRole('region', { name: 'Coaching partije' });
    await expect(coach.getByRole('status')).toHaveText('Coaching je završen.');
    await expect(coach).toContainText('Pregled dostupnih odluka.');
    expect(servers.provider.agentCalls).toHaveLength(2);
    expect(servers.executions).toHaveLength(1);
    expect(await (await page.request.get(`${servers.origin}/api/game`)).json()).toEqual(before);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    console.log('T16 functionality', JSON.stringify({ assets, providerSteps: 2, realTools: 1,
      pokerUnchanged: true, mobileOverflow: false }));
    await testInfo.attach('T16-production-functionality.json', { contentType: 'application/json',
      body: JSON.stringify({ assets, providerSteps: 2, realTools: 1, pokerUnchanged: true, mobileOverflow: false }) });
  } finally { await servers.close(); }
});
