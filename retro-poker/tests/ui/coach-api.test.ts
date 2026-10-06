import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCoach, startCoach } from '../../frontend/src/api';
import { GameViewSchema } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const game = GameViewSchema.parse(publicView());
const run = { gameId: game.gameId, handId: game.handId, expectedVersion: game.version,
  runId: '00000000-0000-4000-8000-000000000022', factsRevision: 1, goal: { focus: 'betting' },
  status: 'running', startedAt: '2026-10-04T12:00:00Z', deadlineAt: '2026-10-04T12:00:45Z',
  stepCount: 0, toolCallCount: 0, providerAttemptCount: 0, stopReason: null,
  failureCategory: null, result: null, sampleLimited: false };
describe('T022 strict coach API', () => {
  it('sends one POST with exact public identity and goal', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ run }), { status: 202 }));
    vi.stubGlobal('fetch', fetch);
    expect(await startCoach(game, { focus: 'betting' })).toEqual(run);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/game/coach', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ gameId: game.gameId, handId: game.handId,
      expectedVersion: game.version, goal: { focus: 'betting' } });
  });
  it('GET uses the path runId and disables caching', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ run })));
    vi.stubGlobal('fetch', fetch);
    expect(await loadCoach(run.runId)).toEqual(run);
    expect(fetch).toHaveBeenCalledWith(`/api/game/coach/${run.runId}`, expect.objectContaining({ cache: 'no-store' }));
  });
  it.each([400, 409, 429, 500])('never exposes server/provider message for HTTP %s', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'INTERNAL_ERROR', message: 'PRIVATE_PROVIDER stack trace secret' },
    }), { status })));
    await expect(startCoach(game, { focus: 'betting' })).rejects.toThrow('Coaching zahtev nije prihvaćen.');
  });
  it.each([{ run: { ...run, prompt: 'PRIVATE' } }, { run: { ...run, status: 'completed' } },
    { run: { ...run, result: { summary: 'unvalidated' } } }])('rejects malformed strict DTO', async payload => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
    await expect(loadCoach(run.runId)).rejects.toThrow('Nevažeći coaching odgovor servera.');
  });
  it('rejects invalid JSON and network exception safely', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('PRIVATE invalid JSON'))
      .mockRejectedValueOnce(new Error('PRIVATE stack trace'));
    vi.stubGlobal('fetch', fetch);
    await expect(loadCoach(run.runId)).rejects.toThrow('Nevažeći odgovor servera.');
    await expect(loadCoach(run.runId)).rejects.toThrow(/Veza sa serverom/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('times out without retrying POST', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('PRIVATE')));
    }));
    vi.stubGlobal('fetch', fetch);
    const result = startCoach(game, { focus: 'betting' }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10000);
    expect(await result).toEqual(expect.objectContaining({ message: expect.stringMatching(/isteklo/) }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
