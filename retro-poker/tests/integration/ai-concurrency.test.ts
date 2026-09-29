import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { coordinateBot } from '../../backend/src/ai/coordinator.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import type { AiClock, AiProvider, BotDecisionContext, ProviderRequest } from '../../backend/src/ai/types.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';
import { GameSession } from '../../backend/src/session.js';
import { FakeAiProvider, legalBotProposal } from '../helpers/fake-ai-provider.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const apps: FastifyInstance[] = [];
const config = loadAiConfig({ GEMINI_API_KEY: 'offline-test-placeholder' });
afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.close()));
  const snapshot = processUsageStore.snapshot(); processUsageStore.reset(snapshot.revision);
});

function dependencies(provider: AiProvider) {
  return { deck: ac23Deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(100).fill(0.9)), aiProvider: provider, aiConfig: config };
}

async function waitForCall(provider: FakeAiProvider) {
  for (let attempt = 0; attempt < 50 && provider.callCount === 0; attempt++)
    await new Promise(resolve => setTimeout(resolve, 1));
  expect(provider.callCount).toBe(1);
}

async function flush() {
  for (let turn = 0; turn < 4; turn++) await new Promise(resolve => setTimeout(resolve, 0));
}

describe('AI cancellation, CAS and non-blocking reads (AIAC05/14/16, SC-010)', () => {
  it('serves GET before a pending provider resolves', async () => {
    const provider = new FakeAiProvider([{ kind: 'pending', id: 'pending-read' }]);
    const app = buildApp(dependencies(provider)); apps.push(app);
    await app.inject({ method: 'POST', url: '/api/game', headers: {
      'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 3, aiMode: true } });
    await waitForCall(provider);
    const read = await app.inject('/api/game');
    const usageRead = await app.inject('/api/ai/usage');
    expect(read.statusCode).toBe(200);
    expect(usageRead.statusCode).toBe(200);
    expect(usageRead.json().usage).toBeDefined();
    expect(read.json().game.ai.active).toMatchObject({ purpose: 'bot', status: 'waiting' });
    expect(provider.pending.has('pending-read')).toBe(true);
  });

  it('replacement aborts the old signal and ignores its late callback', async () => {
    const provider = new FakeAiProvider([{ kind: 'pending', id: 'old' }]);
    const app = buildApp(dependencies(provider)); apps.push(app);
    const created = (await app.inject({ method: 'POST', url: '/api/game', headers: {
      'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount: 3, aiMode: true } })).json().game;
    await waitForCall(provider);
    const oldSignal = provider.calls[0]!.signal;
    const replacement = (await app.inject({ method: 'POST', url: '/api/game', headers: {
      'if-match': `"${created.gameId}:${created.version}"`, 'content-type': 'application/json' },
      payload: { botCount: 1, aiMode: false } })).json().game;
    expect(oldSignal.aborted).toBe(true);
    provider.resolve('old', legalBotProposal(provider.calls[0]!.context as BotDecisionContext));
    await flush();
    const current = (await app.inject('/api/game')).json().game;
    expect(current.gameId).toBe(replacement.gameId);
    expect(current.version).toBe(replacement.version);
  });

  it.each(['version', 'hand', 'actor', 'decisionOrdinal'] as const)(
    'rejects a callback after the %s fingerprint changes and clears the stale interaction', async field => {
      const provider = new FakeAiProvider([{ kind: 'pending', id: field }]);
      const session = new GameSession(dependencies(provider));
      session.create(3, true);
      await waitForCall(provider);
      const context = provider.calls[0]!.context as BotDecisionContext;
      const game = session.get()!;
      if (field === 'version') game.version++;
      if (field === 'hand') game.hand.handId = '33333333-3333-4333-8333-333333333333';
      if (field === 'actor') game.hand.actorId = game.hand.players.find(player => player.kind === 'human')!.id;
      if (field === 'decisionOrdinal') game.aiDecisionOrdinal++;
      const mutatedVersion = game.version;
      provider.resolve(field, legalBotProposal(context));
      await flush();
      expect(session.get()!.version).toBe(mutatedVersion);
      expect(session.get()!.ai.lastBotOutcome).toBeNull();
      expect(session.get()!.ai.active).toBeNull();
    });

  it('accepts at most one commit when a provider resolves the same callback twice', async () => {
    const provider = new FakeAiProvider([{ kind: 'pending', id: 'duplicate' }]);
    const session = new GameSession(dependencies(provider));
    const initial = session.create(3, true);
    await waitForCall(provider);
    const proposal = legalBotProposal(provider.calls[0]!.context as BotDecisionContext);
    provider.resolve('duplicate', proposal); provider.resolve('duplicate', proposal);
    await flush();
    expect(session.get()!.version).toBe(initial.version + 1);
    expect(session.get()!.ai.lastBotOutcome?.outcome).toBe('model');
  });

  it('does not start a retry when the first response reaches the commit-reserve boundary', async () => {
    class BoundaryClock implements AiClock {
      value = 0; now() { return this.value; }
      async sleep(_ms: number, signal?: AbortSignal): Promise<void> {
        await new Promise<void>((_resolve, reject) => signal?.addEventListener('abort',
          () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
      }
    }
    const clock = new BoundaryClock();
    const calls: ProviderRequest[] = [];
    const provider: AiProvider = { generate: async request => {
      calls.push(request); clock.value = config.botTotalMs - config.botReserveMs;
      throw new Error('network boundary');
    } };
    const context = { gameId: '11111111-1111-4111-8111-111111111111',
      handId: '22222222-2222-4222-8222-222222222222', expectedVersion: 1,
      actorId: 'bot-1', decisionOrdinal: 1, phase: 'preflop', board: [], pots: [], players: [],
      holeCards: [], legalActions: [{ type: 'check' }], history: [] } as unknown as BotDecisionContext;
    const result = await coordinateBot(provider, config, context, new AbortController().signal,
      clock, { next: () => 0 });
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, failure: 'network_error' });
  });
});
