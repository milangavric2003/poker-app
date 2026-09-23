import { settlePots } from './pots.js';
import { applyAction, BettingError } from './betting.js';
import { prepareDeck } from './cards.js';
import { clockwiseAfter, initialPositions, nextPositions, type Positions } from './positions.js';
import type { Card, GameDependencies, HandResult, HandState, Player, PokerAction } from './types.js';

export interface ActiveHand extends HandState {
  smallBlindSeat: number; bigBlindSeat: number;
  deck: Card[]; deckCursor: number; burnCards: Card[];
  currentBet: number; lastFullRaise: number; pendingActors: string[];
}

/** First hand only. Session identity, bots and next-hand rotation belong to callers. */
export function createHand(botCount: number, handId: string,
  dependencies: Pick<GameDependencies, 'deckRandom' | 'deck'>): ActiveHand {
  const positions = initialPositions(botCount);
  const deck = prepareDeck(dependencies.deckRandom, dependencies.deck);
  const players: Player[] = Array.from({ length: botCount + 1 }, (_, seat) => ({
    id: `player-${seat}`, seat, kind: seat === 0 ? 'human' : 'bot',
    stack: 1000, stackAtHandStart: 1000, holeCards: [], status: 'active',
    streetContribution: 0, handContribution: 0, acted: false, lastFacedBet: 0,
  }));
  for (const [seat, amount] of [[positions.smallBlindSeat, 5], [positions.bigBlindSeat, 10]] as const) {
    const player = players[seat]!;
    player.stack -= amount;
    player.streetContribution = amount;
    player.handContribution = amount;
  }
  let deckCursor = 0;
  const dealOrder = clockwiseAfter(players, positions.buttonSeat);
  for (let round = 0; round < 2; round++) {
    for (const player of dealOrder) player.holeCards.push(deck[deckCursor++]!);
  }
  const pendingActors = clockwiseAfter(players, positions.bigBlindSeat).map(player => player.id);
  return { handId, ...positions, players, deck, deckCursor, burnCards: [], board: [],
    phase: 'preflop', currentBet: 10, lastFullRaise: 10, pendingActors,
    actorId: pendingActors[0]!, settled: false, result: null, gameStatus: 'playing' };
}

export function createNextHand(previous: ActiveHand, handId: string,
  dependencies: Pick<GameDependencies, 'deckRandom' | 'deck'>): ActiveHand {
  const survivors = previous.players.filter(player => player.stack > 0);
  const positions = nextPositions(previous.players.map(player => player.seat),
    survivors.map(player => player.seat), previous as Positions);
  const deck = prepareDeck(dependencies.deckRandom, dependencies.deck);
  const players: Player[] = previous.players.map(player => ({ ...player,
    stackAtHandStart: player.stack, holeCards: [], status: player.stack > 0 ? 'active' : 'eliminated',
    streetContribution: 0, handContribution: 0, acted: false, lastFacedBet: 0 }));
  for (const [seat, nominal] of [[positions.smallBlindSeat, 5], [positions.bigBlindSeat, 10]] as const) {
    const player = players.find(item => item.seat === seat && item.stack > 0);
    if (!player) continue;
    const amount = Math.min(nominal, player.stack);
    player.stack -= amount; player.streetContribution = amount; player.handContribution = amount;
    if (player.stack === 0) player.status = 'all_in';
  }
  let deckCursor = 0;
  const dealOrder = clockwiseAfter(survivors, positions.buttonSeat);
  for (let round = 0; round < 2; round++) for (const survivor of dealOrder) {
    players.find(player => player.id === survivor.id)!.holeCards.push(deck[deckCursor++]!);
  }
  const pendingActors = clockwiseAfter(players.filter(player => player.status === 'active'),
    positions.bigBlindSeat).map(player => player.id);
  const started: ActiveHand = { handId, buttonSeat: positions.buttonSeat,
    smallBlindSeat: positions.smallBlindSeat,
    bigBlindSeat: positions.bigBlindSeat, players, deck, deckCursor, burnCards: [], board: [],
    phase: 'preflop', currentBet: 10, lastFullRaise: 10, pendingActors,
    actorId: pendingActors[0] ?? null, settled: false, result: null, gameStatus: 'playing' };
  return started.actorId === null ? advance(started) : started;
}

/** A single validated human/bot action followed by forced street/settlement transitions. */
export function act(hand: ActiveHand, playerId: string, action: PokerAction): ActiveHand {
  if (hand.settled || hand.phase === 'complete') throw new BettingError('Ruka je završena.');
  const betting = applyAction(hand, playerId, action);
  const next: ActiveHand = { ...hand, ...betting,
    players: betting.players.map(player => ({ ...hand.players.find(p => p.id === player.id)!, ...player })),
    board: [...hand.board], burnCards: [...hand.burnCards] };
  return advance(next);
}

// Only mutates a newly constructed candidate, never the caller's hand.
function advance(hand: ActiveHand): ActiveHand {
  while (true) {
    const contenders = hand.players.filter(p => p.status === 'active' || p.status === 'all_in');
    if (contenders.length === 1 || (hand.phase === 'river' && hand.actorId === null)) {
      return { ...hand, ...settleHand(hand), pendingActors: [] };
    }
    if (hand.actorId !== null) return hand;

    const nextPhase = { preflop: 'flop', flop: 'turn', turn: 'river' } as const;
    if (hand.phase === 'river' || hand.phase === 'complete') throw new Error('Invalid hand phase');
    const count = hand.phase === 'preflop' ? 3 : 1;
    if (hand.deckCursor + count + 1 > hand.deck.length) throw new Error('Deck exhausted');
    hand.burnCards.push(hand.deck[hand.deckCursor++]!);
    for (let i = 0; i < count; i++) hand.board.push(hand.deck[hand.deckCursor++]!);
    hand.phase = nextPhase[hand.phase];
    hand.currentBet = 0;
    hand.lastFullRaise = 10;
    for (const player of hand.players) {
      player.streetContribution = 0;
      player.acted = false;
      player.lastFacedBet = 0;
    }
    const funded = clockwiseAfter(hand.players.filter(p => p.status === 'active' && p.stack > 0),
      hand.buttonSeat);
    // With no opponent able to bet, run out the remaining board without asking for a check.
    hand.pendingActors = funded.length > 1 ? funded.map(p => p.id) : [];
    hand.actorId = hand.pendingActors[0] ?? null;
  }
}

function gameStatus(players: readonly Player[]): HandState['gameStatus'] {
  const human = players.find(player => player.kind === 'human');
  if (!human) throw new Error('Hand has no human player');
  if (human.stack === 0) return 'lost';
  if (players.every(player => player.kind === 'human' || player.stack === 0)) return 'won';
  return 'playing';
}

export function settleHand(hand: HandState): HandState {
  if (hand.settled) {
    if (!hand.result || hand.phase !== 'complete') throw new Error('Invalid settled hand');
    return hand;
  }
  if (hand.result || hand.phase === 'complete') throw new Error('Invalid unsettled hand');
  const contenders = hand.players.filter(player => player.status !== 'folded'
    && player.status !== 'eliminated');
  const reason: HandResult['reason'] = contenders.length === 1 ? 'uncontested' : 'showdown';
  const terminalShowdown = hand.phase === 'river' && hand.actorId === null;
  if (reason === 'showdown' && !terminalShowdown) throw new Error('Hand is not ready for settlement');

  const paid = settlePots({ players: hand.players, board: hand.board,
    buttonSeat: hand.buttonSeat, settled: false, pots: [], refunds: [] });
  const netChanges = paid.players.map(player => ({ playerId: player.id,
    amount: player.stack - player.stackAtHandStart }));
  if (netChanges.reduce((sum, change) => sum + change.amount, 0) !== 0) {
    throw new Error('Net changes are not balanced');
  }
  const status = gameStatus(paid.players);
  const players = paid.players.map(player => ({ ...player,
    status: player.stack === 0 ? 'eliminated' : player.status } as Player));
  const revealedCards = reason === 'showdown' ? contenders.map(player => {
    if (player.holeCards.length !== 2) throw new Error('Invalid showdown cards');
    return { playerId: player.id,
      cards: [player.holeCards[0]!, player.holeCards[1]!] as [Card, Card] };
  }) : [];
  const result = { handId: hand.handId, reason, gameStatus: status, pots: paid.pots,
    refunds: paid.refunds, revealedCards, netChanges };
  return { ...hand, players, actorId: null, settled: true, phase: 'complete',
    gameStatus: status, result };
}
