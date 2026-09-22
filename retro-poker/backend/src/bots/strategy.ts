import { legalActions } from '../engine/betting.js';
import type { ActiveHand } from '../engine/hand.js';
import type { Card, LegalAction, PokerAction, RandomSource } from '../engine/types.js';

export interface BotObservation {
  playerId: string;
  phase: ActiveHand['phase'];
  holeCards: readonly Card[];
  board: readonly Card[];
  players: ReadonlyArray<{
    id: string; seat: number; kind: 'human' | 'bot'; stack: number;
    streetContribution: number; handContribution: number; status: string;
  }>;
  history: readonly Readonly<Record<string, unknown>>[];
  legalActions: readonly LegalAction[];
}

export interface SafeBotDecision {
  action: PokerAction;
  fallbackUsed: boolean;
  diagnostic: 'BOT_STRATEGY_FALLBACK' | null;
}

export function buildBotObservation(hand: ActiveHand, playerId: string,
  history: readonly Readonly<Record<string, unknown>>[]): BotObservation {
  const player = hand.players.find(candidate => candidate.id === playerId);
  if (!player || player.kind !== 'bot') throw new Error('Invalid bot');
  return {
    playerId, phase: hand.phase, holeCards: [...player.holeCards], board: [...hand.board],
    players: hand.players.map(({ id, seat, kind, stack, streetContribution,
      handContribution, status }) => ({ id, seat, kind, stack, streetContribution,
      handContribution, status })),
    history: history.map(event => ({ ...event })),
    legalActions: legalActions(hand, playerId),
  };
}

function isStrong(observation: BotObservation): boolean {
  const ranks = observation.holeCards.map(card => '23456789TJQKA'.indexOf(card[0]!));
  if (observation.phase === 'preflop') {
    return ranks.length === 2 && (ranks[0] === ranks[1] || ranks.every(rank => rank >= 9));
  }
  const counts = new Map<string, number>();
  for (const card of [...observation.holeCards, ...observation.board]) {
    counts.set(card[0]!, (counts.get(card[0]!) ?? 0) + 1);
  }
  return [...counts.values()].some(count => count >= 2);
}

export function chooseBotAction(observation: BotObservation, random: RandomSource): PokerAction {
  const strong = isStrong(observation);
  const increase = observation.legalActions.find((action): action is Extract<LegalAction,
    { type: 'bet' | 'raise' }> => action.type === 'bet' || action.type === 'raise');
  if (strong && increase && random.next() < 0.25) {
    return { type: increase.type, amountTo: increase.minAmountTo };
  }
  if (observation.legalActions.some(action => action.type === 'check')) return { type: 'check' };
  const call = observation.legalActions.find(action => action.type === 'call');
  if (call && (strong || call.payAmount <= 20)) return { type: 'call' };
  return { type: 'fold' };
}

function matchesLegal(action: PokerAction, legal: readonly LegalAction[]): boolean {
  const candidate = legal.find(item => item.type === action.type);
  if (!candidate) return false;
  if ((action.type === 'bet' || action.type === 'raise') &&
    (candidate.type === 'bet' || candidate.type === 'raise')) {
    return action.amountTo >= candidate.minAmountTo && action.amountTo <= candidate.maxAmountTo;
  }
  return true;
}

export function safeBotAction(legal: readonly LegalAction[], strategy: () => PokerAction): SafeBotDecision {
  try {
    const action = strategy();
    if (matchesLegal(action, legal)) return { action, fallbackUsed: false, diagnostic: null };
  } catch {
    // The deterministic fallback below is deliberately independent of strategy failures.
  }
  const action: PokerAction = legal.some(item => item.type === 'check') ? { type: 'check' } : { type: 'fold' };
  return { action, fallbackUsed: true, diagnostic: 'BOT_STRATEGY_FALLBACK' };
}
