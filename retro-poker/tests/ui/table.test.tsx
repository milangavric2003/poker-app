import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GameViewSchema } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';
import { Table } from '../../frontend/src/components/Table';

afterEach(cleanup);

describe('Table', () => {
  it('imenuje glavni pot i nepotvrđen ulog uz nepromenjene javne iznose', () => {
    render(<Table game={GameViewSchema.parse(publicView())} />);
    const pots = within(screen.getByLabelText('Potovi'));
    expect(pots.getByText(/Glavni pot.*main: 10/)).toBeVisible();
    expect(pots.getByText(/Nepotvrđen ulog.*uncalled: 5/)).toBeVisible();
  });
  it('prikazuje samo neutralne poleđine kada javne protivničke karte nisu dostupne', () => {
    render(<Table game={GameViewSchema.parse(publicView())} />);
    const bot = screen.getByRole('article', { name: /Bot 1.*mesto 2/i });
    const backs = within(bot).getAllByLabelText('Skrivena karta');
    expect(backs).toHaveLength(2);
    for (const back of backs) {
      expect(back.outerHTML).not.toMatch(/data-card|title=|[2-9TJQKA][cdhs]|♠|♥|♦|♣/);
      expect(back).toHaveAccessibleName('Skrivena karta');
    }
  });

  it('označava javni red poteza, blindove, fold, all-in i eliminaciju tekstom', () => {
    const base = publicView();
    const game = GameViewSchema.parse({ ...base, botCount: 3, totalPot: 1025,
      pots: [{ ...base.pots[0], amount: 1025, contributorIds: ['p0', 'p1', 'p2'], eligibleIds: ['p0', 'p2'] }], players: [
      ...base.players.map(p => p.kind === 'bot' ? { ...p, status: 'folded' } : { ...p, stack: 1985 }),
      { ...base.players[1], id: 'p2', seat: 2, stack: 0, handContribution: 1010, status: 'all_in' },
      { ...base.players[1], id: 'p3', seat: 3, stack: 0, status: 'eliminated', streetContribution: 0, handContribution: 0 },
    ] });
    render(<Table game={game} />);
    expect(within(screen.getByRole('article', { name: /Ti.*mesto 1/i })).getByText('Na potezu')).toBeVisible();
    expect(screen.getByText('SB · Mali blind')).toBeVisible();
    expect(screen.getByText('BB · Veliki blind')).toBeVisible();
    expect(screen.getByText('Fold')).toBeVisible();
    expect(screen.getByText('All-in')).toBeVisible();
    expect(screen.getByText('Eliminisan')).toBeVisible();
  });

  it('čuva tačne iznose i ograničava dekoraciju; nula nema lažne čipove', () => {
    const base = publicView();
    const players = Array.from({ length: 6 }, (_, seat) => ({ ...base.players[seat === 0 ? 0 : 1],
      id: `p${seat}`, seat, stack: seat === 0 ? 1 : 0, streetContribution: 0,
      handContribution: seat === 0 ? 999 : 1000, status: seat === 0 ? 'active' : 'all_in' }));
    render(<Table game={GameViewSchema.parse({ ...base, botCount: 5, totalPot: 5999,
      pots: [{ ...base.pots[0], amount: 5999, contributorIds: players.map(p => p.id), eligibleIds: players.map(p => p.id) }], players })} />);
    const pot = screen.getByLabelText('Ukupni pot');
    expect(pot).toHaveTextContent('Pot: 5999');
    expect(pot.querySelectorAll('[data-denomination]').length).toBeGreaterThan(0);
    expect(pot.querySelectorAll('[data-denomination]').length).toBeLessThanOrEqual(5);
    expect(pot.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    const bot = screen.getByRole('article', { name: /Bot 1.*mesto 2/i });
    expect(bot).toHaveTextContent('Stack: 0');
    expect(bot).toHaveTextContent('Ulog: 0');
    expect(bot.querySelectorAll('[data-denomination]')).toHaveLength(0);
  });

  it('prikazuje javni snapshot i događaje po redosledu koji je poslao backend', () => {
    const base = GameViewSchema.parse(publicView());
    const game = GameViewSchema.parse({ ...base, board: ['2c', '3d', '4h'], phase: 'flop', events: [
      base.events[0]!,
      { seq: 2, handId: base.handId, street: 'preflop', type: 'blind_posted', playerId: 'p0', blind: 'small', amount: 5 },
      { seq: 3, handId: base.handId, street: 'preflop', type: 'action', playerId: 'p1', actionType: 'check', payAmount: 0, amountTo: 10 },
      { seq: 4, handId: base.handId, street: 'flop', type: 'board_dealt', cards: ['2c', '3d', '4h'] },
    ] });

    render(<Table game={game} />);

    expect(screen.getByLabelText('As pik')).toBeVisible();
    expect(screen.getByLabelText('As herc')).toBeVisible();
    expect(screen.getByLabelText('2 tref')).toBeVisible();
    expect(screen.getByLabelText('3 karo')).toBeVisible();
    expect(screen.getByLabelText('4 herc')).toBeVisible();
    expect(screen.getByText(/Pot: 15/)).toBeVisible();
    expect(screen.getByText(/Button/)).toBeVisible();
    expect(screen.getByText(/Stack: 995/)).toBeVisible();
    const history = screen.getByRole('list', { name: 'Istorija ruke' });
    expect(within(history).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      expect.stringContaining('Početak ruke'),
      expect.stringContaining('mali blind 5'),
      expect.stringContaining('check'),
      expect.stringContaining('Flop: 2c 3d 4h'),
    ]);
  });

  it('daje kartama i mestima razumljiva imena koja ne zavise samo od boje', () => {
    const game = GameViewSchema.parse(publicView());

    const view = render(<Table game={game} />);
    const table = within(view.container);

    expect(table.getByRole('article', { name: /Ti.*mesto 1/i })).toBeVisible();
    expect(table.getByRole('article', { name: /Bot 1.*mesto 2/i })).toBeVisible();
    expect(table.getByLabelText('As pik')).toHaveTextContent('A♠');
    expect(table.getByLabelText('As herc')).toHaveTextContent('A♥');
    expect(table.getByText(/Mali blind: Ti, 5/)).toBeVisible();
    expect(table.getByText(/Veliki blind: Bot 1, 10/)).toBeVisible();
  });

  it('prikazuje desetku kao 10 i ne ispisuje kod karte pri dnu', () => {
    const base = GameViewSchema.parse(publicView());
    const game = { ...base, board: ['Ts', '6s', '5h'] } as typeof base;

    const view = render(<Table game={game} />);
    const board = within(view.container.querySelector('.board') as HTMLElement);

    expect(board.getByLabelText('10 pik')).toHaveTextContent('10♠');
    expect(board.getByLabelText('6 pik')).toHaveTextContent('6♠');
    expect(board.getByLabelText('5 herc')).toHaveTextContent('5♥');
    expect(board.getByLabelText('10 pik')).not.toHaveTextContent('Ts');
    expect(board.getByLabelText('6 pik')).not.toHaveTextContent('6s');
    expect(board.getByLabelText('5 herc')).not.toHaveTextContent('5h');
  });
});
