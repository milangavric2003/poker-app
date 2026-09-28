import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../frontend/src/App';
import { AnalysisPanel } from '../../frontend/src/components/AnalysisPanel';
import * as api from '../../frontend/src/api';
import { GameViewSchema, HandResultSchema, type GameView } from '../../shared/contracts';
import { handResult, publicView } from '../helpers/public-fixtures';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function game(status: GameView['status'], analysis: GameView['ai']['analysis']): GameView {
  const base = GameViewSchema.parse(publicView());
  if (status === 'playing') return { ...base, ai: { ...base.ai, analysis } };
  return { ...base, status, phase: 'complete', actorId: null, legalActions: [], totalPot: 0, pots: [],
    result: HandResultSchema.parse({ ...handResult(), gameStatus: status }),
    ai: { ...base.ai, availability: 'configured', analysis } };
}
describe('finished-game analysis', () => {
  it('is absent until match completion', () => {
    render(<AnalysisPanel game={game('playing', { status: 'idle', interactionId: null, result: null })} pending={false} onRequest={vi.fn()} />);
    expect(screen.queryByRole('region', { name: /analiza partije/i })).not.toBeInTheDocument();
  });
  it('labels loading and prevents duplicate requests', () => {
    render(<AnalysisPanel game={game('won', { status: 'generating', interactionId: crypto.randomUUID(), result: null })} pending={false} onRequest={vi.fn()} />);
    expect(screen.getByLabelText('AI priprema analizu partije')).toBeVisible();
    expect(screen.queryByRole('button', { name: /analiz/i })).not.toBeInTheDocument();
  });
  it('renders validated sections without mutating result', () => {
    const current = game('won', { status: 'completed', interactionId: crypto.randomUUID(), result: {
      summary: 'Sažetak.', goodDecisions: [{ decisionRef: 'd1', explanation: 'Dobra odluka.' }],
      possibleMistakes: [{ decisionRef: 'd2', explanation: 'Moguća greška.' }], nextSteps: ['Vežbaj raspone.'],
    } });
    const snapshot = structuredClone(current.result);
    render(<AnalysisPanel game={current} pending={false} onRequest={vi.fn()} />);
    for (const name of ['Sažetak', 'Dobre odluke', 'Moguće greške', 'Sledeći koraci']) expect(screen.getByRole('heading', { name })).toBeVisible();
    expect(screen.getByText(/može pogrešiti/i)).toBeVisible();
    expect(current.result).toEqual(snapshot);
    expect(document.body).not.toHaveTextContent(/raw provider response/i);
  });
  it.each(['failed', 'unavailable'] as const)('shows %s and retry', state => {
    const retry = vi.fn();
    render(<AnalysisPanel game={game('lost', { status: state, interactionId: null, result: null })} pending={false} onRequest={retry} />);
    expect(screen.getByText(/nije dostupna|nije uspela/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /pokušaj ponovo/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps HandResult visible and sends a retry POST only after the user clicks', async () => {
    const failed = game('lost', { status: 'failed', interactionId: crypto.randomUUID(), result: null });
    const generating = { ...failed, ai: { ...failed.ai, active: {
      interactionId: crypto.randomUUID(), purpose: 'analysis' as const, status: 'waiting' as const,
      attemptCount: 0, model: 'model-a',
    }, analysis: { status: 'generating' as const, interactionId: crypto.randomUUID(), result: null } } };
    vi.spyOn(api, 'loadGame').mockResolvedValue(failed);
    const request = vi.spyOn(api, 'requestAnalysis').mockResolvedValue(generating);
    render(<App />);

    expect(await screen.findByText('Poraz u partiji')).toBeVisible();
    expect(request).not.toHaveBeenCalled();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /ponovo/i }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Poraz u partiji')).toBeVisible();
    expect(request).toHaveBeenCalledWith(failed);
  });
});
