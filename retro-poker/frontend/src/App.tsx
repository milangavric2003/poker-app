import { useEffect, useState } from 'react';
import type { GameView } from '../../shared/contracts';
import { createGame, loadGame, sendAction, type ActionDraft } from './api';
import { ActionPanel } from './components/ActionPanel';
import { HandResult } from './components/HandResult';
import { Table } from './components/Table';

export function App() {
  const [game, setGame] = useState<GameView | null>(null); const [botCount, setBotCount] = useState(5);
  const [pending, setPending] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadGame().then(setGame).catch(caught => setError(caught instanceof Error ? caught.message : 'Greška.')).finally(() => setPending(false)); }, []);
  async function start() {
    if (game?.status === 'playing' && !window.confirm('Aktivna partija će biti zamenjena. Nastaviti?')) return;
    setPending(true); setError(null);
    try { setGame(await createGame(botCount, game)); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Partija nije pokrenuta.'); } finally { setPending(false); }
  }
  async function act(action: ActionDraft) {
    if (!game) return; setPending(true); setError(null);
    try { setGame(await sendAction(game, action)); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Potez nije obrađen.'); } finally { setPending(false); }
  }
  const visibleResult = game?.result ?? game?.previousResult;
  return <div className="app-shell"><header className="titlebar"><h1>RETRO POKER</h1><span>LOCAL TABLE // NO LIMIT</span></header>
    <section className="new-game" aria-label="Nova partija"><label htmlFor="bot-count">Broj botova</label><select id="bot-count" value={botCount} disabled={pending} onChange={e => setBotCount(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(count => <option key={count}>{count}</option>)}</select><button disabled={pending} onClick={start}>Nova partija</button></section>
    {error && <p className="error" role="alert">{error}</p>}{!game && !pending && <p className="empty">Izaberi broj botova i pokreni lokalnu partiju.</p>}
    {game && <><Table game={game} />{game.legalActions.length > 0 && <ActionPanel game={game} pending={pending} onAction={act} />}{visibleResult && <HandResult result={visibleResult} />}</>}
  </div>;
}
