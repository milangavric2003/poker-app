import { expect, it, vi } from 'vitest';
import { finishSecurityGame, pokerSnapshot, securityInputs, settleSecurityRun } from '../helpers/security-fixtures.js';
import { securityServer } from '../helpers/security-server.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';
import { legalBotProposal } from '../helpers/fake-ai-provider.js';
import { processCapacity } from '../../backend/src/security/capacity.js';
import { securityFixture } from '../helpers/security-fixtures.js';

async function flush() { for (let i = 0; i < 120; i++) await Promise.resolve(); }
function input(h: ReturnType<typeof securityServer>) {
  const game = h.session.get()!;
  return { gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: securityInputs.goal };
}
function observe(h: ReturnType<typeof securityServer>, counter: { active: number; max: number }) {
  const original = h.provider.generateAgent.bind(h.provider);
  vi.spyOn(h.provider, 'generateAgent').mockImplementation(async (...args) => {
    counter.active++; counter.max = Math.max(counter.max, counter.active);
    try { return await original(...args); } finally { counter.active--; }
  });
}
it('T13 actual overlap stays at two across concurrent sessions and cancelled runs until original settle', async () => {
  const hs = [securityServer(), securityServer(), securityServer()];
  const counter = { active: 0, max: 0 };
  try {
    for (const h of hs) { finishSecurityGame(h.session); observe(h, counter); h.provider.enqueue({ kind: 'pending', id: 'hold' }); }
    const responses = await Promise.all(hs.map(h => h.app.inject({ method: 'POST', url: '/api/game/coach', payload: input(h) })));
    await flush(); expect(responses.map(r => r.statusCode)).toEqual([202, 202, 429]);
    expect(responses[2]!.json().error.code).toBe('AI_CAPACITY_EXCEEDED');
    expect(responses[2]!.headers['retry-after']).toBeUndefined(); expect(counter).toEqual({ active: 2, max: 2 });
    hs[0]!.session.create(1); await flush(); expect(counter.active).toBe(2);
    const denied = await hs[2]!.app.inject({ method: 'POST', url: '/api/game/coach', payload: input(hs[2]!) });
    expect(denied.statusCode).toBe(429); expect(hs[2]!.provider.agentCalls).toHaveLength(0);
    hs[0]!.provider.reject('hold', new Error('late')); await flush(); expect(counter.active).toBe(1);
    const accepted = await hs[2]!.app.inject({ method: 'POST', url: '/api/game/coach', payload: input(hs[2]!) });
    expect(accepted.statusCode).toBe(202); await flush(); expect(counter).toEqual({ active: 2, max: 2 });
  } finally {
    for (const h of hs) { h.session.create(1); h.provider.reject('hold', new Error('cleanup')); }
    await flush(); await Promise.all(hs.map(h => h.app.close()));
  }
});
it('T13 mixed coach/analysis starts share five tokens, failures count, reset/new game do not reset sliding window', async () => {
  const h = securityServer();
  try {
    for (let i = 0; i < 5; i++) {
      finishSecurityGame(h.session); h.clock.advance(i === 0 ? 0 : 1000);
      const analysis = i % 2 === 1;
      h.provider.enqueue({ kind: analysis ? 'analysis_success' : 'auth_config' });
      const body = input(h); const identity = { gameId: body.gameId, handId: body.handId, expectedVersion: body.expectedVersion };
      const response = await h.app.inject({ method: 'POST', url: analysis ? '/api/game/analysis' : '/api/game/coach', payload: analysis ? identity : body });
      expect(response.statusCode).toBe(202); await flush();
    }
    processUsageStore.reset(processUsageStore.snapshot().revision);
    finishSecurityGame(h.session);
    const denied = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: input(h) });
    expect(denied.statusCode).toBe(429); expect(denied.json().error.code).toBe('AI_RATE_LIMITED');
    expect(denied.headers['retry-after']).toBe('56');
    h.clock.advance(55999);
    expect((await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: input(h) })).headers['retry-after']).toBe('1');
    h.clock.advance(1); h.provider.enqueue({ kind: 'agent_tool' }, { kind: 'agent_final' });
    const ok = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: input(h) });
    expect(ok.statusCode).toBe(202); expect((await settleSecurityRun(h.session, ok.json().run.runId)).status).toBe('completed');
    expect((await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: input(h) })).statusCode).toBe(429);
  } finally { await h.app.close(); }
});
it('T13 pending dedupe, conflicting goal and invalid input consume no new tokens', async () => {
  const h = securityServer([{ kind: 'pending', id: 'hold' }]);
  try {
    finishSecurityGame(h.session); const body = input(h);
    const first = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: body });
    for (let i = 0; i < 8; i++) {
      const same = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: body });
      expect(same.json().run.runId).toBe(first.json().run.runId);
      expect((await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: { ...body, goal: { focus: 'showdown' } } })).statusCode).toBe(409);
      expect((await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: { ...body, model: 'forged' } })).statusCode).toBe(400);
    }
    expect(h.provider.agentCalls).toHaveLength(1);
    h.provider.resolve('hold', { candidate: { kind: 'refusal', reason: 'insufficient_context' } }); await flush();
    for (let i = 0; i < 4; i++) {
      h.provider.enqueue({ kind: 'agent_refusal' });
      expect((await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: body })).statusCode).toBe(202); await flush();
    }
    expect((await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: body })).statusCode).toBe(429);
  } finally { h.session.create(1); h.provider.reject('hold', new Error('cleanup')); await h.app.close(); }
});
it('T13 analysis and bot share actual coaching capacity; bot fallback stays legal without a new provider job', async () => {
  const h = securityServer([{ kind: 'pending', id: 'coach' }, { kind: 'pending', id: 'analysis' }]);
  const bot = securityFixture();
  let active = 0; let maximum = 0;
  const agent = h.provider.generateAgent.bind(h.provider); const generate = h.provider.generate.bind(h.provider);
  const track = async <T,>(work: () => Promise<T>) => {
    active++; maximum = Math.max(maximum, active); try { return await work(); } finally { active--; }
  };
  vi.spyOn(h.provider, 'generateAgent').mockImplementation((...args) => track(() => agent(...args)));
  vi.spyOn(h.provider, 'generate').mockImplementation((...args) => track(() => generate(...args)));
  try {
    finishSecurityGame(h.session); const body = input(h);
    const identity = { gameId: body.gameId, handId: body.handId, expectedVersion: body.expectedVersion };
    expect((await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: body })).statusCode).toBe(202);
    expect((await h.app.inject({ method: 'POST', url: '/api/game/analysis', payload: identity })).statusCode).toBe(202);
    await flush(); expect({ active, maximum }).toEqual({ active: 2, maximum: 2 });
    const game = bot.session.create(1, true); const chips = game.hand.players.reduce((n, p) => n + p.stack + p.handContribution, 0);
    bot.session.action({ gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, type: 'call' });
    await flush(); expect(bot.provider.calls).toHaveLength(0);
    expect(bot.session.get()!.ai.lastBotOutcome).toMatchObject({ outcome: 'local_fallback', attemptCount: 0 });
    expect(bot.session.get()!.hand.players.reduce((n, p) => n + p.stack + p.handContribution, 0)).toBe(chips);
    expect(processCapacity.current.active).toBe(2);
    h.provider.resolve('analysis', { candidate: { summary: 'Pregled.', goodDecisions: [], possibleMistakes: [], nextSteps: ['Vežbaj.'] } });
    await flush(); expect(h.session.get()!.ai.analysis.status).toBe('completed'); expect(active).toBe(1);
    // Bot start consumes capacity but not the user rate window.
    for (let i = 0; i < 3; i++) {
      h.provider.enqueue({ kind: 'analysis_success' });
      expect((await h.app.inject({ method: 'POST', url: '/api/game/analysis', payload: identity })).statusCode).toBe(202); await flush();
    }
    expect((await h.app.inject({ method: 'POST', url: '/api/game/analysis', payload: identity })).json().error.code).toBe('AI_RATE_LIMITED');
    expect(maximum).toBe(2);
  } finally { h.session.create(1); h.provider.reject('coach', new Error('cleanup')); await flush(); await h.app.close(); }
});
it('T13 cancellation before dispatch frees only the unused reservation, without a provider call', async () => {
  const h = securityServer();
  try {
    finishSecurityGame(h.session);
    await h.session.serial(() => {
      h.session.startCoach(input(h)); expect(processCapacity.current.active).toBe(1);
      h.session.create(1);
    });
    await flush(); expect(h.provider.agentCalls).toHaveLength(0); expect(processCapacity.current.active).toBe(0);
  } finally { await h.app.close(); }
});
it('T12/T13 terminal timeouts retain both noncooperative attempts until their actual settle', async () => {
  const h = securityServer([{ kind: 'pending', id: 'a' }, { kind: 'pending', id: 'b' }]);
  const counter = { active: 0, max: 0 }; observe(h, counter);
  try {
    finishSecurityGame(h.session); const body = input(h);
    const first = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: body }); await flush();
    h.clock.advance(15000); await flush(); h.clock.advance(500); await flush(); h.clock.advance(15000); await flush();
    expect(h.session.coachStatus(first.json().run.runId)).toMatchObject({ status: 'failed', failureCategory: 'provider_timeout' });
    expect(counter).toEqual({ active: 2, max: 2 }); expect(processCapacity.current.active).toBe(2);
    const denied = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: body });
    expect(denied.json().error.code).toBe('AI_CAPACITY_EXCEEDED'); expect(h.provider.agentCalls).toHaveLength(2);
    h.provider.resolve('a', { candidate: { kind: 'refusal', reason: 'insufficient_context' } }); await flush();
    expect(counter.active).toBe(1); h.provider.enqueue({ kind: 'agent_tool' }, { kind: 'agent_final' });
    const accepted = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: body });
    expect(accepted.statusCode).toBe(202); expect((await settleSecurityRun(h.session, accepted.json().run.runId)).status).toBe('completed');
    h.provider.reject('b', new Error('late')); await flush(); expect(counter).toEqual({ active: 0, max: 2 });
    expect(processCapacity.current.active).toBe(0);
  } finally { h.session.create(1); h.provider.reject('a', new Error('cleanup')); h.provider.reject('b', new Error('cleanup')); await h.app.close(); }
});
it('T13 a running bot holds the same global capacity; denied analysis starts consume no user token', async () => {
  const h = securityServer([{ kind: 'pending', id: 'coach' }]);
  const bot = securityFixture([{ kind: 'pending', id: 'bot' }]); const counter = { active: 0, max: 0 };
  observe(h, counter);
  const original = bot.provider.generate.bind(bot.provider);
  vi.spyOn(bot.provider, 'generate').mockImplementation(async (...args) => {
    counter.active++; counter.max = Math.max(counter.max, counter.active);
    try { return await original(...args); } finally { counter.active--; }
  });
  try {
    const game = bot.session.create(1, true);
    bot.session.action({ gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, type: 'call' });
    await flush(); expect(bot.provider.calls).toHaveLength(1);
    finishSecurityGame(h.session); const body = input(h);
    const identity = { gameId: body.gameId, handId: body.handId, expectedVersion: body.expectedVersion };
    expect((await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: body })).statusCode).toBe(202); await flush();
    expect(counter).toEqual({ active: 2, max: 2 });
    for (let i = 0; i < 8; i++) {
      const rejected = await h.app.inject({ method: 'POST', url: '/api/game/analysis', payload: identity });
      expect(rejected.json().error.code).toBe('AI_CAPACITY_EXCEEDED');
    }
    expect(h.provider.calls).toHaveLength(0);
    bot.session.create(1); expect(counter.active).toBe(2);
    bot.provider.resolve('bot', legalBotProposal(bot.provider.calls[0]!.request.context as Parameters<typeof legalBotProposal>[0]));
    await flush(); expect(counter.active).toBe(1);
    for (let i = 0; i < 4; i++) {
      h.provider.enqueue({ kind: 'analysis_success' });
      expect((await h.app.inject({ method: 'POST', url: '/api/game/analysis', payload: identity })).statusCode).toBe(202); await flush();
    }
    expect((await h.app.inject({ method: 'POST', url: '/api/game/analysis', payload: identity })).json().error.code).toBe('AI_RATE_LIMITED');
    expect(counter.max).toBe(2);
  } finally {
    h.session.create(1); bot.session.create(1); h.provider.reject('coach', new Error('cleanup'));
    bot.provider.reject('bot', new Error('cleanup')); await flush(); await h.app.close();
  }
});

it('T13 initial: sixth new completed-run start within 60 seconds is rate limited', async () => {
  const h = securityServer();
  try {
    const game = finishSecurityGame(h.session);
    const before = pokerSnapshot(h.session);
    const ids = new Set<string>();
    const statuses: number[] = [];
    const errors: unknown[] = [];
    for (const at of securityInputs.burstTimes) {
      h.clock.advance(at - h.clock.now());
      h.provider.enqueue({ kind: 'agent_tool' }, { kind: 'agent_final' });
      const response = await h.app.inject({ method: 'POST', url: '/api/game/coach', payload: {
        gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: securityInputs.goal,
      } });
      statuses.push(response.statusCode);
      if (response.statusCode === 202) {
        const id = response.json().run.runId as string;
        expect(ids.has(id)).toBe(false); ids.add(id);
        expect((await settleSecurityRun(h.session, id)).status).toBe('completed');
      } else errors.push(response.json());
    }
    const actual = { times: securityInputs.burstTimes, statuses, accepted: ids.size,
      provider: h.provider.agentCalls.length, executions: h.executions.length, errors };
    console.log('T13 actual', JSON.stringify(actual));
    expect(pokerSnapshot(h.session)).toBe(before);
    expect(statuses.slice(0, 5)).toEqual([202, 202, 202, 202, 202]);
    expect(statuses[5]).toBe(429);
    expect(errors).toEqual([{ error: expect.objectContaining({ code: 'AI_RATE_LIMITED' }) }]);
    expect(ids.size).toBe(5);
    expect(h.provider.agentCalls).toHaveLength(10);
    expect(h.executions).toHaveLength(5);
  } finally { await h.app.close(); }
});
