import { useEffect, useMemo, useState } from 'react';
import type { GameView, LegalAction } from '../../../shared/contracts';
import type { ActionDraft } from '../api';

type Props = { game: GameView; pending: boolean; onAction: (action: ActionDraft) => void };
const labels = { fold: 'Fold', check: 'Check' } as const;

export function ActionPanel({ game, pending, onAction }: Props) {
  const ranged = game.legalActions.find((action): action is Extract<LegalAction, { type: 'bet' | 'raise' }> => action.type === 'bet' || action.type === 'raise');
  const [amountTo, setAmountTo] = useState(ranged?.minAmountTo ?? 0);
  useEffect(() => setAmountTo(ranged?.minAmountTo ?? 0), [ranged?.minAmountTo, ranged?.type]);
  const contribution = useMemo(() => game.players.find(player => player.kind === 'human')?.streetContribution ?? 0, [game.players]);
  return <section className="actions" aria-label="Akcije">
    <h2>Tvoj potez</h2>
    <div className="action-row">{game.legalActions.map(action => {
      if (action.type === 'fold' || action.type === 'check') return <button key={action.type} disabled={pending} onClick={() => onAction({ type: action.type })}>{labels[action.type]}</button>;
      if (action.type === 'call') return <button key="call" disabled={pending} onClick={() => onAction({ type: 'call' })}>Call {action.payAmount}</button>;
      if (action.type === 'all_in') return <button key="all_in" disabled={pending} onClick={() => onAction({ type: 'all_in' })}>All-in {action.payAmount}</button>;
      return null;
    })}</div>
    {ranged && <div className="raise-control">
      <label htmlFor="amount-to">Ukupno u ovoj rundi</label>
      <input id="amount-to" type="number" min={ranged.minAmountTo} max={ranged.maxAmountTo} value={amountTo} disabled={pending} onChange={event => setAmountTo(Number(event.target.value))} />
      <span>Doplata sa stacka: {Math.max(0, amountTo - contribution)}</span>
      <button disabled={pending || amountTo < ranged.minAmountTo || amountTo > ranged.maxAmountTo} onClick={() => onAction({ type: ranged.type, amountTo })}>{ranged.type === 'bet' ? 'Bet' : 'Raise'} to {amountTo}</button>
    </div>}
    {pending && <p role="status">Obrada poteza…</p>}
  </section>;
}
