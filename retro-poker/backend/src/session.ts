import { randomUUID } from 'node:crypto';
import { buildBotObservation, chooseBotAction, safeBotAction } from './bots/strategy.js';
import { BettingError } from './engine/betting.js';
import { act, createHand, createNextHand, type ActiveHand } from './engine/hand.js';
import { appendEvent, completeHistory, createHistory, type GameHistory } from './engine/history.js';
import type { GameDependencies, HandResult, PokerAction, RandomSource } from './engine/types.js';

export class SessionError extends Error {
  constructor(readonly code: 'GAME_NOT_FOUND' | 'STALE_STATE' | 'ILLEGAL_ACTION' | 'INTERNAL_ERROR',
    message: string) { super(message); }
}

export interface GameState {
  gameId: string;
  version: number;
  botCount: number;
  handNumber: number;
  hand: ActiveHand;
  history: GameHistory;
  previousResult: HandResult | null;
  deckRandom: RandomSource;
  botRandom: RandomSource;
}

export interface SessionDependencies extends GameDependencies {
  /** In-process transaction fault injection; never exposed by HTTP. */
  beforeActionCommit?: () => void;
  beforeNextHandCommit?: () => void;
}

function recordInitial(hand: ActiveHand, handNumber = 1,
  history = createHistory(hand.handId)): GameHistory {
  history = appendEvent(history, { type: 'hand_started', street: 'preflop', number: handNumber,
    buttonSeat: hand.buttonSeat, smallBlindSeat: hand.smallBlindSeat, bigBlindSeat: hand.bigBlindSeat });
  const small = hand.players.find(player => player.seat === hand.smallBlindSeat);
  const big = hand.players.find(player => player.seat === hand.bigBlindSeat);
  // Forced all-in runouts can already be settled here, with contributions cleared.
  if (small && small.stackAtHandStart > 0) history = appendEvent(history, { type: 'blind_posted', street: 'preflop',
    playerId: small.id, blind: 'small', amount: Math.min(5, small.stackAtHandStart) });
  if (big && big.stackAtHandStart > 0) history = appendEvent(history, { type: 'blind_posted', street: 'preflop',
    playerId: big.id, blind: 'big', amount: Math.min(10, big.stackAtHandStart) });
  if (hand.result) {
    history = appendEvent(history, { type: 'board_dealt', street: 'flop', cards: hand.board.slice(0, 3) });
    history = appendEvent(history, { type: 'board_dealt', street: 'turn', cards: hand.board.slice(3, 4) });
    history = appendEvent(history, { type: 'board_dealt', street: 'river', cards: hand.board.slice(4, 5) });
    for (const refund of hand.result.refunds) {
      history = appendEvent(history, { type: 'refund', street: 'complete', ...refund });
    }
    history = appendEvent(history, { type: 'settled', street: 'complete', reason: hand.result.reason });
  }
  return history;
}

function actionType(action: PokerAction) { return action.type; }

function applyAndRecord(game: GameState, playerId: string, action: PokerAction): void {
  const before = game.hand;
  const playerBefore = before.players.find(player => player.id === playerId)!;
  const debt = Math.max(0, before.currentBet - playerBefore.streetContribution);
  let payAmount = 0;
  if (action.type === 'call') payAmount = Math.min(debt, playerBefore.stack);
  else if (action.type === 'all_in') payAmount = playerBefore.stack;
  else if (action.type === 'bet' || action.type === 'raise') {
    payAmount = action.amountTo - playerBefore.streetContribution;
  }
  const amountTo = playerBefore.streetContribution + payAmount;
  const next = act(before, playerId, action);
  game.history = appendEvent(game.history, { type: 'action', street: before.phase,
    playerId, actionType: actionType(action), payAmount, amountTo });
  if (next.board.length > before.board.length) {
    const boundaries = [3, 4, 5];
    let cursor = before.board.length;
    for (const boundary of boundaries.filter(value => value > before.board.length && value <= next.board.length)) {
      const cards = next.board.slice(cursor, boundary);
      const street = boundary === 3 ? 'flop' : boundary === 4 ? 'turn' : 'river';
      game.history = appendEvent(game.history, { type: 'board_dealt', street, cards });
      cursor = boundary;
    }
  }
  if (next.result && !before.result) {
    for (const refund of next.result.refunds) {
      game.history = appendEvent(game.history, { type: 'refund', street: 'complete', ...refund });
    }
    game.history = appendEvent(game.history, { type: 'settled', street: 'complete',
      reason: next.result.reason });
  }
  game.hand = next;
}

function cloneGame(game: GameState): GameState {
  const plain = structuredClone({ ...game, deckRandom: undefined, botRandom: undefined });
  return { ...plain, deckRandom: game.deckRandom.clone(), botRandom: game.botRandom.clone() } as GameState;
}

function runBots(game: GameState): void {
  let count = 0;
  while (game.hand.phase !== 'complete') {
    const actor = game.hand.players.find(player => player.id === game.hand.actorId);
    if (!actor || actor.kind === 'human') return;
    if (++count > 10000) throw new SessionError('INTERNAL_ERROR', 'Prekoračen je limit automatskih poteza.');
    const observation = buildBotObservation(game.hand, actor.id, game.history.current.events);
    const decision = safeBotAction(observation.legalActions,
      () => chooseBotAction(observation, game.botRandom));
    applyAndRecord(game, actor.id, decision.action);
  }
}

export class GameSession {
  private game: GameState | null = null;
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly dependencies: SessionDependencies) {}

  async serial<T>(operation: () => T | Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }

  get(): GameState | null { return this.game; }

  create(botCount: number): GameState {
    const deckRandom = (this.game?.deckRandom ?? this.dependencies.deckRandom).clone();
    const botRandom = (this.game?.botRandom ?? this.dependencies.botRandom).clone();
    const gameId = randomUUID();
    const hand = createHand(botCount, randomUUID(), { deckRandom,
      ...(this.dependencies.deck === undefined ? {} : { deck: this.dependencies.deck }) });
    const candidate: GameState = { gameId, version: 1, botCount, handNumber: 1,
      hand, history: recordInitial(hand), previousResult: null, deckRandom, botRandom };
    runBots(candidate);
    this.game = candidate;
    return candidate;
  }

  action(input: { gameId: string; handId: string; expectedVersion: number } & PokerAction): GameState {
    const current = this.game;
    if (!current || current.gameId !== input.gameId) throw new SessionError('GAME_NOT_FOUND', 'Partija nije pronađena.');
    if (current.hand.handId !== input.handId || current.version !== input.expectedVersion) {
      throw new SessionError('STALE_STATE', 'Stanje partije je zastarelo.');
    }
    const candidate = cloneGame(current);
    const human = candidate.hand.players.find(player => player.kind === 'human')!;
    const action: PokerAction = input.type === 'bet' || input.type === 'raise'
      ? { type: input.type, amountTo: input.amountTo }
      : { type: input.type };
    try {
      applyAndRecord(candidate, human.id, action);
      runBots(candidate);
      this.dependencies.beforeActionCommit?.();
    } catch (error) {
      if (error instanceof BettingError) throw new SessionError('ILLEGAL_ACTION', error.message);
      if (error instanceof SessionError) throw error;
      throw new SessionError('INTERNAL_ERROR', 'Interna greška pri obradi poteza.');
    }
    candidate.version++;
    this.game = candidate;
    return candidate;
  }

  nextHand(input: { gameId: string; handId: string; expectedVersion: number }): GameState {
    const current = this.game;
    if (!current || current.gameId !== input.gameId) throw new SessionError('GAME_NOT_FOUND', 'Partija nije pronađena.');
    if (current.hand.handId !== input.handId || current.version !== input.expectedVersion) {
      throw new SessionError('STALE_STATE', 'Stanje partije je zastarelo.');
    }
    if (current.hand.phase !== 'complete' || current.hand.gameStatus !== 'playing') {
      throw new SessionError('ILLEGAL_ACTION', 'Sledeća ruka nije dozvoljena.');
    }
    const candidate = cloneGame(current);
    try {
      const handId = randomUUID();
      const hand = createNextHand(candidate.hand, handId, { deckRandom: candidate.deckRandom,
        ...(this.dependencies.deck === undefined ? {} : { deck: this.dependencies.deck }) });
      candidate.previousResult = candidate.hand.result;
      candidate.handNumber++;
      candidate.hand = hand;
      candidate.history = recordInitial(hand, candidate.handNumber,
        completeHistory(candidate.history, handId));
      runBots(candidate);
      this.dependencies.beforeNextHandCommit?.();
      candidate.version++;
      this.game = candidate;
      return candidate;
    } catch (error) {
      if (error instanceof SessionError) throw error;
      throw new SessionError('INTERNAL_ERROR', 'Interna greška pri pokretanju sledeće ruke.');
    }
  }
}
