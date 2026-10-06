import { z } from 'zod';
import { AiDiagnosticSchema } from './ai-diagnostic.js';

export const CardSchema = z.string().regex(/^[2-9TJQKA][cdhs]$/);
export const ChipsSchema = z.number().int().min(0).max(6000);
export const SeatSchema = z.number().int().min(0).max(5);
const PositiveChips = ChipsSchema.min(1);
const Version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const Identity = { gameId: z.uuid(), handId: z.uuid(), expectedVersion: Version };
export const GameConfigSchema = z.strictObject({
  botCount: z.number().int().min(1).max(5),
  aiMode: z.boolean().default(false),
});
export const NextHandSchema = z.strictObject(Identity);
export const PlayerActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...Identity, type: z.literal('fold') }),
  z.strictObject({ ...Identity, type: z.literal('check') }),
  z.strictObject({ ...Identity, type: z.literal('call') }),
  z.strictObject({ ...Identity, type: z.literal('all_in') }),
  z.strictObject({ ...Identity, type: z.literal('bet'), amountTo: PositiveChips }),
  z.strictObject({ ...Identity, type: z.literal('raise'), amountTo: PositiveChips }),
]);

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type PlayerAction = z.infer<typeof PlayerActionSchema>;
export type NextHand = z.infer<typeof NextHandSchema>;

const Id = z.string().min(1);
const Status = z.enum(['playing', 'won', 'lost']);
const Phase = z.enum(['preflop', 'flop', 'turn', 'river', 'complete']);
const Reason = z.enum(['showdown', 'uncontested']);
const Kind = z.enum(['human', 'bot']);
const PlayerStatus = z.enum(['active', 'folded', 'all_in', 'eliminated']);
const ActionType = z.enum(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
const unique = <T>(values: T[]) => new Set(values).size === values.length;
const Ids = z.array(Id).max(6).refine(unique, 'Duplicate IDs');
const Cards = z.array(CardSchema).refine(unique, 'Duplicate cards');
const HoleCards = z.tuple([CardSchema, CardSchema]).refine(unique, 'Duplicate cards');
const Amount = z.strictObject({ playerId: Id, amount: ChipsSchema });
const Positions = { buttonSeat: SeatSchema, smallBlindSeat: SeatSchema, bigBlindSeat: SeatSchema };

export const LegalActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('fold') }),
  z.strictObject({ type: z.literal('check') }),
  z.strictObject({ type: z.literal('call'), payAmount: PositiveChips, isAllIn: z.boolean() }),
  z.strictObject({ type: z.literal('bet'), minAmountTo: PositiveChips, maxAmountTo: PositiveChips }),
  z.strictObject({ type: z.literal('raise'), minAmountTo: PositiveChips, maxAmountTo: PositiveChips }),
  z.strictObject({ type: z.literal('all_in'), amountTo: PositiveChips, payAmount: PositiveChips,
    classification: z.enum(['call', 'bet', 'raise']) }),
]).refine(a => {
  if (a.type === 'bet' || a.type === 'raise') return a.minAmountTo <= a.maxAmountTo;
  if (a.type === 'all_in') return a.payAmount <= a.amountTo;
  return true;
}, 'Invalid action amounts');

const EventBase = { seq: Version.min(1), handId: z.uuid(), street: Phase };
export const PublicEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...EventBase, type: z.literal('hand_started'), number: Version.min(1), ...Positions }),
  z.strictObject({ ...EventBase, type: z.literal('blind_posted'), playerId: Id,
    blind: z.enum(['small', 'big']), amount: ChipsSchema }),
  z.strictObject({ ...EventBase, type: z.literal('action'), playerId: Id,
    actionType: ActionType, payAmount: ChipsSchema, amountTo: ChipsSchema }),
  z.strictObject({ ...EventBase, type: z.literal('board_dealt'), cards: Cards.refine(c => c.length === 1 || c.length === 3) }),
  z.strictObject({ ...EventBase, type: z.literal('refund'), ...Amount.shape }),
  z.strictObject({ ...EventBase, type: z.literal('settled'), reason: Reason }),
]);

const ResultPot = z.strictObject({
  id: Id, amount: ChipsSchema, eligibleIds: Ids, winnerIds: Ids,
  payouts: z.array(Amount).min(1).max(6),
}).refine(p => p.winnerIds.length > 0
  && p.winnerIds.every(id => p.eligibleIds.includes(id))
  && unique(p.payouts.map(a => a.playerId))
  && p.payouts.length === p.winnerIds.length
  && p.payouts.every(a => p.winnerIds.includes(a.playerId))
  && p.payouts.reduce((sum, a) => sum + a.amount, 0) === p.amount, 'Invalid pot payout');

export const HandResultSchema = z.strictObject({
  handId: z.uuid(), reason: Reason, gameStatus: Status, pots: z.array(ResultPot).max(6),
  refunds: z.array(Amount).max(6),
  revealedCards: z.array(z.strictObject({ playerId: Id, cards: HoleCards })).max(6),
  netChanges: z.array(z.strictObject({ playerId: Id, amount: z.number().int().min(-6000).max(6000) })).min(2).max(6),
}).refine(r => {
  const ids = r.netChanges.map(n => n.playerId);
  const references = [...r.refunds.map(a => a.playerId), ...r.revealedCards.map(a => a.playerId),
    ...r.pots.flatMap(p => [...p.eligibleIds, ...p.winnerIds])];
  return unique(ids) && r.netChanges.reduce((s, n) => s + n.amount, 0) === 0
    && unique(r.pots.map(p => p.id)) && unique(r.refunds.map(a => a.playerId))
    && unique(r.revealedCards.map(a => a.playerId))
    && unique(r.revealedCards.flatMap(a => a.cards))
    && references.every(id => ids.includes(id));
}, 'Invalid result references or balance');

const PlayerView = z.strictObject({
  id: Id, seat: SeatSchema, kind: Kind, stack: ChipsSchema,
  streetContribution: ChipsSchema, handContribution: ChipsSchema, status: PlayerStatus,
  cards: HoleCards.nullable(),
}).refine(p => p.streetContribution <= p.handContribution
  && (p.status !== 'eliminated' || p.stack === 0), 'Invalid player');
const PotView = z.strictObject({
  id: Id, amount: ChipsSchema, contributionCap: ChipsSchema, contributorIds: Ids, eligibleIds: Ids,
}).refine(p => p.eligibleIds.every(id => p.contributorIds.includes(id)), 'Invalid pot eligibility');

const MatchAnalysisItemSchema = z.strictObject({
  decisionRef: z.string().min(1), explanation: z.string().min(1).max(600),
});
export const MatchAnalysisSchema = z.strictObject({
  summary: z.string().min(1).max(1200),
  goodDecisions: z.array(MatchAnalysisItemSchema).max(6),
  possibleMistakes: z.array(MatchAnalysisItemSchema).max(6),
  nextSteps: z.array(z.string().min(1).max(300)).min(1).max(6),
  disclaimer: z.string().min(1).optional(),
});
export const AnalysisRequestSchema = z.strictObject(Identity);
const Count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const UsageResetSchema = z.strictObject({ expectedRevision: Count });
const UsageMetricSchema = z.strictObject({ knownCount: Count, missingCount: Count, sum: Count });
const CostMetricSchema = z.strictObject({ knownCount: Count, missingCount: Count,
  sum: Count.nullable(), currency: z.string().min(1).nullable() }).refine(value =>
  (value.sum === null) === (value.currency === null)
  && (value.knownCount === 0) === (value.sum === null), 'Inconsistent cost aggregate');
const AttemptOutcomeSchema = z.enum(['success', 'timeout', 'rate_limited', 'server_error',
  'network_error', 'malformed', 'schema_rejected', 'semantic_rejected', 'safety_refusal',
  'auth_config_error', 'invalid_request', 'cancelled', 'stale']);
export const CoachStopReasonSchema = z.enum(['completed', 'insufficient_evidence', 'invalid_input',
  'invalid_model_proposal', 'unknown_tool', 'invalid_tool_arguments', 'repeated_action',
  'tool_call_limit', 'step_limit', 'call_budget', 'deadline', 'cancelled', 'stale_state',
  'provider_failed', 'tool_failed', 'malformed_output']);
export const CoachUsageSchema = z.strictObject({
  runCount: Count, stepCount: Count, providerAttemptCount: Count,
  toolAttemptCount: Count, toolExecutionCount: Count, toolRejectionCount: Count,
  validationCount: Count, validationRejectedCount: Count, retryCount: Count, modelFallbackCount: Count,
  stopReasons: z.array(z.strictObject({ reason: CoachStopReasonSchema, count: Count })).max(17),
  latency: z.strictObject({ count: Count, sumMs: Count, maxMs: Count.max(45000) }),
  attempts: z.array(z.strictObject({ stepOrdinal: z.number().int().min(1).max(2),
    model: z.string().min(1).max(128), relation: z.enum(['initial', 'same_model_retry', 'model_fallback']),
    outcome: AttemptOutcomeSchema, count: Count,
    latency: z.strictObject({ count: Count, sumMs: Count, maxMs: Count.max(15000) }),
    usage: z.strictObject({ promptTokens: UsageMetricSchema, candidateTokens: UsageMetricSchema,
      thoughtTokens: UsageMetricSchema, cachedTokens: UsageMetricSchema, totalTokens: UsageMetricSchema,
      cost: CostMetricSchema }) })),
});
export const UsageDashboardSchema = z.strictObject({
  revision: Count,
  logical: z.array(z.strictObject({ purpose: z.enum(['bot', 'analysis']),
    initialModel: z.string().min(1), finalOutcome: z.string().min(1), count: Count })),
  attempts: z.array(z.strictObject({ purpose: z.enum(['bot', 'analysis']), model: z.string().min(1),
    relation: z.enum(['initial', 'same_model_retry', 'model_fallback']), outcome: AttemptOutcomeSchema,
    diagnostic: AiDiagnosticSchema.optional(),
    count: Count, latency: z.strictObject({ count: Count, sumMs: Count, maxMs: Count }),
    usage: z.strictObject({ promptTokens: UsageMetricSchema, candidateTokens: UsageMetricSchema,
      thoughtTokens: UsageMetricSchema, cachedTokens: UsageMetricSchema, totalTokens: UsageMetricSchema,
      cost: CostMetricSchema }) })),
  retryCount: Count, modelFallbackCount: Count, localFallbackCount: Count,
  coach: CoachUsageSchema.optional(),
});
export const UsageResponseSchema = z.strictObject({ usage: UsageDashboardSchema });
const AiViewSchema = z.strictObject({
  mode: z.enum(['off', 'on']),
  availability: z.enum(['configured', 'unavailable']),
  active: z.strictObject({
    interactionId: z.uuid(), purpose: z.enum(['bot', 'analysis']),
    status: z.enum(['waiting', 'retrying', 'model_fallback']),
    attemptCount: z.number().int().min(0).max(2), model: z.string().min(1),
  }).nullable(),
  lastBotOutcome: z.strictObject({
    handId: z.uuid(), actorId: Id, decisionOrdinal: Version.min(1),
    outcome: z.enum(['model', 'local_fallback']), attemptCount: z.number().int().min(0).max(2),
    finalModel: z.string().min(1).nullable(),
  }).nullable(),
  analysis: z.strictObject({
    status: z.enum(['idle', 'generating', 'completed', 'failed', 'unavailable']),
    interactionId: z.uuid().nullable(), result: MatchAnalysisSchema.nullable(),
  }),
});

export const GameViewSchema = z.strictObject({
  gameId: z.uuid(), handId: z.uuid(), version: Version,
  botCount: z.number().int().min(1).max(5), handNumber: Version.min(1),
  status: Status, phase: Phase, ...Positions, actorId: Id.nullable(),
  board: Cards.refine(c => [0, 3, 4, 5].includes(c.length)),
  players: z.array(PlayerView).min(2).max(6), totalPot: ChipsSchema, pots: z.array(PotView).max(6),
  legalActions: z.array(LegalActionSchema).max(6), events: z.array(PublicEventSchema),
  result: HandResultSchema.nullable(), previousResult: HandResultSchema.nullable(), ai: AiViewSchema,
}).refine(v => {
  const ids = v.players.map(p => p.id);
  const visibleCards = [...v.board, ...v.players.flatMap(p => p.cards ?? [])];
  if (v.players.length !== v.botCount + 1 || !unique(ids)
    || !unique(v.players.map(p => p.seat)) || !unique(visibleCards)
    || v.players.some(p => p.seat > v.botCount)
    || v.players.filter(p => p.kind === 'human' && p.seat === 0).length !== 1
    || v.players.filter(p => p.kind === 'human').length !== 1
    || [v.buttonSeat, v.smallBlindSeat, v.bigBlindSeat].some(s => s > v.botCount)) return false;
  if (v.players.reduce((s, p) => s + p.stack + p.handContribution, 0) !== (v.botCount + 1) * 1000
    || v.players.reduce((s, p) => s + p.handContribution, 0) !== v.totalPot
    || v.pots.reduce((s, p) => s + p.amount, 0) !== v.totalPot) return false;
  if (!unique(v.pots.map(p => p.id))
    || v.pots.some(p => [...p.contributorIds, ...p.eligibleIds].some(id => !ids.includes(id)))
    || !unique(v.legalActions.map(a => a.type))) return false;
  if (v.events.some((e, i) => e.handId !== v.handId
    || (i > 0 && e.seq <= v.events[i - 1]!.seq)
    || ('playerId' in e && !ids.includes(e.playerId)))) return false;
  if (v.phase === 'complete') {
    if (!v.result || v.result.handId !== v.handId || v.result.gameStatus !== v.status
      || v.actorId !== null || v.legalActions.length || v.totalPot || v.pots.length) return false;
  } else {
    if (v.result !== null || v.status !== 'playing'
      || v.board.length !== ({ preflop: 0, flop: 3, turn: 4, river: 5 }[v.phase])) return false;
    const actor = v.players.find(p => p.id === v.actorId);
    if (!actor || actor.status !== 'active' || actor.stack === 0) return false;
    if (actor.kind !== 'human' && v.legalActions.length) return false;
  }
  const results = [v.result, v.previousResult].filter(r => r !== null);
  if (results.some(r => r.netChanges.length !== ids.length || r.netChanges.some(n => !ids.includes(n.playerId)))) return false;
  return v.players.every(p => {
    if (p.kind === 'human' || p.cards === null) return true;
    const shown = v.result?.revealedCards.find(r => r.playerId === p.id);
    return v.phase === 'complete' && v.result?.reason === 'showdown'
      && p.status !== 'folded' && !!shown && shown.cards.every((c, i) => c === p.cards?.[i]);
  });
}, 'Inconsistent or private game snapshot');

export const GameResponseSchema = z.strictObject({ game: GameViewSchema.nullable() });
export const GameErrorSchema = z.strictObject({ error: z.strictObject({
  code: z.enum(['INVALID_INPUT', 'GAME_NOT_FOUND', 'STALE_STATE', 'ILLEGAL_ACTION',
    'PRECONDITION_REQUIRED', 'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'INTERNAL_ERROR',
    'AI_UNAVAILABLE', 'AI_ALREADY_PENDING', 'ANALYSIS_NOT_ALLOWED',
    'GAME_NOT_TERMINAL', 'COACH_ALREADY_PENDING', 'RUN_NOT_FOUND']),
  message: z.string().min(1),
}) });
export type GameView = z.infer<typeof GameViewSchema>;
export type LegalAction = z.infer<typeof LegalActionSchema>;
export type HandResult = z.infer<typeof HandResultSchema>;
export type PublicEvent = z.infer<typeof PublicEventSchema>;
export type GameError = z.infer<typeof GameErrorSchema>;
export type MatchAnalysis = z.infer<typeof MatchAnalysisSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type UsageReset = z.infer<typeof UsageResetSchema>;
export type UsageDashboardView = z.infer<typeof UsageDashboardSchema>;

// Week05 contracts are separate from GameView and the Week04 analysis DTO.
export const MAX_TOOL_RESULT_BYTES = 20480;
export function jsonUtf8Bytes(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? Infinity : new TextEncoder().encode(json).byteLength;
  } catch { return Infinity; }
}
const boundedText = (max: number, trim = false) => {
  const text = trim ? z.string().trim() : z.string();
  return text.refine(value => {
    const length = Array.from(value).length;
    return length >= 1 && length <= max;
  }, `Expected 1–${max} Unicode code points`);
};
export const CoachFocusSchema = z.enum(['betting', 'street', 'showdown']);
export const CoachGoalSchema = z.strictObject({ focus: CoachFocusSchema });
export const CoachRequestSchema = z.strictObject({ ...Identity, goal: CoachGoalSchema });
export const DecisionEvidenceArgumentsSchema = z.strictObject({
  focus: CoachFocusSchema, limit: z.number().int().min(1).max(10),
});
export const CoachFactCodeSchema = z.enum(['action', 'phase', 'legal_options', 'known_cards', 'hand_outcome']);
const DecisionRefSchema = z.string().min(1).max(128)
  .refine(value => Array.from(value).every(char => char.charCodeAt(0) <= 127), 'Expected ASCII decisionRef');
export const CoachFactSchema = z.strictObject({ factCode: CoachFactCodeSchema, finding: boundedText(500) });
export const CoachEvidenceSchema = z.strictObject({ decisionRef: DecisionRefSchema, ...CoachFactSchema.shape });
export const DecisionEvidenceResultSchema = z.strictObject({
  factsRevision: Count, focus: CoachFocusSchema, sampleLimited: z.boolean(),
  decisions: z.array(z.strictObject({ decisionRef: DecisionRefSchema,
    facts: z.array(CoachFactSchema).min(1).max(5)
      .refine(facts => unique(facts.map(f => f.factCode)), 'Duplicate fact codes'),
  })).max(10).refine(decisions => unique(decisions.map(d => d.decisionRef)), 'Duplicate decision refs'),
}).refine(value => jsonUtf8Bytes(value) <= MAX_TOOL_RESULT_BYTES, 'Tool result exceeds UTF-8 cap');
const CoachResultFields = {
  summary: boundedText(1000, true), recommendation: boundedText(500, true),
  evidence: z.array(CoachEvidenceSchema).max(10).refine(items =>
    unique(items.map(item => JSON.stringify([item.decisionRef, item.factCode]))), 'Duplicate evidence'),
  confidence: z.enum(['low', 'medium', 'high']), completed: z.boolean(),
};
const hasCompletionEvidence = (value: { completed: boolean; evidence: unknown[] }) =>
  !value.completed || value.evidence.length > 0;
export const CoachResultSchema = z.strictObject(CoachResultFields)
  .refine(hasCompletionEvidence, 'Completed result requires evidence');
export const CoachToolProposalSchema = z.strictObject({ kind: z.literal('tool_request'),
  name: boundedText(128), arguments: z.unknown(),
}).refine(value => Object.hasOwn(value, 'arguments'), 'Arguments are required');
export const CoachRefusalSchema = z.strictObject({ kind: z.literal('refusal'),
  reason: z.enum(['insufficient_context', 'cannot_complete']),
});
export const CoachFinalStepSchema = z.strictObject({ kind: z.literal('final'), ...CoachResultFields })
  .refine(hasCompletionEvidence, 'Completed final requires evidence');
// Stage ordering and name allowlist are application checks, not union parsing.
export const CoachModelStepSchema = z.discriminatedUnion('kind', [
  CoachToolProposalSchema, CoachRefusalSchema, CoachFinalStepSchema,
]).refine(value => jsonUtf8Bytes(value) <= 32768, 'Model step exceeds UTF-8 cap');
export const CoachRunStatusSchema = z.enum(['created', 'running', 'completed', 'stopped', 'failed']);
export const CoachOutputIssueSchema = z.enum(['missing_output', 'output_too_large', 'invalid_json',
  'transport_shape', 'invalid_evidence_index', 'duplicate_evidence', 'missing_completion_evidence',
  'summary_bounds', 'recommendation_bounds', 'final_shape', 'unexpected_fields', 'invalid_kind',
  'invalid_confidence', 'invalid_completion', 'invalid_text_type', 'invalid_evidence_list']);
export type CoachOutputIssue = z.infer<typeof CoachOutputIssueSchema>;
export const CoachFailureCategorySchema = z.enum(['authentication_configuration', 'quota_exhausted',
  'rate_limit', 'provider_timeout', 'provider_unavailable', 'provider_transport', 'provider_refusal',
  'tool_timeout', 'tool_error', 'tool_validation', 'invalid_structured_response', 'evidence_rejected',
  'forbidden_scope']);
export const CoachRunViewSchema = z.strictObject({ ...Identity, runId: z.uuid(), factsRevision: Count,
  goal: CoachGoalSchema, status: CoachRunStatusSchema,
  startedAt: z.iso.datetime(), deadlineAt: z.iso.datetime(),
  stepCount: z.number().int().min(0).max(2), toolCallCount: z.number().int().min(0).max(1),
  providerAttemptCount: z.number().int().min(0).max(4),
  stopReason: CoachStopReasonSchema.nullable(), failureCategory: CoachFailureCategorySchema.nullable(),
  result: CoachResultSchema.nullable(), sampleLimited: z.boolean(),
  outputIssue: CoachOutputIssueSchema.optional(),
}).refine(run => {
  if (run.outputIssue && (run.status !== 'failed' || run.stopReason !== 'malformed_output'
    || run.failureCategory !== 'invalid_structured_response')) return false;
  if (Date.parse(run.deadlineAt) < Date.parse(run.startedAt)
    || run.providerAttemptCount < run.stepCount || run.providerAttemptCount > run.stepCount * 2
    || run.toolCallCount > run.stepCount) return false;
  if (run.status === 'completed') return run.stopReason === 'completed'
    && run.result?.completed === true && run.stepCount === 2 && run.toolCallCount === 1
    && run.failureCategory === null;
  if (run.result !== null) return false;
  if (run.status === 'created' || run.status === 'running') return run.stopReason === null
    && run.failureCategory === null;
  const failed = ['provider_failed', 'tool_failed', 'malformed_output'];
  if (run.status === 'failed') return failed.includes(run.stopReason ?? '') && run.failureCategory !== null;
  return run.stopReason !== null && run.stopReason !== 'completed' && !failed.includes(run.stopReason);
}, 'Inconsistent run status, counters or completion');
export const CoachResponseSchema = z.strictObject({ run: CoachRunViewSchema });

// Pure contextual contract only. The backend must first validate this tool output
// against the trusted snapshot (T011); final lifecycle validation belongs to T015.
export function coachResultForEvidence(output: DecisionEvidenceResult) {
  const parsed = DecisionEvidenceResultSchema.parse(output);
  return CoachResultSchema.refine(result => result.evidence.every(item =>
    parsed.decisions.some(decision => decision.decisionRef === item.decisionRef
      && decision.facts.some(fact => fact.factCode === item.factCode && fact.finding === item.finding))),
  'Evidence was not supplied by this tool result');
}
export type CoachGoal = z.infer<typeof CoachGoalSchema>;
export type CoachRequest = z.infer<typeof CoachRequestSchema>;
export type DecisionEvidenceArguments = z.infer<typeof DecisionEvidenceArgumentsSchema>;
export type DecisionEvidenceResult = z.infer<typeof DecisionEvidenceResultSchema>;
export type CoachFact = z.infer<typeof CoachFactSchema>;
export type CoachEvidence = z.infer<typeof CoachEvidenceSchema>;
export type CoachResult = z.infer<typeof CoachResultSchema>;
export type CoachModelStep = z.infer<typeof CoachModelStepSchema>;
export type CoachRunView = z.infer<typeof CoachRunViewSchema>;
