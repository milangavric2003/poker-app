import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameViewSchema } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';
import { createGame, loadGame, sendAction } from '../../frontend/src/api';

afterEach(() => vi.unstubAllGlobals());

describe('frontend API', () => {
  it('runtime validira uspešan backend odgovor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ game: { ...publicView(), deck: ['As'] } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })));
    await expect(loadGame()).rejects.toThrow(/odgovor servera/i);
  });

  it('šalje create precondition i identitet potvrđenog snapshot-a', async () => {
    const game = GameViewSchema.parse(publicView());
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ game }), {
      status: 201, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await createGame(1, game);
    expect(fetchMock).toHaveBeenCalledWith('/api/game', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ 'If-Match': `"${game.gameId}:${game.version}"` }),
    }));
  });

  it('akciji dodaje identitet i verziju bez lokalnog odlučivanja legalnosti', async () => {
    const game = GameViewSchema.parse(publicView());
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ game: { ...game, version: 1 } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await sendAction(game, { type: 'call' });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      gameId: game.gameId, handId: game.handId, expectedVersion: game.version, type: 'call',
    });
  });
});
