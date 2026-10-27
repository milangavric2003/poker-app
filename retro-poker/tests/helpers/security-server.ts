import Fastify from 'fastify';
import { createServer } from 'node:http';
import { build, preview, type PreviewServer } from 'vite';
import { SecurityEvents } from '../../backend/src/security/events.js';
import { buildApp, productionAiDependencies } from '../../backend/src/app.js';
import { registerRoutes } from '../../backend/src/routes.js';
import { securityFixture, securityInputs } from './security-fixtures.js';
import type { FakeAiStep } from './fake-ai-provider.js';

/** Real route/schema/orchestrator stack, with in-process access to canonical poker state. */
export function securityServer(steps: FakeAiStep[] = []) {
  const fixture = securityFixture(steps);
  const app = Fastify();
  registerRoutes(app, fixture.session);
  return { ...fixture, app };
}

/** Available second-origin image: count real HTTP hits independently of browser events. */
export async function securityRenderingProbe() {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.writeHead(200, { 'content-type': 'image/svg+xml' });
    response.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Rendering probe did not bind');
  return { resource: `http://127.0.0.1:${address.port}/w08-unwanted.png`, requests: () => requests,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

/** Loads the actual preview config: no helper-supplied security headers/proxy overrides. */
export const securitySentinel = 'W08_SERVER_SECRET_DO_NOT_EXPOSE';

/** Build from current source, with local env files disabled and a synthetic server key. */
export async function buildSecurityProduction() {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = securitySentinel;
  try { await build({ configFile: 'vite.config.ts', envDir: false }); }
  finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
}

export async function securityProductionServer() {
  const fixture = securityFixture([{ kind: 'agent_tool' }, { kind: 'agent_final' }]);
  let configuredKey: string | undefined;
  const dependencies = productionAiDependencies({ GEMINI_API_KEY: securitySentinel }, key => {
    configuredKey = key; return fixture.provider;
  });
  const events = new SecurityEvents();
  const backend = buildApp({ ...fixture.dependencies, ...dependencies, securityEvents: events });
  let frontend: PreviewServer | undefined;
  let scriptRequests = 0;
  const probe = createServer((request, response) => {
    if (request.url === securityInputs.scriptPath) {
      scriptRequests++;
      response.writeHead(200, { 'content-type': 'text/javascript' });
      response.end(`window.${securityInputs.marker} = true;`);
    } else {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<!doctype html><title>Security positive control</title>');
    }
  });
  async function close() {
    await frontend?.close();
    await backend.close();
    if (probe.listening) await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  }
  try {
    await backend.listen({ host: '127.0.0.1', port: 3001 });
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(0, '127.0.0.1', resolve);
    });
    const address = probe.address();
    if (!address || typeof address === 'string') throw new Error('Probe did not bind');
    frontend = await preview({ configFile: 'vite.config.ts', envDir: false });
    return { origin: 'http://127.0.0.1:5173', probeOrigin: `http://127.0.0.1:${address.port}`,
      configuredKey, events, scriptRequests: () => scriptRequests, provider: fixture.provider, executions: fixture.executions, close };
  } catch (error) { await close(); throw error; }
}
