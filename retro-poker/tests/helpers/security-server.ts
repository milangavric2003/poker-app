import Fastify from 'fastify';
import { createServer } from 'node:http';
import { preview, type PreviewServer } from 'vite';
import { buildApp } from '../../backend/src/app.js';
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
export async function securityProductionServer() {
  const fixture = securityFixture([{ kind: 'agent_tool' }, { kind: 'agent_final' }]);
  const backend = buildApp(fixture.dependencies);
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
    frontend = await preview({ configFile: 'vite.config.ts' });
    return { origin: 'http://127.0.0.1:5173', probeOrigin: `http://127.0.0.1:${address.port}`,
      scriptRequests: () => scriptRequests, provider: fixture.provider, executions: fixture.executions, close };
  } catch (error) { await close(); throw error; }
}
