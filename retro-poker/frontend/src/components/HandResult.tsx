import type { HandResult as Result } from '../../../shared/contracts';

export function HandResult({ result }: { result: Result }) {
  return <section className="result" aria-label="Rezultat ruke">
    <h2>Rezultat ruke</h2><p>{result.reason === 'showdown' ? 'Showdown' : 'Svi protivnici su odustali'}</p>
    {result.pots.map(pot => <p key={pot.id}>Pot {pot.amount}: {pot.payouts.map(p => `${p.playerId} +${p.amount}`).join(', ')}</p>)}
    {result.refunds.map(refund => <p key={refund.playerId}>Povraćaj: {refund.playerId} +{refund.amount}</p>)}
    <ul>{result.netChanges.map(change => <li key={change.playerId}>{change.playerId}: {change.amount >= 0 ? '+' : ''}{change.amount}</li>)}</ul>
  </section>;
}
