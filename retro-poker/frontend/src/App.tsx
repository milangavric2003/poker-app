import { useEffect, useRef, useState } from 'react';
import type { GameView } from '../../shared/contracts';
import { createGame, loadGame, nextHand, requestAnalysis, sendAction, type ActionDraft } from './api';
import { ActionPanel } from './components/ActionPanel';
import { AiStatus, type AiUiStatus } from './components/AiStatus';
import { AnalysisPanel } from './components/AnalysisPanel';
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
  function commit(next: GameView | null, force = false) {
    snapshotSequence.current++;
    if (force || acceptsAiSnapshot(gameRef.current, next)) { gameRef.current = next; setGame(next); }
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
    if (!game?.ai.active) return;
    const id = ++pollId.current;
    const timer = window.setInterval(() => {
      const requestId = ++snapshotSequence.current;
      void loadGame().then(next => {
        if (id === pollId.current && requestId === snapshotSequence.current) commit(next);
      }).catch(() => undefined);
    }, 750);
    return () => { ++pollId.current; window.clearInterval(timer); };
  }, [game?.gameId, game?.ai.active?.interactionId]);

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
    </>}
  </div>;
}
