import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../backend/src/app.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import type { AiProvider, BotDecisionContext, ProviderRequest, ProviderResult } from '../../backend/src/ai/types.js';
import { GameResponseSchema, type GameView } from '../../shared/contracts.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';
import { FakeAiProvider, legalBotProposal } from '../helpers/fake-ai-provider.js';
import type { Card } from '../../backend/src/engine/types.js';

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

class LegalProvider implements AiProvider {
  readonly calls: ProviderRequest[] = [];
  async generate(request: ProviderRequest, _signal: AbortSignal): Promise<ProviderResult> {
    this.calls.push(structuredClone(request));
    return legalBotProposal(request.context as BotDecisionContext);
  }
}

function makeApp(provider?: AiProvider, configured = true, deck: readonly Card[] = ac23Deck) {
  const value = buildApp({ deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(200).fill(0.9)),
    ...(provider ? { aiProvider: provider } : {}),
    aiConfig: loadAiConfig(configured ? { GEMINI_API_KEY: 'offline-test-placeholder' } : {}) });
  apps.push(value);
  return value;
}

async function create(app: FastifyInstance, botCount: number, aiMode: boolean) {
  const response = await app.inject({ method: 'POST', url: '/api/game',
    headers: { 'if-none-match': '*', 'content-type': 'application/json' }, payload: { botCount, aiMode } });
  expect(response.statusCode).toBe(201);
  return GameResponseSchema.parse(response.json()).game!;
}

async function waitUntil(app: FastifyInstance, predicate: (game: GameView) => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const game = GameResponseSchema.parse((await app.inject('/api/game')).json()).game!;
    if (predicate(game)) return game;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  throw new Error('AI bot commit nije zavrsen u predvidjenom roku.');
}

describe('AI bot mode public integration seam (FR-001, AIAC01, AIAC09)', () => {
  it('završava AI bot obračun sledeće ruke posle eliminacije', async () => {
    let firstHandId: string | undefined;
    const actors: Array<{ handId: string; actorId: string }> = [];
    const provider: AiProvider = {
      async generate(request) {
        const context = request.context as BotDecisionContext;
        firstHandId ??= context.handId;
        actors.push({ handId: context.handId, actorId: context.actorId });
        const type = context.handId === firstHandId && context.actorId !== 'player-1'
          ? 'fold' : context.legalActions.some(action => action.type === 'check') ? 'check' : 'call';
        return legalBotProposal({ ...context, legalActions: [{ type }] });
      },
    };
    const app = makeApp(provider, true, ['Ks', 'Qs', 'Js', 'As', 'Kd', 'Qd', 'Jd', 'Ad',
      '6c', '2c', '3d', '7h', '8c', '9s', 'Tc', '4c']);
    const ready = (game: GameView) => game.phase === 'complete'
      || (game.actorId === 'player-0' && game.ai.active === null);
    await create(app, 3, true);
    let game = await waitUntil(app, ready);
    const send = async (url: string, type?: 'all_in' | 'fold') => {
      const response = await app.inject({ method: 'POST', url, payload: {
        gameId: game.gameId, handId: game.handId, expectedVersion: game.version,
        ...(type ? { type } : {}),
      } });
      expect(response.statusCode).toBe(200);
      return waitUntil(app, ready);
    };
    game = await send('/api/game/actions', 'all_in');
    expect(game.players.map(p => p.stack)).toEqual([2010, 0, 990, 1000]);
    game = await send('/api/game/next-hand');
    game = await send('/api/game/actions', 'fold');
    expect(game.result?.reason).toBe('showdown');
    expect(game.players.reduce((sum, p) => sum + p.stack, 0)).toBe(4000);
    expect(game.players[1]).toMatchObject({ stack: 0, status: 'eliminated', cards: null });
    expect(game.ai.active).toBeNull();
    expect(game.ai.lastBotOutcome?.outcome).toBe('model');
    expect(actors.filter(a => a.handId === game.handId).map(a => a.actorId)).not.toContain('player-1');
  });

  const expected = {
    1: { calls: 2, actions: ['check', 'check'], stacks: [990, 990], eventCount: 7 },
    2: { calls: 3, actions: ['fold', 'check', 'check'], stacks: [990, 995, 990], eventCount: 8 },
    3: { calls: 1, actions: ['fold'], stacks: [1000, 995, 990, 1000], eventCount: 4 },
    4: { calls: 2, actions: ['fold', 'fold'], stacks: [1000, 995, 990, 1000, 1000], eventCount: 5 },
    5: { calls: 3, actions: ['fold', 'fold', 'fold'], stacks: [1000, 995, 990, 1000, 1000, 1000], eventCount: 6 },
  } as const;

  it.each([1, 2, 3, 4, 5])('commits legal fake decisions through the engine for botCount=%i', async botCount => {
    const provider = new LegalProvider();
    const app = makeApp(provider);
    let before = await create(app, botCount, true);

    const human = before.players.find(player => player.kind === 'human');
    if (provider.calls.length === 0 && before.actorId === human?.id) {
      const action = before.legalActions.find(item => item.type === 'call') ?? before.legalActions[0]!;
      const response = await app.inject({ method: 'POST', url: '/api/game/actions',
        headers: { 'content-type': 'application/json' }, payload: {
          gameId: before.gameId, handId: before.handId, expectedVersion: before.version,
          type: action.type, ...((action.type === 'bet' || action.type === 'raise')
            ? { amountTo: action.minAmountTo } : {}),
        } });
      expect(response.statusCode).toBe(200);
      before = GameResponseSchema.parse(response.json()).game!;
    }

    const initialVersion = before.version;
    const initialActions = before.events.filter(event => event.type === 'action').length;
    const settled = await waitUntil(app, game => game.ai.lastBotOutcome?.outcome === 'model');
    const committedActions = settled.events.filter(event => event.type === 'action').slice(initialActions);
    const oracle = expected[botCount as keyof typeof expected];

    expect(provider.calls).toHaveLength(oracle.calls);
    expect(settled.version - initialVersion).toBe(oracle.calls);
    expect(committedActions.map(event => event.actionType)).toEqual(oracle.actions);
    expect(settled.players.map(player => player.stack)).toEqual(oracle.stacks);
    expect(settled.events).toHaveLength(oracle.eventCount);
    expect(settled.ai.lastBotOutcome).toMatchObject({ outcome: 'model', attemptCount: 1 });
    expect(settled.players.reduce((sum, player) => sum + player.stack, 0) + settled.totalPot)
      .toBe(1000 * (botCount + 1));
  });

  it('AI mode off makes exactly zero provider calls and keeps the deterministic local path', async () => {
    const provider = new FakeAiProvider();
    const game = await create(makeApp(provider), 3, false);
    expect(provider.callCount).toBe(0);
    expect(game.ai).toMatchObject({ mode: 'off', active: null });
  });

  it('missing key makes exactly zero provider calls and uses local fallback', async () => {
    const provider = new FakeAiProvider();
    const game = await create(makeApp(provider, false), 3, true);
    expect(provider.callCount).toBe(0);
    expect(game.ai).toMatchObject({ mode: 'on', availability: 'unavailable', active: null });
    expect(game.ai.lastBotOutcome?.outcome).toBe('local_fallback');
  });
});
