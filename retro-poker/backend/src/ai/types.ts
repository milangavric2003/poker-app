import type { Card, LegalAction, PokerAction } from '../engine/types.js';
import type { PublicEvent } from '../../../shared/contracts.js';

export type AiPurpose = 'bot' | 'analysis';
export type AttemptRelation = 'initial' | 'same_model_retry' | 'model_fallback';
export type AttemptOutcome = 'success' | 'timeout' | 'rate_limited' | 'server_error'
  | 'network_error' | 'malformed' | 'schema_rejected' | 'semantic_rejected'
  | 'safety_refusal' | 'auth_config_error' | 'cancelled' | 'stale';

export interface AiRuntimeConfig {
  apiKey: string | null;
  primaryModel: string;
  fallbackModel: string | null;
  maxAttempts: 2;
  botTotalMs: 12000;
  analysisTotalMs: 30000;
  botAttemptMs: 5000;
  analysisAttemptMs: 12000;
}

export interface ProviderUsage {
  promptTokens: number | null; candidateTokens: number | null; thoughtTokens: number | null;
  cachedTokens: number | null; totalTokens: number | null;
}
export interface ProviderRequest {
  purpose: AiPurpose; model: string; context: unknown; responseSchema: Readonly<Record<string, unknown>>;
  attemptOrdinal: 1 | 2; corrective?: boolean;
}
export interface ProviderResult {
  candidate: unknown; model?: string; responseId?: string; usage?: Partial<ProviderUsage>;
}
export interface AiProvider {
  generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult>;
}
export type ProviderFailureKind = 'timeout' | 'rate_limited' | 'server_error' | 'network_error'
  | 'malformed' | 'invalid_request' | 'auth_config_error' | 'safety_refusal' | 'config_error';
export class ProviderError extends Error {
  constructor(readonly kind: ProviderFailureKind, message = 'AI provider failure',
    readonly retryAfterMs?: number) { super(message); }
}

export interface AiClock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}
export interface AiJitter { next(maxInclusive: number): number; }

export interface BotDecisionContext {
  gameId: string; handId: string; expectedVersion: number; actorId: string; decisionOrdinal: number;
  phase: 'preflop' | 'flop' | 'turn' | 'river'; board: readonly Card[];
  pots: ReadonlyArray<{ id: string; amount: number; contributionCap: number;
    contributorIds: readonly string[]; eligibleIds: readonly string[] }>;
  players: ReadonlyArray<{ id: string; seat: number; kind: 'human' | 'bot'; stack: number;
    streetContribution: number; handContribution: number; status: string }>;
  holeCards: readonly [Card, Card]; legalActions: readonly LegalAction[];
  history: readonly PublicEvent[];
}
export type BotActionProposal = { gameId: string; handId: string; expectedVersion: number;
  actorId: string; type: 'fold' | 'check' | 'call' | 'all_in' }
  | { gameId: string; handId: string; expectedVersion: number; actorId: string;
    type: 'bet' | 'raise'; amountTo: number };

export interface BotFingerprint {
  interactionId: string; purpose: 'bot'; gameId: string; handId: string;
  expectedVersion: number; actorId: string; decisionOrdinal: number;
}
export interface AIAttempt {
  ordinal: 1 | 2; model: string; relation: AttemptRelation; outcome: AttemptOutcome; durationMs: number;
  usage?: Partial<ProviderUsage>;
}
export interface CoordinatorResult<T> {
  ok: boolean; value?: T; attempts: AIAttempt[]; finalModel: string | null;
  failure?: AttemptOutcome;
}
export interface BotCommitCandidate { action: PokerAction; proposal: BotActionProposal; }
