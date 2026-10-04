import type { FastifyInstance, FastifyReply } from 'fastify';
import { CoachRequestSchema, CoachResponseSchema, GameConfigSchema, NextHandSchema, PlayerActionSchema } from '../../shared/contracts.js';
import { SessionError, type GameSession } from './session.js';
import { toGameView } from './view.js';
import { z } from 'zod';
import { processUsageStore } from './ai/usage.js';

const UsageResetSchema = z.strictObject({ expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) });
const AnalysisRequestSchema = z.strictObject({ gameId: z.uuid(), handId: z.uuid(),
  expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) });

function error(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

export function registerRoutes(app: FastifyInstance, session: GameSession): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'no-store');
    return payload;
  });
  app.get('/api/game', async () => ({
    game: session.get() ? toGameView(session.get()!) : null,
  }));
  const coachError = (reply: FastifyReply, caught: unknown) => caught instanceof SessionError
    ? error(reply, ['GAME_NOT_FOUND', 'RUN_NOT_FOUND'].includes(caught.code) ? 404 : 409, caught.code, caught.message)
    : error(reply, 500, 'INTERNAL_ERROR', 'Interna greška pri coaching obradi.');
  app.post('/api/game/coach', { bodyLimit: 1024 }, async (request, reply) => session.serial(() => {
    const parsed = CoachRequestSchema.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'INVALID_INPUT', 'Nevalidan coaching zahtev.');
    try {
      const run = session.startCoach(parsed.data);
      return reply.code(run.stopReason ? 200 : 202).send(CoachResponseSchema.parse({ run }));
    } catch (caught) { return coachError(reply, caught); }
  }));
  app.get('/api/game/coach/:runId', async (request, reply) => session.serial(() => {
    const params = z.strictObject({ runId: z.uuid() }).safeParse(request.params);
    if (!params.success || !z.strictObject({}).safeParse(request.query).success) {
      return error(reply, 400, 'INVALID_INPUT', 'Nevalidan coaching identitet.');
    }
    try { return CoachResponseSchema.parse({ run: session.coachStatus(params.data.runId) }); }
    catch (caught) { return coachError(reply, caught); }
  }));
  app.get('/api/ai/usage', async () => ({ usage: processUsageStore.snapshot() }));
  app.post('/api/ai/usage/reset', async (request, reply) => {
    const parsed = UsageResetSchema.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'INVALID_INPUT', 'Nevalidan zahtev za reset metrika.');
    if (!processUsageStore.reset(parsed.data.expectedRevision)) return error(reply, 409, 'STALE_STATE', 'Stanje metrika je zastarelo.');
    return { usage: processUsageStore.snapshot() };
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
