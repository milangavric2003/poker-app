import { describe, expect, it, vi } from 'vitest';
import { createGeminiProvider, type GeminiClient } from '../../backend/src/ai/providers/gemini.js';
import type { AgentStepRequest } from '../../backend/src/ai/types.js';
const request: AgentStepRequest = { purpose: 'coach', runId: 'run', stepOrdinal: 1, attemptOrdinal: 1,
  runAttemptOrdinal: 1, model: 'test', deadlineAt: 45000, remainingMs: 45000,
  context: { goal: { focus: 'street' }, availableDecisionCount: 1, sampleLimited: false },
  responseSchema: { type: 'object' } };
const tool = { kind: 'tool_request', name: 'get_decision_evidence', arguments: { focus: 'street', limit: 10 } };
const final = { kind: 'final', summary: 'S', recommendation: 'R', confidence: 'low', completed: true,
  evidence: [{ decisionRef: 'h:1', factCode: 'phase', finding: '"flop"' }] };
function setup(response: unknown, error = false) {
  const generate = error ? vi.fn().mockRejectedValue(response) : vi.fn().mockResolvedValue(response);
  const client: GeminiClient = { models: { generateContent: generate } };
  const provider = createGeminiProvider('offline-secret', () => client);
  expect(provider.generateAgent, 'Missing Gemini agent adapter behavior').toBeTypeOf('function');
  return { provider, generate };
}
describe('offline Gemini coach adapter', () => {
  it.each([tool, final, { kind: 'refusal', reason: 'insufficient_context' }])('maps structured %j', async candidate => {
    const { provider, generate } = setup({ text: JSON.stringify(candidate), usageMetadata: { totalTokenCount: 7 } });
    const signal = new AbortController().signal;
    expect(await provider.generateAgent(request, signal)).toMatchObject({ candidate, usage: { totalTokens: 7 } });
    const call = generate.mock.calls[0]![0];
    expect(JSON.parse(call.contents[0].parts[0].text)).toEqual(request.context);
    expect(call.config).toMatchObject({ abortSignal: signal, responseMimeType: 'application/json',
      httpOptions: { retryOptions: { attempts: 1 } } });
    expect(call.config.systemInstruction).toContain('data');
    expect(JSON.stringify(call)).not.toContain('offline-secret');
  });
  it.each(['{bad', '{}', JSON.stringify({ kind: 'unsupported' }), JSON.stringify({ ...tool, raw: 'secret' }),
    'x'.repeat(32769)])('rejects malformed/schema/unsupported output', async text => {
    const { provider } = setup({ text });
    await expect(provider.generateAgent(request, new AbortController().signal)).rejects.toMatchObject({ kind: 'malformed' });
  });
  it('classifies safety', async () => {
    const { provider } = setup({ promptFeedback: { blockReason: 'SAFETY' } });
    await expect(provider.generateAgent(request, new AbortController().signal)).rejects.toMatchObject({ kind: 'safety_refusal' });
  });
  it.each([[408, 'timeout'], [429, 'rate_limited'], [503, 'server_error'], [401, 'auth_config_error'],
    [403, 'auth_config_error'], [400, 'invalid_request']])('classifies HTTP %s', async (status, kind) => {
    const { provider } = setup({ status, message: 'private raw response' }, true);
    await expect(provider.generateAgent(request, new AbortController().signal)).rejects.toMatchObject({ kind, message: 'AI provider failure' });
  });
  it('classifies transport and honors pre-abort without a call', async () => {
    const { provider, generate } = setup(new Error('private transport'), true);
    await expect(provider.generateAgent(request, new AbortController().signal)).rejects.toMatchObject({ kind: 'network_error' });
    const controller = new AbortController(); controller.abort();
    await expect(provider.generateAgent(request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
