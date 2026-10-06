import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGeminiProvider } from '../../backend/src/ai/providers/gemini.js';
import type { AgentStepRequest } from '../../backend/src/ai/types.js';
import { GameSession } from '../../backend/src/session.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { registerRoutes } from '../../backend/src/routes.js';
import { CoachResponseSchema } from '../../shared/contracts.js';
import Fastify from 'fastify';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

const final = { kind: 'final', summary: 'S', recommendation: 'R', completed: true,
  confidence: 'low', evidence: [0] };
const request: AgentStepRequest = { purpose: 'coach', runId: 'run', model: 'test',
  stepOrdinal: 2, attemptOrdinal: 1, runAttemptOrdinal: 2, deadlineAt: 45000, remainingMs: 45000,
  responseSchema: {}, context: { goal: { focus: 'betting' }, availableDecisionCount: 1,
    sampleLimited: true, toolResult: { factsRevision: 34, focus: 'betting', sampleLimited: true,
      decisions: [{ decisionRef: 'h:1', facts: [{ factCode: 'phase', finding: '"flop"' }] }] } } };
const failures = [
  { text: '{bad private-model-output', issue: 'invalid_json' },
  { text: JSON.stringify({ ...final, evidence: [0, 0] }), issue: 'duplicate_evidence' },
  { text: JSON.stringify({ ...final, evidence: [9] }), issue: 'invalid_evidence_index' },
  { text: JSON.stringify({ ...final, evidence: ['0'] }), issue: 'invalid_evidence_index' },
  { text: JSON.stringify({ ...final, evidence: [] }), issue: 'missing_completion_evidence' },
  { text: JSON.stringify({ ...final, summary: 's'.repeat(1001) }), issue: 'summary_bounds' },
  { text: JSON.stringify({ ...final, recommendation: 'r'.repeat(501) }), issue: 'recommendation_bounds' },
  { text: JSON.stringify({ ...final, raw: 'private-model-output' }), issue: 'unexpected_fields' },
  { text: 'x'.repeat(32769), issue: 'output_too_large' },
];
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

describe('safe coach output diagnostics T034', () => {
  it.each([
    { patch: { reason: 'cannot_complete' }, issue: 'unexpected_fields' },
    { patch: { kind: 'review' }, issue: 'invalid_kind' },
    { patch: { confidence: 'moderate' }, issue: 'invalid_confidence' },
    { patch: { completed: 'true' }, issue: 'invalid_completion' },
    { patch: { summary: 123 }, issue: 'invalid_text_type' },
    { patch: { evidence: null }, issue: 'invalid_evidence_list' },
  ])('T035 identifies the failing transport contract $issue', async ({ patch, issue }) => {
    const provider = createGeminiProvider('offline-key', () => ({ models: { generateContent: vi.fn()
      .mockResolvedValue({ text: JSON.stringify({ ...final, ...patch }) }) } }));
    await expect(provider.generateAgent(request, new AbortController().signal))
      .rejects.toMatchObject({ kind: 'malformed', outputIssue: issue });
  });
  it.each(failures)('identifies $issue without storing the rejected output', async ({ text, issue }) => {
    const generateContent = vi.fn().mockResolvedValue({ text });
    const provider = createGeminiProvider('offline-key', () => ({ models: { generateContent } }));
    const error = await provider.generateAgent(request, new AbortController().signal).catch(error => error);
    expect(error).toMatchObject({ kind: 'malformed', outputIssue: issue, message: 'AI provider failure' });
    expect(JSON.stringify(error)).not.toContain('private-model-output');
    expect(JSON.stringify(error)).not.toContain('offline-key');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
  it('identifies a missing text output', async () => {
    const provider = createGeminiProvider('offline-key', () => ({ models: { generateContent: vi.fn().mockResolvedValue({}) } }));
    await expect(provider.generateAgent(request, new AbortController().signal))
      .rejects.toMatchObject({ kind: 'malformed', outputIssue: 'missing_output' });
  });
  it('describes runtime bounds and distinct selection in the provider schema', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify(final) });
    const provider = createGeminiProvider('offline-key', () => ({ models: { generateContent } }));
    await provider.generateAgent(request, new AbortController().signal);
    const branch = generateContent.mock.calls[0]![0].config.responseJsonSchema.oneOf[0];
    expect(branch.properties.summary.description).toContain('1000');
    expect(branch.properties.recommendation.description).toContain('500');
    expect(branch.properties.evidence.description).toContain('distinct');
  });
  it('exposes only a known diagnostic enum through the real session and GET route', async () => {
    const generateContent = vi.fn().mockResolvedValueOnce({ text: JSON.stringify({ kind: 'tool_request',
      name: 'get_decision_evidence', arguments: { focus: 'betting', limit: 10 } }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ...final, evidence: [0, 0] }) });
    const provider = createGeminiProvider('offline-key', () => ({ models: { generateContent } }));
    const session = new GameSession({ aiProvider: provider,
      aiConfig: loadAiConfig({ GEMINI_ENABLED: 'true', GEMINI_API_KEY: 'offline-key' }),
      deck: ['As', 'Kc', 'Ah', 'Kd', ...ac23Deck.slice(4)], deckRandom: sequenceRandom([]),
      botRandom: sequenceRandom(Array<number>(100).fill(0.9)) });
    let game = session.create(1);
    game = session.action({ gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, type: 'all_in' });
    const before = JSON.stringify(game);
    const app = Fastify({ logger: false }); registerRoutes(app, session); apps.push(app);
    const started = await app.inject({ method: 'POST', url: '/api/game/coach', payload: {
      gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version, goal: { focus: 'betting' } } });
    for (let i = 0; i < 100; i++) await Promise.resolve();
    const response = await app.inject(`/api/game/coach/${started.json().run.runId}`);
    expect(response.statusCode).toBe(200);
    const parsed = CoachResponseSchema.parse(response.json());
    expect(parsed.run).toMatchObject({ status: 'failed', failureCategory: 'invalid_structured_response',
      outputIssue: 'duplicate_evidence', stepCount: 2, providerAttemptCount: 2, toolCallCount: 1, result: null });
    expect(response.body).not.toContain('offline-key');
    expect(response.body).not.toContain('finding');
    expect(JSON.stringify(game)).toBe(before);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(CoachResponseSchema.safeParse({ run: { ...parsed.run, outputIssue: 'private-model-output' } }).success).toBe(false);
    expect(CoachResponseSchema.safeParse({ run: { ...parsed.run, failureCategory: 'evidence_rejected' } }).success).toBe(false);
  });
});
