import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCoachSmoke } from './coach-smoke.js';
import { CoachRequestGate, COACH_EVAL_MODEL, type CoachGateState } from './coach-request-gate.js';
import { productionAiDependencies } from '../backend/src/app.js';
import { ProviderError, type AgentProvider, type AiProvider } from '../backend/src/ai/types.js';

/** Separate process and in-process HTTP fixtures: never starts or touches the user's game. */
export async function runCoachLiveEval(args: readonly string[]): Promise<number> {
  if (!args.includes('--live')) { console.log(JSON.stringify({ event: 'coach-live-eval', executed: false })); return 0; }
  const runsFlags = args.filter(arg => arg.startsWith('--runs='));
  const labelFlags = args.filter(arg => arg.startsWith('--label='));
  const runs = runsFlags.length ? Number(runsFlags[0]?.slice(7)) : 6;
  const label = labelFlags[0]?.slice(8) ?? 'baseline';
  if (runsFlags.length > 1 || !Number.isInteger(runs) || runs < 1 || runs > 12 || labelFlags.length > 1
    || !/^[a-z0-9-]{1,32}$/.test(label)
    || args.some(arg => arg !== '--live' && !arg.startsWith('--runs=') && !arg.startsWith('--label='))) return 2;
  const ledgerPath = resolve('.verification/coach-live-ledger.json');
  mkdirSync(resolve('.verification'), { recursive: true });
  const ledger: { model: string; state: CoachGateState; reports: Array<Record<string, unknown>>;
    dispatches?: Array<{ ordinal: number; at: number }> } = existsSync(ledgerPath)
    ? JSON.parse(readFileSync(ledgerPath, 'utf8'))
    : { model: COACH_EVAL_MODEL, state: { requestCount: 0, lastDispatchAt: null, blockedUntil: Date.now() + 60000 }, reports: [] };
  if (ledger.model !== COACH_EVAL_MODEL || !ledger.state || !Array.isArray(ledger.reports)) return 2;
  ledger.dispatches ??= [];
  const save = (state: CoachGateState) => {
    if (state.lastDispatchAt !== null && state.requestCount > (ledger.dispatches!.at(-1)?.ordinal ?? 0)) {
      ledger.dispatches!.push({ ordinal: state.requestCount, at: state.lastDispatchAt });
    }
    ledger.state = state; writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  };
  const gate = new CoachRequestGate({ state: ledger.state, save }); save(gate.state);
  const resolved = productionAiDependencies({ ...process.env, GEMINI_PRIMARY_MODEL: COACH_EVAL_MODEL,
    GEMINI_FALLBACK_MODEL: '', GEMINI_MAX_ATTEMPTS: '1' });
  if (!resolved.aiConfig?.enabled || !resolved.aiProvider || !('generateAgent' in resolved.aiProvider)) return 2;
  const underlying = resolved.aiProvider as AiProvider & AgentProvider;
  const provider: AiProvider & AgentProvider = {
    async generate() { throw new ProviderError('config_error'); },
    generateAgent: (request, signal) => gate.dispatch(request.model, () => underlying.generateAgent(request, signal), signal),
  };
  const matrix = ['single-all-in', 'street-review', 'long-match'].flatMap(scenario =>
    ['street', 'betting', 'showdown'].map(focus => ({ scenario, focus })));
  console.log(JSON.stringify({ event: 'coach-live-eval-start', label, runs, model: COACH_EVAL_MODEL,
    budgetUsed: gate.state.requestCount, maxRequests: 50, dispatchIntervalMs: 6000 }));
  let failures = 0;
  for (let index = 0; index < runs; index++) {
    if (gate.state.requestCount > 48) break; // Reserve enough for the two-step workflow.
    await gate.wait();
    const entry = matrix[index % matrix.length]!;
    const result = await runCoachSmoke(['--live', `--scenario=${entry.scenario}`, `--focus=${entry.focus}`],
      () => ({ aiConfig: resolved.aiConfig!, aiProvider: provider }));
    const report = { ...result.report, label, batchRun: index + 1, budgetUsed: gate.state.requestCount };
    ledger.reports.push(report); save(gate.state);
    console.log(JSON.stringify(report));
    if (!result.report.passed) failures++;
    if (result.report.failureCategory === 'rate_limit' || result.report.failureCategory === 'authentication_configuration') break;
  }
  console.log(JSON.stringify({ event: 'coach-live-eval-finish', label, failures, budgetUsed: gate.state.requestCount }));
  return failures ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCoachLiveEval(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(() => {
    console.log(JSON.stringify({ event: 'coach-live-eval-failed', reason: 'local_verification_failure' })); process.exitCode = 2;
  });
}
