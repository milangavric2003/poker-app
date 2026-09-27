import { z } from 'zod';
import { GameErrorSchema, GameResponseSchema, type GameView } from '../../shared/contracts';

export type ActionDraft =
  | { type: 'fold' | 'check' | 'call' | 'all_in' }
  | { type: 'bet' | 'raise'; amountTo: number };

export class ApiError extends Error {
  constructor(message: string, readonly code: string | null = null) { super(message); }
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    let response: Response;
    try { response = await fetch(path, { ...init, signal: controller.signal }); }
    catch { throw new ApiError(controller.signal.aborted
      ? 'Vreme čekanja je isteklo. Učitaj stanje pre nastavka.'
      : 'Veza sa serverom je prekinuta. Učitaj stanje pre nastavka.'); }
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new ApiError('Nevažeći odgovor servera.'); }
    if (!response.ok) {
      const parsed = GameErrorSchema.safeParse(payload);
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

const Count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const UsageMetricSchema = z.strictObject({ knownCount: Count, missingCount: Count, sum: Count });
const CostMetricSchema = z.strictObject({ knownCount: Count, missingCount: Count,
  sum: Count.nullable(), currency: z.string().min(1).nullable() }).refine(value =>
  (value.knownCount === 0) === (value.sum === null), 'Inconsistent cost aggregate');
const UsageDashboardSchema = z.strictObject({
  revision: Count,
  logical: z.array(z.strictObject({ purpose: z.enum(['bot', 'analysis']), initialModel: z.string().min(1),
    finalOutcome: z.string().min(1), count: Count })),
  attempts: z.array(z.strictObject({ purpose: z.enum(['bot', 'analysis']), model: z.string().min(1),
    relation: z.enum(['initial', 'same_model_retry', 'model_fallback']),
    outcome: z.enum(['success', 'timeout', 'rate_limited', 'server_error', 'network_error', 'malformed',
      'schema_rejected', 'semantic_rejected', 'safety_refusal', 'auth_config_error', 'cancelled', 'stale']),
    count: Count, latency: z.strictObject({ count: Count, sumMs: Count, maxMs: Count }),
    usage: z.strictObject({ promptTokens: UsageMetricSchema, candidateTokens: UsageMetricSchema,
      thoughtTokens: UsageMetricSchema, cachedTokens: UsageMetricSchema, totalTokens: UsageMetricSchema,
      cost: CostMetricSchema }).optional() })),
  retryCount: Count, modelFallbackCount: Count, localFallbackCount: Count,
});
const UsageResponseSchema = z.strictObject({ usage: UsageDashboardSchema });
export type UsageDashboardView = z.infer<typeof UsageDashboardSchema>;

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
