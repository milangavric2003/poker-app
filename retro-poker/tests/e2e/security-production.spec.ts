import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { buildSecurityProduction, securitySentinel, securityProductionServer } from '../helpers/security-server.js';
import { securityInputs } from '../helpers/security-fixtures.js';
import { AdmissionWindow, processAdmission } from '../../backend/src/security/admission.js';
import { ProviderCapacity, processCapacity } from '../../backend/src/security/capacity.js';

test.beforeAll(async () => { await buildSecurityProduction(); });

test.beforeEach(() => {
  processAdmission.current = new AdmissionWindow();
  processCapacity.current = new ProviderCapacity();
});

test('T16 initial: production CSP blocks an available second-origin script', async ({ page, context }, testInfo) => {
  const servers = await securityProductionServer();
  try {
    expect(servers.configuredKey).toBe(securitySentinel);
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
    const pollRun = await page.request.get(`${servers.origin}/api/game/coach/${servers.provider.agentCalls[0]!.request.runId}`);
    const bad = await page.request.post(`${servers.origin}/api/game/coach`, { data: {} });
    expect(bad.status()).toBe(400);
    const usage = await page.request.get(`${servers.origin}/api/ai/usage`);
    expect(JSON.stringify({ poll: await pollRun.text(), failure: await bad.text(), usage: await usage.text(),
      model: servers.provider.agentCalls, events: servers.events.read(), html: await page.content() })).not.toContain(securitySentinel);
    expect(await (await page.request.get(`${servers.origin}/api/game`)).json()).toEqual(before);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    console.log('T16 functionality', JSON.stringify({ assets, providerSteps: 2, realTools: 1,
      pokerUnchanged: true, mobileOverflow: false }));
    await testInfo.attach('T16-production-functionality.json', { contentType: 'application/json',
      body: JSON.stringify({ assets, providerSteps: 2, realTools: 1, pokerUnchanged: true, mobileOverflow: false }) });
  } finally { await servers.close(); }
});


test('T16 synthetic server secret is absent from fresh production JS/CSS/HTML and any source maps', async () => {
  const files: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path); else files.push(path);
    }
  }
  await walk('dist/frontend');
  expect(files.some(path => path.endsWith('.js'))).toBe(true);
  expect(files.some(path => path.endsWith('.css'))).toBe(true);
  expect(files.some(path => path.endsWith('.html'))).toBe(true);
  for (const path of files) expect((await readFile(path)).includes(Buffer.from(securitySentinel)), path).toBe(false);
  console.log('T16 artifact actual', JSON.stringify({ files, sourceMaps: files.filter(path => path.endsWith('.map')),
    sentinelAbsent: true, envFilesDisabled: true, syntheticBuild: true }));
});
