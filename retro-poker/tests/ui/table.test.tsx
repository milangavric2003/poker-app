import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameViewSchema } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';
import { Table } from '../../frontend/src/components/Table';

describe('Table', () => {
  it('prikazuje javni snapshot i događaje po redosledu koji je poslao backend', () => {
    const base = GameViewSchema.parse(publicView());
    const game = GameViewSchema.parse({ ...base, board: ['2c', '3d', '4h'], phase: 'flop', events: [
      base.events[0]!,
      { seq: 2, handId: base.handId, street: 'preflop', type: 'blind_posted', playerId: 'p0', blind: 'small', amount: 5 },
      { seq: 3, handId: base.handId, street: 'preflop', type: 'action', playerId: 'p1', actionType: 'check', payAmount: 0, amountTo: 10 },
      { seq: 4, handId: base.handId, street: 'flop', type: 'board_dealt', cards: ['2c', '3d', '4h'] },
    ] });

    render(<Table game={game} />);

    expect(screen.getByText('As')).toBeVisible();
    expect(screen.getByText('Ah')).toBeVisible();
    expect(screen.getByText('2c')).toBeVisible();
    expect(screen.getByText('3d')).toBeVisible();
    expect(screen.getByText('4h')).toBeVisible();
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
});
