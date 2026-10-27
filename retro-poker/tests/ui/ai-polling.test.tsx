import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../frontend/src/App';
import * as api from '../../frontend/src/api';
import { GameViewSchema, type GameView } from '../../shared/contracts';
import { handResult, publicView } from '../helpers/public-fixtures';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

function snapshots(purpose: 'bot' | 'analysis'): { active: GameView; completed: GameView } {
  const base = GameViewSchema.parse(publicView());
  const interactionId = crypto.randomUUID();
  const completed = GameViewSchema.parse(purpose === 'bot' ? {
    ...base, version: base.version + 1, ai: { ...base.ai, mode: 'on', availability: 'configured',
      lastBotOutcome: { handId: base.handId, actorId: 'p1', decisionOrdinal: 1,
        outcome: 'model', attemptCount: 1, finalModel: 'model-a' } },
  } : {
    ...base, status: 'won', phase: 'complete', actorId: null,
    players: base.players.map(player => ({ ...player, stack: 1000, streetContribution: 0, handContribution: 0 })),
    legalActions: [], totalPot: 0, pots: [], result: { ...handResult(), gameStatus: 'won' },
    ai: { ...base.ai, mode: 'on', availability: 'configured', analysis: {
      status: 'completed', interactionId, result: {
        summary: 'Potvrđena završena analiza.', goodDecisions: [], possibleMistakes: [], nextSteps: ['Vežbaj.'],
      } } },
  });
  const active = GameViewSchema.parse({ ...completed, version: base.version,
    ai: { ...completed.ai, lastBotOutcome: null,
      active: { interactionId, purpose, status: 'waiting', attemptCount: 0, model: 'model-a' },
      ...(purpose === 'analysis' ? { analysis: { status: 'generating', interactionId, result: null } } : {}) },
  });
  return { active, completed };
}

describe('slow game polling preserves normal AI progress (W08 I8)', () => {
  it.each(['bot', 'analysis'] as const)('shows a completed %s despite GET latency above 750 ms', async purpose => {
    vi.useFakeTimers();
    const { active, completed } = snapshots(purpose);
    let activeReads = 0; let maximumReads = 0;
    const load = vi.spyOn(api, 'loadGame').mockResolvedValueOnce(active).mockImplementation(async () => {
      activeReads++; maximumReads = Math.max(maximumReads, activeReads);
      try { await new Promise(resolve => setTimeout(resolve, 1200)); return completed; }
      finally { activeReads--; }
    });
    const mutations = [vi.spyOn(api, 'createGame'), vi.spyOn(api, 'sendAction'),
      vi.spyOn(api, 'nextHand'), vi.spyOn(api, 'requestAnalysis'), vi.spyOn(api, 'startCoach')];
    render(<App />); await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(1950); });
    if (purpose === 'bot') expect(screen.getByText('AI potez je prihvaćen.')).toBeVisible();
    else expect(screen.getByText('Potvrđena završena analiza.')).toBeVisible();
    expect(maximumReads).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(load).toHaveBeenCalledTimes(2);
    for (const mutation of mutations) expect(mutation).not.toHaveBeenCalled();
  });

  it('recovers after a failed GET and accepts the next completed snapshot', async () => {
    vi.useFakeTimers();
    const { active, completed } = snapshots('bot');
    const load = vi.spyOn(api, 'loadGame').mockResolvedValueOnce(active)
      .mockRejectedValueOnce(new Error('Synthetic GET failure')).mockResolvedValue(completed);
    render(<App />); await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByText('AI potez je prihvaćen.')).toBeVisible();
    expect(load).toHaveBeenCalledTimes(3);
  });
});
