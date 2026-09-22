import { createServer, type ViteDevServer } from 'vite';
import { buildApp } from '../../backend/src/app.js';
import type { GameDependencies } from '../../backend/src/engine/types.js';
import { ac23Deck, sequenceRandom } from './fixtures.js';
export function testDependencies(): GameDependencies {
  return { deck: ac23Deck, deckRandom: sequenceRandom([0.1, 0.2, 0.3]),
    botRandom: sequenceRandom([0.9, 0.9, 0.9]) };
}

export interface TestServers {
  origin: string;
  close: () => Promise<void>;
}

/** Real Fastify + Vite servers with constructor-only fixture injection. */
export async function startTestServers(): Promise<TestServers> {
  const backend = buildApp(testDependencies());
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
        port: 0,
        strictPort: true,
        proxy: { '/api': `http://127.0.0.1:${backendAddress.port}` },
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

