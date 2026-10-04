import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { registerRoutes } from '../../backend/src/routes.js';
import { GameSession, type SessionDependencies } from '../../backend/src/session.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { getDecisionEvidence } from '../../backend/src/agent/tools.js';
import { CoachResponseSchema, GameErrorSchema } from '../../shared/contracts.js';
import { FakeAiProvider, type FakeAiStep } from '../helpers/fake-ai-provider.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const apps: Array<ReturnType<typeof buildApp>> = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
function harness(steps: FakeAiStep[] = [{ kind: 'pending', id: 'first' }], terminal = true, available = true) {
  const provider = new FakeAiProvider(steps);
  const executeTool = vi.fn(getDecisionEvidence);
  const dependencies: SessionDependencies = { deck: ['As', 'Kc', 'Ah', 'Kd', ...ac23Deck.slice(4)],
    deckRandom: sequenceRandom([]), botRandom: sequenceRandom(Array<number>(100).fill(0.9)),
    aiProvider: provider, aiConfig: loadAiConfig({ GEMINI_ENABLED: available ? 'true' : 'false', GEMINI_API_KEY: 'fake-key' }),
    coachExecuteTool: executeTool };
  const session = new GameSession(dependencies);
  let game = session.create(1);
  if (terminal) game = session.action({ gameId: game.gameId, handId: game.hand.handId,
    expectedVersion: game.version, type: 'all_in' });
  const app = Fastify({ logger: false }); registerRoutes(app, session); apps.push(app);
  const input = { gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: { focus: 'street' } };
  const post = (payload: unknown = input) => app.inject({ method: 'POST', url: '/api/game/coach', payload: payload as object });
  return { app, session, game, provider, executeTool, input, post };
}
async function flush() { for (let i = 0; i < 80; i++) await Promise.resolve(); }
describe('T018 coach HTTP contract', () => {
  it('starts a strict run and serves the same status with no-store', async () => {
    const h = harness(); const before = JSON.stringify(h.game);
    const response = await h.post(); expect(response.statusCode).toBe(202);
    const { run } = CoachResponseSchema.parse(response.json());
    expect(['created', 'running']).toContain(run.status); expect(run.result).toBeNull();
    expect(response.headers['cache-control']).toBe('no-store');
    const status = await h.app.inject(`/api/game/coach/${run.runId}`);
    expect(status.statusCode).toBe(200); expect(CoachResponseSchema.parse(status.json()).run.runId).toBe(run.runId);
    expect(status.headers['cache-control']).toBe('no-store'); expect(JSON.stringify(h.game)).toBe(before);
    h.session.create(1); await flush();
  });
  it.each([
    {}, { extra: true }, { gameId: 'bad' }, { handId: 'bad' }, { expectedVersion: -1 },
    { expectedVersion: 1.2 }, { expectedVersion: '2' }, { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
    { goal: { focus: 'shell' } }, { goal: { focus: 'street', extra: true } }, { goal: null },
  ])('rejects strict input %j before provider/tool calls', async patch => {
    const h = harness(); const before = JSON.stringify(h.game);
    const payload = Object.keys(patch).length ? { ...h.input, ...patch } : { gameId: h.input.gameId };
    const response = await h.post(payload); expect(response.statusCode).toBe(400);
    expect(GameErrorSchema.parse(response.json()).error.code).toBe('INVALID_INPUT');
    expect(h.provider.agentCalls).toHaveLength(0); expect(h.executeTool).not.toHaveBeenCalled();
    expect(JSON.stringify(h.game)).toBe(before);
  });
  it.each(['game', 'hand', 'version', 'active', 'completed-hand'] as const)('rejects %s preflight without calls', async kind => {
    const h = harness(undefined, kind !== 'active' && kind !== 'completed-hand');
    if (kind === 'completed-hand') h.session.action({ ...h.input, type: 'fold' });
    const input = { ...h.input,
      ...(kind === 'game' ? { gameId: '00000000-0000-4000-8000-000000000001' } : {}),
      ...(kind === 'hand' ? { handId: '00000000-0000-4000-8000-000000000001' } : {}),
      ...(kind === 'version' ? { expectedVersion: 0 } : {}),
      ...(kind === 'completed-hand' ? { expectedVersion: h.session.get()!.version } : {}) };
    const response = await h.post(input); expect(response.statusCode).toBe(kind === 'game' ? 404 : 409);
    GameErrorSchema.parse(response.json()); expect(h.provider.agentCalls).toHaveLength(0);
    expect(h.executeTool).not.toHaveBeenCalled();
  });
  it('returns insufficient evidence without provider or tool calls', async () => {
    const h = harness(); h.game.facts = { ...h.game.facts, decisions: [] };
    const response = await h.post(); expect(response.statusCode).toBe(200);
    expect(CoachResponseSchema.parse(response.json()).run).toMatchObject({ status: 'stopped', stopReason: 'insufficient_evidence', providerAttemptCount: 0, toolCallCount: 0 });
    expect(h.provider.agentCalls).toHaveLength(0); expect(h.executeTool).not.toHaveBeenCalled();
  });
  it.each(['gameId', 'handId', 'expectedVersion', 'goal'] as const)('requires %s without provider or tool calls', async field => {
    const h = harness(); const payload: Record<string, unknown> = { ...h.input }; delete payload[field];
    const response = await h.post(payload); expect(response.statusCode).toBe(400);
    expect(h.provider.agentCalls).toHaveLength(0); expect(h.executeTool).not.toHaveBeenCalled();
  });
  it('keeps facts revision server-side and rejects client overrides', async () => {
    const h = harness(); expect((await h.post({ ...h.input, factsRevision: 0 })).statusCode).toBe(400);
    expect(h.provider.agentCalls).toHaveLength(0); expect(h.executeTool).not.toHaveBeenCalled();
  });
  it('rejects a missing session safely', async () => {
    const h = harness(); const app = buildApp(); apps.push(app);
    expect((await app.inject({ method: 'POST', url: '/api/game/coach', payload: h.input })).statusCode).toBe(404);
    const created = await app.inject({ method: 'POST', url: '/api/game', headers: { 'if-none-match': '*' }, payload: { botCount: 1 } });
    expect(created.statusCode).toBe(201); expect(h.provider.agentCalls).toHaveLength(0);
    expect(h.executeTool).not.toHaveBeenCalled();
  });
  it('rejects unavailable AI before provider and tool calls', async () => {
    const h = harness([], true, false); const response = await h.post();
    expect(response.statusCode).toBe(409); expect(GameErrorSchema.parse(response.json()).error.code).toBe('AI_UNAVAILABLE');
    expect(h.provider.agentCalls).toHaveLength(0); expect(h.executeTool).not.toHaveBeenCalled();
  });
  it('exposes a safe terminal failure and explicit POST retry creates another run', async () => {
    const h = harness([{ kind: 'unknown_tool' }]); const first = await h.post(); await flush();
    const failed = await h.app.inject(`/api/game/coach/${first.json().run.runId}`);
    expect(CoachResponseSchema.parse(failed.json()).run).toMatchObject({ status: 'stopped', stopReason: 'unknown_tool', result: null });
    h.provider.enqueue({ kind: 'agent_tool' }, { kind: 'agent_final' }); const retry = await h.post();
    expect(retry.statusCode).toBe(202); expect(retry.json().run.runId).not.toBe(first.json().run.runId);
    await flush(); const result = await h.app.inject(`/api/game/coach/${retry.json().run.runId}`);
    expect(CoachResponseSchema.parse(result.json()).run.status).toBe('completed');
    expect((await h.app.inject(`/api/game/coach/${first.json().run.runId}`)).statusCode).toBe(404);
  });
  it('deduplicates active starts and rejects a competing goal', async () => {
    const h = harness(); const first = await h.post(); const second = await h.post();
    expect(first.statusCode).toBe(202); expect(second.json().run.runId).toBe(first.json().run.runId);
    expect((await h.post({ ...h.input, goal: { focus: 'betting' } })).statusCode).toBe(409);
    await flush(); expect(h.provider.agentCalls).toHaveLength(1); h.session.create(1); await flush();
  });
  it('requires a valid retained run identity and rejects query alternatives', async () => {
    const h = harness();
    for (const path of ['bad', '00000000-0000-4000-8000-000000000001']) {
      const response = await h.app.inject(`/api/game/coach/${path}`);
      expect(response.statusCode).toBe(path === 'bad' ? 400 : 404); GameErrorSchema.parse(response.json());
    }
    const first = await h.post();
    expect((await h.app.inject(`/api/game/coach/${first.json().run.runId}?extra=1`)).statusCode).toBe(400);
    h.session.create(1); expect((await h.app.inject(`/api/game/coach/${first.json().run.runId}`)).statusCode).toBe(404);
    expect((await h.post()).statusCode).toBe(404); await flush();
  });
  it('enforces JSON and 1024 byte cap with safe errors in the production app', async () => {
    const provider = new FakeAiProvider(); const app = buildApp({ aiProvider: provider }); apps.push(app);
    for (const [payload, contentType, status] of [['{raw-secret', 'application/json', 400], ['{}', 'text/plain', 415], [JSON.stringify({ secret: 'x'.repeat(1100) }), 'application/json', 413]] as const) {
      const response = await app.inject({ method: 'POST', url: '/api/game/coach', headers: { 'content-type': contentType }, payload });
      expect(response.statusCode).toBe(status); expect(response.headers['cache-control']).toBe('no-store');
      GameErrorSchema.parse(response.json()); expect(response.body).not.toContain('raw-secret');
    }
    expect(provider.agentCalls).toHaveLength(0);
  });
});
