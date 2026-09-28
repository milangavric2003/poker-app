import { GoogleGenAI } from '@google/genai';
import { ProviderError, type AiProvider, type ProviderRequest, type ProviderResult,
  type ProviderUsage } from '../types.js';

interface GeminiResponse {
  text?: string;
  modelVersion?: string;
  responseId?: string;
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{ finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number;
    thoughtsTokenCount?: number; cachedContentTokenCount?: number; totalTokenCount?: number };
}
export interface GeminiClient {
  models: { generateContent(parameters: unknown): Promise<GeminiResponse> };
}
type ClientFactory = (apiKey: string) => GeminiClient;

function tokenCount(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function usage(value: GeminiResponse['usageMetadata']): ProviderUsage | undefined {
  if (!value) return undefined;
  return { promptTokens: tokenCount(value.promptTokenCount),
    candidateTokens: tokenCount(value.candidatesTokenCount),
    thoughtTokens: tokenCount(value.thoughtsTokenCount),
    cachedTokens: tokenCount(value.cachedContentTokenCount),
    totalTokens: tokenCount(value.totalTokenCount) };
}
function providerError(error: unknown): never {
  if (error instanceof DOMException && error.name === 'AbortError') throw error;
  const status = typeof error === 'object' && error !== null && 'status' in error
    && typeof error.status === 'number' ? error.status : null;
  if (status === 408) throw new ProviderError('timeout');
  if (status === 429) throw new ProviderError('rate_limited');
  if (status !== null && status >= 500) throw new ProviderError('server_error');
  if (status === 401 || status === 403) throw new ProviderError('auth_config_error');
  if (status !== null && status >= 400) throw new ProviderError('invalid_request');
  throw new ProviderError('network_error');
}

export function createGeminiProvider(apiKey: string,
  clientFactory: ClientFactory = key => new GoogleGenAI({ apiKey: key }) as GeminiClient): AiProvider {
  const client = clientFactory(apiKey);
  return { async generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult> {
    let response: GeminiResponse;
    try {
      response = await client.models.generateContent({ model: request.model,
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(request.context) }] }],
        config: { abortSignal: signal, responseMimeType: 'application/json',
          responseJsonSchema: request.responseSchema,
          httpOptions: { retryOptions: { attempts: 1 } } } });
    } catch (error) { return providerError(error); }
    const refused = response.promptFeedback?.blockReason === 'SAFETY'
      || response.candidates?.some(candidate => candidate.finishReason === 'SAFETY');
    if (refused) throw new ProviderError('safety_refusal');
    if (typeof response.text !== 'string' || response.text.trim() === '') {
      throw new ProviderError('malformed');
    }
    const normalizedUsage = usage(response.usageMetadata);
    return { candidate: response.text,
      ...(response.modelVersion ? { model: response.modelVersion } : {}),
      ...(response.responseId ? { responseId: response.responseId } : {}),
      ...(normalizedUsage ? { usage: normalizedUsage } : {}) };
  } };
}
