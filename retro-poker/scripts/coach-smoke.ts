import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { buildApp, productionAiDependencies } from '../backend/src/app.js';
import type { SessionDependencies } from '../backend/src/session.js';
import { ProviderError, type AgentProvider } from '../backend/src/ai/types.js';
import { processUsageStore } from '../backend/src/ai/usage.js';
import { getDecisionEvidence } from '../backend/src/agent/tools.js';
import { CORE_AGENT_LIMITS } from '../backend/src/agent/types.js';
import type { RandomSource } from '../backend/src/engine/types.js';
import { CoachResponseSchema, GameResponseSchema, UsageResponseSchema, type CoachRunView,
  type GameView, type UsageDashboardView } from '../shared/contracts.js';

export type CoachSmokeDependencies = Pick<SessionDependencies, 'aiConfig' | 'aiProvider'>;
export interface CoachSmokeResult {
  exitCode: number;
  report: Record<string, unknown>;
}

// A constructor-only synthetic fixture. No server listener or debug HTTP capability.
const deck = ['As', 'Kc', 'Ah', 'Kd', '6c', '2c', '3d', '7h', '8c', '9s', 'Tc', 'Jc'] as const;
function fixedRandom(): RandomSource { return { next: () => 0.9, clone: fixedRandom }; }
const identity = (game: GameView) => ({ gameId: game.gameId, handId: game.handId, expectedVersion: game.version });
function gameFrom(value: unknown): GameView {
  const game = GameResponseSchema.parse(value).game; assert.ok(game); return game;
}
function skipped(reason: string, exitCode: number): CoachSmokeResult {
  return { exitCode, report: { event: 'coach-smoke', executed: false, passed: false,
    reason, providerCallCount: 0, toolCallCount: 0 } };
}

/** One run only; no retry/fallback and no raw provider/game data in the report. */
export async function runCoachSmoke(
  args: readonly string[],
  dependencies: () => CoachSmokeDependencies = () => productionAiDependencies(),
): Promise<CoachSmokeResult> {
  if (!args.includes('--live')) return skipped('opt_in_required', 0);
  let resolved: CoachSmokeDependencies;
  try { resolved = dependencies(); } catch { return skipped('configuration_unavailable', 2); }
  const { aiConfig, aiProvider } = resolved;
  if (!aiConfig?.enabled || !aiConfig.apiKey || !aiProvider || !('generateAgent' in aiProvider)
    || typeof aiProvider.generateAgent !== 'function') return skipped('configuration_unavailable', 2);
  const provider = aiProvider as typeof aiProvider & AgentProvider;
  const config = { ...aiConfig, maxAttempts: 1 as const, fallbackModel: null,
    public: { ...aiConfig.public, maxAttempts: 1 as const, fallbackModel: null } };
  processUsageStore.reset(processUsageStore.snapshot().revision);
  let providerCalls = 0, toolCalls = 0, toolSnapshotPreserved = true;
  const app = buildApp({ deck, deckRandom: fixedRandom(), botRandom: fixedRandom(), aiConfig: config,
    aiProvider: {
      async generate() { throw new ProviderError('config_error'); },
      async generateAgent(request, signal) {
        // Independent dispatch guard: a bug in retry/routing cannot spend another call.
        if (providerCalls >= 2 || request.stepOrdinal !== providerCalls + 1 || request.attemptOrdinal !== 1
          || request.runAttemptOrdinal !== providerCalls + 1 || request.model !== config.primaryModel) {
          throw new ProviderError('config_error');
        }
        providerCalls++;
        return provider.generateAgent(request, signal);
      },
    } as typeof aiProvider & AgentProvider,
    coachExecuteTool: (snapshot, args, controls) => {
      if (toolCalls >= 1) throw new Error('Tool budget exhausted');
      toolCalls++;
      const before = JSON.stringify(snapshot);
      try { return getDecisionEvidence(snapshot, args, controls); }
      finally { toolSnapshotPreserved = toolSnapshotPreserved && JSON.stringify(snapshot) === before; }
    },
  });
  const started = performance.now();
  let stage = 'create', passed = false, readOnlySnapshotPreserved: boolean | null = null;
  let run: CoachRunView | null = null;
  let terminal: GameView | null = null;
  let usage: UsageDashboardView['coach'];
  try {
    const created = await app.inject({ method: 'POST', url: '/api/game',
      headers: { 'if-none-match': '*' }, payload: { botCount: 1, aiMode: false } });
    assert.equal(created.statusCode, 201);
    const initial = gameFrom(created.json());
    stage = 'finish-synthetic-game';
    const moved = await app.inject({ method: 'POST', url: '/api/game/actions',
      payload: { ...identity(initial), type: 'all_in' } });
    assert.equal(moved.statusCode, 200);
    terminal = gameFrom(moved.json());
    assert.equal(terminal.phase, 'complete'); assert.notEqual(terminal.status, 'playing');
    assert.equal(providerCalls, 0);
    stage = 'start-coach';
    const response = await app.inject({ method: 'POST', url: '/api/game/coach',
      payload: { ...identity(terminal), goal: { focus: 'street' } } });
    assert.equal(response.statusCode, 202);
    assert.equal(response.headers['cache-control'], 'no-store');
    run = CoachResponseSchema.parse(response.json()).run;
    const runId = run.runId;
    const deadline = performance.now() + CORE_AGENT_LIMITS.totalDeadlineMs + 1000;
    stage = 'poll-coach';
    // GET waits for the queued terminal usage commit without holding the provider await.
    do {
      await delay(25);
      const status = await app.inject(`/api/game/coach/${runId}`);
      assert.equal(status.statusCode, 200);
      run = CoachResponseSchema.parse(status.json()).run;
      usage = UsageResponseSchema.parse((await app.inject('/api/ai/usage')).json()).usage.coach;
      if (run.stopReason && usage?.runCount === 1) break;
    } while (performance.now() < deadline);
    stage = 'verify-read-only';
    readOnlySnapshotPreserved = toolSnapshotPreserved
      && JSON.stringify(gameFrom((await app.inject('/api/game')).json())) === JSON.stringify(terminal);
    assert.equal(readOnlySnapshotPreserved, true);
    assert.equal(run.providerAttemptCount, providerCalls); assert.equal(run.toolCallCount, toolCalls);
    assert.equal(usage?.runCount, 1); assert.equal(usage?.retryCount, 0); assert.equal(usage?.modelFallbackCount, 0);
    stage = 'verify-final';
    assert.equal(run.status, 'completed'); assert.equal(run.stopReason, 'completed');
    assert.equal(run.stepCount, 2); assert.equal(providerCalls, 2); assert.equal(toolCalls, 1);
    assert.equal(run.result?.completed, true); assert.ok(run.result.evidence.length > 0);
    assert.equal(usage?.validationRejectedCount, 0); assert.equal(usage?.validationCount, 5);
    passed = true; stage = 'completed';
  } catch {
    // Assertion diffs, error messages and provider contents never cross this boundary.
  } finally {
    // If an unexpected verification failure interrupted an active run, cancel its slot.
    if (run && !run.stopReason && terminal) {
      await app.inject({ method: 'POST', url: '/api/game',
        headers: { 'if-match': `"${terminal.gameId}:${terminal.version}"` }, payload: { botCount: 1, aiMode: false } });
    }
    await app.close();
  }
  return { exitCode: passed ? 0 : 1, report: {
    event: 'coach-smoke', executed: providerCalls > 0, passed, stage,
    reason: passed ? null : 'verification_failed', model: config.primaryModel, runId: run?.runId ?? null,
    goal: { focus: 'street' }, maxRuns: 1, maxProviderCalls: 2,
    providerAttemptTimeoutMs: CORE_AGENT_LIMITS.providerAttemptTimeoutMs, totalDeadlineMs: CORE_AGENT_LIMITS.totalDeadlineMs,
    status: run?.status ?? null, stopReason: run?.stopReason ?? null, failureCategory: run?.failureCategory ?? null,
    stepCount: run?.stepCount ?? 0, providerCallCount: providerCalls, toolCallCount: toolCalls,
    finalValidated: run?.status === 'completed' && run.result?.completed === true,
    evidenceCount: run?.result?.evidence.length ?? 0, readOnlySnapshotPreserved,
    durationMs: Math.round(performance.now() - started), usage: usage ?? null,
  } };
}
