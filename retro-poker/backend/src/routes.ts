import type { FastifyInstance, FastifyReply } from 'fastify';
import { GameConfigSchema, NextHandSchema, PlayerActionSchema } from '../../shared/contracts.js';
import { SessionError, type GameSession } from './session.js';
import { toGameView } from './view.js';

function error(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

export function registerRoutes(app: FastifyInstance, session: GameSession): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'no-store');
    return payload;
  });
  app.get('/api/game', async () => session.serial(() => ({
    game: session.get() ? toGameView(session.get()!) : null,
  })));
  app.post('/api/game', async (request, reply) => session.serial(() => {
    const parsed = GameConfigSchema.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, 'INVALID_INPUT', 'Nevalidna konfiguracija partije.');
    const current = session.get();
    const noneMatch = request.headers['if-none-match'];
    const match = request.headers['if-match'];
    if (!current && noneMatch !== '*') return error(reply, 428, 'PRECONDITION_REQUIRED', 'Nedostaje uslov za kreiranje.');
    if (current && match === undefined) return error(reply, 428, 'PRECONDITION_REQUIRED', 'Nedostaje uslov za zamenu.');
    if (current && match !== `"${current.gameId}:${current.version}"`) {
      return error(reply, 409, 'STALE_STATE', 'Stanje partije je zastarelo.');
    }
    try { return reply.code(201).send({ game: toGameView(session.create(parsed.data.botCount)) }); }
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
}
