import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); const s = processUsageStore.snapshot(); processUsageStore.reset(s.revision); });

describe('analysis route read-only boundary (FR-016â€“FR-019, AIAC10â€“AIAC11)', () => {
  it('does not mutate a nonterminal game when analysis eligibility is rejected', async () => {
    const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
      botRandom: sequenceRandom(Array<number>(100).fill(0.9)) });
    apps.push(app);
    const created = await app.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 1 } });
    const before = created.json().game;
    const response = await app.inject({ method: 'POST', url: '/api/game/analysis',
      headers: { 'content-type': 'application/json' }, payload: {
        gameId: before.gameId, handId: before.handId, expectedVersion: before.version,
      } });
    const after = (await app.inject('/api/game')).json().game;
    expect({ result: after.result, stacks: after.players.map((p: { stack: number }) => p.stack),
      version: after.version, events: after.events }).toEqual({
      result: before.result, stacks: before.players.map((p: { stack: number }) => p.stack),
      version: before.version, events: before.events,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ANALYSIS_NOT_ALLOWED');
  });
});


