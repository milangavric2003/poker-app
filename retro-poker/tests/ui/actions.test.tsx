import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameViewSchema } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';
import { ActionPanel } from '../../frontend/src/components/ActionPanel';
import { App } from '../../frontend/src/App';
import * as api from '../../frontend/src/api';

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
});
