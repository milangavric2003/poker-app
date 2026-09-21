import { describe, expect, it } from 'vitest';
import { PlayerActionSchema, NextHandSchema } from '../../shared/contracts.js';
import { GameViewSchema, GameResponseSchema, GameErrorSchema, HandResultSchema,
  LegalActionSchema, PublicEventSchema } from '../../shared/contracts.js';
import { publicView, handResult, handId } from '../helpers/public-fixtures.js';

const ids = { gameId: '11111111-1111-4111-8111-111111111111',
  handId: '22222222-2222-4222-8222-222222222222', expectedVersion: 0 };
describe('command contracts', () => {
  it.each(['fold', 'check', 'call', 'all_in'])('accepts %s without amount', type => {
    expect(PlayerActionSchema.parse({ ...ids, type })).toEqual({ ...ids, type });
    expect(PlayerActionSchema.safeParse({ ...ids, type, amountTo: 1 }).success).toBe(false);
  });
  it.each(['bet', 'raise'])('requires bounded amountTo for %s', type => {
    for (const amountTo of [1, 60, 6000]) {
      expect(PlayerActionSchema.parse({ ...ids, type, amountTo })).toEqual({ ...ids, type, amountTo });
    }
    for (const amountTo of [0, -1, 0.5, 6001, '60', null, undefined]) {
      expect(PlayerActionSchema.safeParse({ ...ids, type, amountTo }).success).toBe(false);
    }
  });
  it.each([{ gameId: 'wrong' }, { handId: null }, { expectedVersion: -1 },
    { expectedVersion: 1.5 }, { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
    { expectedVersion: '0' }, { actorId: 'bot' }, { type: 'dance' }])('rejects command patch %j', patch => {
    expect(PlayerActionSchema.safeParse({ ...ids, type: 'check', ...patch }).success).toBe(false);
  });
  it('requires identities and revision', () => {
    expect(PlayerActionSchema.safeParse({ type: 'fold' }).success).toBe(false);
    expect(NextHandSchema.safeParse({}).success).toBe(false);
  });
  it('next-hand accepts only the three precondition fields', () => {
    expect(NextHandSchema.parse(ids)).toEqual(ids);
    expect(NextHandSchema.safeParse({ ...ids, type: 'next' }).success).toBe(false);
  });
});

describe('output contracts', () => {
  const actions = [{ type: 'fold' }, { type: 'check' },
    { type: 'call', payAmount: 5, isAllIn: false },
    { type: 'bet', minAmountTo: 10, maxAmountTo: 1000 },
    { type: 'raise', minAmountTo: 20, maxAmountTo: 1000 },
    { type: 'all_in', amountTo: 1000, payAmount: 995, classification: 'raise' }];
  it.each(actions)('accepts legal action %j', value => {
    expect(LegalActionSchema.parse(value)).toEqual(value);
    expect(LegalActionSchema.safeParse({ ...value, secret: 42 }).success).toBe(false);
  });
  it.each([{ type: 'call', payAmount: -1, isAllIn: false },
    { type: 'raise', minAmountTo: 100, maxAmountTo: 50 },
    { type: 'all_in', amountTo: 4, payAmount: 5, classification: 'call' },
    { type: 'all_in', amountTo: 5, payAmount: 5, classification: 'check' }])('rejects inconsistent action %j', value => expect(LegalActionSchema.safeParse(value).success).toBe(false));

  const events = [
    { type: 'hand_started', number: 1, buttonSeat: 0, smallBlindSeat: 0, bigBlindSeat: 1 },
    { type: 'blind_posted', playerId: 'p0', blind: 'small', amount: 5 },
    { type: 'action', playerId: 'p0', actionType: 'call', payAmount: 5, amountTo: 10 },
    { type: 'board_dealt', cards: ['2c', '3d', '7h'] },
    { type: 'refund', playerId: 'p0', amount: 5 },
    { type: 'settled', reason: 'showdown' },
  ];
  it.each(events)('accepts public event %j', event => {
    const value = { seq: 1, handId, street: 'flop', ...event };
    expect(PublicEventSchema.parse(value)).toEqual(value);
    expect(PublicEventSchema.safeParse({ ...value, deck: ['As'] }).success).toBe(false);
    expect(PublicEventSchema.safeParse({ ...value, seq: 0 }).success).toBe(false);
  });
  it('rejects invalid board event lengths and duplicates', () => {
    for (const cards of [[], ['2c', '3c'], ['As', 'As', 'Kd']]) {
      expect(PublicEventSchema.safeParse({ seq: 1, handId, street: 'flop', type: 'board_dealt', cards }).success).toBe(false);
    }
  });
  it('accepts empty and active game envelope', () => {
    expect(GameResponseSchema.parse({ game: null })).toEqual({ game: null });
    expect(GameResponseSchema.parse({ game: publicView() })).toEqual({ game: publicView() });
    expect(GameResponseSchema.safeParse({ game: null, deck: [] }).success).toBe(false);
  });
  it('requires all snapshot fields', () => {
    expect(GameViewSchema.parse(publicView())).toEqual(publicView());
    for (const key of Object.keys(publicView())) {
      const value: Record<string, unknown> = publicView();
      delete value[key];
      expect(GameViewSchema.safeParse(value).success, key).toBe(false);
    }
  });
  it.each([
    { version: -1 }, { version: 1.5 }, { handNumber: 0 }, { status: 'paused' },
    { phase: 'flop' }, { board: ['As'] }, { board: ['2c', '3d', '7h'] },
    { actorId: 'missing' }, { botCount: 2 }, { totalPot: 14 }, { deck: [] },
    { result: handResult() }, { buttonSeat: 6 }, { legalActions: [{ type: 'check', secret: 2 }] },
  ])('rejects inconsistent public snapshot %j', patch => {
    expect(GameViewSchema.safeParse({ ...publicView(), ...patch }).success).toBe(false);
  });
  it('rejects duplicate seats, cards and unknown nested fields', () => {
    const view = publicView();
    const first = view.players[0]!;
    const second = view.players[1]!;
    for (const patch of [{ seat: 0 }, { id: 'p0' }, { cards: ['Kc', 'Kd'] },
      { stack: -1 }, { cards: ['As', 'Kd'] }, { deck: [] }, { handContribution: 9 }]) {
      expect(GameViewSchema.safeParse({ ...view, players: [first, { ...second, ...patch }] }).success).toBe(false);
    }
  });
  it('rejects repeated event sequence and wrong hand', () => {
    const view = publicView();
    expect(GameViewSchema.safeParse({ ...view, events: [view.events[0], view.events[0]] }).success).toBe(false);
    expect(GameViewSchema.safeParse({ ...view, events: [{ ...view.events[0], handId: ids.gameId }] }).success).toBe(false);
  });
  it('validates payouts, winner eligibility and zero-sum net result', () => {
    const result = handResult();
    expect(HandResultSchema.parse(result)).toEqual(result);
    expect(HandResultSchema.safeParse({ ...result, netChanges: [{ playerId: 'p0', amount: 1 }] }).success).toBe(false);
    for (const patch of [{ amount: 21 }, { winnerIds: ['missing'] },
      { payouts: [{ playerId: 'p1', amount: 20 }] }]) {
      expect(HandResultSchema.safeParse({ ...result, pots: [{ ...result.pots[0], ...patch }] }).success).toBe(false);
    }
  });
  it('accepts settled view only with result and no pending pot/actor/actions', () => {
    const v = publicView();
    const value = { ...v, phase: 'complete', actorId: null, board: ['2c', '3d', '7h', '9s', 'Jc'],
      players: v.players.map((p, i) => ({ ...p, stack: i === 0 ? 1010 : 990,
        handContribution: 0, streetContribution: 0, cards: i === 0 ? ['As', 'Ah'] : ['Kc', 'Kd'] })),
      totalPot: 0, pots: [], legalActions: [], result: handResult() };
    expect(GameViewSchema.parse(value)).toEqual(value);
    expect(GameViewSchema.safeParse({ ...value, result: null }).success).toBe(false);
    expect(GameViewSchema.safeParse({ ...value, actorId: 'p0' }).success).toBe(false);
  });
  it.each(['INVALID_INPUT', 'GAME_NOT_FOUND', 'STALE_STATE', 'ILLEGAL_ACTION',
    'PRECONDITION_REQUIRED', 'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'INTERNAL_ERROR'])('accepts safe error %s', code => {
    const value = { error: { code, message: 'Zahtev nije prihvaćen.' } };
    expect(GameErrorSchema.parse(value)).toEqual(value);
    expect(GameErrorSchema.safeParse({ error: { ...value.error, stack: 'secret' } }).success).toBe(false);
  });
});
