import { describe, expect, it } from 'vitest';
import { createMatchFacts } from '../../backend/src/ai/match-facts.js';

describe('bounded match facts', () => {
  it('starts empty with an independent revision', () => {
    expect(createMatchFacts('game')).toEqual({ gameId: 'game', revision: 0,
      decisions: [], aggregates: [], nextDecisionOrdinal: 1 });
  });
});
