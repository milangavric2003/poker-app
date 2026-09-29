import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameViewSchema } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';
import { createGame, loadGame, loadUsage, sendAction } from '../../frontend/src/api';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('frontend API', () => {
  it('timeout prekida čekanje bez ponavljanja mutacije', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_path: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = sendAction(GameViewSchema.parse(publicView()), { type: 'call' });
    const assertion = expect(result).rejects.toThrow(/isteklo/i);
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('izgubljen odgovor daje srpsku grešku i GET može uskladiti stanje bez POST retry', async () => {
    const game = GameViewSchema.parse(publicView());
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ game: { ...game, version: game.version + 1 } })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendAction(game, { type: 'call' })).rejects.toThrow(/veza|odgovor/i);
    expect((await loadGame())?.version).toBe(game.version + 1);
    expect(fetchMock.mock.calls.map(c => c[1]?.method ?? 'GET')).toEqual(['POST', 'GET']);
  });
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

  it('runtime validira usage i odbija nepoznata potencijalno privatna polja', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ usage: {
      revision: 0, logical: [], attempts: [{ purpose: 'bot', model: 'model-a', relation: 'initial',
        outcome: 'success', count: 1, latency: { count: 1, sumMs: 8, maxMs: 8 },
        usage: { rawPrompt: 'private context' } }], retryCount: 0, modelFallbackCount: 0, localFallbackCount: 0,
    } }), { status: 200 })));

    await expect(loadUsage()).rejects.toThrow(/odgovor servera/i);
  });

  it('odbija attempt bez obaveznih privacy-safe usage agregata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ usage: {
      revision: 0, logical: [], attempts: [{ purpose: 'bot', model: 'model-a', relation: 'initial',
        outcome: 'success', count: 1, latency: { count: 1, sumMs: 8, maxMs: 8 } }],
      retryCount: 0, modelFallbackCount: 0, localFallbackCount: 0,
    } }), { status: 200 })));

    await expect(loadUsage()).rejects.toThrow(/odgovor servera/i);
  });
});
