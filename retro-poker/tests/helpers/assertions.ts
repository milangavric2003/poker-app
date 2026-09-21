import { expect } from 'vitest';
import type { BettingState } from '../../backend/src/engine/types.js';
export function expectChips(state: BettingState, total: number): void {
  expect(state.players.reduce((n, p) => n + p.stack + p.handContribution, 0)).toBe(total);
  for (const p of state.players) {
    for (const n of [p.stack, p.streetContribution, p.handContribution]) {
      expect(Number.isSafeInteger(n) && n >= 0).toBe(true);
    }
    expect(p.streetContribution).toBeLessThanOrEqual(p.handContribution);
  }
}

