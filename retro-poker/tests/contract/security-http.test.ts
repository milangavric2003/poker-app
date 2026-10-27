import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { buildApp } from '../../backend/src/app.js';
import { GameSession } from '../../backend/src/session.js';
import { securityFixture, pokerSnapshot } from '../helpers/security-fixtures.js';

let h: ReturnType<typeof securityFixture>;
let app: ReturnType<typeof buildApp>;
let session: GameSession;
let input: { gameId: string; handId: string; expectedVersion: number; goal: { focus: string } };
let before: string;
beforeEach(async () => {
  h = securityFixture([{ kind: 'agent_tool' }, { kind: 'agent_final' }]);
  // Observe the real session created by buildApp; do not replace any validator.
  const created = vi.spyOn(GameSession.prototype, 'create');
  app = buildApp(h.dependencies);
  const response = await app.inject({ method: 'POST', url: '/api/game',
    headers: { 'if-none-match': '*' }, payload: { botCount: 1 } });
  expect(response.statusCode).toBe(201);
  // Vitest erases the class receiver type; this is an observed real instance,
  // not a cast used as validation of untrusted HTTP data.
  expect(created.mock.contexts[0]).toBeInstanceOf(GameSession);
  session = created.mock.contexts[0] as GameSession;
  created.mockRestore();
  const game = session.get()!;
  session.action({ gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, type: 'all_in' });
  const terminal = session.get()!;
  input = { gameId: terminal.gameId, handId: terminal.hand.handId,
    expectedVersion: terminal.version, goal: { focus: 'street' } };
  before = pokerSnapshot(session);
});
afterEach(async () => { vi.restoreAllMocks(); await app?.close(); });

async function denied(payload: unknown, status = 400, code = 'INVALID_INPUT',
  headers: Record<string, string> = { 'content-type': 'application/json' }) {
  const response = await app.inject({ method: 'POST', url: '/api/game/coach',
    headers, payload: typeof payload === 'string' ? payload : JSON.stringify(payload) });
  expect(response.statusCode).toBe(status);
  expect(response.json()).toEqual({ error: { code, message: expect.any(String) } });
  expect(h.provider.agentCalls).toHaveLength(0);
  expect(h.provider.calls).toHaveLength(0);
  expect(h.executions).toHaveLength(0);
  expect(pokerSnapshot(session)).toBe(before);
}

it.each(['{', 'null', '[]', '"text"'])('T01 malformed or non-object JSON %s', value => denied(value));
it.each([
  { gameId: 1 }, { handId: null }, { gameId: 'invalid' }, { expectedVersion: '1' },
  { expectedVersion: -1 }, { expectedVersion: 1.5 }, { expectedVersion: null },
  { goal: null }, { goal: { focus: 'shell' } }, { goal: { focus: 1 } },
  { goal: {} }, { goal: { focus: 'street', role: 'admin' } },
])('T01 rejects types/domain/null %j', patch => denied({ ...input, ...patch }));
it.each(['gameId', 'handId', 'expectedVersion', 'goal'])('T01 missing %s', key => {
  const body: Record<string, unknown> = { ...input }; delete body[key]; return denied(body);
});
it.each(['model', 'provider', 'maxSteps', 'role', 'ownerId', 'stacks', 'result'])('T02/T15 rejects privileged %s independently of body cap', key => {
  const body = JSON.stringify({ ...input, [key]: 'forged' });
  expect(Buffer.byteLength(body)).toBeLessThan(1024);
  return denied(body);
});
it('T02 rejects 1025 bytes of otherwise valid JSON', () => {
  const body = JSON.stringify(input);
  return denied(body + ' '.repeat(1025 - Buffer.byteLength(body)), 413);
});
it('T02 counts multibyte UTF-8 bytes, not characters', () => {
  const body = JSON.stringify({ ...input, goal: { focus: 'ž'.repeat(450) } });
  expect(body.length).toBeLessThan(1024);
  expect(Buffer.byteLength(body)).toBeGreaterThan(1024);
  return denied(body, 413);
});
it('T01 rejects unsupported media before work', () => denied('{}', 415, 'UNSUPPORTED_MEDIA_TYPE', { 'content-type': 'text/plain' }));
it('T03 unknown game', () => denied({ ...input, gameId: randomUUID() }, 404, 'GAME_NOT_FOUND'));
it('T03 unknown hand follows stale contract', () => denied({ ...input, handId: randomUUID() }, 409, 'STALE_STATE'));
it('T03 stale version', () => denied({ ...input, expectedVersion: input.expectedVersion - 1 }, 409, 'STALE_STATE'));
it.each(['http://evil.invalid', 'null'])('T012 forbidden Origin %s has server-side rejection', origin =>
  denied(input, 400, 'INVALID_INPUT', { origin, 'content-type': 'application/json' }));

it.each([undefined, 'http://127.0.0.1:5173'])('T00/T02/T012 valid exact byte boundary, Origin %s', async origin => {
  const body = JSON.stringify(input);
  const payload = body + ' '.repeat(1024 - Buffer.byteLength(body));
  expect(Buffer.byteLength(payload)).toBe(1024);
  const response = await app.inject({ method: 'POST', url: '/api/game/coach', payload,
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) } });
  expect(response.statusCode).toBe(202);
  const runId = response.json().run.runId;
  const { settleSecurityRun } = await import('../helpers/security-fixtures.js');
  expect((await settleSecurityRun(session, runId)).status).toBe('completed');
  expect(h.provider.agentCalls).toHaveLength(2); expect(h.executions).toHaveLength(1);
  expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  expect(response.headers['set-cookie']).toBeUndefined();
  expect(pokerSnapshot(session)).toBe(before);
});
