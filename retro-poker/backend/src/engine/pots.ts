import { compareRanks, rank } from '../evaluator/rank.js';
import type { Player, PotPayout, PotSettlementState } from './types.js';

const validChips = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 6000;

function assertValid(state: PotSettlementState): void {
  if (!Number.isInteger(state.buttonSeat) || state.buttonSeat < 0 || state.buttonSeat > 5
    || !Array.isArray(state.players) || new Set(state.players.map(p => p.id)).size !== state.players.length) {
    throw new Error('Invalid pot state');
  }
  for (const player of state.players) {
    if (![player.stack, player.streetContribution, player.handContribution, player.stackAtHandStart]
      .every(validChips) || player.streetContribution > player.handContribution
      || !Number.isInteger(player.seat) || player.seat < 0 || player.seat > 5
      || player.holeCards.length !== 2) throw new Error('Invalid chips or player');
  }
}

function clockwise(players: readonly Player[], ids: readonly string[], buttonSeat: number): string[] {
  const seats = new Map(players.map(player => [player.id, player.seat]));
  return [...ids].sort((a, b) => {
    const distanceA = ((seats.get(a)! - buttonSeat + 6) % 6) || 6;
    const distanceB = ((seats.get(b)! - buttonSeat + 6) % 6) || 6;
    return distanceA - distanceB;
  });
}

function winners(players: readonly Player[], eligibleIds: readonly string[], board: PotSettlementState['board']): string[] {
  if (eligibleIds.length === 1) return [...eligibleIds];
  let best: ReturnType<typeof rank> | undefined;
  let result: string[] = [];
  for (const id of eligibleIds) {
    const player = players.find(candidate => candidate.id === id)!;
    const playerRank = rank([...board, ...player.holeCards]);
    const comparison = best ? compareRanks(playerRank, best) : 1;
    if (comparison > 0) {
      best = playerRank;
      result = [id];
    } else if (comparison === 0) result.push(id);
  }
  return result;
}

export function settlePots(state: PotSettlementState): PotSettlementState {
  assertValid(state);
  if (state.settled) return state;

  const players = state.players.map(player => ({ ...player, holeCards: [...player.holeCards] }));
  const initialTotal = players.reduce((sum, player) => sum + player.stack + player.handContribution, 0);
  const levels = [...new Set(players.map(player => player.handContribution).filter(amount => amount > 0))]
    .sort((a, b) => a - b);
  const refunds: PotSettlementState['refunds'] = [];
  const pots: PotPayout[] = [];
  let previousLevel = 0;

  for (const level of levels) {
    const contributors = players.filter(player => player.handContribution >= level);
    const amount = (level - previousLevel) * contributors.length;
    previousLevel = level;
    if (contributors.length === 1) {
      contributors[0]!.stack += amount;
      refunds.push({ playerId: contributors[0]!.id, amount });
      continue;
    }
    const eligibleIds = contributors.filter(player => player.status !== 'folded'
      && player.status !== 'eliminated').map(player => player.id);
    if (eligibleIds.length === 0) throw new Error('Pot has no eligible player');
    const winnerIds = clockwise(players, winners(players, eligibleIds, state.board), state.buttonSeat);
    const share = Math.floor(amount / winnerIds.length);
    let remainder = amount % winnerIds.length;
    const payouts = winnerIds.map(playerId => {
      const payout = share + (remainder-- > 0 ? 1 : 0);
      players.find(player => player.id === playerId)!.stack += payout;
      return { playerId, amount: payout };
    });
    pots.push({ id: `pot-${pots.length + 1}`, amount, eligibleIds, winnerIds, payouts });
  }

  for (const player of players) {
    player.streetContribution = 0;
    player.handContribution = 0;
  }
  const finalTotal = players.reduce((sum, player) => sum + player.stack, 0);
  if (finalTotal !== initialTotal || players.some(player => !validChips(player.stack))) {
    throw new Error('Chip conservation failed');
  }
  return { ...state, players, settled: true, pots, refunds };
}
