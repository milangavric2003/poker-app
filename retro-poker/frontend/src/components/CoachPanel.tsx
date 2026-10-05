import { useId, useState } from 'react';
import { CoachRunViewSchema, type CoachGoal, type CoachRunView, type GameView } from '../../../shared/contracts';

export interface CoachPanelProps {
  game: GameView;
  run: unknown;
  pending: boolean;
  failure: boolean;
  onRequest: (goal: CoachGoal) => void;
}

const focusLabels = { betting: 'Ulaganje', street: 'Odluke po fazama', showdown: 'Showdown' };
const focusDescriptions: Record<CoachGoal['focus'], string> = {
  betting: 'Pregled odluka sa ulaganjem žetona: bet, raise, call i all-in. Check i fold nisu deo ovog uzorka.',
  street: 'Pregled svih raspoloživih odluka kroz preflop, flop, turn i river, uključujući check i fold.',
  showdown: 'Pregled odluka iz ruku završenih otkrivanjem karata (showdown). Ruke završene fold-om nisu deo ovog uzorka.',
};
const malformedLabels = {
  invalid_structured_response: 'AI odgovor nema očekivanu strukturu ili prelazi dozvoljene granice.',
  evidence_rejected: 'AI odgovor sadrži reference ili činjenice koje se ne poklapaju sa podacima partije.',
};
const stopLabels: Record<NonNullable<CoachRunView['stopReason']>, string> = {
  completed: 'Pregled je završen.',
  insufficient_evidence: 'Nema dovoljno raspoloživih dokaza.',
  invalid_input: 'Početno stanje nije važeće.',
  invalid_model_proposal: 'Predlog nije prošao proveru.',
  unknown_tool: 'Predloženi alat nije dozvoljen.',
  invalid_tool_arguments: 'Zahtev za alat nije prošao proveru.',
  repeated_action: 'Ponavljanje iste radnje je zaustavljeno.',
  tool_call_limit: 'Dostignuto je ograničenje poziva alata.',
  step_limit: 'Dostignuto je ograničenje koraka.',
  call_budget: 'Dostignuto je ograničenje pokušaja.',
  deadline: 'Vreme za coaching je isteklo.',
  cancelled: 'Pregled je otkazan.',
  stale_state: 'Stanje partije se promenilo.',
  provider_failed: 'AI servis nije uspeo da završi zahtev.',
  tool_failed: 'Dokazi nisu mogli da se obrade.',
  malformed_output: 'Odgovor nije prošao validaciju.',
};

export function CoachPanel({ game, run: input, pending, failure, onRequest }: CoachPanelProps) {
  const goalId = useId();
  const goalDescriptionId = `${goalId}-description`;
  const [focus, setFocus] = useState<CoachGoal['focus']>('betting');
  const parsed = input === null ? null : CoachRunViewSchema.safeParse(input);
  const run = parsed?.success && parsed.data.gameId === game.gameId
    && parsed.data.handId === game.handId && parsed.data.expectedVersion === game.version ? parsed.data : null;
  const invalid = input !== null && !run;
  const active = run?.status === 'created' || run?.status === 'running';
  const available = game.status !== 'playing' && game.phase === 'complete'
    && game.ai.availability === 'configured';
  const retry = failure || invalid || run?.status === 'failed' || run?.status === 'stopped';
  const stopLabel = run?.stopReason === 'malformed_output'
    && (run.failureCategory === 'invalid_structured_response' || run.failureCategory === 'evidence_rejected')
    ? malformedLabels[run.failureCategory] : run?.stopReason ? stopLabels[run.stopReason] : null;
  let status = 'Izaberi cilj za pregled završene partije.';
  if (!available) status = game.status === 'playing' ? 'Coaching je dostupan za završenu partiju.' : 'Coaching trenutno nije dostupan.';
  else if (pending) status = 'Coaching se pokreće…';
  else if (invalid) status = 'Coaching odgovor nije validiran.';
  else if (failure || run?.status === 'failed') status = 'Coaching nije uspeo. Rezultat partije nije promenjen.';
  else if (active) status = 'Coaching je u toku…';
  else if (run?.status === 'completed') status = 'Coaching je završen.';
  else if (run?.stopReason === 'insufficient_evidence') status = 'Nema dovoljno dokaza za ovaj cilj.';
  else if (run?.status === 'stopped') status = 'Coaching je zaustavljen. Rezultat partije nije promenjen.';
  return <section className="analysis-panel" aria-label="Coaching partije">
    <h2>Coaching partije</h2>
    <label htmlFor={goalId}>Coaching cilj</label>{' '}
    <select id={goalId} aria-describedby={goalDescriptionId} value={focus} disabled={!available || pending || active}
      onChange={event => setFocus(event.target.value as CoachGoal['focus'])}>
      {Object.entries(focusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <p id={goalDescriptionId}>{focusDescriptions[focus]}</p>
    {run && <p>Izabrani cilj: {focusLabels[run.goal.focus]}</p>}
    <p role={retry ? 'alert' : 'status'} aria-live={retry ? 'assertive' : 'polite'}>{status}</p>
    {run?.stopReason && run.stopReason !== 'completed' && <p>Razlog zaustavljanja: {stopLabel}</p>}
    {run?.status !== 'completed' && <button disabled={!available || pending || active}
      onClick={() => onRequest({ focus })}>{retry ? 'Pokušaj coaching ponovo' : 'Pokreni coaching'}</button>}
    {run?.status === 'completed' && run.result && <div className="analysis-content">
      <h3>Coaching sažetak</h3><p>{run.result.summary}</p>
      <h3>Preporuka</h3><p>{run.result.recommendation}</p>
      <h3>Dokazi</h3><ul>{run.result.evidence.map(item => <li key={`${item.decisionRef}:${item.factCode}`}>
        {item.decisionRef} ({item.factCode}): {item.finding}</li>)}</ul>
      {run.sampleLimited && <p>Prikazan je ograničen uzorak raspoloživih odluka.</p>}
      <p>Coaching je obrazovni savet i može pogrešiti.</p>
    </div>}
  </section>;
}
