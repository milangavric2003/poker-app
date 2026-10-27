import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// Explicit operational vocabulary. Never derive a reason from message/tool text.
export const SecurityReasonSchema = z.enum(['accepted', 'INVALID_INPUT', 'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE', 'INTERNAL_ERROR', 'GAME_NOT_FOUND', 'RUN_NOT_FOUND', 'STALE_STATE',
  'AI_UNAVAILABLE', 'AI_ALREADY_PENDING', 'ANALYSIS_NOT_ALLOWED', 'GAME_NOT_TERMINAL',
  'COACH_ALREADY_PENDING', 'AI_RATE_LIMITED', 'AI_CAPACITY_EXCEEDED', 'completed',
  'insufficient_evidence', 'invalid_input', 'invalid_model_proposal', 'unknown_tool',
  'invalid_tool_arguments', 'repeated_action', 'tool_call_limit', 'step_limit', 'call_budget',
  'deadline', 'cancelled', 'stale_state', 'provider_failed', 'tool_failed', 'malformed_output']);
export const SecurityEventSchema = z.strictObject({
  event: z.enum(['ai.request.accepted', 'ai.request.rejected', 'agent.tool.accepted', 'agent.tool.rejected', 'ai.run.finished']),
  timestamp: z.iso.datetime(), correlationId: z.uuid(), purpose: z.enum(['coach', 'analysis', 'bot']),
  reasonCode: SecurityReasonSchema, outcome: z.enum(['accepted', 'denied', 'completed', 'stopped', 'failed']),
  providerAttempts: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  executedToolCalls: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
export type SecurityEvent = z.infer<typeof SecurityEventSchema>;
export function securityReason(value: unknown): SecurityEvent['reasonCode'] {
  const parsed = SecurityReasonSchema.safeParse(value);
  return parsed.success ? parsed.data : 'INTERNAL_ERROR';
}
/** Internal synchronous bounded sink; no I/O, public endpoint or raw-content logging. */
export class SecurityEvents {
  private buffer: Array<{ at: number; event: SecurityEvent }> = [];
  constructor(private readonly now: () => number = Date.now,
    private readonly observer?: (event: SecurityEvent) => void) {}
  private prune(at: number): void { this.buffer = this.buffer.filter(item => at - item.at < 1_800_000); }
  emit(input: unknown): void {
    const at = this.now(); this.prune(at);
    if (!input || typeof input !== 'object') return;
    const raw = input as Record<string, unknown>;
    // Deliberate projection, including server-owned time; never spread raw input.
    const parsed = SecurityEventSchema.safeParse({ event: raw.event, timestamp: new Date(at).toISOString(),
      correlationId: raw.correlationId, purpose: raw.purpose, reasonCode: raw.reasonCode,
      outcome: raw.outcome, providerAttempts: raw.providerAttempts, executedToolCalls: raw.executedToolCalls });
    if (!parsed.success) return;
    this.buffer.push({ at, event: parsed.data });
    if (this.buffer.length > 200) this.buffer.splice(0, this.buffer.length - 200);
    try { this.observer?.(structuredClone(parsed.data)); } catch { /* observability cannot change gameplay */ }
  }
  read(): SecurityEvent[] { this.prune(this.now()); return this.buffer.map(item => structuredClone(item.event)); }
}
export const processSecurityEvents = new SecurityEvents();
export function securityCorrelation(): string { return randomUUID(); }
