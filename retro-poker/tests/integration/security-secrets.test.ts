import { expect, it, vi } from 'vitest';
import { buildApp, productionAiDependencies } from '../../backend/src/app.js';
import { GameSession } from '../../backend/src/session.js';
import { createGeminiProvider } from '../../backend/src/ai/providers/gemini.js';
import { getDecisionEvidence } from '../../backend/src/agent/tools.js';
import { SecurityEvents } from '../../backend/src/security/events.js';
import { securityFixture, finishSecurityGame, settleSecurityRun } from '../helpers/security-fixtures.js';
import { registerRoutes } from '../../backend/src/routes.js';
import Fastify from 'fastify';

const sentinel = 'W08_SERVER_SECRET_DO_NOT_EXPOSE';
it.each(['adapter', 'tool', 'success'])('T14 loaded server sentinel stays out of %s HTTP/model/events/operational outputs', async mode => {
  const h = securityFixture([{ kind: 'agent_tool' }, { kind: 'agent_final' }]);
  const transport = vi.fn(async () => { throw { status: 401, message: `internal ${sentinel}` }; });
  const factory = vi.fn((key: string) => mode === 'adapter'
    ? createGeminiProvider(key, () => ({ models: { generateContent: transport } })) : h.provider);
  const config = productionAiDependencies({ GEMINI_API_KEY: sentinel, GEMINI_MAX_ATTEMPTS: '1' }, factory);
  expect(factory).toHaveBeenCalledExactlyOnceWith(sentinel);
  expect(config.aiConfig?.apiKey).toBe(sentinel); expect(config.aiConfig?.enabled).toBe(true);
  const events = new SecurityEvents();
  const consoleOutput: unknown[] = [];
  const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(method =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { consoleOutput.push(args); }));
  const session = new GameSession({ ...h.dependencies, ...config, securityEvents: events,
    coachExecuteTool: (...args) => {
      const result = getDecisionEvidence(...args);
      return mode === 'tool' ? { ...result, forbiddenSecret: sentinel } : result;
    } });
  const game = finishSecurityGame(session); const app = Fastify(); registerRoutes(app, session);
  const boundaryApp = buildApp({ ...h.dependencies, ...config, securityEvents: events });
  const responses: string[] = [];
  try {
    const response = await app.inject({ method: 'POST', url: '/api/game/coach', payload: {
      gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: { focus: 'street' } } });
    responses.push(response.body); expect(response.statusCode).toBe(202);
    const runId = response.json().run.runId;
    responses.push((await app.inject({ method: 'GET', url: `/api/game/coach/${runId}` })).body);
    const run = await settleSecurityRun(session, runId);
    responses.push((await app.inject({ method: 'GET', url: `/api/game/coach/${runId}` })).body);
    responses.push((await app.inject({ method: 'GET', url: '/api/game' })).body);
    responses.push((await app.inject({ method: 'GET', url: '/api/ai/usage' })).body);
    responses.push((await boundaryApp.inject({ method: 'POST', url: '/api/game/coach', payload: {} })).body);
    expect(run.status).toBe(mode === 'success' ? 'completed' : 'failed');
    if (mode === 'adapter') {
      expect(run.stopReason).toBe('provider_failed'); expect(transport).toHaveBeenCalledTimes(1);
      // SDK receives only projected context/config, never the configured API key in content.
      expect(JSON.stringify(transport.mock.calls)).not.toContain(sentinel);
    } else {
      expect(transport).not.toHaveBeenCalled();
      expect(h.provider.agentCalls).toHaveLength(mode === 'tool' ? 1 : 2);
      if (mode === 'tool') expect(run.stopReason).toBe('tool_failed');
    }
    expect(JSON.stringify({ responses, events: events.read(), model: h.provider.agentCalls, consoleOutput })).not.toContain(sentinel);
  } finally {
    await app.close(); await boundaryApp.close(); spies.forEach(spy => spy.mockRestore());
  }
});
