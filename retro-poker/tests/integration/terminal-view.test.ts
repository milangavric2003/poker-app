import { describe, expect, it } from 'vitest';
import { buildApp } from '../../backend/src/app.js';
import { GameResponseSchema } from '../../shared/contracts.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';

describe('terminal all-in HTTP snapshot', () => {
  it.each(['won', 'lost'] as const)('validates a %s game while preserving showdown evidence', async status => {
    const deck = status === 'won' ? ac23Deck
      : ['As', 'Kc', 'Ah', 'Kd', ...ac23Deck.slice(4)] as const;
    const app = buildApp({ deck, deckRandom: sequenceRandom([]), botRandom: sequenceRandom([0.9]) });
    try {
      const initial = (await app.inject({ method: 'POST', url: '/api/game',
        headers: { 'content-type': 'application/json', 'if-none-match': '*' },
        payload: { botCount: 1, aiMode: false } })).json().game;
      const response = await app.inject({ method: 'POST', url: '/api/game/actions',
        headers: { 'content-type': 'application/json' }, payload: { gameId: initial.gameId,
          handId: initial.handId, expectedVersion: initial.version, type: 'all_in' } });
      expect(response.statusCode).toBe(200);
      const game = response.json().game;
      expect(game.status).toBe(status);
      expect(GameResponseSchema.safeParse(response.json()).success).toBe(true);
      const eliminated = game.players.find((player: { status: string }) => player.status === 'eliminated');
      expect(eliminated.cards).toBeNull();
      expect(game.result.revealedCards).toEqual(expect.arrayContaining([
        expect.objectContaining({ playerId: eliminated.id, cards: expect.any(Array) }),
      ]));
    } finally { await app.close(); }
  });
});
