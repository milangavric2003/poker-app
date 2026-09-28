import type { Card, LegalAction, PokerAction } from '../engine/types.js';
import type { PublicEvent } from '../../../shared/contracts.js';
import type { GameState } from '../session.js';

export interface HumanDecisionFact {
  decisionRef: string; gameId: string; handId: string; expectedVersion: number;
  handNumber: number; decisionOrdinal: number;
  knowledge: { phase: string; board: readonly Card[]; holeCards: readonly [Card, Card];
    humanStackAtHandStart: number;
    players: ReadonlyArray<{ id: string; stack: number; streetContribution: number;
      handContribution: number; status: string }>;
    pots: ReadonlyArray<{ amount: number; contributionCap: number; contributorIds: readonly string[];
      eligibleIds: readonly string[] }>;
    legalActions: readonly LegalAction[]; events: readonly PublicEvent[] };
  chosenAction: PokerAction;
  outcome: null | { reason: 'showdown' | 'uncontested'; gameStatus: string; humanNetChange: number };
}
export interface HandFactAggregate { handId: string; handNumber: number; decisionCount: number;
  actionCounts: Partial<Record<PokerAction['type'], number>>; startingStack: number;
  endingStack: number | null; humanNetChange: number | null; }
export interface MatchFacts { gameId: string; revision: number; decisions: HumanDecisionFact[];
  aggregates: HandFactAggregate[]; nextDecisionOrdinal: number; }

export function createMatchFacts(gameId: string): MatchFacts {
  return { gameId, revision: 0, decisions: [], aggregates: [], nextDecisionOrdinal: 1 };
}

function publicPots(game: GameState): HumanDecisionFact['knowledge']['pots'] {
  const levels = [...new Set(game.hand.players.map(player => player.handContribution)
    .filter(amount => amount > 0))].sort((a, b) => a - b);
  let previous = 0;
  return levels.map(level => {
    const contributors = game.hand.players.filter(player => player.handContribution >= level);
    const pot = { amount: (level - previous) * contributors.length, contributionCap: level,
      contributorIds: contributors.map(player => player.id), eligibleIds: contributors
        .filter(player => player.status !== 'folded' && player.status !== 'eliminated')
        .map(player => player.id) };
    previous = level;
    return pot;
  });
}

export function recordHumanDecision(facts: MatchFacts, game: GameState,
  action: PokerAction, legalActions: readonly LegalAction[]): MatchFacts {
  const human = game.hand.players.find(p => p.kind === 'human')!;
  const ordinal = facts.nextDecisionOrdinal;
  const fact: HumanDecisionFact = { decisionRef: `${game.hand.handId}:${ordinal}`,
    gameId: game.gameId, handId: game.hand.handId, expectedVersion: game.version,
    handNumber: game.handNumber, decisionOrdinal: ordinal,
    knowledge: { phase: game.hand.phase, board: [...game.hand.board],
      holeCards: [human.holeCards[0]!, human.holeCards[1]!],
      humanStackAtHandStart: human.stackAtHandStart,
      players: game.hand.players.map(p => ({ id: p.id, stack: p.stack,
        streetContribution: p.streetContribution, handContribution: p.handContribution,
        status: p.status })), pots: publicPots(game),
      legalActions: structuredClone(legalActions), events: structuredClone(game.history.current.events.slice(-64)) },
    chosenAction: structuredClone(action), outcome: null };
  const decisions = [...facts.decisions, fact];
  const aggregates = [...facts.aggregates];
  if (decisions.length > 200) {
    const removed = decisions.shift()!;
    let aggregate = aggregates.find(a => a.handId === removed.handId);
    if (!aggregate) { aggregate = { handId: removed.handId, handNumber: removed.handNumber,
      decisionCount: 0, actionCounts: {}, startingStack: removed.knowledge.humanStackAtHandStart,
      endingStack: null, humanNetChange: null }; aggregates.push(aggregate); }
    aggregate.decisionCount++;
    aggregate.actionCounts[removed.chosenAction.type] = (aggregate.actionCounts[removed.chosenAction.type] ?? 0) + 1;
  }
  return { ...facts, revision: facts.revision + 1, decisions, aggregates,
    nextDecisionOrdinal: ordinal + 1 };
}
export function attachHandOutcome(facts: MatchFacts, game: GameState): MatchFacts {
  const result = game.hand.result;
  if (!result) return facts;
  const human = game.hand.players.find(p => p.kind === 'human')!;
  let changed = false;
  const humanNetChange = result.netChanges.find(n => n.playerId === human.id)?.amount ?? 0;
  const decisions = facts.decisions.map(fact => {
    if (fact.handId !== result.handId || fact.outcome) return fact;
    changed = true;
    return { ...fact, outcome: { reason: result.reason, gameStatus: result.gameStatus,
      humanNetChange } };
  });
  const aggregates = facts.aggregates.map(aggregate => {
    if (aggregate.handId !== result.handId || aggregate.endingStack !== null) return aggregate;
    changed = true;
    return { ...aggregate, endingStack: human.stack, humanNetChange };
  });
  return changed ? { ...facts, revision: facts.revision + 1, decisions, aggregates } : facts;
}

export function analysisContext(facts: MatchFacts): Readonly<Record<string, unknown>> {
  return structuredClone({ gameId: facts.gameId, factsRevision: facts.revision,
    decisions: facts.decisions, aggregates: facts.aggregates });
}
