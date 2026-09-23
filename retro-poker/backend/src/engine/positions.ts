export interface Positions {
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
}

export interface PositionTransition extends Positions {
  firstPreflopSeat: number;
  firstPostflopSeat: number;
}

/** Dead-button transition over the stable configured six-seat ring. */
export function nextPositions(configuredSeats: readonly number[], activeSeats: readonly number[],
  previous: Positions): PositionTransition {
  const configured = new Set(configuredSeats);
  const active = [...new Set(activeSeats)].filter(seat => configured.has(seat)).sort((a, b) => a - b);
  if (active.length < 2) throw new Error('At least two active seats are required');
  const nextActive = (seat: number) => {
    for (let distance = 1; distance <= 6; distance++) {
      const candidate = (seat + distance) % 6;
      if (active.includes(candidate)) return candidate;
    }
    throw new Error('No active seat');
  };
  const bigBlindSeat = nextActive(previous.bigBlindSeat);
  if (active.length === 2) {
    const buttonSeat = nextActive(bigBlindSeat);
    return { buttonSeat, smallBlindSeat: buttonSeat, bigBlindSeat,
      firstPreflopSeat: buttonSeat, firstPostflopSeat: bigBlindSeat };
  }
  const smallBlindSeat = previous.bigBlindSeat;
  const buttonSeat = previous.smallBlindSeat;
  return { buttonSeat, smallBlindSeat, bigBlindSeat,
    firstPreflopSeat: nextActive(bigBlindSeat), firstPostflopSeat: nextActive(buttonSeat) };
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
