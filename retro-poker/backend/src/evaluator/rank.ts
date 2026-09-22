import type { Card } from '../engine/types.js';

export interface HandRank {
  category: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  kickers: number[];
}

/** Najboljih pet od 5–7 karata; ulaz ostaje nepromenjen. */
export function rank(cards: readonly Card[]): HandRank {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7
    || Array.from(cards).some(card => typeof card !== 'string'
      || card.length !== 2 || !/^[2-9TJQKA][cdhs]$/.test(card))
    || new Set(cards).size !== cards.length) {
    throw new Error('Invalid cards');
  }

  let best: HandRank | undefined;
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const candidate = rankFive([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
            if (!best || compareRanks(candidate, best) > 0) best = candidate;
          }
  return best!;
}

/** Pozitivno: a je jači; nula: nerešeno. Suit nikada nije tiebreak. */
export function compareRanks(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < a.kickers.length; i++) {
    const difference = a.kickers[i]! - b.kickers[i]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

function rankFive(cards: readonly Card[]): HandRank {
  const values = cards.map(card => '23456789TJQKA'.indexOf(card[0]!) + 2)
    .sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(card => card[1] === cards[0]![1]);
  const wheel = values.join(',') === '14,5,4,3,2';
  const straightHigh = counts.size === 5 && (values[0]! - values[4]! === 4 || wheel)
    ? (wheel ? 5 : values[0]!) : 0;
  const [first, second] = groups;
  const groupedRanks = groups.map(([value]) => value);

  if (flush && straightHigh) return { category: 8, kickers: [straightHigh] };
  if (first![1] === 4) return { category: 7, kickers: groupedRanks };
  if (first![1] === 3 && second![1] === 2) return { category: 6, kickers: groupedRanks };
  if (flush) return { category: 5, kickers: values };
  if (straightHigh) return { category: 4, kickers: [straightHigh] };
  if (first![1] === 3) return { category: 3, kickers: groupedRanks };
  if (first![1] === 2 && second![1] === 2) return { category: 2, kickers: groupedRanks };
  if (first![1] === 2) return { category: 1, kickers: groupedRanks };
  return { category: 0, kickers: values };
}
