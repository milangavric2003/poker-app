// Domain-only types; no transport, Zod or UI dependency.
export type Card = `${'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A'}${'c'|'d'|'h'|'s'}`;
export type PlayerStatus = 'active' | 'folded' | 'all_in' | 'eliminated';
export type PokerAction = { type: 'fold' | 'check' | 'call' | 'all_in' }
  | { type: 'bet' | 'raise'; amountTo: number };
export type LegalAction = { type: 'fold' | 'check' }
  | { type: 'call'; payAmount: number; isAllIn: boolean }
  | { type: 'bet' | 'raise'; minAmountTo: number; maxAmountTo: number }
  | { type: 'all_in'; amountTo: number; payAmount: number; classification: 'call' | 'bet' | 'raise' };
export interface BettingPlayer {
  id: string; seat: number; stack: number; streetContribution: number;
  handContribution: number; status: PlayerStatus; acted: boolean; lastFacedBet: number;
}
export interface BettingState {
  players: BettingPlayer[]; currentBet: number; lastFullRaise: number;
  actorId: string | null; pendingActors: string[];
}
export interface Player extends BettingPlayer {
  kind: 'human' | 'bot'; holeCards: Card[]; stackAtHandStart: number;
}
export interface Pot {
  id: string; amount: number; contributionCap: number;
  contributorIds: string[]; eligibleIds: string[];
}
export interface PotPayout {
  id: string; amount: number; eligibleIds: string[]; winnerIds: string[];
  payouts: { playerId: string; amount: number }[];
}
export interface Refund { playerId: string; amount: number; }
export interface PotSettlementState {
  players: Player[]; board: Card[]; buttonSeat: number; settled: boolean;
  pots: PotPayout[]; refunds: Refund[];
}
export type GameStatus = 'playing' | 'won' | 'lost';
export interface HandResult {
  handId: string; reason: 'showdown' | 'uncontested'; gameStatus: GameStatus;
  pots: PotPayout[]; refunds: Refund[];
  revealedCards: { playerId: string; cards: [Card, Card] }[];
  netChanges: { playerId: string; amount: number }[];
}
export interface HandState {
  handId: string; phase: 'preflop' | 'flop' | 'turn' | 'river' | 'complete';
  buttonSeat: number; board: Card[]; players: Player[]; actorId: string | null;
  settled: boolean; result: HandResult | null; gameStatus: GameStatus;
}
export interface RandomSource { next(): number; clone(): RandomSource; }
export interface GameDependencies {
  deckRandom: RandomSource; botRandom: RandomSource;
  // In-process test harness only; never an HTTP input.
  deck?: readonly Card[];
}
