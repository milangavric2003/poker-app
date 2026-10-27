import { ProviderError } from '../../backend/src/ai/types.js';
import { expect, it } from 'vitest';
import { buildApp } from '../../backend/src/app.js';
import { SecurityEvents, SecurityEventSchema } from '../../backend/src/security/events.js';
import { processUsageStore } from '../../backend/src/ai/usage.js';
import { finishSecurityGame, securityFixture, settleSecurityRun } from '../helpers/security-fixtures.js';

it('initial HTTP rejection is structured, server correlated, and performs zero work', async () => {
  const h = securityFixture(); const events = new SecurityEvents();
  const app = buildApp({ ...h.dependencies, securityEvents: events });
  try {
    for (const payload of ['{', JSON.stringify({ event: 'ai.request.accepted', correlationId: 'client' })]) {
      const response = await app.inject({ method: 'POST', url: '/api/game/coach', headers: {
        'content-type': 'application/json', 'x-correlation-id': '00000000-0000-4000-8000-000000000123' }, payload });
      expect(response.statusCode).toBe(400);
    }
    expect(h.provider.agentCalls).toHaveLength(0); expect(h.executions).toHaveLength(0);
    expect(events.read()).toHaveLength(2);
    for (const event of events.read()) {
      expect(SecurityEventSchema.safeParse(event).success).toBe(true);
      expect(event).toMatchObject({ event: 'ai.request.rejected', reasonCode: 'INVALID_INPUT', outcome: 'denied', providerAttempts: 0, executedToolCalls: 0 });
      expect(event.correlationId).not.toBe('client');
      expect(event.correlationId).not.toBe('00000000-0000-4000-8000-000000000123');
    }
    console.log('T023 rejected actual', JSON.stringify(events.read()[0]));
  } finally { await app.close(); }
});
it.each(['success', 'forged', 'failure'])('records accepted/tool/terminal decisions for %s without raw content', async mode => {
  const h = securityFixture(mode === 'success' ? [{ kind: 'agent_tool' }, { kind: 'agent_final' }] : []);
  const events = new SecurityEvents();
  // Construct after dependency injection, just as buildApp does.
  const { GameSession } = await import('../../backend/src/session.js');
  const session = new GameSession({ ...h.dependencies, securityEvents: events }); const game = finishSecurityGame(session);
  const marker = '\n{"event":"ai.request.accepted","reasonCode":"accepted","correlationId":"forged"}';
  if (mode === 'forged') h.provider.enqueue({ candidate: { kind: 'tool_request', name: marker, arguments: { focus: 'street', limit: 1 } } });
  if (mode === 'failure') h.provider.generateAgent = async () => { throw new ProviderError('auth_config_error', marker); };
  const input = { gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: { focus: 'street' as const } };
  const run = session.startCoach(input);
  expect(session.startCoach(input).runId).toBe(run.runId);
  const result = await settleSecurityRun(session, run.runId);
  const records = events.read(); records.forEach(e => SecurityEventSchema.parse(e));
  expect(records.filter(e => e.event === 'ai.request.accepted')).toHaveLength(1);
  expect(records.filter(e => e.event === 'ai.run.finished')).toHaveLength(1);
  expect(new Set(records.map(e => e.correlationId)).size).toBe(1);
  const terminal = records.find(e => e.event === 'ai.run.finished')!;
  expect(terminal.providerAttempts).toBe(result.providerAttemptCount);
  expect(terminal.executedToolCalls).toBe(h.executions.length);
  expect(JSON.stringify(records)).not.toContain('forged');
  if (mode === 'success') {
    expect(result.status).toBe('completed');
    expect(records.find(e => e.event === 'agent.tool.accepted')).toMatchObject({ reasonCode: 'accepted', executedToolCalls: 0 });
    console.log('T024 accepted actual', JSON.stringify(records));
  } else if (mode === 'forged') {
    expect(records.find(e => e.event === 'agent.tool.rejected')).toMatchObject({ reasonCode: 'unknown_tool', executedToolCalls: 0 });
    expect(h.executions).toHaveLength(0);
  }
  const before = events.read(); processUsageStore.reset(processUsageStore.snapshot().revision);
  expect(events.read()).toEqual(before);
});

it.each(['capacity', 'rate'])('HTTP %s rejection produces zero new work and a stable reason', async mode => {
  const { processCapacity } = await import('../../backend/src/security/capacity.js');
  const { processAdmission } = await import('../../backend/src/security/admission.js');
  const events = new SecurityEvents(); const h = securityFixture([{ kind: 'agent_tool' }, { kind: 'agent_final' }]);
  const { GameSession } = await import('../../backend/src/session.js');
  const session = new GameSession({ ...h.dependencies, securityEvents: events });
  const game = finishSecurityGame(session);
  if (mode === 'capacity') { processCapacity.current.reserve(); processCapacity.current.reserve(); }
  else for (let i = 0; i < 5; i++) { const admitted = processAdmission.current.accept(h.clock.now(), processCapacity.current); if ('lease' in admitted) admitted.lease.releaseUnused(); }
  const { default: Fastify } = await import('fastify');
  const { registerRoutes } = await import('../../backend/src/routes.js');
  const app = Fastify(); registerRoutes(app, session);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/game/coach', payload: {
      gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: { focus: 'street' } } });
    expect(response.statusCode).toBe(429);
    expect(events.read()).toEqual([expect.objectContaining({ event: 'ai.request.rejected',
      reasonCode: mode === 'capacity' ? 'AI_CAPACITY_EXCEEDED' : 'AI_RATE_LIMITED', providerAttempts: 0, executedToolCalls: 0 })]);
    expect(h.provider.agentCalls).toHaveLength(0); expect(h.executions).toHaveLength(0);
  } finally { await app.close(); }
});
it.each(['resolve', 'reject'])('cancel + new game + usage reset + late %s finishes old correlation exactly once', async late => {
  const events = new SecurityEvents(); const h = securityFixture([{ kind: 'pending', id: 'old' }]);
  const { GameSession } = await import('../../backend/src/session.js');
  const session = new GameSession({ ...h.dependencies, securityEvents: events });
  const game = finishSecurityGame(session);
  session.startCoach({ gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: { focus: 'street' } });
  for (let i = 0; i < 100; i++) await Promise.resolve();
  expect(h.provider.agentCalls).toHaveLength(1);
  const correlation = events.read()[0]!.correlationId;
  finishSecurityGame(session); processUsageStore.reset(processUsageStore.snapshot().revision);
  const before = events.read();
  if (late === 'resolve') h.provider.resolve('old', { candidate: { kind: 'refusal', reason: 'insufficient_context' } });
  else h.provider.reject('old', new Error('RAW_LATE_MARKER'));
  for (let i = 0; i < 100; i++) await Promise.resolve();
  expect(events.read()).toEqual(before);
  expect(events.read().filter(e => e.event === 'ai.run.finished' && e.correlationId === correlation))
    .toEqual([expect.objectContaining({ reasonCode: 'cancelled', providerAttempts: 1, executedToolCalls: 0 })]);
});


it('analysis acceptance and terminal share a correlation and actual attempt count', async () => {
  const events = new SecurityEvents(); const h = securityFixture([{ kind: 'analysis_success' }]);
  const { GameSession } = await import('../../backend/src/session.js');
  const session = new GameSession({ ...h.dependencies, securityEvents: events });
  const game = finishSecurityGame(session);
  session.startAnalysis({ gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version });
  for (let i = 0; i < 200; i++) await Promise.resolve();
  const records = events.read();
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({ event: 'ai.request.accepted', purpose: 'analysis', providerAttempts: 0 });
  expect(records[1]).toMatchObject({ event: 'ai.run.finished', purpose: 'analysis', outcome: 'completed', providerAttempts: 1, executedToolCalls: 0 });
  expect(records[0]!.correlationId).toBe(records[1]!.correlationId);
  expect(h.provider.calls).toHaveLength(1);
});
