import { z } from 'zod';
import { CoachModelStepSchema, type CoachGoal, type CoachRunView, type DecisionEvidenceResult } from '../../../shared/contracts.js';
import type { AgentProvider, AiClock, AiJitter, AttemptOutcome, AttemptRelation, ProviderUsage } from '../ai/types.js';
import type { TerminalFactsSnapshot, ToolControls } from './tools.js';

export type StopReason = NonNullable<CoachRunView['stopReason']>;
export type FailureCategory = NonNullable<CoachRunView['failureCategory']>;
export interface AgentFingerprint {
  runId: string; gameId: string; handId: string; expectedVersion: number; factsRevision: number;
}
export interface AgentAttempt {
  stepOrdinal: 1 | 2; attemptOrdinal: 1 | 2; runAttemptOrdinal: number;
  model: string; relation: AttemptRelation; outcome: AttemptOutcome; durationMs: number;
  usage?: Partial<ProviderUsage>;
}
export interface AgentRunState extends AgentFingerprint {
  goal: CoachGoal; status: CoachRunView['status']; startedAt: number; deadlineAt: number;
  stepCount: number; toolCallCount: number; providerAttemptCount: number;
  recentActionKeys: string[]; validatedToolResult: DecisionEvidenceResult | null;
  stopReason: StopReason | null; failureCategory: FailureCategory | null;
  result: CoachRunView['result']; sampleLimited: boolean; terminalTransitionCount: number;
  attempts: AgentAttempt[];
  toolAttemptCount: number; toolRejectionCount: number;
  validationCount: number; validationRejectedCount: number; finishedAt: number | null;
}
export interface AgentLimits {
  maxSteps: number; maxToolCalls: number; maxProviderAttempts: number;
  maxAttemptsPerStep: 1 | 2; providerAttemptTimeoutMs: number; totalDeadlineMs: number; toolTimeoutMs: number;
}
export interface AgentRunOptions {
  runId: string; snapshot: TerminalFactsSnapshot; goal: CoachGoal;
  provider: AgentProvider; clock: AiClock; model: string; fallbackModel?: string | null;
  signal?: AbortSignal; isCurrent?: (identity: Readonly<AgentFingerprint>) => boolean;
  executeTool?: (snapshot: TerminalFactsSnapshot, args: unknown, controls: ToolControls) => unknown | Promise<unknown>;
  limits?: Partial<AgentLimits>; backoffMinMs?: number; backoffMaxMs?: number; jitter?: AiJitter;
  onTerminal?: (state: AgentRunState) => void;
}
export const CORE_AGENT_LIMITS: Readonly<AgentLimits> = Object.freeze({ maxSteps: 2, maxToolCalls: 1,
  maxProviderAttempts: 4, maxAttemptsPerStep: 2, providerAttemptTimeoutMs: 15000, totalDeadlineMs: 45000,
  toolTimeoutMs: 1000 });
export const agentResponseJsonSchema = z.toJSONSchema(CoachModelStepSchema, { unrepresentable: 'any' });
