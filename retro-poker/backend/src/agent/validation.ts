import { DecisionEvidenceArgumentsSchema, DecisionEvidenceResultSchema, MAX_TOOL_RESULT_BYTES,
  CoachFinalStepSchema, coachResultForEvidence, jsonUtf8Bytes, type CoachResult, type DecisionEvidenceResult } from '../../../shared/contracts.js';
import { projectDecisionFacts, type TerminalFactsSnapshot } from './tools.js';

export type FinalOutputValidation = { status: 'valid'; result: CoachResult }
  | { status: 'insufficient_evidence' } | { status: 'rejected'; category: 'evidence_rejected' };

/** Pure final-stage policy. evidence must already have passed validateDecisionEvidence. */
export function validateFinalOutput(candidate: unknown, evidence: DecisionEvidenceResult): FinalOutputValidation {
  const rejected = { status: 'rejected', category: 'evidence_rejected' } as const;
  try {
    const bytes = typeof candidate === 'string' ? new TextEncoder().encode(candidate).byteLength : jsonUtf8Bytes(candidate);
    if (bytes > 32768) return rejected;
    const parsed = CoachFinalStepSchema.safeParse(typeof candidate === 'string' ? JSON.parse(candidate) : candidate);
    if (!parsed.success) return rejected;
    const value = { summary: parsed.data.summary, recommendation: parsed.data.recommendation,
      evidence: parsed.data.evidence, confidence: parsed.data.confidence, completed: parsed.data.completed };
    const result = coachResultForEvidence(evidence).safeParse(value);
    if (!result.success) return rejected;
    if (!result.data.completed || evidence.decisions.length === 0) return { status: 'insufficient_evidence' };
    return { status: 'valid', result: result.data };
  } catch { return rejected; }
}

export type ToolResultValidation =
  | { status: 'valid' | 'insufficient_evidence'; result: DecisionEvidenceResult }
  | { status: 'rejected'; category: 'tool_validation' };

/** Validate untrusted output against this run's trusted snapshot and parsed args.
 * Re-project facts, without invoking a tool executor or accepting model-selected scope.
 * Exact canonical comparison also rejects fabricated emptiness, omissions, order,
 * sample flags and results from other snapshots that happen to share a revision. */
export function validateDecisionEvidence(candidate: unknown, snapshot: TerminalFactsSnapshot,
  argumentsCandidate: unknown): ToolResultValidation {
  const rejected = { status: 'rejected', category: 'tool_validation' } as const;
  try {
    if (jsonUtf8Bytes(candidate) > MAX_TOOL_RESULT_BYTES) return rejected;
    const output = DecisionEvidenceResultSchema.safeParse(candidate);
    const args = DecisionEvidenceArgumentsSchema.safeParse(argumentsCandidate);
    if (!output.success || !args.success || snapshot.facts.decisions.length > 200
      || !snapshot.handId
      || (snapshot.status !== 'won' && snapshot.status !== 'lost')
      || snapshot.gameId !== snapshot.facts.gameId || snapshot.factsRevision !== snapshot.facts.revision
      || !Number.isSafeInteger(snapshot.expectedVersion) || snapshot.expectedVersion < 0
      || output.data.factsRevision !== snapshot.factsRevision || output.data.focus !== args.data.focus
      || output.data.decisions.length > args.data.limit) return rejected;
    const ordinals = new Set<number>(); const refs = new Set<string>();
    for (const decision of snapshot.facts.decisions) {
      if (decision.gameId !== snapshot.gameId
        || decision.decisionRef !== `${decision.handId}:${decision.decisionOrdinal}`
        || !Number.isSafeInteger(decision.decisionOrdinal) || decision.decisionOrdinal < 1
        || !Number.isSafeInteger(decision.expectedVersion) || decision.expectedVersion < 0
        || decision.expectedVersion > snapshot.expectedVersion
        || ordinals.has(decision.decisionOrdinal) || refs.has(decision.decisionRef)) return rejected;
      ordinals.add(decision.decisionOrdinal); refs.add(decision.decisionRef);
    }
    const eligible = snapshot.facts.decisions.filter(decision => args.data.focus === 'street'
      || (args.data.focus === 'betting' && ['bet', 'raise', 'call', 'all_in'].includes(decision.chosenAction.type))
      || (args.data.focus === 'showdown' && decision.outcome?.reason === 'showdown'))
      .sort((a, b) => a.decisionOrdinal - b.decisionOrdinal);
    const canonical: DecisionEvidenceResult = { factsRevision: snapshot.factsRevision, focus: args.data.focus,
      sampleLimited: snapshot.facts.aggregates.length > 0 || eligible.length > args.data.limit, decisions: [] };
    for (const decision of eligible.slice(-args.data.limit)) {
      const facts = projectDecisionFacts(decision);
      if (facts.length < (decision.outcome ? 5 : 4)) canonical.sampleLimited = true;
      if (facts.length) canonical.decisions.push({ decisionRef: decision.decisionRef, facts });
    }
    while (jsonUtf8Bytes(canonical) > MAX_TOOL_RESULT_BYTES && canonical.decisions.length) {
      canonical.sampleLimited = true; canonical.decisions.shift();
    }
    if (JSON.stringify(output.data) !== JSON.stringify(canonical)) return rejected;
    return { status: output.data.decisions.length ? 'valid' : 'insufficient_evidence', result: output.data };
  } catch {
    // Never expose source data, raw exceptions or untrusted candidate in diagnostics.
    return rejected;
  }
}
