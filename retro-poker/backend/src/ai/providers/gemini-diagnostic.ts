import { ProviderCodeSchema, type AiDiagnostic } from '../../../../shared/ai-diagnostic.js';

// Decode the SDK's JSON error message in memory. Return only bounded, allowlisted
// values; never retain its message, headers, arbitrary details or request content.
export function geminiDiagnostic(error: unknown): AiDiagnostic {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const status = value.httpStatus ?? value.status;
  const httpStatus = typeof status === 'number' && Number.isInteger(status)
    && status >= 400 && status <= 599 ? status : null;
  let body: Record<string, unknown> = {};
  if (typeof value.message === 'string' && value.message.length <= 65536) {
    try {
      const parsed: unknown = JSON.parse(value.message);
      if (parsed && typeof parsed === 'object' && 'error' in parsed
        && parsed.error && typeof parsed.error === 'object') body = parsed.error as Record<string, unknown>;
    } catch { /* Non-JSON error text is deliberately not exposed. */ }
  }
  const code = ProviderCodeSchema.safeParse(body.status);
  return { httpStatus, providerCode: code.success ? code.data : null,
    reason: httpStatus === 503 && typeof body.message === 'string'
      && /experiencing high demand/i.test(body.message) ? 'high_demand' : 'unknown' };
}
