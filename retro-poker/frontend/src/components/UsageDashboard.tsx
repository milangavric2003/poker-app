import { useCallback, useEffect, useRef, useState } from 'react';
import { loadUsage, resetUsage, type UsageDashboardView } from '../api';

const failureOutcomes = new Set(['timeout', 'rate_limited', 'server_error', 'network_error', 'malformed',
  'schema_rejected', 'semantic_rejected', 'safety_refusal', 'auth_config_error', 'invalid_request']);
function diagnosticLabel(row: UsageDashboardView['attempts'][number]): string {
  const diagnostic = row.diagnostic;
  if (!diagnostic) return 'Nema detalja';
  return [diagnostic.httpStatus ? `HTTP ${diagnostic.httpStatus}` : 'Bez HTTP odgovora',
    diagnostic.providerCode, diagnostic.reason === 'high_demand'
      ? 'Model je trenutno preopterećen; pokušaj kasnije.' : null].filter(Boolean).join(' · ');
}
export function UsageDashboard() {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<UsageDashboardView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);
  const inFlight = useRef<number | null>(null);
  const resetting = useRef(false);
  const refresh = useCallback(async (background = false) => {
    if (inFlight.current !== null || resetting.current) return;
    const id = ++requestId.current;
    inFlight.current = id;
    if (!background) { setLoading(true); setError(false); }
    try {
      const next = await loadUsage();
      if (id === requestId.current) { setUsage(next); setError(false); }
    }
    catch { if (id === requestId.current) setError(true); }
    finally {
      if (inFlight.current === id) inFlight.current = null;
      if (id === requestId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    void refresh();
    const timer = window.setInterval(() => { void refresh(true); }, 1000);
    return () => {
      window.clearInterval(timer);
      ++requestId.current;
      inFlight.current = null;
    };
  }, [open, refresh]);
  async function reset() {
    if (!usage || loading || resetting.current || !window.confirm('Resetovati lokalne AI metrike?')) return;
    resetting.current = true;
    const id = ++requestId.current; setLoading(true); setError(false);
    try { const next = await resetUsage(usage.revision); if (id === requestId.current) setUsage(next); }
    catch { if (id === requestId.current) setError(true); }
    finally { resetting.current = false; if (id === requestId.current) setLoading(false); }
  }
  // Week04 and coaching are disjoint aggregates in the same usage store.
  // Project them for display only: model steps and tools never become logical requests.
  const coach = usage?.coach;
  const attempts = [...(usage?.attempts ?? []), ...(coach?.attempts ?? []).map(row => ({
    ...row, purpose: 'coach' as const,
  }))];
  const purposeLabel = (purpose: string) => purpose === 'bot' ? 'Bot odluke'
    : purpose === 'analysis' ? 'AI analiza partije (sažetak)' : 'Coaching';
  const total = (usage?.logical.reduce((sum, row) => sum + row.count, 0) ?? 0) + (coach?.runCount ?? 0);
  const successes = (usage?.logical.filter(row => row.finalOutcome === 'model_success')
    .reduce((sum, row) => sum + row.count, 0) ?? 0)
    + (coach?.stopReasons.find(row => row.reason === 'completed')?.count ?? 0);
  const errors = attempts.filter(row => failureOutcomes.has(row.outcome)).reduce((sum, row) => sum + row.count, 0);
  const latencyCount = attempts.reduce((sum, row) => sum + row.latency.count, 0);
  const latencySum = attempts.reduce((sum, row) => sum + row.latency.sumMs, 0);
  const providerAttempts = attempts.reduce((sum, row) => sum + row.count, 0);
  const bots = usage?.logical.filter(row => row.purpose === 'bot').reduce((sum, row) => sum + row.count, 0) ?? 0;
  const analyses = usage?.logical.filter(row => row.purpose === 'analysis').reduce((sum, row) => sum + row.count, 0) ?? 0;
  const totalTokens = attempts.reduce((aggregate, row) => {
    const metric = row.usage?.totalTokens;
    if (metric) {
      aggregate.knownCount += metric.knownCount;
      aggregate.missingCount += metric.missingCount;
      aggregate.sum += metric.sum;
    }
    return aggregate;
  }, { knownCount: 0, missingCount: 0, sum: 0 });
  const cost = attempts.reduce((aggregate, row) => {
    const metric = row.usage?.cost;
    if (metric) {
      aggregate.knownCount += metric.knownCount;
      aggregate.missingCount += metric.missingCount;
      if (metric.sum !== null) aggregate.sum += metric.sum;
      if (metric.currency) aggregate.currency = metric.currency;
    }
    return aggregate;
  }, { knownCount: 0, missingCount: 0, sum: 0, currency: '' });
  const usageLabel = (metric: { knownCount: number; missingCount: number; sum: number } | undefined,
    suffix = '') => !metric || metric.knownCount === 0 ? 'Nepoznato'
      : `${metric.sum}${suffix}${metric.missingCount > 0 ? ' (delimično)' : ''}`;
  return <section className="usage-dashboard">
    <button aria-expanded={open} aria-controls="usage-panel" onClick={() => setOpen(value => !value)}>AI upotreba</button>
    {open && <div id="usage-panel" className="usage-panel">
      <h2>Lokalne AI metrike</h2>
      {loading && <p role="status"><span className="loading-dot" aria-label="Učitavanje AI metrika" /> Učitavanje…</p>}
      {error && !loading && <><p role="alert">Nije moguće učitati AI metrike.</p>
        <button onClick={() => void refresh()}>Pokušaj ponovo</button></>}
      {usage && !loading && !error && total === 0 && <p>Nema zabeleženih AI zahteva.</p>}
      {usage && !loading && !error && total > 0 && <>
        <p>Jedno generisanje može imati više modelskih koraka i provider pokušaja. Lokalni alat nije API zahtev.</p>
        <p data-testid="retry-count">Week04 Retry: {usage.retryCount} | model fallback: {usage.modelFallbackCount} | local fallback: {usage.localFallbackCount}</p>
        <p>Week04 Retry broji pokretanja sa ponovnim pokušajem, uključujući model fallback.</p>
        <p data-testid="coach-recovery">Coaching retry pokušaji: {coach?.retryCount ?? 0} | model fallback pokušaji: {coach?.modelFallbackCount ?? 0}</p>
        <p data-testid="provider-recovery">Provider pokušaji po odnosu: isti model retry {attempts.filter(row => row.relation === 'same_model_retry').reduce((sum, row) => sum + row.count, 0)}; model fallback {attempts.filter(row => row.relation === 'model_fallback').reduce((sum, row) => sum + row.count, 0)}.</p>
        <p data-testid="latency-summary">Latency count / avg / max: {latencyCount} / {latencyCount ? Math.round(latencySum / latencyCount) : 0} / {Math.max(0, ...attempts.map(row => row.latency.maxMs))} ms (provider pokušaji)</p>
        <details className="usage-details"><summary>Logical requests</summary>
        <div className="usage-table-wrap"><table><thead><tr><th>Tok</th><th>Initial model</th><th>Final outcome</th><th>Count</th></tr></thead><tbody>{usage.logical.map((row, i) => <tr key={`l-${i}`}><td>{purposeLabel(row.purpose)}</td><td>{row.initialModel}</td><td>{row.finalOutcome}</td><td>{row.count}</td></tr>)}</tbody></table></div>
        {coach && coach.runCount > 0 && <table><caption>Coaching generisanja po završnom razlogu</caption><thead><tr><th>Ishod</th><th>Broj</th></tr></thead><tbody>{coach.stopReasons.map(row => <tr key={row.reason}><td>{row.reason}</td><td>{row.count}</td></tr>)}</tbody></table>}
        </details>
        <details className="usage-details"><summary>Attempts</summary>
        <div className="usage-table-wrap"><table><thead><tr><th>Tok / korak</th><th>Actual model</th><th>Relation</th><th>Outcome</th><th>Razlog</th><th>Count</th><th>Latency count / avg / max</th><th>Total tokens</th><th>Cost</th></tr></thead><tbody>{attempts.map((row, i) => <tr key={`a-${i}`}><td>{purposeLabel(row.purpose)}{'stepOrdinal' in row ? ` / korak ${row.stepOrdinal}` : ''}</td><td>{row.model}</td><td>{row.relation}</td><td>{row.outcome}</td><td>{'diagnostic' in row ? diagnosticLabel(row) : 'Nema detalja'}</td><td>{row.count}</td><td>{row.latency.count} / {row.latency.count ? Math.round(row.latency.sumMs / row.latency.count) : 0} / {row.latency.maxMs} ms</td><td>{usageLabel(row.usage?.totalTokens)}</td><td>{row.usage?.cost.knownCount && row.usage.cost.sum !== null ? `${row.usage.cost.sum} ${row.usage.cost.currency ?? ''}` : 'Nepoznato'}</td></tr>)}</tbody></table></div>
        </details>
        <details className="usage-details"><summary>Tokeni i trošak</summary>
      <dl className="metric-grid">
        <div><dt>Ukupno logičkih pokretanja</dt><dd data-testid="total-requests">{total}</dd></div>
        <div><dt>Uspešna pokretanja</dt><dd data-testid="successful-requests">{successes}</dd></div>
        <div><dt>Neuspešna ili nepotpuna pokretanja</dt><dd data-testid="failed-requests">{Math.max(0, total - successes - usage.localFallbackCount)}</dd></div>
        <div><dt>Provider pokušaji (API zahtevi)</dt><dd data-testid="provider-attempt-count">{providerAttempts}</dd></div>
        <div><dt>Uspešni provider pokušaji</dt><dd data-testid="provider-success-count">{attempts.filter(row => row.outcome === 'success').reduce((sum, row) => sum + row.count, 0)}</dd></div>
        <div><dt>Bot odluke</dt><dd data-testid="bot-count">{bots}</dd></div>
        <div><dt>Lokalni fallback</dt><dd data-testid="fallback-count">{usage.localFallbackCount}</dd></div>
        <div><dt>Timeout / 429 / greške</dt><dd data-testid="error-count">{errors}</dd></div>
        <div><dt>Prosečno trajanje provider pokušaja</dt><dd data-testid="average-latency">{latencyCount ? Math.round(latencySum / latencyCount) + ' ms' : 'Nema podataka'}</dd></div>
        <div><dt>AI analiza partije (sažetak)</dt><dd data-testid="analysis-count">{analyses}</dd></div>
        <div><dt>Coaching pokretanja</dt><dd data-testid="coach-count">{coach?.runCount ?? 0}</dd></div>
        <div><dt>Coaching modelski koraci</dt><dd data-testid="coach-steps">{coach?.stepCount ?? 0}</dd></div>
        <div><dt>Coaching lokalna izvršenja alata</dt><dd data-testid="coach-tools">{coach?.toolExecutionCount ?? 0}</dd></div>
        <div><dt>Coaching pokušaji / odbijanja alata</dt><dd>{coach?.toolAttemptCount ?? 0} / {coach?.toolRejectionCount ?? 0}</dd></div>
        <div><dt>Coaching trajanje pokretanja (prosek / max)</dt><dd data-testid="coach-duration">{coach?.latency.count ? `${Math.round(coach.latency.sumMs / coach.latency.count)} / ${coach.latency.maxMs} ms` : 'Nema podataka'}</dd></div>
        <div><dt>Ukupno tokena</dt><dd data-testid="usage-total-tokens">{usageLabel(totalTokens)}</dd></div>
        <div><dt>Trošak</dt><dd data-testid="usage-cost">{cost?.knownCount
          ? usageLabel(cost, ` ${cost.currency}`) : 'Nepoznato'}</dd></div>
      </dl>
        </details>
      </>}
      {usage && !error && <button disabled={loading} onClick={() => void reset()}>Resetuj metrike</button>}
    </div>}
  </section>;
}
