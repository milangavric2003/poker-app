import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import type { RandomSource } from './engine/types.js';
import { registerRoutes } from './routes.js';
import { GameSession, type SessionDependencies } from './session.js';

class SeededRandom implements RandomSource {
  constructor(private state: number) {}
  next(): number {
    this.state ^= this.state << 13; this.state ^= this.state >>> 17; this.state ^= this.state << 5;
    return (this.state >>> 0) / 0x1_0000_0000;
  }
  clone(): RandomSource { return new SeededRandom(this.state); }
}

function secureRandom(): RandomSource { return new SeededRandom(randomBytes(4).readUInt32LE(0)); }

export function buildApp(dependencies: SessionDependencies = {
  deckRandom: secureRandom(), botRandom: secureRandom(),
}) {
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });
  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.origin !== undefined && request.headers.origin !== 'http://127.0.0.1:5173') {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Poreklo zahteva nije dozvoljeno.' } });
    }
    if (request.method === 'POST' && ['/api/game', '/api/game/actions', '/api/game/next-hand'].includes(request.url)
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
  registerRoutes(app, new GameSession(dependencies));
  return app;
}
