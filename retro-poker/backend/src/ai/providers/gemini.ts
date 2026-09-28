import { GoogleGenAI } from '@google/genai';
import { geminiDiagnostic } from './gemini-diagnostic.js';
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

function usage(value: GeminiResponse['usageMetadata']): ProviderUsage | undefined {
  if (!value) return undefined;
  return { promptTokens: value.promptTokenCount ?? null,
    candidateTokens: value.candidatesTokenCount ?? null,
    thoughtTokens: value.thoughtsTokenCount ?? null,
    cachedTokens: value.cachedContentTokenCount ?? null,
    totalTokens: value.totalTokenCount ?? null };
}
function providerError(error: unknown): never {
  if (error instanceof DOMException && error.name === 'AbortError') throw error;
  const diagnostic = geminiDiagnostic(error);
  const status = diagnostic.httpStatus;
  if (status === 408) throw new ProviderError('timeout', undefined, undefined, status, diagnostic);
  if (status === 429) throw new ProviderError('rate_limited', undefined, undefined, status, diagnostic);
  if (status !== null && status >= 500) throw new ProviderError('server_error', undefined, undefined, status, diagnostic);
  if (status === 401 || status === 403) throw new ProviderError('auth_config_error', undefined, undefined, status, diagnostic);
  if (status !== null && status >= 400) throw new ProviderError('invalid_request', undefined, undefined, status, diagnostic);
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
