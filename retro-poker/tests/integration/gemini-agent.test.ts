import { describe, expect, it, vi } from 'vitest';
import { createGeminiProvider, type GeminiClient } from '../../backend/src/ai/providers/gemini.js';
import type { AgentStepRequest } from '../../backend/src/ai/types.js';
import { validateFinalOutput } from '../../backend/src/agent/validation.js';
import type { DecisionEvidenceResult } from '../../shared/contracts.js';
import { agentResponseJsonSchema } from '../../backend/src/agent/types.js';
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

const toolResult: DecisionEvidenceResult = { factsRevision: 20, focus: 'street', sampleLimited: true,
  decisions: [
    { decisionRef: 'hand-a:1', facts: [{ factCode: 'phase', finding: '"flop"' },
      { factCode: 'action', finding: '{"type":"raise","amountTo":120}' }] },
    { decisionRef: 'hand-b:2', facts: [{ factCode: 'phase', finding: '"turn"' }] },
  ] };
const secondRequest: AgentStepRequest = { ...request, stepOrdinal: 2, runAttemptOrdinal: 2,
  context: { ...request.context, toolResult } };
const selectedFinal = { ...final, evidence: [2, 1, 0] };

describe('canonical Gemini evidence selection T033', () => {
  it('T035 sends provider-supported enum discriminants at both stages without mutating the neutral schema', async () => {
    const { provider, generate } = setup({ text: JSON.stringify(tool) });
    const original = structuredClone(agentResponseJsonSchema);
    await provider.generateAgent({ ...request, responseSchema: agentResponseJsonSchema }, new AbortController().signal);
    const first = generate.mock.calls[0]![0].config.responseJsonSchema;
    expect(first.oneOf[0].properties.kind).toMatchObject({ type: 'string', enum: ['tool_request'] });
    expect(first.oneOf[0].properties.kind).not.toHaveProperty('const');
    expect(agentResponseJsonSchema).toEqual(original);
    const second = setup({ text: JSON.stringify(selectedFinal) });
    await second.provider.generateAgent(secondRequest, new AbortController().signal);
    const schema = second.generate.mock.calls[0]![0].config.responseJsonSchema;
    expect(schema.oneOf[0].properties.kind).toMatchObject({ type: 'string', enum: ['final'] });
    expect(schema.oneOf[1].properties.kind).toMatchObject({ type: 'string', enum: ['refusal'] });
    expect(schema.oneOf[0].properties.kind).not.toHaveProperty('const');
  });
  it('shows indexed facts and returns selected original values without copying JSON strings', async () => {
    const before = structuredClone(secondRequest);
    const { provider, generate } = setup({ text: JSON.stringify(selectedFinal) });
    const result = await provider.generateAgent(secondRequest, new AbortController().signal);
    expect(result.candidate).toEqual({ ...final, evidence: [
      { decisionRef: 'hand-b:2', factCode: 'phase', finding: '"turn"' },
      { decisionRef: 'hand-a:1', factCode: 'action', finding: '{"type":"raise","amountTo":120}' },
      { decisionRef: 'hand-a:1', factCode: 'phase', finding: '"flop"' },
    ] });
    expect(validateFinalOutput(result.candidate, toolResult).status).toBe('valid');
    expect(secondRequest).toEqual(before);
    const call = generate.mock.calls[0]![0];
    const context = JSON.parse(call.contents[0].parts[0].text);
    expect(context.toolResult.decisions[0].facts).toEqual([
      { factCode: 'phase', finding: '"flop"', evidenceIndex: 0 },
      { factCode: 'action', finding: '{"type":"raise","amountTo":120}', evidenceIndex: 1 },
    ]);
    expect(context.toolResult.decisions[1].facts[0].evidenceIndex).toBe(2);
    expect(call.config.systemInstruction).toContain('evidenceIndex');
    expect(call.config.responseJsonSchema).not.toEqual(secondRequest.responseSchema);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('reproduces the rejected quote-copy variant and prevents model-authored findings', async () => {
    const copied = { ...final, evidence: [{ decisionRef: 'hand-a:1', factCode: 'phase', finding: 'flop' }] };
    expect(validateFinalOutput(copied, toolResult)).toEqual({ status: 'rejected', category: 'evidence_rejected' });
    const { provider } = setup({ text: JSON.stringify(copied) });
    await expect(provider.generateAgent(secondRequest, new AbortController().signal))
      .rejects.toMatchObject({ kind: 'malformed' });
  });
  it.each([[3], [-1], [0.5], ['0'], [null], [0, 0], [], Array<number>(11).fill(0)].map(evidence => ({ evidence })))(
    'rejects invalid, duplicate or empty completion selections $evidence', async ({ evidence }) => {
      const { provider } = setup({ text: JSON.stringify({ ...selectedFinal, evidence }) });
      await expect(provider.generateAgent(secondRequest, new AbortController().signal))
        .rejects.toMatchObject({ kind: 'malformed' });
    });
  it.each([
    { ...selectedFinal, raw: 'private-output' },
    { ...selectedFinal, evidence: [{ evidenceIndex: 0, finding: 'invented' }] },
  ])('rejects untrusted additional fields %j', async candidate => {
    const { provider } = setup({ text: JSON.stringify(candidate) });
    await expect(provider.generateAgent(secondRequest, new AbortController().signal))
      .rejects.toMatchObject({ kind: 'malformed' });
  });
  it.each([{ kind: 'refusal', reason: 'insufficient_context' },
    { ...final, completed: false, evidence: [] }])('preserves insufficient-evidence output %j', async candidate => {
    const { provider } = setup({ text: JSON.stringify(candidate) });
    expect(await provider.generateAgent(secondRequest, new AbortController().signal)).toMatchObject({ candidate });
  });
  it('selects the last of fifty facts and preserves quotes, escapes and Unicode in a separate holdout', async () => {
    const finding = JSON.stringify({ note: 'Čuvaj "navodnike" i \n zapis' });
    const codes = ['action', 'phase', 'legal_options', 'known_cards', 'hand_outcome'] as const;
    const output: DecisionEvidenceResult = { ...toolResult, decisions: Array.from({ length: 10 }, (_, index) => ({
      decisionRef: `other-hand:${index + 1}`, facts: codes.map(factCode => ({ factCode, finding })),
    })) };
    const { provider } = setup({ text: JSON.stringify({ ...final, evidence: [49] }) });
    const result = await provider.generateAgent({ ...secondRequest,
      context: { ...secondRequest.context, toolResult: output } }, new AbortController().signal);
    expect(result.candidate).toEqual({ ...final, evidence: [{ decisionRef: 'other-hand:10',
      factCode: 'hand_outcome', finding }] });
    expect(validateFinalOutput(result.candidate, output).status).toBe('valid');
  });
  it.each([undefined, { ...toolResult, decisions: [] }, { ...toolResult, raw: 'extra' }])(
    'rejects absent, empty or invalid step-two tool results before a provider call', async toolResult => {
      const { provider, generate } = setup({ text: JSON.stringify(selectedFinal) });
      await expect(provider.generateAgent({ ...secondRequest,
        context: { ...request.context, ...(toolResult ? { toolResult } : {}) } }, new AbortController().signal))
        .rejects.toMatchObject({ kind: 'invalid_request' });
      expect(generate).not.toHaveBeenCalled();
    });
});
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
