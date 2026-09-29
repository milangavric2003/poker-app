import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { buildApp, productionAiDependencies } from '../backend/src/app.js';
import { ProviderError } from '../backend/src/ai/types.js';
import type { RandomSource } from '../backend/src/engine/types.js';
import { GameResponseSchema, type GameView } from '../shared/contracts.js';
import { processUsageStore } from '../backend/src/ai/usage.js';
import { BotActionProposalSchema, parseProviderCandidate } from '../backend/src/ai/schemas.js';

// Opt-in only. One provider call per scenario, no retries or fallback model.
// Synthetic fixture injection is local to this script, never an HTTP capability.
const deck = ['Kc', 'As', 'Kd', 'Ah', '6c', '2c', '3d', '7h', '8c', '9s', 'Tc', 'Jc'] as const;
function fixedRandom(): RandomSource { return { next: () => 0.9, clone: fixedRandom }; }
const identity = (game: GameView) => ({ gameId: game.gameId, handId: game.handId, expectedVersion: game.version });
function gameFromResponse(value: unknown): GameView {
  const game = GameResponseSchema.parse(value).game;
  assert.ok(game);
  return game;
}

async function main() {
  if (!process.argv.includes('--live')) {
    console.log('Not run: pass --live to allow at most one bot and one analysis call.');
    return;
  }
  const dependencies = productionAiDependencies(process.env);
  if (!dependencies.aiProvider || !dependencies.aiConfig?.enabled) {
    console.log('Not run: AI configuration unavailable.'); process.exitCode = 2; return;
  }
  const config = { ...dependencies.aiConfig, maxAttempts: 1 as const, fallbackModel: null };
  const provider = dependencies.aiProvider;
  const calls = { bot: 0, analysis: 0 };
  let failures = 0;
  const purposes = process.argv.includes('--bot-only') ? ['bot'] as const : ['bot', 'analysis'] as const;
  console.log(JSON.stringify({ event: 'configuration', model: config.primaryModel,
    botAttemptMs: config.botAttemptMs, botTotalMs: config.botTotalMs,
    analysisAttemptMs: config.analysisAttemptMs, maxCalls: purposes.length }));
  for (const purpose of purposes) {
    processUsageStore.reset(processUsageStore.snapshot().revision);
    const app = buildApp({ deck, deckRandom: fixedRandom(), botRandom: fixedRandom(), aiConfig: config,
      aiProvider: { async generate(request, signal) {
        if (request.purpose !== purpose || calls[purpose] >= 1) throw new ProviderError('config_error');
        calls[purpose]++;
        const result = await provider.generate(request, signal);
        if (request.purpose === 'bot') {
          try {
            const candidate = parseProviderCandidate(result.candidate);
            const parsed = BotActionProposalSchema.safeParse(candidate);
            if (!parsed.success) {
              const fields = new Set(['type', 'gameId', 'handId', 'expectedVersion', 'actorId', 'decisionOrdinal', 'amountTo',
                'action', 'decision', 'reason', 'explanation', 'proposal', 'result', 'response']);
              const safeField = (value: unknown) => typeof value === 'string' && fields.has(value) ? value : 'other';
              const object = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : {};
              console.log(JSON.stringify({ event: 'bot-schema-diagnostic',
                fields: Object.keys(object).map(safeField),
                actionType: ['fold', 'check', 'call', 'all_in', 'bet', 'raise'].includes(String(object.type)) ? object.type : 'unknown',
                issues: parsed.error.issues.map(issue => ({ code: issue.code, path: issue.path.map(safeField),
                  ...('keys' in issue ? { keys: issue.keys.map(safeField) } : {}) })) }));
            }
          } catch { console.log(JSON.stringify({ event: 'bot-schema-diagnostic', code: 'malformed_json' })); }
        }
        return result;
      } } });
    const started = performance.now();
    let passed = false;
    let terminalStatus: string | null = null;
    let stage = 'create';
    try {
      const created = await app.inject({ method: 'POST', url: '/api/game',
        headers: { 'content-type': 'application/json', 'if-none-match': '*' },
        payload: { botCount: 1, aiMode: purpose === 'bot' } });
      assert.equal(created.statusCode, 201);
      const initial = gameFromResponse(created.json());
      stage = 'human-all-in';
      const moved = await app.inject({ method: 'POST', url: '/api/game/actions',
        headers: { 'content-type': 'application/json' }, payload: { ...identity(initial), type: 'all_in' } });
      assert.equal(moved.statusCode, 200);
      let game = gameFromResponse(moved.json());
      const unchanged = JSON.stringify({ version: game.version, players: game.players,
        events: game.events, result: game.result });
      if (purpose === 'analysis') {
        stage = 'prepare-analysis';
        assert.equal(game.phase, 'complete');
        assert.notEqual(game.status, 'playing');
        assert.equal(calls.analysis, 0);
        const response = await app.inject({ method: 'POST', url: '/api/game/analysis',
          headers: { 'content-type': 'application/json' }, payload: identity(game) });
        assert.equal(response.statusCode, 202);
      }
      const deadline = performance.now() + (purpose === 'bot' ? config.botTotalMs : config.analysisTotalMs) + 2000;
      stage = 'poll';
      do {
        await new Promise(resolve => setTimeout(resolve, 100));
        game = gameFromResponse((await app.inject('/api/game')).json());
        if (purpose === 'bot' ? game.ai.lastBotOutcome !== null
          : ['completed', 'failed'].includes(game.ai.analysis.status)) break;
      } while (performance.now() < deadline);
      terminalStatus = purpose === 'bot' ? game.ai.lastBotOutcome?.outcome ?? null : game.ai.analysis.status;
      stage = 'verify-outcome';
      assert.equal(calls[purpose], 1);
      if (purpose === 'bot') {
        assert.equal(terminalStatus, 'model');
        assert.equal(game.version, initial.version + 2);
        assert.equal(game.phase, 'complete');
        assert.ok(game.events.some(event => event.type === 'action' && event.playerId === game.ai.lastBotOutcome?.actorId));
      } else {
        assert.equal(terminalStatus, 'completed');
        assert.ok(game.ai.analysis.result);
        assert.equal(JSON.stringify({ version: game.version, players: game.players,
          events: game.events, result: game.result }), unchanged);
      }
      const usage = processUsageStore.snapshot();
      assert.equal(usage.logical[0]?.finalOutcome, 'model_success');
      assert.equal(usage.attempts.length, 1);
      assert.equal(usage.attempts[0]?.outcome, 'success');
      passed = true;
    } catch (error) {
      // Never print assertion diffs: game state and provider contents are private.
      failures++;
      console.log(JSON.stringify({ event: 'smoke-check-failed', purpose, stage,
        ...(error instanceof ZodError ? { issues: error.issues.map(issue => ({ code: issue.code, path: issue.path })) } : {}) }));
    } finally {
      console.log(JSON.stringify({ event: 'live-smoke', purpose, passed, terminalStatus,
        providerCalls: calls[purpose], durationMs: Math.round(performance.now() - started),
        usage: processUsageStore.snapshot() }));
      await app.close();
    }
  }
  if (failures) process.exitCode = 1;
}

await main();
