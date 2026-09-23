import { afterEach, expect, it } from 'vitest';
import { buildApp } from '../../backend/src/app';
import { GameSession } from '../../backend/src/session';
import { GameErrorSchema } from '../../shared/contracts';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures';

const apps: ReturnType<typeof buildApp>[] = [];
function app() { const a = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]), botRandom: sequenceRandom(Array(100).fill(0.9)) }); apps.push(a); return a; }
afterEach(async () => { await Promise.all(apps.splice(0).map(a => a.close())); });
it('create/reset uslovi i konkurentni duplikati ne brišu noviju partiju', async () => {
  const a = app();
  const post = (headers = {}) => a.inject({ method: 'POST', url: '/api/game', headers, payload: { botCount: 1 } });
  expect((await post()).statusCode).toBe(428);
  expect((await post({ 'if-none-match': 'wrong' })).statusCode).toBe(409);
  const created = await Promise.all([post({ 'if-none-match': '*' }), post({ 'if-none-match': '*' })]);
  expect(created.map(r => r.statusCode).sort()).toEqual([201, 409]);
  const g = created.find(r => r.statusCode === 201)!.json().game;
  expect((await post()).statusCode).toBe(428);
  const resets = await Promise.all([post({ 'if-match': `"${g.gameId}:${g.version}"` }), post({ 'if-match': `"${g.gameId}:${g.version}"` })]);
  expect(resets.map(r => r.statusCode).sort()).toEqual([201, 409]);
});
it.each([
  [400, 'INVALID_INPUT', 'application/json', '{"private":"As",'],
  [413, 'PAYLOAD_TOO_LARGE', 'application/json', 'x'.repeat(17000)],
  [415, 'UNSUPPORTED_MEDIA_TYPE', 'text/plain', '{"botCount":1}'],
  [415, 'UNSUPPORTED_MEDIA_TYPE', 'application/xml', '<private>As</private>'],
] as const)('kontrolisan %s bez promene stanja', async (status, code, contentType, payload) => {
  const a = app(); await a.inject({ method: 'POST', url: '/api/game', headers: { 'if-none-match': '*' }, payload: { botCount: 1 } });
  const before = (await a.inject('/api/game')).body;
  const r = await a.inject({ method: 'POST', url: '/api/game', headers: { 'content-type': contentType }, payload });
  expect(r.statusCode).toBe(status); expect(GameErrorSchema.parse(r.json()).error.code).toBe(code);
  expect(r.body).not.toContain('As'); expect((await a.inject('/api/game')).body).toBe(before);
});
it('samo propisani Origin; nema debug ili set-deck ruta', async () => {
  const a = app();
  for (const origin of ['http://evil.test', 'null', 'http://localhost:5173', 'http://127.0.0.1:5174']) {
    const r = await a.inject({ method: 'POST', url: '/api/game', headers: { origin, 'if-none-match': '*' }, payload: { botCount: 1 } });
    expect(r.statusCode).toBe(400); expect(GameErrorSchema.parse(r.json()).error.code).toBe('INVALID_INPUT');
    expect((await a.inject('/api/game')).json()).toEqual({ game: null });
  }
  expect((await a.inject({ method: 'GET', url: '/api/game', headers: { origin: 'http://127.0.0.1:5173' } })).statusCode).toBe(200);
  for (const url of ['/api/debug', '/api/set-deck', '/api/game/set-deck', '/api/reset-stack']) {
    for (const method of ['GET', 'POST'] as const) expect((await a.inject({ method, url })).statusCode).toBe(404);
  }
});
it('404, stale i dupli potez imaju najviše jedan commit', async () => {
  const a = app(); const g = (await a.inject({ method: 'POST', url: '/api/game', headers: { 'if-none-match': '*' }, payload: { botCount: 1 } })).json().game;
  const payload = { gameId: g.gameId, handId: g.handId, expectedVersion: g.version, type: 'call' };
  const missing = await a.inject({ method: 'POST', url: '/api/game/actions', payload: { ...payload, gameId: '11111111-1111-4111-8111-111111111111' } });
  expect(missing.statusCode).toBe(404); expect(GameErrorSchema.parse(missing.json()).error.code).toBe('GAME_NOT_FOUND');
  const responses = await Promise.all([a.inject({ method: 'POST', url: '/api/game/actions', payload }), a.inject({ method: 'POST', url: '/api/game/actions', payload })]);
  expect(responses.map(r => r.statusCode).sort()).toEqual([200, 409]);
  expect((await a.inject('/api/game')).json()).toEqual(responses.find(r => r.statusCode === 200)!.json());
});
it('rollback next-hand čuva istoriju, verziju i oba RNG izvora posle potrošnje', () => {
  let fail = true;
  const s = new GameSession({ deckRandom: sequenceRandom(Array.from({ length: 500 }, (_, i) => (i + 1) / 501)), botRandom: sequenceRandom(Array.from({ length: 500 }, (_, i) => 0.5 + i / 1000)), beforeNextHandCommit: () => { if (fail) throw new Error('private seed'); } });
  let g = s.create(1); g = s.action({ gameId: g.gameId, handId: g.hand.handId, expectedVersion: g.version, type: 'fold' });
  const before = JSON.stringify(g); const deck = g.deckRandom; const bot = g.botRandom;
  const deckBefore = deck.clone().next(); const botBefore = bot.clone().next();
  const input = { gameId: g.gameId, handId: g.hand.handId, expectedVersion: g.version };
  expect(() => s.nextHand(input)).toThrow('Interna greška');
  expect(s.get()).toBe(g); expect(JSON.stringify(s.get())).toBe(before);
  expect(s.get()!.deckRandom).toBe(deck); expect(s.get()!.botRandom).toBe(bot);
  expect(s.get()!.deckRandom.clone().next()).toBe(deckBefore); expect(s.get()!.botRandom.clone().next()).toBe(botBefore);
  fail = false; expect(s.nextHand(input).version).toBe(g.version + 1);
});
it('kontrolisan HTTP 500 odbacuje kandidata i ne otkriva privatnu grešku', async () => {
  const a = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]), botRandom: sequenceRandom([0.1, 0.9]),
    beforeActionCommit: () => { throw new Error('private observation Kc seed=123'); } });
  apps.push(a);
  const g = (await a.inject({ method: 'POST', url: '/api/game', headers: { 'if-none-match': '*' }, payload: { botCount: 1 } })).json().game;
  const before = (await a.inject('/api/game')).body;
  const r = await a.inject({ method: 'POST', url: '/api/game/actions', payload: {
    gameId: g.gameId, handId: g.handId, expectedVersion: g.version, type: 'call',
  } });
  expect(r.statusCode).toBe(500); expect(GameErrorSchema.parse(r.json()).error.code).toBe('INTERNAL_ERROR');
  expect(r.body).not.toMatch(/private|observation|Kc|seed|stack/);
  expect((await a.inject('/api/game')).body).toBe(before);
});
