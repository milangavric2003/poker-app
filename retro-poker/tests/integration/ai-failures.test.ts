import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { FakeAiProvider } from '../helpers/fake-ai-provider.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const apps: FastifyInstance[] = [];
afterEach(async () => Promise.all(apps.splice(0).map(app => app.close())));
describe('offline AI recovery', () => {
  it('bounds malformed recovery at two attempts and commits one local fallback', async () => {
    const provider = new FakeAiProvider([{ kind: 'malformed' }, { kind: 'schema_mismatch' }]);
    const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]), botRandom: sequenceRandom([0.9, 0.9]),
      aiProvider: provider, aiConfig: loadAiConfig({ GEMINI_API_KEY: 'test' }) }); apps.push(app);
    const created = await app.inject({ method: 'POST', url: '/api/game', headers: {
      'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 3, aiMode: true } });
    const initial = created.json().game;
    let game = initial;
    for (let i = 0; i < 20 && !game.ai.lastBotOutcome; i++) {
      await new Promise(resolve => setTimeout(resolve, 5));
      game = (await app.inject('/api/game')).json().game;
    }
    expect(provider.callCount).toBe(2);
    expect(game.ai.lastBotOutcome).toMatchObject({ outcome: 'local_fallback', attemptCount: 2 });
    expect(game.version).toBe(initial.version + 1);
  });
});
