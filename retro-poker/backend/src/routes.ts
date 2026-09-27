import type { FastifyInstance, FastifyReply } from 'fastify';
import { GameConfigSchema, NextHandSchema, PlayerActionSchema } from '../../shared/contracts.js';
import { SessionError, type GameSession } from './session.js';
import { toGameView } from './view.js';
import { z } from 'zod';

const UsageResetSchema = z.strictObject({ expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) });
const AnalysisRequestSchema = z.strictObject({ gameId: z.uuid(), handId: z.uuid(),
  expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) });
interface UsageState { revision: number; logical: never[]; attempts: never[]; retryCount: number;
  modelFallbackCount: number; localFallbackCount: number; }

function error(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

export function registerRoutes(app: FastifyInstance, session: GameSession): void {
  let usage: UsageState = { revision: 0, logical: [], attempts: [], retryCount: 0,
    modelFallbackCount: 0, localFallbackCount: 0 };
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'no-store');
    return payload;
  });
  app.get('/api/game', async () => ({
    game: session.get() ? toGameView(session.get()!) : null,
  }));
  app.get('/api/ai/usage', async () => ({ usage }));
  app.post('/api/ai/usage/reset', async (request, reply) => {
    const parsed = UsageResetSchema.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'INVALID_INPUT', 'Nevalidan zahtev za reset metrika.');
    if (parsed.data.expectedRevision !== usage.revision) return error(reply, 409, 'STALE_STATE', 'Stanje metrika je zastarelo.');
    usage = { revision: usage.revision + 1, logical: [], attempts: [], retryCount: 0,
      modelFallbackCount: 0, localFallbackCount: 0 };
    return { usage };
  });
  app.post('/api/game', async (request, reply) => session.serial(() => {
    const parsed = GameConfigSchema.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'INVALID_INPUT', 'Nevalidna konfiguracija partije.');
    const current = session.get();
    const noneMatch = request.headers['if-none-match'];
    const match = request.headers['if-match'];
    if (noneMatch === undefined && match === undefined) return error(reply, 428, 'PRECONDITION_REQUIRED', 'Nedostaje uslov za kreiranje ili zamenu.');
    if ((!current && (noneMatch !== '*' || match !== undefined)) || (current && noneMatch !== undefined)) {
      return error(reply, 409, 'STALE_STATE', 'Stanje partije je zastarelo.');
    }
    if (current && match !== `"${current.gameId}:${current.version}"`) {
      return error(reply, 409, 'STALE_STATE', 'Stanje partije je zastarelo.');
    }
    try { return reply.code(201).send({ game: toGameView(session.create(parsed.data.botCount, parsed.data.aiMode)) }); }
    catch { return error(reply, 500, 'INTERNAL_ERROR', 'Partija nije mogla da se kreira.'); }
  }));
  app.post('/api/game/actions', async (request, reply) => session.serial(() => {
    const parsed = PlayerActionSchema.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'INVALID_INPUT', 'Nevalidan zahtev za potez.');
    try { return { game: toGameView(session.action(parsed.data)) }; }
    catch (caught) {
      if (caught instanceof SessionError) {
        const status = caught.code === 'GAME_NOT_FOUND' ? 404 : caught.code === 'INTERNAL_ERROR' ? 500 : 409;
        return error(reply, status, caught.code, caught.message);
      }
      return error(reply, 500, 'INTERNAL_ERROR', 'Interna greška pri obradi poteza.');
    }
  }));
  app.post('/api/game/next-hand', async (request, reply) => session.serial(() => {
    const parsed = NextHandSchema.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'INVALID_INPUT', 'Nevalidan zahtev za sledeću ruku.');
    try { return { game: toGameView(session.nextHand(parsed.data)) }; }
    catch (caught) {
      if (caught instanceof SessionError) {
        const status = caught.code === 'GAME_NOT_FOUND' ? 404 : caught.code === 'INTERNAL_ERROR' ? 500 : 409;
        return error(reply, status, caught.code, caught.message);
      }
      return error(reply, 500, 'INTERNAL_ERROR', 'Interna greška pri pokretanju ruke.');
    }
  }));
  app.post('/api/game/analysis', async (request, reply) => session.serial(() => {
    const parsed = AnalysisRequestSchema.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'INVALID_INPUT', 'Nevalidan zahtev za analizu.');
    try { return reply.code(202).send({ game: toGameView(session.startAnalysis(parsed.data)) }); }
    catch (caught) {
      if (caught instanceof SessionError) return error(reply, caught.code === 'GAME_NOT_FOUND' ? 404 : 409,
        caught.code, caught.message);
      return error(reply, 500, 'INTERNAL_ERROR', 'Interna greška pri analizi.');
    }
  }));
}
