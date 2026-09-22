import { GameErrorSchema, GameResponseSchema, type GameView } from '../../shared/contracts';

export type ActionDraft =
  | { type: 'fold' | 'check' | 'call' | 'all_in' }
  | { type: 'bet' | 'raise'; amountTo: number };

async function request(path: string, init?: RequestInit): Promise<GameView | null> {
  const response = await fetch(path, init);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error('Nevažeći odgovor servera.'); }
  if (!response.ok) {
    const parsed = GameErrorSchema.safeParse(payload);
    throw new Error(parsed.success ? parsed.data.error.message : 'Nevažeći odgovor servera.');
  }
  const parsed = GameResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error('Nevažeći odgovor servera.');
  return parsed.data.game;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function loadGame(): Promise<GameView | null> { return request('/api/game'); }

export async function createGame(botCount: number, current: GameView | null): Promise<GameView> {
  const condition = current ? { 'If-Match': `"${current.gameId}:${current.version}"` } : { 'If-None-Match': '*' };
  const game = await request('/api/game', { method: 'POST', headers: { ...jsonHeaders, ...condition }, body: JSON.stringify({ botCount }) });
  if (!game) throw new Error('Server nije vratio novu partiju.');
  return game;
}

export async function sendAction(game: GameView, action: ActionDraft): Promise<GameView> {
  const body = { gameId: game.gameId, handId: game.handId, expectedVersion: game.version, ...action };
  const next = await request('/api/game/actions', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
  if (!next) throw new Error('Server nije vratio stanje partije.');
  return next;
}
