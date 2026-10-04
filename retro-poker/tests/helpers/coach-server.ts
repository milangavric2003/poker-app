import { createServer, type ViteDevServer } from 'vite';
import { buildApp } from '../../backend/src/app.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { getDecisionEvidence } from '../../backend/src/agent/tools.js';
import { CoachResponseSchema, GameResponseSchema } from '../../shared/contracts.js';
import { FakeAiProvider } from './fake-ai-provider.js';
import { ac23Deck, sequenceRandom } from './fixtures.js';

/** Constructor-only fixtures; production HTTP routes and validators, no debug routes. */
export async function startCoachServers() {
  const provider = new FakeAiProvider([{ kind: 'pending', id: 'first' }]);
  let tools = 0;
  const backend = buildApp({ deck: ['As', 'Kc', 'Ah', 'Kd', ...ac23Deck.slice(4)],
    deckRandom: sequenceRandom([]), botRandom: sequenceRandom(Array<number>(100).fill(0.9)),
    aiProvider: provider, aiConfig: loadAiConfig({ GEMINI_API_KEY: 'offline-fake-only', GEMINI_MAX_ATTEMPTS: '1' }),
    coachExecuteTool: (...args) => { tools++; return getDecisionEvidence(...args); } });
  let frontend: ViteDevServer | undefined;
  try {
    const created = await backend.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*' }, payload: { botCount: 1 } });
    const game = GameResponseSchema.parse(created.json()).game!;
    const finished = await backend.inject({ method: 'POST', url: '/api/game/actions', payload: {
      gameId: game.gameId, handId: game.handId, expectedVersion: game.version, type: 'all_in',
    } });
    const terminal = GameResponseSchema.parse(finished.json()).game!;
    if (terminal.status === 'playing') throw new Error('Coach fixture must be terminal');
    await backend.listen({ host: '127.0.0.1', port: 0 });
    const address = backend.server.address();
    if (!address || typeof address === 'string') throw new Error('Missing backend port');
    frontend = await createServer({ configFile: false, root: 'frontend', server: {
      host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': `http://127.0.0.1:${address.port}` },
    } });
    await frontend.listen();
    return { origin: 'http://127.0.0.1:5173', provider, terminal, toolCount: () => tools,
      status: async (runId: string) => CoachResponseSchema.parse((await backend.inject(`/api/game/coach/${runId}`)).json()).run,
      snapshot: async () => (await backend.inject('/api/game')).json(),
      close: async () => { await frontend?.close(); await backend.close(); } };
  } catch (error) { await frontend?.close(); await backend.close(); throw error; }
}
