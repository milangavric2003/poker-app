// Future T019/T022 in-process harness boundary, not a game server implementation.
import type { GameDependencies } from '../../backend/src/engine/types.js';
import { ac23Deck, sequenceRandom } from './fixtures.js';
export function testDependencies(): GameDependencies {
  return { deck: ac23Deck, deckRandom: sequenceRandom([0.1, 0.2, 0.3]),
    botRandom: sequenceRandom([0.9, 0.9, 0.9]) };
}

