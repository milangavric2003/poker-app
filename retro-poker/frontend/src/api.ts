import { CoachResponseSchema, GameErrorSchema, GameResponseSchema, UsageResponseSchema,
  type CoachGoal, type CoachRunView, type GameView, type UsageDashboardView } from '../../shared/contracts';

export type ActionDraft =
  | { type: 'fold' | 'check' | 'call' | 'all_in' }
  | { type: 'bet' | 'raise'; amountTo: number };

export class ApiError extends Error {
  constructor(message: string, readonly code: string | null = null) { super(message); }
}

async function fetchJson(path: string, init?: RequestInit, safeCoachError = false): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    let response: Response;
    const apiOrigin = (import.meta as ImportMeta & { env?: { VITE_API_ORIGIN?: string } }).env?.VITE_API_ORIGIN;
    try { response = await fetch(apiOrigin ? new URL(path, apiOrigin).toString() : path, { ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal }); }
    catch { throw new ApiError(controller.signal.aborted
      ? 'Vreme čekanja je isteklo. Učitaj stanje pre nastavka.'
      : 'Veza sa serverom je prekinuta. Učitaj stanje pre nastavka.'); }
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new ApiError('Nevažeći odgovor servera.'); }
    if (!response.ok) {
      const parsed = GameErrorSchema.safeParse(payload);
      if (safeCoachError) throw new ApiError('Coaching zahtev nije prihvaćen.', parsed.success ? parsed.data.error.code : null);
      throw new ApiError(parsed.success ? parsed.data.error.message : 'Nevažeći odgovor servera.',
        parsed.success ? parsed.data.error.code : null);
    }
    return payload;
  } finally { clearTimeout(timer); }
}

async function requestGame(path: string, init?: RequestInit): Promise<GameView | null> {
  const parsed = GameResponseSchema.safeParse(await fetchJson(path, init));
  if (!parsed.success) throw new ApiError('Nevažeći odgovor servera.');
  return parsed.data.game;
}

const jsonHeaders = { 'Content-Type': 'application/json' };
async function requestCoach(path: string, init: RequestInit): Promise<CoachRunView> {
  const parsed = CoachResponseSchema.safeParse(await fetchJson(path, { ...init, cache: 'no-store' }, true));
  if (!parsed.success) throw new ApiError('Nevažeći coaching odgovor servera.');
  return parsed.data.run;
}
export async function startCoach(game: GameView, goal: CoachGoal, signal?: AbortSignal): Promise<CoachRunView> {
  return requestCoach('/api/game/coach', { method: 'POST', headers: jsonHeaders, ...(signal ? { signal } : {}),
    body: JSON.stringify({ gameId: game.gameId, handId: game.handId, expectedVersion: game.version, goal }) });
}
export async function loadCoach(runId: string, signal?: AbortSignal): Promise<CoachRunView> {
  return requestCoach(`/api/game/coach/${encodeURIComponent(runId)}`, signal ? { signal } : {});
}
export async function loadGame(): Promise<GameView | null> { return requestGame('/api/game'); }

export async function createGame(botCount: number, current: GameView | null, aiMode?: boolean): Promise<GameView> {
  const condition = current ? { 'If-Match': `"${current.gameId}:${current.version}"` } : { 'If-None-Match': '*' };
  const body = aiMode === undefined ? { botCount } : { botCount, aiMode };
  const game = await requestGame('/api/game', { method: 'POST', headers: { ...jsonHeaders, ...condition },
    body: JSON.stringify(body) });
  if (!game) throw new ApiError('Server nije vratio novu partiju.');
  return game;
}

export async function sendAction(game: GameView, action: ActionDraft): Promise<GameView> {
  const body = { gameId: game.gameId, handId: game.handId, expectedVersion: game.version, ...action };
  const next = await requestGame('/api/game/actions', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
  if (!next) throw new ApiError('Server nije vratio stanje partije.');
  return next;
}

export async function nextHand(game: GameView): Promise<GameView> {
  const body = { gameId: game.gameId, handId: game.handId, expectedVersion: game.version };
  const next = await requestGame('/api/game/next-hand', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
  if (!next) throw new ApiError('Server nije vratio sledeću ruku.');
  return next;
}

export async function requestAnalysis(game: GameView): Promise<GameView> {
  const body = { gameId: game.gameId, handId: game.handId, expectedVersion: game.version };
  const next = await requestGame('/api/game/analysis', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
  if (!next) throw new ApiError('Server nije vratio stanje analize.');
  return next;
}

export type { UsageDashboardView };

export async function loadUsage(): Promise<UsageDashboardView> {
  const parsed = UsageResponseSchema.safeParse(await fetchJson('/api/ai/usage'));
  if (!parsed.success) throw new ApiError('Nevažeći odgovor servera.');
  return parsed.data.usage;
}
export async function resetUsage(expectedRevision: number): Promise<UsageDashboardView> {
  const parsed = UsageResponseSchema.safeParse(await fetchJson('/api/ai/usage/reset', { method: 'POST',
    headers: jsonHeaders, body: JSON.stringify({ expectedRevision }) }));
  if (!parsed.success) throw new ApiError('Nevažeći odgovor servera.');
  return parsed.data.usage;
}
