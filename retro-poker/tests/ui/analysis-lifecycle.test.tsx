import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acceptsAiSnapshot, App } from '../../frontend/src/App';
import * as api from '../../frontend/src/api';
import { GameViewSchema, type GameView } from '../../shared/contracts';
import { handResult, publicView } from '../helpers/public-fixtures';

function snapshot(status: 'completed' | 'failed' | 'generating', id: string, summary = 'Prvi pregled.'): GameView {
  const base = GameViewSchema.parse(publicView());
  return GameViewSchema.parse({ ...base, status: 'lost', phase: 'complete', actorId: null,
    players: base.players.map(player => ({ ...player, stack: 1000, streetContribution: 0, handContribution: 0 })),
    legalActions: [], totalPot: 0, pots: [], result: { ...handResult(), gameStatus: 'lost' },
    ai: { ...base.ai, availability: 'configured',
      lastBotOutcome: { handId: base.handId, actorId: 'p1', decisionOrdinal: 1,
        outcome: 'model', attemptCount: 1, finalModel: 'model-a' },
      active: status === 'generating' ? { interactionId: id, purpose: 'analysis', status: 'waiting', attemptCount: 0, model: 'model-a' } : null,
      analysis: { status, interactionId: id, result: status === 'completed'
        ? { summary, goodDecisions: [], possibleMistakes: [], nextSteps: ['Vežbaj.'] } : null } } });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const firstId = '33333333-3333-4333-8333-333333333333';
const secondId = '44444444-4444-4444-8444-444444444444';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('SR1 analysis lifecycle', () => {
  it.each(['generating', 'completed'] as const)('rejects previous results while the latest is %s, even with same-hand bot outcome', status => {
    const latest = snapshot(status, secondId, 'Novi pregled.');
    for (const oldStatus of ['generating', 'completed', 'failed'] as const) {
      expect(acceptsAiSnapshot(latest, snapshot(oldStatus, firstId))).toBe(false);
    }
    expect(acceptsAiSnapshot(latest, snapshot('completed', secondId, 'Novi pregled.'))).toBe(true);
    expect(acceptsAiSnapshot(latest, { ...latest, gameId: crypto.randomUUID() })).toBe(false);
  });

  it.each(['completed', 'failed'] as const)('starts once after %s and follows only the new result without reload', async status => {
    vi.useFakeTimers();
    const before = snapshot(status, firstId);
    const generating = snapshot('generating', secondId);
    const completed = snapshot('completed', secondId, 'Drugi pregled.');
    const post = deferred<GameView>();
    const load = vi.spyOn(api, 'loadGame').mockResolvedValueOnce(before)
      .mockResolvedValueOnce(snapshot('completed', firstId)).mockResolvedValue(completed);
    const request = vi.spyOn(api, 'requestAnalysis').mockReturnValue(post.promise);
    render(<App />);
    await act(async () => {});
    expect(request).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: status === 'completed' ? 'Generiši analizu ponovo' : 'Pokušaj ponovo' });
    fireEvent.click(button); fireEvent.click(button);
    expect(request).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => { post.resolve(generating); });
    expect(screen.getByLabelText('AI priprema analizu partije')).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    expect(screen.queryByText('Prvi pregled.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('AI priprema analizu partije')).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    expect(screen.getByText('Drugi pregled.')).toBeVisible();
    expect(screen.getByText('Poraz u partiji')).toBeVisible();
    const reads = load.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(load).toHaveBeenCalledTimes(reads);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(before);
  });

  it('new game intent discards a pending analysis poll before replacement completes', async () => {
    vi.useFakeTimers();
    const late = deferred<GameView | null>();
    const replacement = deferred<GameView>();
    vi.spyOn(api, 'loadGame').mockResolvedValueOnce(snapshot('generating', firstId)).mockReturnValue(late.promise);
    vi.spyOn(api, 'createGame').mockReturnValue(replacement.promise);
    render(<App />); await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    fireEvent.click(screen.getByRole('button', { name: 'Nova partija' }));
    await act(async () => { late.resolve(snapshot('completed', firstId, 'Stari pregled.')); });
    expect(screen.queryByText('Stari pregled.')).not.toBeInTheDocument();
    await act(async () => { replacement.resolve({ ...GameViewSchema.parse(publicView()), gameId: crypto.randomUUID() }); });
    expect(screen.queryByRole('region', { name: 'AI analiza partije' })).not.toBeInTheDocument();
  });
  it('does not recover a late rejected POST after unmount', async () => {
    const load = vi.spyOn(api, 'loadGame').mockResolvedValue(snapshot('failed', firstId));
    let reject!: (reason: Error) => void;
    vi.spyOn(api, 'requestAnalysis').mockReturnValue(new Promise<GameView>((_resolve, fail) => { reject = fail; }));
    const app = render(<App />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Pokušaj ponovo' }));
    app.unmount();
    await act(async () => { reject(new Error('Offline POST failure')); });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
