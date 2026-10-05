import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../frontend/src/App';
import * as api from '../../frontend/src/api';
import { CoachRunViewSchema, GameViewSchema, HandResultSchema, type CoachRunView } from '../../shared/contracts';
import { handResult, publicView } from '../helpers/public-fixtures';

const base = GameViewSchema.parse(publicView());
const game = { ...base, status: 'won' as const, phase: 'complete' as const, actorId: null, legalActions: [],
  result: HandResultSchema.parse({ ...handResult(), gameStatus: 'won' }),
  ai: { ...base.ai, availability: 'configured' as const } };
function run(overrides: Partial<CoachRunView> = {}) {
  return CoachRunViewSchema.parse({ gameId: game.gameId, handId: game.handId, expectedVersion: game.version,
    runId: '00000000-0000-4000-8000-000000000022', factsRevision: 1, goal: { focus: 'betting' },
    status: 'running', startedAt: '2026-10-04T12:00:00Z', deadlineAt: '2026-10-04T12:00:45Z',
    stepCount: 0, toolCallCount: 0, providerAttemptCount: 0, stopReason: null,
    failureCategory: null, result: null, sampleLimited: false, ...overrides });
}
const failed = () => run({ status: 'failed', stopReason: 'provider_failed', failureCategory: 'provider_timeout' });
const completed = () => run({ status: 'completed', stopReason: 'completed', stepCount: 2, toolCallCount: 1,
  providerAttemptCount: 2, result: { summary: 'Coaching test rezultat.', recommendation: 'Vežbaj uloge.',
    evidence: [{ decisionRef: 'd1', factCode: 'action', finding: 'Call.' }], completed: true, confidence: 'low' } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
async function flush() { await act(async () => { await Promise.resolve(); }); }
async function tick(ms = 1000) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
const panel = () => within(screen.getByRole('region', { name: 'Coaching partije' }));
async function mount() { const view = render(<App />); await flush(); return view; }
function start() { fireEvent.click(panel().getByRole('button', { name: 'Pokreni coaching' })); }
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(api, 'loadGame').mockResolvedValue(game);
  vi.spyOn(api, 'loadUsage').mockResolvedValue({ revision: 0, logical: [], attempts: [], retryCount: 0,
    modelFallbackCount: 0, localFallbackCount: 0 });
  vi.spyOn(api, 'startCoach').mockResolvedValue(run());
  vi.spyOn(api, 'loadCoach').mockResolvedValue(run());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('T022 coaching App lifecycle', () => {
  it('guards duplicate POST and polls only after accepted start', async () => {
    const pending = deferred<CoachRunView>(); vi.mocked(api.startCoach).mockReturnValue(pending.promise);
    await mount(); start(); start();
    expect(api.startCoach).toHaveBeenCalledTimes(1);
    await tick(3000); expect(api.loadCoach).not.toHaveBeenCalled();
    pending.resolve(run()); await flush(); await tick();
    expect(api.loadCoach).toHaveBeenCalledTimes(1);
    expect(api.startCoach).toHaveBeenCalledWith(game, { focus: 'betting' }, expect.any(AbortSignal));
  });
  it.each([completed(), failed(), run({ status: 'stopped', stopReason: 'unknown_tool' }),
    run({ status: 'stopped', stopReason: 'insufficient_evidence' })])('stops polling at terminal $status/$stopReason', async terminal => {
    vi.mocked(api.loadCoach).mockResolvedValue(terminal);
    await mount(); start(); await flush(); await tick(); await tick(5000);
    expect(api.loadCoach).toHaveBeenCalledTimes(1);
    const announcement = panel().getByRole(terminal.status === 'completed' ? 'status' : 'alert');
    expect(announcement).not.toHaveTextContent('u toku');
    expect(announcement).toHaveTextContent(terminal.status === 'completed' ? 'Coaching je završen.'
      : terminal.stopReason === 'insufficient_evidence' ? 'Nema dovoljno dokaza'
        : terminal.status === 'failed' ? 'Coaching nije uspeo.' : 'Coaching je zaustavljen.');
  });
  it('does not poll a terminal POST response', async () => {
    vi.mocked(api.startCoach).mockResolvedValue(failed());
    await mount(); start(); await flush(); await tick(4000);
    expect(api.loadCoach).not.toHaveBeenCalled();
  });
  it('allows only one GET in flight and unmount aborts/ignores late GET', async () => {
    const pending = deferred<CoachRunView>(); vi.mocked(api.loadCoach).mockReturnValue(pending.promise);
    const view = await mount(); start(); await flush(); await tick(); await tick(4000);
    expect(api.loadCoach).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(api.loadCoach).mock.calls[0]![1];
    view.unmount(); expect(signal?.aborted).toBe(true);
    pending.resolve(completed()); await flush(); await tick(4000);
    expect(api.loadCoach).toHaveBeenCalledTimes(1); expect(document.body).not.toHaveTextContent('Coaching test rezultat.');
  });
  it('ignores late POST after unmount', async () => {
    const pending = deferred<CoachRunView>(); vi.mocked(api.startCoach).mockReturnValue(pending.promise);
    const view = await mount(); start(); view.unmount(); pending.resolve(run()); await flush(); await tick(4000);
    expect(api.loadCoach).not.toHaveBeenCalled();
  });
  it.each(['POST', 'GET'] as const)('new game takes precedence over delayed %s', async source => {
    const pending = deferred<CoachRunView>();
    if (source === 'POST') vi.mocked(api.startCoach).mockReturnValue(pending.promise);
    else vi.mocked(api.loadCoach).mockReturnValue(pending.promise);
    vi.spyOn(api, 'createGame').mockResolvedValue({ ...base, gameId: '00000000-0000-4000-8000-000000000099' });
    await mount(); start(); await flush(); if (source === 'GET') await tick();
    fireEvent.click(screen.getByRole('button', { name: 'Nova partija' })); await flush();
    pending.resolve(completed()); await flush(); await tick(4000);
    expect(document.body).not.toHaveTextContent('Coaching test rezultat.');
    expect(panel().getByRole('button', { name: 'Pokreni coaching' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Call 5' })).toBeEnabled();
  });
  it('manual retry starts new runId and polls only that run', async () => {
    const next = run({ runId: '00000000-0000-4000-8000-000000000023' });
    vi.mocked(api.startCoach).mockResolvedValueOnce(failed()).mockResolvedValueOnce(next);
    await mount(); start(); await flush(); await tick(3000);
    expect(api.startCoach).toHaveBeenCalledTimes(1);
    fireEvent.click(panel().getByRole('button', { name: 'Pokušaj coaching ponovo' })); await flush(); await tick();
    expect(api.startCoach).toHaveBeenCalledTimes(2);
    expect(api.loadCoach).toHaveBeenCalledWith(next.runId, expect.any(AbortSignal));
  });
  it('ignores old runId and foreign/reversed snapshots without overwriting current run', async () => {
    vi.mocked(api.loadCoach).mockResolvedValueOnce(run({ runId: '00000000-0000-4000-8000-000000000099' }))
      .mockResolvedValueOnce(run({ expectedVersion: game.version + 1 }))
      .mockResolvedValueOnce(run({ stepCount: 1, providerAttemptCount: 1 }))
      .mockResolvedValueOnce(run()).mockResolvedValueOnce(completed());
    await mount(); start(); await flush(); await tick(); await tick(); await tick(); await tick();
    expect(panel().getByRole('status')).toHaveTextContent('u toku');
    await tick(); expect(screen.getByText('Coaching test rezultat.')).toBeVisible();
    await tick(3000); expect(api.loadCoach).toHaveBeenCalledTimes(5);
  });
  it.each(['POST', 'GET'] as const)('safe failure for %s exception stops polling and never leaks details', async source => {
    vi.mocked(source === 'POST' ? api.startCoach : api.loadCoach).mockRejectedValue(new Error('PRIVATE_PROVIDER stack trace'));
    await mount(); start(); await flush(); await tick(); await tick(3000);
    expect(panel().getByRole('alert')).toHaveTextContent('nije uspeo');
    expect(document.body).not.toHaveTextContent('PRIVATE_PROVIDER');
    expect(api.startCoach).toHaveBeenCalledTimes(1);
    expect(api.loadCoach).toHaveBeenCalledTimes(source === 'POST' ? 0 : 1);
  });
  it('does not accept a different goal from start response', async () => {
    vi.mocked(api.startCoach).mockResolvedValue(run({ goal: { focus: 'showdown' } }));
    await mount(); start(); await flush(); await tick(3000);
    expect(panel().getByRole('alert')).toHaveTextContent('nije uspeo');
    expect(api.loadCoach).not.toHaveBeenCalled();
  });
  it('keeps Week04 analysis polling and retry independent during coaching', async () => {
    const interactionId = '00000000-0000-4000-8000-000000000024';
    const generating = { ...game, ai: { ...game.ai,
      active: { interactionId, purpose: 'analysis' as const, status: 'waiting' as const, attemptCount: 1, model: 'fake' },
      analysis: { status: 'generating' as const, interactionId, result: null } } };
    const terminal = { ...game, ai: { ...game.ai, analysis: { status: 'failed' as const, interactionId, result: null } } };
    vi.spyOn(api, 'requestAnalysis').mockResolvedValue(generating);
    vi.mocked(api.loadGame).mockResolvedValueOnce(game).mockResolvedValue(terminal);
    await mount(); start(); await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Zatraži analizu' })); await flush();
    await tick(750);
    expect(api.loadGame).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert', { name: '' })).toHaveTextContent('Analiza nije uspela');
    expect(panel().getByRole('status')).toHaveTextContent('u toku');
    fireEvent.click(screen.getByRole('button', { name: 'Pokušaj ponovo' })); await flush();
    expect(api.requestAnalysis).toHaveBeenCalledTimes(2);
    expect(api.startCoach).toHaveBeenCalledTimes(1);
  });
  it('rejects same runId on terminal retry', async () => {
    vi.mocked(api.startCoach).mockResolvedValueOnce(failed()).mockResolvedValueOnce(run());
    await mount(); start(); await flush();
    fireEvent.click(panel().getByRole('button', { name: 'Pokušaj coaching ponovo' })); await flush();
    expect(panel().getByRole('alert')).toHaveTextContent('nije uspeo');
    expect(api.loadCoach).not.toHaveBeenCalled();
  });
});
