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
  return !active || incoming.ai.active?.interactionId === active
    || incoming.ai.lastBotOutcome?.handId === current.handId || incoming.ai.analysis.interactionId === active;
}

export function App() {
  const [game, setGame] = useState<GameView | null>(null);
  const gameRef = useRef<GameView | null>(null);
  const [botCount, setBotCount] = useState(5);
  const [aiMode, setAiMode] = useState(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<AiUiStatus | null>(null);
  const pollId = useRef(0);
  function commit(next: GameView | null, force = false) {
    if (force || acceptsAiSnapshot(gameRef.current, next)) { gameRef.current = next; setGame(next); }
  }
  useEffect(() => {
    let mounted = true;
    loadGame().then(next => { if (mounted) commit(next, true); })
      .catch(caught => { if (mounted) setError(caught instanceof Error ? caught.message : 'Greška.'); })
      .finally(() => { if (mounted) setPending(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!game?.ai.active) return;
    const id = ++pollId.current;
    const timer = window.setInterval(() => {
      void loadGame().then(next => { if (id === pollId.current) commit(next); }).catch(() => undefined);
    }, 750);
    return () => { ++pollId.current; window.clearInterval(timer); };
  }, [game?.gameId, game?.ai.active?.interactionId]);

  async function synchronize() {
    if (pending) return;
    setPending(true);
    try { commit(await loadGame(), true); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Stanje nije učitano.'); }
    finally { setPending(false); }
  }
  async function start() {
    if (pending || error) return;
    if (game?.status === 'playing' && !window.confirm('Aktivna partija će biti zamenjena. Nastaviti?')) return;
    setPending(true); setError(null); setAiNotice(null);
    try { commit(aiMode ? await createGame(botCount, game, true) : await createGame(botCount, game), true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Partija nije pokrenuta.'); }
    finally { setPending(false); }
  }
  async function act(action: ActionDraft) {
    if (!game || pending || error) return;
    setPending(true); setError(null); setAiNotice(null);
    try { commit(await sendAction(game, action)); setAiNotice({ kind: 'success' }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Potez nije obrađen.'); }
    finally { setPending(false); }
  }
  async function advance() {
    if (!game || pending || error) return;
    setPending(true); setError(null);
    try { commit(await nextHand(game)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Sledeća ruka nije pokrenuta.'); }
    finally { setPending(false); }
  }
  async function analyze() {
    if (!game || pending || game.status === 'playing' || game.ai.analysis.status === 'generating') return;
    setPending(true); setError(null);
    try { commit(await requestAnalysis(game)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Analiza nije pokrenuta.'); }
    finally { setPending(false); }
  }
  const visibleResult = game?.result ?? game?.previousResult;
  const status: AiUiStatus = game?.ai.active
    ? { kind: 'requesting', purpose: game.ai.active.purpose, attemptCount: game.ai.active.attemptCount }
    : game?.ai.lastBotOutcome?.outcome === 'local_fallback' ? { kind: 'fallback' }
    : aiNotice ?? (game?.ai.availability === 'unavailable' && game.ai.mode === 'on'
      ? { kind: 'missing_key' } : { kind: 'idle', mode: game?.ai.mode ?? 'off' });
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
    <AiStatus status={status} />
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
