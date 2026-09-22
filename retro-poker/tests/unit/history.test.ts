import { describe, expect, it } from 'vitest';
import { appendEvent, completeHistory, createHistory } from '../../backend/src/engine/history.js';

describe('T016 FR-018 istorija', () => {
  it('događaji imaju strogo rastući seq u tekućoj ruci', () => {
    let history = createHistory('22222222-2222-4222-8222-222222222222');
    history = appendEvent(history, { type: 'hand_started', street: 'preflop', number: 1,
      buttonSeat: 0, smallBlindSeat: 0, bigBlindSeat: 1 });
    history = appendEvent(history, { type: 'action', street: 'preflop', playerId: 'player-0',
      actionType: 'fold', payAmount: 0, amountTo: 5 });
    expect(history.current.events.map(event => event.seq)).toEqual([1, 2]);
  });

  it('čuva samo tekuću i poslednju završenu ruku', () => {
    let history = appendEvent(createHistory('22222222-2222-4222-8222-222222222222'),
      { type: 'settled', street: 'complete', reason: 'uncontested' });
    history = completeHistory(history, '33333333-3333-4333-8333-333333333333');
    history = appendEvent(history, { type: 'settled', street: 'complete', reason: 'showdown' });
    history = completeHistory(history, '44444444-4444-4444-8444-444444444444');
    expect(history.previous?.handId).toBe('33333333-3333-4333-8333-333333333333');
    expect(history.current.handId).toBe('44444444-4444-4444-8444-444444444444');
    expect(JSON.stringify(history)).not.toContain('22222222-2222-4222-8222-222222222222');
  });

  it('javni događaj ne prihvata privatni observation', () => {
    const history = createHistory('22222222-2222-4222-8222-222222222222');
    expect(() => appendEvent(history, { type: 'action', street: 'preflop', playerId: 'player-1',
      actionType: 'check', payAmount: 0, amountTo: 10,
      observation: { holeCards: ['As', 'Ah'] } } as never)).toThrow('Invalid public event');
  });
});
