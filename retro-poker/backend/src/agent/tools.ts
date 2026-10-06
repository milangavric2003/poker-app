import { CoachFactSchema, DecisionEvidenceArgumentsSchema, DecisionEvidenceResultSchema,
  MAX_TOOL_RESULT_BYTES, jsonUtf8Bytes, type CoachFact, type DecisionEvidenceArguments,
  type DecisionEvidenceResult } from '../../../shared/contracts.js';
import type { HumanDecisionFact, MatchFacts } from '../ai/match-facts.js';

type DeepReadonly<T> = { readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K] };
export interface TerminalFactsSnapshot {
  readonly gameId: string;
  readonly handId: string;
  readonly expectedVersion: number;
  readonly factsRevision: number;
  readonly status: 'won' | 'lost';
  readonly facts: DeepReadonly<MatchFacts>;
}
export interface ToolControls {
  signal?: AbortSignal;
  now?: () => number;
  /** Absolute monotonic run deadline, in the same clock domain as now. */
  deadlineAt?: number;
}
export class EvidenceToolError extends Error {
  constructor(readonly category: 'invalid_snapshot' | 'cancelled' | 'tool_timeout') {
    super(category);
    this.name = 'EvidenceToolError';
  }
}
function checkpoint(controls: ToolControls, now: () => number, deadline: number) {
  if (controls.signal?.aborted) throw new EvidenceToolError('cancelled');
  if (now() >= deadline) throw new EvidenceToolError('tool_timeout');
}
function assertSnapshot(snapshot: TerminalFactsSnapshot) {
  if ((snapshot.status !== 'won' && snapshot.status !== 'lost')
    || snapshot.gameId !== snapshot.facts.gameId || snapshot.factsRevision !== snapshot.facts.revision
    || !Number.isSafeInteger(snapshot.factsRevision) || snapshot.factsRevision < 0
    || !Number.isSafeInteger(snapshot.expectedVersion) || snapshot.expectedVersion < 0
    || !snapshot.handId || snapshot.facts.decisions.length > 200) {
    throw new EvidenceToolError('invalid_snapshot');
  }
}
function matches(decision: DeepReadonly<HumanDecisionFact>, focus: DecisionEvidenceArguments['focus']) {
  if (focus === 'betting') return ['bet', 'raise', 'call', 'all_in'].includes(decision.chosenAction.type);
  return focus === 'street' || decision.outcome?.reason === 'showdown';
}

/** Canonical allowlist projection. No events, opponents, pots, stacks or engine state. */
export function projectDecisionFacts(decision: DeepReadonly<HumanDecisionFact>): CoachFact[] {
  const action = decision.chosenAction;
  const chosenAction = action.type === 'bet' || action.type === 'raise'
    ? { type: action.type, amountTo: action.amountTo } : { type: action.type };
  const legalActions = decision.knowledge.legalActions.map(action => {
    switch (action.type) {
      case 'fold': case 'check': return { type: action.type };
      case 'call': return { type: action.type, payAmount: action.payAmount, isAllIn: action.isAllIn };
      case 'bet': case 'raise': return { type: action.type, minAmountTo: action.minAmountTo,
        maxAmountTo: action.maxAmountTo };
      case 'all_in': return { type: action.type, amountTo: action.amountTo,
        payAmount: action.payAmount, classification: action.classification };
    }
  });
  const values: Array<[CoachFact['factCode'], unknown]> = [
    ['action', chosenAction], ['phase', decision.knowledge.phase], ['legal_options', legalActions],
    ['known_cards', { board: [...decision.knowledge.board], holeCards: [...decision.knowledge.holeCards] }],
  ];
  // Later outcome is a separate fact, never folded into pre-action knowledge.
  if (decision.outcome) values.push(['hand_outcome', { reason: decision.outcome.reason,
    gameStatus: decision.outcome.gameStatus, humanNetChange: decision.outcome.humanNetChange }]);
  return values.flatMap(([factCode, value]) => {
    const parsed = CoachFactSchema.safeParse({ factCode, finding: JSON.stringify(value) });
    return parsed.success ? [parsed.data] : [];
  });
}

/** Local synchronous executor. Caller binds the trusted terminal fingerprint;
 * model arguments can select only focus/limit. No model proposal is executed here. */
export function getDecisionEvidence(snapshot: TerminalFactsSnapshot, candidate: unknown,
  controls: ToolControls = {}): DecisionEvidenceResult {
  const args = DecisionEvidenceArgumentsSchema.parse(candidate);
  const now = controls.now ?? (() => performance.now());
  const start = now();
  const deadline = Math.min(start + 1000, controls.deadlineAt ?? Infinity);
  checkpoint(controls, now, deadline);
  assertSnapshot(snapshot);
  const ordinals = new Set<number>();
  const refs = new Set<string>();
  const eligible: DeepReadonly<HumanDecisionFact>[] = [];
  for (const decision of snapshot.facts.decisions) {
    checkpoint(controls, now, deadline);
    if (decision.gameId !== snapshot.gameId
      || decision.decisionRef !== `${decision.handId}:${decision.decisionOrdinal}`
      || !Number.isSafeInteger(decision.decisionOrdinal) || decision.decisionOrdinal < 1
      || !Number.isSafeInteger(decision.expectedVersion) || decision.expectedVersion < 0
      || decision.expectedVersion > snapshot.expectedVersion
      || ordinals.has(decision.decisionOrdinal) || refs.has(decision.decisionRef)) {
      throw new EvidenceToolError('invalid_snapshot');
    }
    ordinals.add(decision.decisionOrdinal); refs.add(decision.decisionRef);
    if (matches(decision, args.focus)) eligible.push(decision);
  }
  eligible.sort((a, b) => a.decisionOrdinal - b.decisionOrdinal);
  const result: DecisionEvidenceResult = { factsRevision: snapshot.factsRevision, focus: args.focus,
    sampleLimited: snapshot.facts.aggregates.length > 0 || eligible.length > args.limit, decisions: [] };
  for (const decision of eligible.slice(-args.limit)) {
    checkpoint(controls, now, deadline);
    const facts = projectDecisionFacts(decision);
    if (facts.length < (decision.outcome ? 5 : 4)) result.sampleLimited = true;
    if (facts.length > 0) result.decisions.push({ decisionRef: decision.decisionRef, facts });
  }
  while (jsonUtf8Bytes(result) > MAX_TOOL_RESULT_BYTES && result.decisions.length > 0) {
    checkpoint(controls, now, deadline);
    result.sampleLimited = true; result.decisions.shift();
  }
  checkpoint(controls, now, deadline);
  return DecisionEvidenceResultSchema.parse(result);
}
export const AGENT_TOOLS = Object.freeze({ get_decision_evidence: Object.freeze({
  name: 'get_decision_evidence' as const,
  argumentsSchema: DecisionEvidenceArgumentsSchema,
  resultSchema: DecisionEvidenceResultSchema,
  execute: getDecisionEvidence,
}) });
