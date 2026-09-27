import { useRef, useState } from 'react';
import { loadUsage, resetUsage, type UsageDashboardView } from '../api';

const failureOutcomes = new Set(['timeout', 'rate_limited', 'server_error', 'network_error', 'malformed',
  'schema_rejected', 'semantic_rejected', 'safety_refusal', 'auth_config_error']);
export function UsageDashboard() {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<UsageDashboardView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);
  async function refresh() {
    const id = ++requestId.current;
    setLoading(true); setError(false);
    try { const next = await loadUsage(); if (id === requestId.current) setUsage(next); }
    catch { if (id === requestId.current) setError(true); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  function toggle() {
    const next = !open; setOpen(next);
    if (next && !usage && !loading) void refresh();
  }
  async function reset() {
    if (!usage || loading || !window.confirm('Resetovati lokalne AI metrike?')) return;
    const id = ++requestId.current; setLoading(true); setError(false);
    try { const next = await resetUsage(usage.revision); if (id === requestId.current) setUsage(next); }
    catch { if (id === requestId.current) setError(true); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  const total = usage?.logical.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const successes = usage?.attempts.filter(row => row.outcome === 'success').reduce((sum, row) => sum + row.count, 0) ?? 0;
  const errors = usage?.attempts.filter(row => failureOutcomes.has(row.outcome)).reduce((sum, row) => sum + row.count, 0) ?? 0;
  const latencyCount = usage?.attempts.reduce((sum, row) => sum + row.latency.count, 0) ?? 0;
  const latencySum = usage?.attempts.reduce((sum, row) => sum + row.latency.sumMs, 0) ?? 0;
  const analyses = usage?.logical.filter(row => row.purpose === 'analysis').reduce((sum, row) => sum + row.count, 0) ?? 0;
  return <section className="usage-dashboard">
    <button aria-expanded={open} aria-controls="usage-panel" onClick={toggle}>AI upotreba</button>
    {open && <div id="usage-panel" className="usage-panel">
      <h2>Lokalne AI metrike</h2>
      {loading && <p role="status"><span className="loading-dot" aria-label="Učitavanje AI metrika" /> Učitavanje…</p>}
      {error && !loading && <><p role="alert">Nije moguće učitati AI metrike.</p>
        <button onClick={() => void refresh()}>Pokušaj ponovo</button></>}
      {usage && !loading && !error && total === 0 && <p>Nema zabeleženih AI zahteva.</p>}
      {usage && !loading && !error && total > 0 && <dl className="metric-grid">
        <div><dt>Ukupno zahteva</dt><dd data-testid="total-requests">{total}</dd></div>
        <div><dt>Uspešni pokušaji</dt><dd data-testid="successful-requests">{successes}</dd></div>
        <div><dt>Lokalni fallback</dt><dd data-testid="fallback-count">{usage.localFallbackCount}</dd></div>
        <div><dt>Timeout / 429 / greške</dt><dd data-testid="error-count">{errors}</dd></div>
        <div><dt>Prosečno trajanje</dt><dd data-testid="average-latency">{latencyCount ? Math.round(latencySum / latencyCount) + ' ms' : 'Nema podataka'}</dd></div>
        <div><dt>Analize</dt><dd data-testid="analysis-count">{analyses}</dd></div>
      </dl>}
      {usage && !error && <button disabled={loading} onClick={() => void reset()}>Resetuj metrike</button>}
    </div>}
  </section>;
}
