import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameViewSchema } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';
import { ActionPanel } from '../../frontend/src/components/ActionPanel';
import { App } from '../../frontend/src/App';
import * as api from '../../frontend/src/api';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ActionPanel', () => {
  it('prikazuje samo kontrole koje backend označi kao legalne', () => {
    const game = GameViewSchema.parse(publicView());
    render(<ActionPanel game={game} pending={false} onAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Fold' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Call 5' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All-in' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ukupno u ovoj rundi')).not.toBeInTheDocument();
  });

  it('razlikuje amountTo od doplate i blokira sve akcije dok zahtev traje', () => {
    const base = GameViewSchema.parse(publicView());
    const game = GameViewSchema.parse({ ...base,
      legalActions: [{ type: 'raise', minAmountTo: 20, maxAmountTo: 100 }] });
    const onAction = vi.fn();
    const { rerender } = render(<ActionPanel game={game} pending={false} onAction={onAction} />);

    const amount = screen.getByLabelText('Ukupno u ovoj rundi');
    expect(amount).toHaveAttribute('min', '20');
    expect(amount).toHaveAttribute('max', '100');
    expect(screen.getByText('Doplata sa stacka: 15')).toBeVisible();
    fireEvent.change(amount, { target: { value: '40' } });
    expect(screen.getByText('Doplata sa stacka: 35')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Raise to 40' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'raise', amountTo: 40 });

    rerender(<ActionPanel game={game} pending onAction={onAction} />);
    expect(screen.getByLabelText('Ukupno u ovoj rundi')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Raise to 40' })).toBeDisabled();
  });
});

describe('App', () => {
  it('pokreće lokalnu partiju i traži potvrdu pre zamene aktivne', async () => {
    vi.spyOn(api, 'loadGame').mockResolvedValue(null);
    const create = vi.spyOn(api, 'createGame').mockResolvedValue(GameViewSchema.parse(publicView()));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nova partija' }));
    expect(await screen.findByText('Tvoje karte')).toBeVisible();
    expect(create).toHaveBeenCalledWith(5, null);

    fireEvent.click(screen.getByRole('button', { name: 'Nova partija' }));
    expect(confirm).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('prikazuje serverom potvrden AI potez kao uspeh', async () => {
    const source = publicView();
    const game = GameViewSchema.parse({ ...source, ai: {
      mode: 'on', availability: 'configured', active: null,
      lastBotOutcome: { handId: source.handId, actorId: 'p1', decisionOrdinal: 1,
        outcome: 'model', attemptCount: 1, finalModel: 'gemini-3.8-flash' },
      analysis: { status: 'idle', interactionId: null, result: null },
    } });
    vi.spyOn(api, 'loadGame').mockResolvedValue(game);
    render(<App />);

    expect(await screen.findByText(/AI potez je prihvaćen/i)).toBeVisible();
  });

  it('does not send duplicate actions before React disables the controls', async () => {
    const game = GameViewSchema.parse(publicView());
    vi.spyOn(api, 'loadGame').mockResolvedValue(game);
    const send = vi.spyOn(api, 'sendAction').mockImplementation(() => new Promise(() => undefined));
    render(<App />);
    const call = await screen.findByRole('button', { name: 'Call 5' });

    fireEvent.click(call);
    fireEvent.click(call);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });
});
