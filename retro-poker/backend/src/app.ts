import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import type { RandomSource } from './engine/types.js';
import { registerRoutes } from './routes.js';
import { GameSession, type SessionDependencies } from './session.js';
import { loadAiConfig } from './ai/config.js';
import { createGeminiProvider } from './ai/providers/gemini.js';

class SeededRandom implements RandomSource {
  constructor(private state: number) {}
  next(): number {
    this.state ^= this.state << 13; this.state ^= this.state >>> 17; this.state ^= this.state << 5;
    return (this.state >>> 0) / 0x1_0000_0000;
  }
  clone(): RandomSource { return new SeededRandom(this.state); }
}

function secureRandom(): RandomSource { return new SeededRandom(randomBytes(4).readUInt32LE(0)); }

export function productionAiDependencies(
  env: Readonly<Record<string, string | undefined>> = process.env,
  providerFactory: (apiKey: string) => NonNullable<SessionDependencies['aiProvider']> = createGeminiProvider,
): Partial<Pick<SessionDependencies, 'aiConfig' | 'aiProvider'>> {
  const aiConfig = loadAiConfig(env);
  return aiConfig.enabled && aiConfig.apiKey
    ? { aiConfig, aiProvider: providerFactory(aiConfig.apiKey) }
    : { aiConfig };
}

export function buildApp(dependencies: Partial<SessionDependencies> = {}) {
  const resolved: SessionDependencies = { deckRandom: secureRandom(), botRandom: secureRandom(), ...dependencies };
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });
  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.origin !== undefined && request.headers.origin !== 'http://127.0.0.1:5173') {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Poreklo zahteva nije dozvoljeno.' } });
    }
    if (request.method === 'POST' && ['/api/game', '/api/game/actions', '/api/game/next-hand',
      '/api/game/analysis', '/api/ai/usage/reset'].includes(request.url)
      && request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return reply.code(415).send({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Zahtev mora biti JSON.' } });
    }
  });
  app.setErrorHandler((caught, _request, reply) => {
    const status = (caught as { statusCode?: number }).statusCode;
    const [http, code, message] = status === 413 ? [413, 'PAYLOAD_TOO_LARGE', 'Zahtev je prevelik.']
      : status === 415 ? [415, 'UNSUPPORTED_MEDIA_TYPE', 'Zahtev mora biti JSON.']
      : status === 400 ? [400, 'INVALID_INPUT', 'Nevalidan JSON zahtev.']
      : [500, 'INTERNAL_ERROR', 'Interna greška servera.'];
    return reply.code(http as number).send({ error: { code, message } });
  });
  registerRoutes(app, new GameSession(resolved));
  return app;
}
