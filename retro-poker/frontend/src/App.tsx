import { useEffect, useRef, useState } from 'react';
import { CoachRunViewSchema, type CoachGoal, type CoachRunView, type GameView } from '../../shared/contracts';
import { createGame, loadCoach, loadGame, nextHand, requestAnalysis, sendAction, startCoach, type ActionDraft } from './api';
import { ActionPanel } from './components/ActionPanel';
import { AiStatus, type AiUiStatus } from './components/AiStatus';
import { AnalysisPanel } from './components/AnalysisPanel';
import { CoachPanel } from './components/CoachPanel';
import { HandResult } from './components/HandResult';
import { Table } from './components/Table';
import { UsageDashboard } from './components/UsageDashboard';

export function acceptsAiSnapshot(current: GameView | null, incoming: GameView | null): boolean {
  if (!current || !incoming) return true;
  if (current.gameId !== incoming.gameId) return false;
  if (incoming.version < current.version) return false;
  const active = current.ai.active?.interactionId;
  if (!active) {
    const terminalAnalysis = current.ai.analysis;
    if (terminalAnalysis.interactionId && terminalAnalysis.status !== 'idle'
      && terminalAnalysis.status !== 'generating'
      && incoming.ai.active?.interactionId === terminalAnalysis.interactionId) return false;
    return true;
  }
  return incoming.ai.active?.interactionId === active
    || incoming.ai.lastBotOutcome?.handId === current.handId || incoming.ai.analysis.interactionId === active;
}

export function App() {
  const [game, setGame] = useState<GameView | null>(null);
  const gameRef = useRef<GameView | null>(null);
  const [botCount, setBotCount] = useState(5);
  const [aiMode, setAiMode] = useState(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollId = useRef(0);
  const snapshotSequence = useRef(0);
  const mutationLock = useRef(false);
  const [coachRun, setCoachRun] = useState<CoachRunView | null>(null);
  const coachRef = useRef<CoachRunView | null>(null);
  const [coachPending, setCoachPending] = useState(false);
  const [coachFailure, setCoachFailure] = useState(false);
  // Same request-token pattern as game snapshots, with a separate read-only lane.
  const coachSequence = useRef(0);
  const coachLock = useRef(false);
  const coachController = useRef<AbortController | null>(null);
  function invalidateCoach() {
    ++coachSequence.current;
    coachController.current?.abort();
    coachController.current = null;
    coachLock.current = false;
    coachRef.current = null;
    setCoachRun(null); setCoachPending(false); setCoachFailure(false);
  }
  function coachMatches(run: CoachRunView, current: GameView | null) {
    return current?.gameId === run.gameId && current.handId === run.handId
      && current.version === run.expectedVersion && current.status !== 'playing';
  }
  function commitCoach(run: CoachRunView) { coachRef.current = run; setCoachRun(run); }
  function commit(next: GameView | null, force = false) {
    snapshotSequence.current++;
    if (force || acceptsAiSnapshot(gameRef.current, next)) {
      const current = gameRef.current;
      if (current?.gameId !== next?.gameId || current?.handId !== next?.handId || current?.version !== next?.version) invalidateCoach();
      gameRef.current = next; setGame(next);
    }
  }
  useEffect(() => () => { ++coachSequence.current; coachController.current?.abort(); }, []);
  useEffect(() => {
    if (!coachRun || (coachRun.status !== 'running' && coachRun.status !== 'created')) return;
    const token = coachSequence.current;
    const runId = coachRun.runId;
    const controller = new AbortController();
    coachController.current = controller;
    let timer: number;
    const current = () => !controller.signal.aborted && token === coachSequence.current
      && coachRef.current?.runId === runId;
    async function poll() {
      try {
        const parsed = CoachRunViewSchema.safeParse(await loadCoach(runId, controller.signal));
        if (!current()) return;
        if (!parsed.success) throw new Error('Invalid coach DTO');
        const next = parsed.data;
        const previous = coachRef.current!;
        if (next.runId === runId && coachMatches(next, gameRef.current)
          && next.factsRevision === previous.factsRevision && next.goal.focus === previous.goal.focus
          && next.stepCount >= previous.stepCount && next.toolCallCount >= previous.toolCallCount
          && next.providerAttemptCount >= previous.providerAttemptCount
          && !(previous.status === 'running' && next.status === 'created')) commitCoach(next);
        if (current() && !coachRef.current?.stopReason) timer = window.setTimeout(() => void poll(), 1000);
      } catch {
        if (current()) { coachRef.current = null; setCoachRun(null); setCoachFailure(true); }
      }
    }
    timer = window.setTimeout(() => void poll(), 1000);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [coachRun?.runId, coachRun?.status]);

  async function coach(goal: CoachGoal) {
    const currentGame = gameRef.current;
    if (!currentGame || pending || mutationLock.current || coachLock.current
      || currentGame.status === 'playing' || currentGame.phase !== 'complete'
      || currentGame.ai.availability !== 'configured' || coachRef.current && !coachRef.current.stopReason) return;
    coachLock.current = true;
    const token = ++coachSequence.current;
    coachController.current?.abort();
    const controller = new AbortController(); coachController.current = controller;
    const previousId = coachRef.current?.runId;
    setCoachPending(true); setCoachFailure(false);
    try {
      const parsed = CoachRunViewSchema.safeParse(await startCoach(currentGame, goal, controller.signal));
      if (token !== coachSequence.current || controller.signal.aborted) return;
      if (!parsed.success || !coachMatches(parsed.data, gameRef.current)
        || parsed.data.goal.focus !== goal.focus || parsed.data.runId === previousId) throw new Error('Invalid coach start');
      commitCoach(parsed.data);
    } catch {
      if (token === coachSequence.current && !controller.signal.aborted) {
        coachRef.current = null; setCoachRun(null); setCoachFailure(true);
      }
    } finally {
      if (token === coachSequence.current) { coachLock.current = false; setCoachPending(false); }
    }
  }
  useEffect(() => {
    let mounted = true;
    const requestId = ++snapshotSequence.current;
    loadGame().then(next => { if (mounted && requestId === snapshotSequence.current) commit(next, true); })
      .catch(caught => { if (mounted && requestId === snapshotSequence.current) setError(caught instanceof Error ? caught.message : 'Greška.'); })
      .finally(() => { if (mounted) setPending(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const awaitingBotReservation = game?.ai.mode === 'on' && game.phase !== 'complete'
      && game.actorId !== null && game.legalActions.length === 0;
    if (!game?.ai.active && !awaitingBotReservation) return;
    const id = ++pollId.current;
    const timer = window.setInterval(() => {
      const requestId = ++snapshotSequence.current;
      void loadGame().then(next => {
        if (id === pollId.current && requestId === snapshotSequence.current) commit(next);
      }).catch(() => undefined);
    }, 750);
    return () => { ++pollId.current; window.clearInterval(timer); };
  }, [game?.gameId, game?.handId, game?.phase, game?.actorId,
    game?.legalActions.length, game?.ai.mode, game?.ai.active?.interactionId]);

  async function synchronize() {
    if (pending || mutationLock.current) return;
    mutationLock.current = true;
    snapshotSequence.current++;
    setPending(true);
    try { commit(await loadGame(), true); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Stanje nije učitano.'); }
    finally { mutationLock.current = false; setPending(false); }
  }
  async function start() {
    if (pending || error || mutationLock.current) return;
    if (game?.status === 'playing' && !window.confirm('Aktivna partija će biti zamenjena. Nastaviti?')) return;
    invalidateCoach();
    mutationLock.current = true;
    snapshotSequence.current++;
    setPending(true); setError(null);
    try { commit(aiMode ? await createGame(botCount, game, true) : await createGame(botCount, game), true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Partija nije pokrenuta.'); }
    finally { mutationLock.current = false; setPending(false); }
  }
  async function act(action: ActionDraft) {
    if (!game || pending || error || mutationLock.current) return;
    mutationLock.current = true;
    snapshotSequence.current++;
    setPending(true); setError(null);
    try { commit(await sendAction(game, action)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Potez nije obrađen.'); }
    finally { mutationLock.current = false; setPending(false); }
  }
  async function advance() {
    if (!game || pending || error || mutationLock.current) return;
    mutationLock.current = true;
    snapshotSequence.current++;
    setPending(true); setError(null);
    try { commit(await nextHand(game)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Sledeća ruka nije pokrenuta.'); }
    finally { mutationLock.current = false; setPending(false); }
  }
  async function analyze() {
    if (!game || pending || mutationLock.current || game.status === 'playing' || game.ai.analysis.status === 'generating') return;
    mutationLock.current = true;
    snapshotSequence.current++;
    setPending(true); setError(null);
    try { commit(await requestAnalysis(game)); }
    catch (caught) {
      try {
        const latest = await loadGame();
        if (latest?.gameId === game.gameId && latest.handId === game.handId
          && latest.ai.analysis.status !== 'idle') commit(latest);
        else setError(caught instanceof Error ? caught.message : 'Analiza nije pokrenuta.');
      } catch { setError('Analiza nije pokrenuta. Ucitaj stanje pre nastavka.'); }
    }
    finally { mutationLock.current = false; setPending(false); }
  }
  const visibleResult = game?.result ?? game?.previousResult;
  const lastBotOutcome = game && game.ai.lastBotOutcome?.handId === game.handId ? game.ai.lastBotOutcome : null;
  const status: AiUiStatus = game?.ai.active
    ? { kind: 'requesting', purpose: game.ai.active.purpose, attemptCount: game.ai.active.attemptCount,
      stage: game.ai.active.status }
    : game?.ai.analysis.status === 'completed' ? { kind: 'completed' }
    : game?.ai.analysis.status === 'unavailable' ? { kind: 'unavailable' }
    : game?.ai.analysis.status === 'failed' ? { kind: 'failed' }
    : lastBotOutcome?.outcome === 'model' ? { kind: 'success' }
    : lastBotOutcome?.outcome === 'local_fallback' ? { kind: 'fallback' }
    : game?.ai.availability === 'unavailable' && game.ai.mode === 'on'
      ? { kind: 'missing_key' } : { kind: 'idle', mode: game?.ai.mode ?? 'off' };
  const busy = pending || !!game?.ai.active;
  return <div className="app-shell">
    <header className="titlebar"><h1>RETRO POKER</h1><span>LOCAL TABLE // NO LIMIT</span></header>
    <section className="new-game" aria-label="Nova partija">
      <label htmlFor="bot-count">Broj botova</label>
      <select id="bot-count" value={botCount} disabled={pending} onChange={event => setBotCount(Number(event.target.value))}>
        {[1, 2, 3, 4, 5].map(count => <option key={count}>{count}</option>)}
      </select>
      <label className="checkbox"><input type="checkbox" checked={aiMode} disabled={pending}
        onChange={event => setAiMode(event.target.checked)} /> AI režim</label>
      <button disabled={pending || !!error} onClick={() => void start()}>Nova partija</button>
    </section>
    {(game?.ai.mode === 'on' || game?.ai.active || game?.ai.lastBotOutcome || game?.ai.analysis.status !== 'idle') &&
      <AiStatus status={status} />}
    <UsageDashboard />
    {error && <><p className="error" role="alert">{error} Učitaj stanje pre nastavka.</p>
      <button disabled={pending} onClick={() => void synchronize()}>Učitaj stanje</button></>}
    {!game && !pending && !error && <p className="empty">Izaberi broj botova i pokreni lokalnu partiju.</p>}
    {game && <><Table game={game} />
      {game.legalActions.length > 0 && <ActionPanel game={game} pending={busy || !!error} onAction={act} />}
      {visibleResult && <HandResult result={visibleResult} />}
      {game.phase === 'complete' && game.status === 'playing' &&
        <button disabled={busy || !!error} onClick={() => void advance()}>Sledeća ruka</button>}
      <AnalysisPanel game={game} pending={busy || !!error} onRequest={() => void analyze()} />
      <CoachPanel key={`${game.gameId}:${game.handId}`} game={game} run={coachRun}
        pending={coachPending || pending || !!error} failure={coachFailure} onRequest={goal => void coach(goal)} />
    </>}
  </div>;
}
