import { describe, expect, it } from 'vitest';
import type { Card } from '../../backend/src/engine/types.js';
import { compareRanks, rank } from '../../backend/src/evaluator/rank.js';
import { evaluatorOracles } from '../helpers/fixtures.js';

const cards = (text: string): Card[] => text.split(' ') as Card[];
const vector = (hand: readonly Card[]) => {
  const result = rank(hand);
  return [result.category, ...result.kickers];
};

// Ručno zadati oracle-i; ni jedan očekivani rezultat ne računa evaluator.
const categories = [
  { cards: 'Ac Kd Qh Js 8c', expected: [0,14,13,12,11,8] },
  { cards: '2c 2d 5h 4s 3c', expected: [1,2,5,4,3] },
  { cards: '2c 2d 3h 3s 4c', expected: [2,3,2,4] },
  { cards: '2c 2d 2h 4s 3c', expected: [3,2,4,3] },
  { cards: 'Ac 2d 3h 4s 5c', expected: [4,5] },
  { cards: '2h 3h 4h 5h 7h', expected: [5,7,5,4,3,2] },
  { cards: '2c 2d 2h 3s 3c', expected: [6,2,3] },
  { cards: '2c 2d 2h 2s 3c', expected: [7,2,3] },
  { cards: 'Ac 2c 3c 4c 5c', expected: [8,5] },
];

describe('rank — AC14/AC15', () => {
  it.each(evaluatorOracles)('$id', ({ cards, rank: expected }) => {
    expect(vector(cards)).toEqual(expected);
  });

  it.each(categories)('pet karata: $expected', ({ cards: hand, expected }) => {
    expect(vector(cards(hand))).toEqual(expected);
  });

  it.each(categories.slice(1).map((higher, index) => ({ higher, lower: categories[index]! })))(
    'susedne kategorije: $lower.expected < $higher.expected', ({ higher, lower }) => {
    const a = rank(cards(higher.cards));
    const b = rank(cards(lower.cards));
    expect(compareRanks(a, b)).toBeGreaterThan(0);
    expect(compareRanks(b, a)).toBeLessThan(0);
    });

  it.each([
    ['EV01', '2c 3d 4h 5s Kc 6h Jd', '2c 3d 4h 5s Kc Ah Qd'],
    ['EV02', 'Kc Kd 8h 5s 2c Ah Qd', 'Kc Kd 8h 5s 2c Jh Td'],
    ['high-card poslednji kicker', 'Ac Kd Qh Js 9c', 'Ad Kh Qs Jc 8d'],
    ['par poslednji kicker', 'Ac Ad Kh Qs 9c', 'Ah As Kd Qc 8d'],
    ['dva para kicker', 'Ac Ad Kh Ks 9c', 'Ah As Kd Kc 8d'],
    ['dva para niži par', 'Ac Ad Kh Ks 2c', 'Ah As Qd Qc Jd'],
    ['trips drugi kicker', '9c 9d 9h As Kd', '9c 9d 9s Ah Qd'],
    ['flush poslednji kicker', 'Ah Jh 8h 5h 3h', 'As Js 8s 5s 2s'],
    ['full house par', 'Ac Ad Ah Ks Kc', 'Ac Ad Ah Qs Qc'],
    ['full house trips', 'Kc Kd Kh 2s 2c', 'Qc Qd Qh As Ac'],
    ['quads kicker', '7c 7d 7h 7s Ac', '7c 7d 7h 7s Kc'],
    ['straight flush high', '6s 7s 8s 9s Ts', '5h 6h 7h 8h 9h'],
  ])('%s: poređenje po rangu i kickerima', (_name, higher, lower) => {
    expect(compareRanks(rank(cards(higher!)), rank(cards(lower!)))).toBeGreaterThan(0);
    expect(compareRanks(rank(cards(lower!)), rank(cards(higher!)))).toBeLessThan(0);
  });

  it.each([
    ['šest karata, kasniji straight', '2c 3d 4h 5s Kc 6h', [4,6]],
    ['šest karata, najviši flush', '2h 5h 8h Jh Qh Ah', [5,14,12,11,8,5]],
    ['sedam karata, najviši flush', '2h 5h 8h Jh Qh Kh Ah', [5,14,13,12,11,8]],
    ['dupli rang unutar straight-a', '2c 3d 4h 4s 5c 6d 7h', [4,7]],
    ['straight i flush nisu straight flush', '2h 4h 6h 8h Th 3c 5d', [5,10,8,6,4,2]],
    ['nema QKA23 wrap-a', 'Qc Kd Ah 2s 3c', [0,14,13,12,3,2]],
    ['jedna privatna karta poboljšava board', '9c 9d 9h 9s 2c Ac Kd', [7,9,14]],
  ] as const)('%s', (_name, hand, expected) => {
    expect(vector(cards(hand))).toEqual(expected);
  });

  it('EV10: board određuje jednak rezultat bez privatnog kickera', () => {
    const a = rank(cards('As Ks Qs Js Ts 2c 3d'));
    const b = rank(cards('As Ks Qs Js Ts Ah Ad'));
    expect(compareRanks(a, b)).toBe(0);
  });

  it.each(categories)('suit ne razrešava jednakost: $expected', ({ cards: hand, expected }) => {
    const original = cards(hand);
    const rotated = original.map(card => (card[0]! + ({ c: 'd', d: 'h', h: 's', s: 'c' }[card[1]!])) as Card);
    expect(vector(rotated)).toEqual(expected);
    expect(compareRanks(rank(original), rank(rotated))).toBe(0);
  });

  it.each(evaluatorOracles)('$id: redosled ne menja rank niti ulaz', ({ cards: hand, rank: expected }) => {
    const input = Object.freeze([...hand].reverse());
    const before = [...input];
    expect(vector(input)).toEqual(expected);
    expect(input).toEqual(before);
  });

  it.each([
    [], ['Ac','Kd','Qh','Js'], ['Ac','Kd','Qh','Js','9c','8d','7h','6s'],
    ['Ac','Ac','Qh','Js','9c'], ['Ac','Kd','Qh','Js','9c','2d','Ac'],
    ...['1c','Bc','10c','ax','AX','A♠','Ac\n',' Ac','Ac ', '', null, undefined, 14, {}]
      .map(invalid => ['Ac','Kd','Qh','Js',invalid]),
    new Array(5), null, undefined, 'Ac Kd Qh Js 9c', { length: 5 },
  ].map((input, index) => ({ input, index })))('odbija nevalidan ulaz $index', ({ input }) => {
    expect(() => rank(input as readonly Card[])).toThrow('Invalid cards');
  });
});
