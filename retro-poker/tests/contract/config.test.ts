import { describe, expect, it } from 'vitest';
import { GameConfigSchema, CardSchema, ChipsSchema, SeatSchema } from '../../shared/contracts.js';

describe('GameConfig / AC03', () => {
  it.each([1, 2, 3, 4, 5])('accepts botCount %i', botCount => {
    expect(GameConfigSchema.parse({ botCount })).toEqual({ botCount });
  });
  it.each([{}, null, [], { botCount: 0 }, { botCount: 6 }, { botCount: 2.5 },
    { botCount: '3' }, { botCount: true }, { botCount: 3, startingStack: 999999 }])('rejects invalid configuration %j', value => expect(GameConfigSchema.safeParse(value).success).toBe(false));
});
describe('shared scalar bounds', () => {
  it.each(['2c', 'Td', 'Ah', 'Ks'])('accepts card %s', c => expect(CardSchema.parse(c)).toBe(c));
  it.each(['10c', '1s', 'AX', 'as', '', null])('rejects card %j', c => expect(CardSchema.safeParse(c).success).toBe(false));
  it.each([0, 1, 6000])('accepts chips %i', n => expect(ChipsSchema.parse(n)).toBe(n));
  it.each([-1, 6001, 1.5, '5', NaN, Infinity])('rejects chips %j', n => expect(ChipsSchema.safeParse(n).success).toBe(false));
  it.each([0, 5])('accepts seat %i', n => expect(SeatSchema.parse(n)).toBe(n));
  it.each([-1, 6, 1.1, '0'])('rejects seat %j', n => expect(SeatSchema.safeParse(n).success).toBe(false));
});
