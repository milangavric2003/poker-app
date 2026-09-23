import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../frontend/src/App';
import { HandResult } from '../../frontend/src/components/HandResult';
import { GameViewSchema, type GameView } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';
import * as api from '../../frontend/src/api';

const base = GameViewSchema.parse(publicView());
const result: GameView = { ...base, phase: 'complete', actorId: null,
  legalActions: [], totalPot: 0, pots: [], status: 'playing',
  result: { handId: publicView().handId, reason: 'showdown', gameStatus: 'playing',
    pots: [], refunds: [], revealedCards: [],
    netChanges: [{ playerId: 'player-0', amount: 10 }, { playerId: 'player-1', amount: -10 }] } };

describe('T029/T030 rezultat i nastavak', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(cleanup);
  it('rezultat ostaje vidljiv i prikazuje neto promene', () => {
    render(<HandResult result={result.result!} />);
    expect(screen.getByRole('region', { name: 'Rezultat ruke' })).toHaveTextContent('player-0: +10');
  });
  it('nudi sledeću ruku samo za neterminalnu partiju', async () => {
    vi.spyOn(api, 'loadGame').mockResolvedValue(result);
    const nextState: GameView = { ...GameViewSchema.parse(publicView()), handNumber: 2,
      previousResult: result.result };
    const next = vi.spyOn(api, 'nextHand').mockResolvedValue(nextState);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sledeća ruka' }));
    expect(next).toHaveBeenCalledWith(result);
    expect(await screen.findByRole('region', { name: 'Rezultat ruke' })).toBeVisible();
  });
  it.each(['won', 'lost'] as const)('status %s nema next-hand akciju', async status => {
    vi.spyOn(api, 'loadGame').mockResolvedValue({ ...result, status,
      result: { ...result.result!, gameStatus: status } });
    render(<App />);
    expect(await screen.findByRole('region', { name: 'Rezultat ruke' }))
      .toHaveTextContent(status === 'won' ? 'Pobeda' : 'Poraz');
    expect(screen.queryByRole('button', { name: 'Sledeća ruka' })).not.toBeInTheDocument();
  });
  it('reset aktivne partije podržava cancel i confirm', async () => {
    vi.spyOn(api, 'loadGame').mockResolvedValue(GameViewSchema.parse(publicView()));
    const create = vi.spyOn(api, 'createGame').mockResolvedValue(GameViewSchema.parse(publicView()));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<App />);
    const button = await screen.findByRole('button', { name: 'Nova partija' });
    fireEvent.click(button); expect(create).not.toHaveBeenCalled();
    fireEvent.click(button); expect(confirm).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalled();
  });
});
