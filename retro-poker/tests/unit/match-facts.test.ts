import { describe, expect, it } from 'vitest';
import { attachHandOutcome, createMatchFacts, recordHumanDecision } from '../../backend/src/ai/match-facts.js';
import { legalActions } from '../../backend/src/engine/betting.js';
import { GameSession } from '../../backend/src/session.js';
import type { PublicEvent } from '../../shared/contracts.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

function session() {
  return new GameSession({ deck: ac23Deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(500).fill(0.9)) });
}

describe('bounded match facts (FR-017, FR-026, SC-006)', () => {
  it('starts empty with an independent revision', () => {
    expect(createMatchFacts('game')).toEqual({ gameId: 'game', revision: 0,
      decisions: [], aggregates: [], nextDecisionOrdinal: 1 });
  });

  it('captures only pre-action knowledge and keeps chosen action separate from later outcome', () => {
    const current = session().create(1);
    const human = current.hand.players.find(player => player.kind === 'human')!;
    const beforeBoard = [...current.hand.board];
    const beforeCards = [...human.holeCards];
    const facts = recordHumanDecision(current.facts, current, { type: 'call' },
      legalActions(current.hand, human.id));
    current.hand.board.push('2c', '3d', '4h');

    expect(facts.revision).toBe(1);
    expect(facts.decisions[0]).toMatchObject({ gameId: current.gameId,
      handId: current.hand.handId, expectedVersion: 1, handNumber: 1, decisionOrdinal: 1,
      chosenAction: { type: 'call' }, outcome: null,
      knowledge: { phase: 'preflop', board: beforeBoard, holeCards: beforeCards,
        pots: [{ amount: 10, contributionCap: 5 }, { amount: 5, contributionCap: 10 }] } });
    expect(facts.decisions[0]!.knowledge.board).not.toContain('2c');
    current.hand.players[0]!.stack = 1;
    expect(facts.decisions[0]!.knowledge.players[0]!.stack).toBe(995);
  });

  it('attaches verified settlement later and increments revision exactly once', () => {
    const game = session();
    const initial = game.create(1);
    const completed = game.action({ gameId: initial.gameId, handId: initial.hand.handId,
      expectedVersion: initial.version, type: 'fold' });
    expect(completed.hand.result).not.toBeNull();
    expect(completed.facts.revision).toBe(2);
    expect(completed.facts.decisions).toHaveLength(1);
    expect(completed.facts.decisions[0]).toMatchObject({ chosenAction: { type: 'fold' },
      outcome: { reason: 'uncontested', gameStatus: 'playing' } });
    expect(Number.isInteger(completed.facts.decisions[0]!.outcome!.humanNetChange)).toBe(true);
    expect(attachHandOutcome(completed.facts, completed)).toBe(completed.facts);
  });

  it('keeps at most the last 64 public events in each immutable pre-action snapshot', () => {
    const current = session().create(1);
    const template = current.history.current.events[0]!;
    current.history.current.events = Array.from({ length: 70 }, (_, index) => ({
      ...template, seq: index + 1,
    })) as PublicEvent[];
    const human = current.hand.players.find(player => player.kind === 'human')!;
    const facts = recordHumanDecision(current.facts, current, { type: 'fold' },
      legalActions(current.hand, human.id));
    expect(facts.decisions[0]!.knowledge.events).toHaveLength(64);
    expect(facts.decisions[0]!.knowledge.events[0]!.seq).toBe(7);
    current.history.current.events[69]!.seq = 999;
    expect(facts.decisions[0]!.knowledge.events.at(-1)!.seq).toBe(70);
  });

  it('retains 200 details and reduces older decisions to numeric hand aggregates', () => {
    const current = session().create(1);
    const human = current.hand.players.find(player => player.kind === 'human')!;
    let facts = createMatchFacts(current.gameId);
    facts = recordHumanDecision(facts, current, { type: 'fold' }, legalActions(current.hand, human.id));
    human.stackAtHandStart = 777;
    for (let index = 1; index < 205; index++) {
      facts = recordHumanDecision(facts, current, index % 2 ? { type: 'call' } : { type: 'fold' },
        legalActions(current.hand, human.id));
    }
    expect(facts.decisions).toHaveLength(200);
    expect(facts.decisions[0]!.decisionOrdinal).toBe(6);
    expect(facts.revision).toBe(205);
    expect(facts.nextDecisionOrdinal).toBe(206);
    expect(facts.aggregates).toEqual([{ handId: current.hand.handId, handNumber: 1,
      decisionCount: 5, actionCounts: { fold: 3, call: 2 },
      startingStack: 1000, endingStack: null, humanNetChange: null }]);
  });

  it('settles both retained details and already summarized decisions', () => {
    const game = session();
    const current = game.create(1);
    const human = current.hand.players.find(player => player.kind === 'human')!;
    let facts = createMatchFacts(current.gameId);
    for (let index = 0; index < 205; index++) facts = recordHumanDecision(facts, current,
      { type: 'fold' }, legalActions(current.hand, human.id));
    current.facts = facts;
    const completed = game.action({ gameId: current.gameId, handId: current.hand.handId,
      expectedVersion: current.version, type: 'fold' });
    expect(completed.facts.revision).toBe(207);
    expect(completed.facts.decisions.every(decision => decision.outcome !== null)).toBe(true);
    expect(completed.facts.aggregates).toEqual([{ handId: current.hand.handId, handNumber: 1,
      decisionCount: 6, actionCounts: { fold: 6 }, startingStack: 1000,
      endingStack: completed.hand.players.find(player => player.kind === 'human')!.stack,
      humanNetChange: completed.hand.result!.netChanges.find(change => change.playerId === human.id)!.amount }]);
  });

  it('new game/reset replaces all facts and restarts revision and ordinal', () => {
    const game = session();
    const first = game.create(1);
    game.action({ gameId: first.gameId, handId: first.hand.handId,
      expectedVersion: first.version, type: 'fold' });
    expect(game.get()!.facts.decisions).toHaveLength(1);
    const replacement = game.create(1);
    expect(replacement.gameId).not.toBe(first.gameId);
    expect(replacement.facts).toEqual({ gameId: replacement.gameId, revision: 0,
      decisions: [], aggregates: [], nextDecisionOrdinal: 1 });
  });
});
