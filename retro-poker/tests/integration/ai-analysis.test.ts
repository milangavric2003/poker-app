import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';
import { registerRoutes } from '../../backend/src/routes.js';
import { GameSession } from '../../backend/src/session.js';
import { toGameView } from '../../backend/src/view.js';
import type { ProviderResult } from '../../backend/src/ai/types.js';
import { FakeAiProvider, type FakeAiStep } from '../helpers/fake-ai-provider.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';
import { FakeClock } from '../helpers/fake-clock.js';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.close()));
  const snapshot = processUsageStore.snapshot();
  processUsageStore.reset(snapshot.revision);
});

function pokerSnapshot(game: ReturnType<typeof toGameView>) {
  return { result: structuredClone(game.result), version: game.version,
    stacks: game.players.map(player => ({ id: player.id, stack: player.stack })),
    events: structuredClone(game.events) };
}

function analysisResult(decisionRef: string, list: 'good' | 'mistake' = 'good'): ProviderResult {
  const item = { decisionRef, explanation: 'Procena koristi tada dostupne karte, stackove i legalne akcije.' };
  return { candidate: { summary: 'Strukturisana analiza zavrsene partije.',
    goodDecisions: list === 'good' ? [item] : [], possibleMistakes: list === 'mistake' ? [item] : [],
    nextSteps: ['Uporedi velicinu pota sa cenom odluke.'] } };
}

function terminalHarness(...steps: FakeAiStep[]) {
  const provider = new FakeAiProvider(steps);
  const clock = new FakeClock();
  // Human KK loses to bot AA on the fixed board, through real engine settlement.
  const session = new GameSession({ deck: ['As', 'Kc', 'Ah', 'Kd', ...ac23Deck.slice(4)], deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(100).fill(0.9)),
    aiProvider: provider, aiClock: clock, aiConfig: loadAiConfig({ GEMINI_API_KEY: 'offline-test-placeholder',
      GEMINI_BACKOFF_MIN_MS: '0', GEMINI_BACKOFF_MAX_MS: '0' }) });
  let state = session.create(1, false);
  state = session.action({ gameId: state.gameId, handId: state.hand.handId,
    expectedVersion: state.version, type: 'all_in' });
  if (!state.hand.result) throw new Error('Terminal fixture mora imati HandResult.');
  expect(state.hand.gameStatus).toBe('lost');
  expect(state.hand.result.gameStatus).toBe('lost');
  const app = Fastify();
  registerRoutes(app, session);
  apps.push(app);
  return { app, session, provider, clock, decisionRef: state.facts.decisions[0]!.decisionRef };
}

async function postAnalysis(app: FastifyInstance, suppliedGame?: ReturnType<typeof toGameView>) {
  const game = suppliedGame ?? (await app.inject('/api/game')).json().game;
  return app.inject({ method: 'POST', url: '/api/game/analysis',
    headers: { 'content-type': 'application/json' }, payload: {
      gameId: game.gameId, handId: game.handId, expectedVersion: game.version,
    } });
}

async function waitForAnalysis(app: FastifyInstance, status: 'completed' | 'failed') {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const game = (await app.inject('/api/game')).json().game;
    if (game.ai.analysis.status === status) return game;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error(`Analysis nije dostigla status ${status}.`);
}

describe('analysis route read-only boundary (FR-016–FR-019, AIAC10–AIAC11)', () => {
  it('rejects a nonterminal game and keeps poker state deeply equal', async () => {
    const provider = new FakeAiProvider();
    const session = new GameSession({ deck: ac23Deck, deckRandom: sequenceRandom([]),
      botRandom: sequenceRandom(Array<number>(100).fill(0.9)),
      aiProvider: provider, aiConfig: loadAiConfig({ GEMINI_API_KEY: 'offline-test-placeholder' }) });
    session.create(1, false);
    const app = Fastify(); registerRoutes(app, session); apps.push(app);
    const before = toGameView(session.get()!);
    const response = await postAnalysis(app, before);
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ANALYSIS_NOT_ALLOWED');
    expect(pokerSnapshot(toGameView(session.get()!))).toEqual(pokerSnapshot(before));
    expect(provider.callCount).toBe(0);
  });

  it('returns terminal-only 202 and completes a strict, locally-disclaimed, read-only analysis', async () => {
    const harness = terminalHarness();
    harness.provider.enqueue(analysisResult(harness.decisionRef));
    const before = toGameView(harness.session.get()!);
    const accepted = await postAnalysis(harness.app, before);
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json().game.ai.analysis.status).toBe('generating');
    const after = await waitForAnalysis(harness.app, 'completed');
    expect(after.ai.analysis.result).toEqual({
      summary: 'Strukturisana analiza zavrsene partije.',
      goodDecisions: [{ decisionRef: harness.decisionRef,
        explanation: 'Procena koristi tada dostupne karte, stackove i legalne akcije.' }],
      possibleMistakes: [], nextSteps: ['Uporedi velicinu pota sa cenom odluke.'],
      disclaimer: 'AI analiza je obrazovna pomoć, ne garantovano optimalna strategija.',
    });
    expect(pokerSnapshot(after)).toEqual(pokerSnapshot(before));
  });

  it.each(['good', 'mistake'] as const)('rejects unknown decisionRef in %s twice and never publishes a fake analysis', async list => {
    const invalid = analysisResult('unknown-decision', list);
    const harness = terminalHarness(invalid, invalid);
    const before = toGameView(harness.session.get()!);
    expect((await postAnalysis(harness.app, before)).statusCode).toBe(202);
    const after = await waitForAnalysis(harness.app, 'failed');
    expect(after.ai.analysis.result).toBeNull();
    expect(harness.provider.callCount).toBe(2);
    expect(pokerSnapshot(after)).toEqual(pokerSnapshot(before));
  });

  it('does not treat a bad result as sole evidence that the recorded decision was bad', async () => {
    const harness = terminalHarness();
    harness.provider.enqueue(analysisResult(harness.decisionRef, 'good'));
    const before = toGameView(harness.session.get()!);
    expect(before.status).toBe('lost');
    expect((await postAnalysis(harness.app, before)).statusCode).toBe(202);
    const after = await waitForAnalysis(harness.app, 'completed');
    expect(after.ai.analysis.result.goodDecisions[0].decisionRef).toBe(harness.decisionRef);
    const sentDecision = (harness.provider.calls[0]!.context as { decisions: Array<Record<string, unknown>> }).decisions[0]!;
    expect(sentDecision).toEqual(expect.objectContaining({ decisionRef: harness.decisionRef,
      knowledge: expect.objectContaining({ phase: 'preflop', board: [], holeCards: ['Kc', 'Kd'],
        humanStackAtHandStart: 1000, legalActions: expect.arrayContaining([expect.objectContaining({ type: 'all_in' })]) }),
      chosenAction: { type: 'all_in' },
      outcome: { reason: 'showdown', gameStatus: 'lost', humanNetChange: -1000 } }));
    expect(pokerSnapshot(after)).toEqual(pokerSnapshot(before));
  });

  it.each([
    ['timeout', { kind: 'timeout_error' } as const, { kind: 'timeout_error' } as const],
    ['malformed', { kind: 'malformed' } as const, { kind: 'malformed' } as const],
    ['5xx', { kind: '5xx' } as const, { kind: '5xx' } as const],
  ])('ends immediate %s errors as failed and preserves poker state', async (_name, first, second) => {
    const harness = terminalHarness(first, second);
    const before = toGameView(harness.session.get()!);
    expect((await postAnalysis(harness.app, before)).statusCode).toBe(202);
    const after = await waitForAnalysis(harness.app, 'failed');
    expect(after.ai.analysis.result).toBeNull();
    expect(harness.provider.callCount).toBe(2);
    expect(pokerSnapshot(after)).toEqual(pokerSnapshot(before));
  });

  it('bounds genuinely hanging provider attempts by the 30 second interaction budget', async () => {
    const harness = terminalHarness({ kind: 'timeout' }, { kind: 'timeout' });
    const before = pokerSnapshot(toGameView(harness.session.get()!));
    expect((await postAnalysis(harness.app)).statusCode).toBe(202);
    for (let elapsed = 0; elapsed < 30000; elapsed += 250) {
      harness.clock.advance(250);
      await harness.app.inject('/api/game');
      expect(pokerSnapshot(toGameView(harness.session.get()!))).toEqual(before);
      if (harness.session.get()!.ai.analysis.status === 'failed') break;
    }
    const after = (await harness.app.inject('/api/game')).json().game;
    expect(after.ai.analysis.status).toBe('failed');
    expect(after.ai.analysis.result).toBeNull();
    expect(harness.provider.callCount).toBe(2);
    expect(harness.clock.now()).toBeLessThanOrEqual(30000);
  });

  it.each(['unexpected', 'disclaimer'])('rejects provider-supplied %s fields in strict analysis', async field => {
    const harness = terminalHarness();
    const valid = analysisResult(harness.decisionRef);
    const invalid = { ...valid, candidate: { ...valid.candidate as object, [field]: 'untrusted' } };
    harness.provider.enqueue(invalid);
    harness.provider.enqueue(invalid);
    const before = pokerSnapshot(toGameView(harness.session.get()!));
    expect((await postAnalysis(harness.app)).statusCode).toBe(202);
    const after = await waitForAnalysis(harness.app, 'failed');
    expect(after.ai.analysis.result).toBeNull();
    expect(harness.provider.callCount).toBe(2);
    expect(pokerSnapshot(after)).toEqual(before);
  });

  it('rejects a duplicate request while one interaction is pending', async () => {
    const harness = terminalHarness({ kind: 'pending', id: 'analysis-pending' });
    const before = toGameView(harness.session.get()!);
    const first = await postAnalysis(harness.app, before);
    const duplicate = await postAnalysis(harness.app, before);
    expect(first.statusCode).toBe(202);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('AI_ALREADY_PENDING');
    harness.provider.resolve('analysis-pending', analysisResult(harness.decisionRef));
    const after = await waitForAnalysis(harness.app, 'completed');
    expect(harness.provider.callCount).toBe(1);
    expect(pokerSnapshot(after)).toEqual(pokerSnapshot(before));
  });

  it('starts manual retry as a new logical interaction after terminal failure', async () => {
    const harness = terminalHarness({ kind: 'safety_refusal' });
    const before = toGameView(harness.session.get()!);
    expect((await postAnalysis(harness.app, before)).statusCode).toBe(202);
    const failed = await waitForAnalysis(harness.app, 'failed');
    const failedId = failed.ai.analysis.interactionId;
    harness.provider.enqueue(analysisResult(harness.decisionRef));
    const retried = await postAnalysis(harness.app, failed);
    expect(retried.statusCode).toBe(202);
    expect(retried.json().game.ai.analysis.interactionId).not.toBe(failedId);
    const after = await waitForAnalysis(harness.app, 'completed');
    expect(after.ai.analysis.interactionId).not.toBe(failedId);
    expect(harness.provider.callCount).toBe(2);
    expect(pokerSnapshot(after)).toEqual(pokerSnapshot(before));
  });
  it('regenerates a completed match with a new identity and exactly one logical request per action', async () => {
    const harness = terminalHarness();
    const before = toGameView(harness.session.get()!);
    harness.provider.enqueue(analysisResult(harness.decisionRef));
    expect((await postAnalysis(harness.app, before)).statusCode).toBe(202);
    const first = await waitForAnalysis(harness.app, 'completed');
    const secondResult = analysisResult(harness.decisionRef);
    secondResult.candidate = { ...secondResult.candidate as object, summary: 'Druga analiza iste partije.' };
    harness.provider.enqueue(secondResult);
    const secondStart = await postAnalysis(harness.app, first);
    expect(secondStart.statusCode).toBe(202);
    expect(secondStart.json().game.ai.analysis.interactionId).not.toBe(first.ai.analysis.interactionId);
    const second = await waitForAnalysis(harness.app, 'completed');
    expect(second.ai.analysis.result.summary).toBe('Druga analiza iste partije.');
    expect(harness.provider.callCount).toBe(2);
    expect(processUsageStore.snapshot().logical.filter(row => row.purpose === 'analysis')
      .reduce((sum, row) => sum + row.count, 0)).toBe(2);
    const recorded = processUsageStore.snapshot();
    expect(recorded.attempts.reduce((sum, row) => sum + row.count, 0)).toBe(2);
    expect(recorded.coach.runCount).toBe(0);
    expect(recorded.attempts[0]!.usage.totalTokens).toEqual({ knownCount: 0, missingCount: 2, sum: 0 });
    for (let i = 0; i < 3; i++) {
      expect((await harness.app.inject('/api/ai/usage')).json().usage).toEqual(recorded);
      await harness.app.inject('/api/game');
    }
    expect(processUsageStore.snapshot()).toEqual(recorded);
    expect(pokerSnapshot(second)).toEqual(pokerSnapshot(before));
  });

  it('usage reset rejects late summary metrics but allows a new explicit generation', async () => {
    const harness = terminalHarness({ kind: 'pending', id: 'reset-summary' });
    await postAnalysis(harness.app);
    const revision = processUsageStore.snapshot().revision;
    expect((await harness.app.inject({ method: 'POST', url: '/api/ai/usage/reset',
      payload: { expectedRevision: revision } })).statusCode).toBe(200);
    harness.provider.resolve('reset-summary', analysisResult(harness.decisionRef));
    const completed = await waitForAnalysis(harness.app, 'completed');
    expect(processUsageStore.snapshot().logical).toEqual([]);
    expect(processUsageStore.snapshot().attempts).toEqual([]);
    harness.provider.enqueue(analysisResult(harness.decisionRef));
    await postAnalysis(harness.app, completed); await waitForAnalysis(harness.app, 'completed');
    expect(processUsageStore.snapshot().logical).toMatchObject([{ purpose: 'analysis', count: 1 }]);
    expect(processUsageStore.snapshot().attempts).toMatchObject([{ purpose: 'analysis', count: 1 }]);
  });

  it('replacement aborts analysis and its late callback cannot publish an old result', async () => {
    const harness = terminalHarness({ kind: 'pending', id: 'old-analysis' });
    await postAnalysis(harness.app);
    const signal = harness.provider.calls[0]!.signal;
    harness.session.create(1, false);
    const replacement = toGameView(harness.session.get()!);
    expect(signal.aborted).toBe(true);
    harness.provider.resolve('old-analysis', analysisResult(harness.decisionRef));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(toGameView(harness.session.get()!)).toEqual(replacement);
  });
  it('ignores a timed-out provider response after a newer analysis has completed', async () => {
    const harness = terminalHarness({ kind: 'pending', id: 'late-analysis' }, { kind: 'safety_refusal' });
    const before = pokerSnapshot(toGameView(harness.session.get()!));
    await postAnalysis(harness.app);
    for (let elapsed = 0; elapsed < 30000 && harness.session.get()!.ai.analysis.status === 'generating'; elapsed += 250) {
      harness.clock.advance(250);
      await harness.app.inject('/api/game');
    }
    const failed = await waitForAnalysis(harness.app, 'failed');
    expect(harness.provider.calls[0]!.signal.aborted).toBe(true);
    const fresh = analysisResult(harness.decisionRef);
    fresh.candidate = { ...fresh.candidate as object, summary: 'Aktuelni pregled.' };
    harness.provider.enqueue(fresh);
    await postAnalysis(harness.app, failed);
    const latest = await waitForAnalysis(harness.app, 'completed');
    harness.provider.resolve('late-analysis', analysisResult(harness.decisionRef));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(toGameView(harness.session.get()!).ai.analysis).toEqual(latest.ai.analysis);
    expect(latest.ai.analysis.result.summary).toBe('Aktuelni pregled.');
    expect(pokerSnapshot(toGameView(harness.session.get()!))).toEqual(before);
    expect(processUsageStore.snapshot().logical.filter(row => row.purpose === 'analysis')
      .reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });
});
