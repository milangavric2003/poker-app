import { expect, test } from '@playwright/test';
import { securityProductionServer } from '../helpers/security-server.js';
import { securityInputs } from '../helpers/security-fixtures.js';

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
  } finally { await servers.close(); }
});
