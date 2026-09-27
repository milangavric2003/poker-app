import { createServer, type ViteDevServer } from 'vite';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../../backend/src/app.js';
import type { GameDependencies } from '../../backend/src/engine/types.js';
import type { AiProvider, ProviderRequest, ProviderResult } from '../../backend/src/ai/types.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { ac23Deck, sequenceRandom } from './fixtures.js';
export function testDependencies(): GameDependencies {
  return { deck: ac23Deck, deckRandom: sequenceRandom([0.1, 0.2, 0.3]),
    botRandom: sequenceRandom([0.9, 0.9, 0.9]) };
}
const offlineProvider: AiProvider = { async generate(request: ProviderRequest): Promise<ProviderResult> {
  if (request.purpose === 'bot') {
    const context = request.context as { gameId: string; handId: string; expectedVersion: number; actorId: string;
      legalActions: Array<{ type: string }> };
    const action = context.legalActions.find(candidate => candidate.type === 'check') ?? context.legalActions[0]!;
    return { candidate: { gameId: context.gameId, handId: context.handId, expectedVersion: context.expectedVersion,
      actorId: context.actorId, type: action.type }, usage: { promptTokens: 0, candidateTokens: 2, totalTokens: 2 } };
  }
  return { candidate: { summary: 'Offline fake analiza.', goodDecisions: [], possibleMistakes: [],
    nextSteps: ['Nastavi sa proverom uloga.'] }, usage: { promptTokens: 10, candidateTokens: 4, totalTokens: 14 } };
} };

export interface TestServers {
  origin: string;
  close: () => Promise<void>;
  restartBackend?: () => Promise<void>;
}

/** Real Fastify + Vite servers with constructor-only fixture injection. */
export async function startTestServers(processBackend = false, fakeAi = false): Promise<TestServers> {
  if (processBackend) {
    let child: ChildProcess;
    async function start(port: number) {
      const processShim = fileURLToPath(new URL('./process-user-shim.cjs', import.meta.url));
      child = fork(fileURLToPath(new URL('./backend-process.ts', import.meta.url)), [], {
        execArgv: ['--require', processShim, '--import', 'tsx'], windowsHide: true,
        env: { ...process.env, TEST_BACKEND_PORT: String(port) },
      });
      const [boundPort] = await once(child, 'message');
      return boundPort as number;
    }
    async function stop() {
      const exited = once(child, 'exit'); child.send('close'); await exited;
    }
    const port = await start(0);
    let frontend: ViteDevServer | undefined;
    try {
      frontend = await createServer({ configFile: false, root: 'frontend', server: {
        host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': `http://127.0.0.1:${port}` },
      } });
      await frontend.listen();
      return { origin: 'http://127.0.0.1:5173', restartBackend: async () => { await stop(); await start(port); },
        close: async () => { await frontend?.close(); await stop(); } };
    } catch (error) { await frontend?.close(); await stop(); throw error; }
  }
  const backend = buildApp({ ...testDependencies(), ...(fakeAi ? { aiProvider: offlineProvider,
    aiConfig: loadAiConfig({ GEMINI_API_KEY: 'offline-fake-only' }) } : {}) });
  await backend.listen({ host: '127.0.0.1', port: 0 });
  const backendAddress = backend.server.address();
  if (!backendAddress || typeof backendAddress === 'string') {
    await backend.close();
    throw new Error('Test backend did not bind a TCP port');
  }

  let frontend: ViteDevServer | undefined;
  try {
    frontend = await createServer({
      configFile: false,
      root: 'frontend',
      server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        proxy: { '/api': { target: `http://127.0.0.1:${backendAddress.port}`, changeOrigin: false } },
      },
    });
    await frontend.listen();
    const frontendAddress = frontend.httpServer?.address();
    if (!frontendAddress || typeof frontendAddress === 'string') {
      throw new Error('Test frontend did not bind a TCP port');
    }
    return {
      origin: `http://127.0.0.1:${frontendAddress.port}`,
      close: async () => {
        await frontend?.close();
        await backend.close();
      },
    };
  } catch (error) {
    await frontend?.close();
    await backend.close();
    throw error;
  }
}

