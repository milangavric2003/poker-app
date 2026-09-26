import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../frontend/src/App';
import { GameViewSchema, type GameView } from '../../shared/contracts';
import { handResult, publicView } from '../helpers/public-fixtures';
import * as api from '../../frontend/src/api';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function terminalGame(analysis: object): GameView {
  const base = GameViewSchema.parse(publicView());
  return { ...base, phase: 'complete', actorId: null, legalActions: [], totalPot: 0, pots: [],
    players: base.players.map((player, index) => ({ ...player, stack: index === 0 ? 1010 : 990,
      handContribution: 0, streetContribution: 0,
      cards: index === 0 ? ['As', 'Ah'] : ['Kc', 'Kd'] })),
    result: handResult(), ai: { mode: 'off', availability: 'configured', active: null,
      lastBotOutcome: null, analysis },
  } as unknown as GameView;
}

describe('match analysis UI contract (FR-016–FR-018, AIAC10–AIAC11)', () => {
  it('keeps HandResult visible and offers explicit analysis only for a terminal game', async () => {
    vi.spyOn(api, 'loadGame').mockResolvedValue(terminalGame({
      status: 'idle', interactionId: null, result: null,
    }));
    render(<App />);
    expect(await screen.findByRole('region', { name: 'Rezultat ruke' })).toBeVisible();
    expect(screen.getByRole('button', { name: /zatraži analizu/i })).toBeVisible();
  });

  it('renders four validated sections and a local disclaimer without hiding HandResult', async () => {
    vi.spyOn(api, 'loadGame').mockResolvedValue(terminalGame({
      status: 'completed', interactionId: '33333333-3333-4333-8333-333333333333',
      result: { summary: 'Sažetak.', goodDecisions: [{ decisionRef: 'd1', explanation: 'Dobra odluka.' }],
        possibleMistakes: [{ decisionRef: 'd2', explanation: 'Moguća greška.' }], nextSteps: ['Vežbaj raspone.'] },
    }));
    render(<App />);
    expect(await screen.findByRole('region', { name: 'Rezultat ruke' })).toBeVisible();
    for (const heading of ['Sažetak', 'Dobre odluke', 'Moguće greške', 'Sledeći koraci']) {
      expect(screen.getByRole('heading', { name: heading })).toBeVisible();
    }
    expect(screen.getByText(/AI analiza može pogrešiti/i)).toBeVisible();
  });
});
