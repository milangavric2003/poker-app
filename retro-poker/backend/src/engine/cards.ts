import type { Card, RandomSource } from './types.js';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ['c', 'd', 'h', 's'] as const) {
    for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

/** Controlled prefixes are an in-process test dependency, never an HTTP input. */
export function prepareDeck(random: RandomSource, prefix?: readonly Card[]): Card[] {
  const deck = createDeck();
  if (prefix !== undefined) {
    if (!Array.isArray(prefix) || prefix.length > 52
      || Array.from(prefix).some(card => !deck.includes(card))
      || new Set(prefix).size !== prefix.length) throw new Error('Invalid deck');
    return [...prefix, ...deck.filter(card => !prefix.includes(card))];
  }
  // The caller supplies the RNG for its candidate transaction; bot RNG is separate.
  for (let i = deck.length - 1; i > 0; i--) {
    const value = random.next();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid random value');
    const j = Math.floor(value * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}
