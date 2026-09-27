import { describe, expect, it } from 'vitest';
import { GameSession } from '../../backend/src/session.js';
import { buildBotDecisionContext } from '../../backend/src/ai/context.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';
import { FakeAiProvider } from '../helpers/fake-ai-provider.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';

describe('privacy-safe bot context', () => {
  it('allowlists one bot hand and at most 64 current public events', () => {
    const session = new GameSession({ deck: ac23Deck, deckRandom: sequenceRandom([]), botRandom: sequenceRandom([0.9]),
      aiProvider: new FakeAiProvider([{ kind: 'pending' }]), aiConfig: loadAiConfig({ GEMINI_API_KEY: 'test' }) });
    const game = session.create(3, true);
    const bot = game.hand.players.find(p => p.id === game.hand.actorId && p.kind === 'bot')!;
    const context = buildBotDecisionContext(game, bot.id, 1);
    expect(context.holeCards).toEqual(bot.holeCards);
    expect(JSON.stringify(context)).not.toContain('deckRandom');
    expect(JSON.stringify(context)).not.toContain('holeCards":[' + game.hand.players[0]!.holeCards.join(','));
    expect(context.history.length).toBeLessThanOrEqual(64);
  });
});
