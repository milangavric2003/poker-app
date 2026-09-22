export interface Positions {
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
}

export function initialPositions(botCount: number): Positions {
  if (!Number.isInteger(botCount) || botCount < 1 || botCount > 5) throw new Error('Invalid bot count');
  return { buttonSeat: 0, smallBlindSeat: botCount === 1 ? 0 : 1,
    bigBlindSeat: botCount === 1 ? 1 : 2 };
}

/** Stable seats in clockwise order, starting strictly after the reference seat. */
export function clockwiseAfter<T extends { seat: number }>(players: readonly T[], seat: number): T[] {
  const distance = (candidate: T) => ((candidate.seat - seat + 6) % 6) || 6;
  return [...players].sort((a, b) => distance(a) - distance(b));
}
