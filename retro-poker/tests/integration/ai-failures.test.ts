import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';
import { GameResponseSchema, type GameView } from '../../shared/contracts.js';
import { FakeAiProvider, legalBotProposal, type FakeAiStep } from '../helpers/fake-ai-provider.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';
import { FakeClock } from '../helpers/fake-clock.js';

const apps: FastifyInstance[] = [];
const clocks = new WeakMap<FastifyInstance, FakeClock>();
afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.close()));
  const snapshot = processUsageStore.snapshot(); processUsageStore.reset(snapshot.revision);
});

function makeApp(provider: FakeAiProvider, configured = true) {
  const clock = new FakeClock();
  const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(100).fill(0.9)), aiProvider: provider, aiClock: clock,
    aiConfig: loadAiConfig(configured ? { GEMINI_API_KEY: 'offline-test-placeholder' } : {}) });
  clocks.set(app, clock); apps.push(app); return app;
}

async function start(app: FastifyInstance): Promise<GameView> {
  const response = await app.inject({ method: 'POST', url: '/api/game', headers: {
    'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 3, aiMode: true } });
  expect(response.statusCode).toBe(201);
  return GameResponseSchema.parse(response.json()).game!;
}

async function settled(app: FastifyInstance): Promise<GameView> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const game = GameResponseSchema.parse((await app.inject('/api/game')).json()).game!;
    if (game.ai.lastBotOutcome && game.ai.active === null) return game;
    // Advance the injected AI clock, independent of the host's timer resolution.
    clocks.get(app)!.advance(10);
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  throw new Error('AI fallback nije zavrsen u predvidjenom roku.');
}

const recoveryCases: ReadonlyArray<{ name: string; steps: FakeAiStep[]; attempts: number;
  outcomes: string[] }> = [
  { name: 'malformed', steps: [{ kind: 'malformed' }, { kind: 'malformed' }], attempts: 2,
    outcomes: ['malformed', 'malformed'] },
  { name: 'schema', steps: [{ kind: 'schema_mismatch' }, { kind: 'schema_mismatch' }], attempts: 2,
    outcomes: ['schema_rejected', 'schema_rejected'] },
  { name: 'semantic', steps: [{ kind: 'semantic_illegal' }, { kind: 'semantic_illegal' }], attempts: 2,
    outcomes: ['semantic_rejected', 'semantic_rejected'] },
  { name: 'timeout', steps: [{ kind: 'timeout_error' }, { kind: 'timeout_error' }], attempts: 2,
    outcomes: ['timeout', 'timeout'] },
  { name: '429', steps: [{ kind: '429' }, { kind: '429' }], attempts: 2,
    outcomes: ['rate_limited', 'rate_limited'] },
  { name: '5xx', steps: [{ kind: '5xx' }, { kind: '5xx' }], attempts: 2,
    outcomes: ['server_error', 'server_error'] },
  { name: 'network', steps: [{ kind: 'network' }, { kind: 'network' }], attempts: 2,
    outcomes: ['network_error', 'network_error'] },
  { name: 'safety', steps: [{ kind: 'safety_refusal' }], attempts: 1,
    outcomes: ['safety_refusal'] },
  { name: 'auth/config', steps: [{ kind: 'auth_config' }], attempts: 1,
    outcomes: ['auth_config_error'] },
];

describe('offline AI recovery (FR-012, AIAC03–AIAC09)', () => {
  it.each(recoveryCases)('$name failure has the expected bounded chain and one visible local commit',
    async ({ steps, attempts, outcomes }) => {
      const provider = new FakeAiProvider([...steps]);
      const app = makeApp(provider);
      const initial = await start(app);
      const game = await settled(app);
      expect(provider.callCount).toBe(attempts);
      expect(game.version).toBe(initial.version + 1);
      expect(game.ai.lastBotOutcome).toMatchObject({ outcome: 'local_fallback', attemptCount: attempts });
      const usage = (await app.inject('/api/ai/usage')).json().usage;
      expect(usage.logical).toEqual([{ purpose: 'bot', initialModel: 'gemini-3.8-flash',
        finalOutcome: 'local_fallback', count: 1 }]);
      expect(usage.attempts.flatMap((row: { outcome: string; count: number }) =>
        Array<string>(row.count).fill(row.outcome))).toEqual(expect.arrayContaining(outcomes));
      expect(usage.retryCount).toBe(attempts - 1);
      expect(usage.localFallbackCount).toBe(1);
    });

  it('missing key makes zero provider calls and still exposes local fallback', async () => {
    const provider = new FakeAiProvider();
    const game = await start(makeApp(provider, false));
    expect(provider.callCount).toBe(0);
    expect(game.ai).toMatchObject({ availability: 'unavailable', active: null,
      lastBotOutcome: { outcome: 'local_fallback', attemptCount: 0 } });
  });

  it.each([
    ['retrying', { kind: '429' } as const, 'gemini-3.8-flash'],
    ['model_fallback', { kind: '5xx' } as const, 'gemini-3.5-flash-lite'],
  ])('publishes %s with attempt count and selected model before attempt two',
    async (status, firstStep, model) => {
      const provider = new FakeAiProvider([firstStep, { kind: 'pending', id: status }]);
      const app = makeApp(provider); await start(app);
      for (let attempt = 0; attempt < 100 && provider.callCount < 2; attempt++) {
        clocks.get(app)!.advance(10);
        await new Promise<void>(resolve => setImmediate(resolve));
      }
      expect(provider.callCount).toBe(2);
      const waiting = GameResponseSchema.parse((await app.inject('/api/game')).json()).game!;
      expect(waiting.ai.active).toMatchObject({ status, attemptCount: 1, model });
      provider.resolve(status, legalBotProposal(provider.calls[1]!.context as Parameters<typeof legalBotProposal>[0]));
      await settled(app);
    });

  it('rejected proposals do not alter RNG, stacks, board or accepted history before fallback', async () => {
    const rejectedApp = makeApp(new FakeAiProvider([
      { kind: 'semantic_illegal' }, { kind: 'semantic_illegal' }]));
    const terminalApp = makeApp(new FakeAiProvider([{ kind: 'safety_refusal' }]));
    await start(rejectedApp); await start(terminalApp);
    const rejected = await settled(rejectedApp);
    const terminal = await settled(terminalApp);
    const pokerProjection = (game: GameView) => ({ version: game.version, board: game.board,
      players: game.players.map(player => ({ id: player.id, stack: player.stack,
        streetContribution: player.streetContribution, handContribution: player.handContribution,
        status: player.status })), pots: game.pots, totalPot: game.totalPot,
      events: game.events.map(({ handId: _handId, ...event }) => event) });
    expect(pokerProjection(rejected)).toEqual(pokerProjection(terminal));
  });
});
