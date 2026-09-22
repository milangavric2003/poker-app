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
  registerRoutes(app, new GameSession(dependencies));
  return app;
}
