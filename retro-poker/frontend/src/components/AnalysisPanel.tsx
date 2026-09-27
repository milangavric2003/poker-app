import type { GameView } from '../../../shared/contracts';

interface Props { game: GameView; pending: boolean; onRequest: () => void; }
export function AnalysisPanel({ game, pending, onRequest }: Props) {
  if (game.status === 'playing') return null;
  const { analysis } = game.ai;
  return <section className="analysis-panel" aria-label="AI analiza partije">
    <h2>AI analiza partije</h2>
    {analysis.status === 'idle' && <><p>Analiza je dostupna za završenu partiju.</p>
      <button disabled={pending} onClick={onRequest}>Zatraži analizu</button></>}
    {analysis.status === 'generating' && <p role="status"><span className="loading-dot"
      aria-label="AI priprema analizu partije" /> Analiza se priprema…</p>}
    {analysis.status === 'failed' && <><p role="alert">Analiza nije uspela. Rezultat partije nije promenjen.</p>
      <button disabled={pending} onClick={onRequest}>Pokušaj ponovo</button></>}
    {analysis.status === 'unavailable' && <><p role="alert">Analiza trenutno nije dostupna.</p>
      <button disabled={pending} onClick={onRequest}>Pokušaj ponovo</button></>}
    {analysis.status === 'completed' && analysis.result && <div className="analysis-content">
      <h3>Sažetak</h3><p>{analysis.result.summary}</p>
      <h3>Dobre odluke</h3><ul>{analysis.result.goodDecisions.map(item =>
        <li key={item.decisionRef}>{item.explanation}</li>)}</ul>
      <h3>Moguće greške</h3><ul>{analysis.result.possibleMistakes.map(item =>
        <li key={item.decisionRef}>{item.explanation}</li>)}</ul>
      <h3>Sledeći koraci</h3><ul>{analysis.result.nextSteps.map((step, index) => <li key={index}>{step}</li>)}</ul>
      <p className="disclaimer">{analysis.result.disclaimer ?? 'AI analiza može pogrešiti; tretiraj je kao savet, ne kao činjenicu.'}</p>
    </div>}
    {analysis.status === 'completed' && !analysis.result &&
      <p role="alert">Analiza nije dostupna jer odgovor nije validiran.</p>}
  </section>;
}
