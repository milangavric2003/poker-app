import { describe, expect, it, vi } from 'vitest';
import { ProviderError, type ProviderRequest } from '../../backend/src/ai/types.js';
import { createGeminiProvider, type GeminiClient } from '../../backend/src/ai/providers/gemini.js';
import { productionAiDependencies } from '../../backend/src/app.js';

const request: ProviderRequest = {
  purpose: 'bot', model: 'gemini-3.8-flash', context: { actorId: 'bot1', board: [] },
  responseSchema: { type: 'object', additionalProperties: false, required: ['type'] },
  attemptOrdinal: 1,
};

function client(result: unknown): { sdk: GeminiClient; generate: ReturnType<typeof vi.fn> } {
  const generate = vi.fn().mockResolvedValue(result);
  return { sdk: { models: { generateContent: generate } }, generate };
}

describe('Gemini provider adapter', () => {
  it('implements the provider-neutral contract and maps structured requests and usage', async () => {
    const mocked = client({ text: '{"type":"check"}', modelVersion: 'gemini-3.8-flash-001',
      responseId: 'response-safe-id', usageMetadata: { promptTokenCount: 11,
        candidatesTokenCount: 3, thoughtsTokenCount: 2, cachedContentTokenCount: 5,
        totalTokenCount: 16 } });
    const provider = createGeminiProvider('server-only-secret', () => mocked.sdk);
    const signal = new AbortController().signal;

    await expect(provider.generate(request, signal)).resolves.toEqual({
      candidate: '{"type":"check"}', model: 'gemini-3.8-flash-001',
      responseId: 'response-safe-id', usage: { promptTokens: 11, candidateTokens: 3,
        thoughtTokens: 2, cachedTokens: 5, totalTokens: 16 },
    });
    expect(mocked.generate).toHaveBeenCalledWith({ model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(request.context) }] }],
      config: { abortSignal: signal, responseMimeType: 'application/json',
        responseJsonSchema: request.responseSchema,
        httpOptions: { retryOptions: { attempts: 1 } } } });
  });

  it('supports analysis through the same neutral contract without adding private fields', async () => {
    const mocked = client({ text: '{}' });
    const context = { factsRevision: 2, decisions: [] };
    const provider = createGeminiProvider('secret', () => mocked.sdk);
    await provider.generate({ ...request, purpose: 'analysis', model: 'gemini-3.5-flash-lite',
      context }, new AbortController().signal);
    const call = mocked.generate.mock.calls[0]?.[0];
    expect(call.model).toBe('gemini-3.5-flash-lite');
    expect(JSON.parse(call.contents[0].parts[0].text)).toEqual(context);
    expect(call.contents[0].parts[0].text).not.toContain('secret');
  });

  it('classifies empty output and safety refusal without exposing raw provider content', async () => {
    const empty = client({ text: undefined });
    await expect(createGeminiProvider('secret', () => empty.sdk).generate(request,
      new AbortController().signal)).rejects.toMatchObject({ kind: 'malformed', message: 'AI provider failure' });
    const blocked = client({ text: undefined, promptFeedback: { blockReason: 'SAFETY' } });
    await expect(createGeminiProvider('secret', () => blocked.sdk).generate(request,
      new AbortController().signal)).rejects.toMatchObject({ kind: 'safety_refusal', message: 'AI provider failure' });
  });

  it.each([[400, 'invalid_request'], [401, 'auth_config_error'], [403, 'auth_config_error'],
    [429, 'rate_limited'], [500, 'server_error'], [503, 'server_error']] as const)(
    'maps HTTP %i to %s with a sanitized error', async (status, kind) => {
      const sdk: GeminiClient = { models: { generateContent: vi.fn().mockRejectedValue(
        Object.assign(new Error(`raw secret-${status}`), { status })) } };
      const caught = await createGeminiProvider('secret', () => sdk).generate(request,
        new AbortController().signal).catch((error: unknown) => error);
      expect(caught).toBeInstanceOf(ProviderError);
      expect(caught).toMatchObject({ kind, message: 'AI provider failure' });
      expect((caught as ProviderError).httpStatus).toBe(status);
      expect(String(caught)).not.toContain('secret');
      expect(JSON.stringify(caught)).not.toContain('raw secret');
      expect(JSON.stringify(caught)).not.toContain('headers');
    });

  it('leaves status unknown when the SDK error has no numeric HTTP status', async () => {
    const sdk: GeminiClient = { models: { generateContent: vi.fn().mockRejectedValue(
      new Error('must-not-leak raw body or key=private')) } };
    const caught = await createGeminiProvider('private', () => sdk).generate(request,
      new AbortController().signal).catch((error: unknown) => error);
    expect(caught).toMatchObject({ kind: 'network_error', httpStatus: null,
      message: 'AI provider failure' });
    expect(JSON.stringify(caught)).not.toContain('must-not-leak');
    expect(JSON.stringify(caught)).not.toContain('private');
  });

  it('preserves cancellation as AbortError and maps transport failures', async () => {
    const aborted = new DOMException('secret', 'AbortError');
    const abortSdk: GeminiClient = { models: { generateContent: vi.fn().mockRejectedValue(aborted) } };
    await expect(createGeminiProvider('secret', () => abortSdk).generate(request,
      new AbortController().signal)).rejects.toBe(aborted);
    const networkSdk: GeminiClient = { models: { generateContent: vi.fn().mockRejectedValue(new Error('secret')) } };
    await expect(createGeminiProvider('secret', () => networkSdk).generate(request,
      new AbortController().signal)).rejects.toMatchObject({ kind: 'network_error', message: 'AI provider failure' });
  });

  it('wires production only with an enabled key and an allowed model', () => {
    const factory = vi.fn(() => ({ generate: vi.fn() }));
    expect(productionAiDependencies({}, factory)).not.toHaveProperty('aiProvider');
    expect(productionAiDependencies({ GEMINI_API_KEY: 'secret',
      GEMINI_PRIMARY_MODEL: 'unknown' }, factory)).not.toHaveProperty('aiProvider');
    expect(productionAiDependencies({ GEMINI_API_KEY: 'secret',
      GEMINI_PRIMARY_MODEL: 'gemini-3.5-flash-lite' }, factory)).toHaveProperty('aiProvider');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('secret');
  });
});
