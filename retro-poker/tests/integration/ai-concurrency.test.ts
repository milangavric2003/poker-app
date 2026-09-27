import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { FakeAiProvider } from '../helpers/fake-ai-provider.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const apps: FastifyInstance[] = [];
afterEach(async () => Promise.all(apps.splice(0).map(app => app.close())));
describe('AI cancellation and non-blocking reads', () => {
  it('serves GET while pending and ignores a late callback after replacement', async () => {
    const provider = new FakeAiProvider([{ kind: 'pending', id: 'old' }]);
    const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]), botRandom: sequenceRandom([0.9]),
      aiProvider: provider, aiConfig: loadAiConfig({ GEMINI_API_KEY: 'test' }) }); apps.push(app);
    const created = (await app.inject({ method: 'POST', url: '/api/game', headers: {
      'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 3, aiMode: true } })).json().game;
    await new Promise(resolve => setTimeout(resolve, 0));
    const pending = await app.inject('/api/game');
    expect(pending.statusCode).toBe(200);
    expect(pending.json().game.ai.active).not.toBeNull();
    const replacement = (await app.inject({ method: 'POST', url: '/api/game', headers: {
      'if-match': `"${created.gameId}:${created.version}"`, 'content-type': 'application/json' },
      payload: { botCount: 1, aiMode: false } })).json().game;
    provider.resolve('old', { candidate: {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect((await app.inject('/api/game')).json().game.gameId).toBe(replacement.gameId);
  });
});
