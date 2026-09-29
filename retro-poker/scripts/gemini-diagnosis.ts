import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { GoogleGenAI } from '@google/genai';
import { createGeminiProvider } from '../backend/src/ai/providers/gemini.js';
import type { GeminiClient } from '../backend/src/ai/providers/gemini.js';
import { BotActionProposalSchema, botProposalJsonSchema, parseProviderCandidate } from '../backend/src/ai/schemas.js';
import { validateBotProposal } from '../backend/src/ai/semantic.js';
import { geminiDiagnostic } from '../backend/src/ai/providers/gemini-diagnostic.js';
import { ProviderError, type BotDecisionContext } from '../backend/src/ai/types.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com';
const API_VERSION = 'v1beta';
const MAX_CALLS = 3;
const TIMEOUT_MS = 12_000;
const enabled = process.env.RUN_GEMINI_DIAGNOSTIC === '1' || process.argv.includes('--live');
const diagnosticEnvFile = process.env.GEMINI_DIAGNOSTIC_ENV_FILE?.trim() || '.env';
const secretKeys = /(?:API_KEY|SECRET|TOKEN|PASSWORD)/i;
const allowedCodes = new Set(['timeout', 'rate_limited', 'server_error', 'network_error',
  'malformed', 'invalid_request', 'auth_config_error', 'safety_refusal', 'config_error']);

function safeError(error: unknown) {
  const diagnostic = error instanceof ProviderError && error.diagnostic
    ? error.diagnostic : geminiDiagnostic(error);
  if (error && typeof error === 'object') {
    const value = error as { httpStatus?: unknown; status?: unknown; statusCode?: unknown;
      kind?: unknown; name?: unknown; cause?: unknown };
    const possible = [value.httpStatus, value.status, value.statusCode];
    const status = possible.find(candidate => typeof candidate === 'number' && Number.isInteger(candidate)) as number | undefined;
    let code = typeof value.kind === 'string' && allowedCodes.has(value.kind) ? value.kind : 'unknown';
    if (code === 'unknown' && status !== undefined) {
      code = status === 408 ? 'timeout' : status === 429 ? 'rate_limited'
        : status >= 500 ? 'server_error' : status === 401 || status === 403 ? 'auth_config_error'
        : status >= 400 ? 'invalid_request' : 'unknown';
    }
    if (code === 'unknown' && (value.name === 'AbortError' || value.name === 'TimeoutError')) code = 'timeout';
    if (code === 'unknown' && (value.name === 'TypeError' || value.name === 'NetworkError')) code = 'network_error';
    if (code === 'unknown' && value.cause && typeof value.cause === 'object') {
      const causeName = (value.cause as { name?: unknown }).name;
      if (causeName === 'TypeError' || causeName === 'NetworkError') code = 'network_error';
    }
    return { status: diagnostic.httpStatus, code, diagnostic };
  }
  return { status: null, code: 'unknown', diagnostic };
}

async function main(): Promise<void> {
  if (!enabled) {
    console.log('Not run: set RUN_GEMINI_DIAGNOSTIC=1 to opt in.');
    return;
  }
  let fileEnv: Record<string, string | undefined>;
  try { fileEnv = parseEnv(await readFile(diagnosticEnvFile, 'utf8')); }
  catch { console.log('Not run: local .env is unavailable.'); process.exitCode = 2; return; }
  const env = { ...fileEnv, ...process.env };
  const key = env.GEMINI_API_KEY?.trim();
  const configuredModel = [env.GEMINI_PRIMARY_MODEL, env.GEMINI_FALLBACK_MODEL]
    .map(value => value?.trim()).find(value => value && /flash-lite/i.test(value));
  if (!key) { console.log('Not run: GEMINI_API_KEY is unavailable in local .env/process environment.'); process.exitCode = 2; return; }
  if (!configuredModel || !/flash-lite/i.test(configuredModel)) {
    console.log(`Not run: configured Flash-Lite model unavailable (configured=${configuredModel ? 'non-Flash-Lite' : 'missing'}); no model was substituted.`);
    process.exitCode = 2; return;
  }

  const model = configuredModel;
  console.log(JSON.stringify({ event: 'configuration', sdk: '2.24.0', model, endpoint: ENDPOINT,
    apiVersion: API_VERSION, maxCalls: MAX_CALLS, timeoutMs: TIMEOUT_MS,
    sdkRetries: 0, envFileLoaded: true,
    envKeysPresent: Object.keys(env).filter(k => !secretKeys.test(k) && k.startsWith('GEMINI_')).sort() }));

  let calls = 0;
  const run = async (phase: string, generate: (signal: AbortSignal) => Promise<unknown>,
    configuration: string, valid: (result: unknown) => boolean): Promise<boolean> => {
    if (calls >= MAX_CALLS) return false;
    calls += 1;
    const started = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const result = await generate(controller.signal);
      if (!valid(result)) throw new ProviderError('malformed');
      const durationMs = Math.round(performance.now() - started);
      console.log(JSON.stringify({ event: 'probe', phase, call: calls, model,
        status: null, code: 'success', durationMs, configuration }));
      return true;
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      const result = safeError(error);
      // Do not mislabel transport/DNS failures as a Gemini HTTP server response.
      console.log(JSON.stringify({ event: 'probe', phase, call: calls, model,
        status: result.status, code: result.code, diagnostic: result.diagnostic, durationMs, configuration }));
      process.exitCode = 1;
      return false;
    } finally { clearTimeout(timer); }
  };

  const client = new GoogleGenAI({ apiKey: key, httpOptions: {
    baseUrl: ENDPOINT, apiVersion: API_VERSION, timeout: TIMEOUT_MS,
    retryOptions: { attempts: 1 },
  } });
  const textOk = await run('A-minimal-text', signal => client.models.generateContent({
    model, contents: 'Reply with the single word OK.', config: { abortSignal: signal,
      maxOutputTokens: 128, httpOptions: { timeout: TIMEOUT_MS, retryOptions: { attempts: 1 } } },
  }), 'text/plain; no schema', result => {
    const text = (result as { text?: string }).text;
    return typeof text === 'string' && text.trim().length > 0;
  });
  if (!textOk) { console.log(JSON.stringify({ event: 'stopped', after: 'A', calls })); return; }

  const jsonOk = await run('B-minimal-json-schema', signal => client.models.generateContent({
    model, contents: 'Return an object where ok is true.', config: { abortSignal: signal,
      maxOutputTokens: 128, responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } },
        required: ['ok'], additionalProperties: false },
      httpOptions: { timeout: TIMEOUT_MS, retryOptions: { attempts: 1 } } },
  }), 'application/json; simple responseJsonSchema', result => {
    try { return JSON.parse((result as { text: string }).text).ok === true; }
    catch { return false; }
  });
  if (!jsonOk) { console.log(JSON.stringify({ event: 'stopped', after: 'B', calls })); return; }

  const provider = createGeminiProvider(key, apiKey => new GoogleGenAI({ apiKey,
    httpOptions: { baseUrl: ENDPOINT, apiVersion: API_VERSION, timeout: TIMEOUT_MS,
      retryOptions: { attempts: 1 } },
  }) as unknown as GeminiClient);
  const synthetic: BotDecisionContext = { gameId: '00000000-0000-4000-8000-000000000001',
    handId: '00000000-0000-4000-8000-000000000002', expectedVersion: 1,
    actorId: 'bot-synthetic', decisionOrdinal: 1, phase: 'preflop', board: [], pots: [],
    players: [], holeCards: ['As', 'Kh'], legalActions: [{ type: 'check' }], history: [] };
  const cOk = await run('C-production-adapter-synthetic-context', signal => provider.generate({
    purpose: 'bot', model, context: synthetic, responseSchema: botProposalJsonSchema,
    attemptOrdinal: 1,
  }, signal), 'production adapter; botProposalJsonSchema', result => {
    try {
      const parsed = BotActionProposalSchema.safeParse(parseProviderCandidate((result as { candidate: unknown }).candidate));
      return parsed.success && validateBotProposal(parsed.data, synthetic) !== null;
    } catch { return false; }
  });
  console.log(JSON.stringify({ event: 'complete', calls, cOk }));
}

await main();
