export type AiUiStatus =
  | { kind: 'idle'; mode: 'off' | 'on' }
  | { kind: 'requesting'; purpose: 'bot' | 'analysis'; attemptCount: number }
  | { kind: 'success' | 'fallback' | 'timeout' | 'rate_limited' | 'provider_error'
    | 'cancelled' | 'stale' | 'missing_key' | 'semantic_rejection' };

const labels: Record<Exclude<AiUiStatus['kind'], 'idle' | 'requesting'>, string> = {
  success: 'AI potez je prihvaćen.',
  fallback: 'Korišćen je bezbedan lokalni fallback; razlog nije javno dostupan.',
  timeout: 'Vreme čekanja na AI je isteklo.',
  rate_limited: 'AI provider je primio previše zahteva (429).',
  provider_error: 'AI provider nije odgovorio ili je vratio grešku.',
  cancelled: 'AI zahtev je otkazan i nije promenio partiju.',
  stale: 'Zastareo AI odgovor je odbačen.',
  missing_key: 'AI nije konfigurisan na lokalnom serveru.',
  semantic_rejection: 'AI predlog nije prošao semantičku proveru; korišćen je fallback.',
};

export function AiStatus({ status }: { status: AiUiStatus }) {
  let label: string;
  if (status.kind === 'idle') label = status.mode === 'off' ? 'AI režim je isključen.' : 'AI je spreman.';
  else if (status.kind === 'requesting') label = status.purpose === 'bot'
    ? 'AI razmišlja o potezu…' : 'AI priprema analizu…';
  else label = labels[status.kind];
  return <div className={`ai-status ai-status--${status.kind}`} role="status" aria-live="polite">
    {status.kind === 'requesting' && <span className="loading-dot" aria-label={status.purpose === 'bot'
      ? 'AI obrađuje potez' : 'AI priprema analizu'} />}
    <span>{label}</span>
  </div>;
}
