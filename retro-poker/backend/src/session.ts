import { randomUUID } from 'node:crypto';
import { buildBotObservation, chooseBotAction, safeBotAction } from './bots/strategy.js';
import { BettingError, legalActions } from './engine/betting.js';
import { act, createHand, createNextHand, type ActiveHand } from './engine/hand.js';
import { appendEvent, completeHistory, createHistory, type GameHistory } from './engine/history.js';
import type { GameDependencies, HandResult, PokerAction, RandomSource } from './engine/types.js';
import { buildBotDecisionContext } from './ai/context.js';
import { coordinateAnalysis, coordinateBot, systemClock, zeroJitter } from './ai/coordinator.js';
import { loadAiConfig } from './ai/config.js';
import type { AiClock, AiJitter, AiProvider, AiRuntimeConfig, BotDecisionContext } from './ai/types.js';
import { attachHandOutcome, createMatchFacts, recordHumanDecision, type MatchFacts } from './ai/match-facts.js';
import { analysisContext } from './ai/match-facts.js';
import type { MatchAnalysis } from '../../shared/contracts.js';

export class SessionError extends Error {
  constructor(readonly code: 'GAME_NOT_FOUND' | 'STALE_STATE' | 'ILLEGAL_ACTION' | 'INTERNAL_ERROR'
    | 'AI_UNAVAILABLE' | 'AI_ALREADY_PENDING' | 'ANALYSIS_NOT_ALLOWED',
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
  ai: {
    mode: 'off' | 'on'; availability: 'configured' | 'unavailable';
    active: { interactionId: string; purpose: 'bot' | 'analysis';
      status: 'waiting' | 'retrying' | 'model_fallback'; attemptCount: number; model: string } | null;
    lastBotOutcome: { handId: string; actorId: string; decisionOrdinal: number;
      outcome: 'model' | 'local_fallback'; attemptCount: number; finalModel: string | null } | null;
    analysis: { status: 'idle' | 'generating' | 'completed' | 'failed' | 'unavailable';
      interactionId: string | null; result: MatchAnalysis | null };
  };
  aiDecisionOrdinal: number;
  facts: MatchFacts;
}

export interface SessionDependencies extends GameDependencies {
  /** In-process transaction fault injection; never exposed by HTTP. */
  beforeActionCommit?: () => void;
  beforeNextHandCommit?: () => void;
  aiProvider?: AiProvider;
  aiConfig?: AiRuntimeConfig;
  aiClock?: AiClock;
  aiJitter?: AiJitter;
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
  private activeBot: { interactionId: string; controller: AbortController } | null = null;
  private readonly aiConfig: AiRuntimeConfig;
  constructor(private readonly dependencies: SessionDependencies) {
    this.aiConfig = dependencies.aiConfig ?? loadAiConfig();
  }

  async serial<T>(operation: () => T | Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }

  get(): GameState | null { return this.game; }

  create(botCount: number, aiMode = false): GameState {
    this.activeBot?.controller.abort();
    this.activeBot = null;
    const deckRandom = (this.game?.deckRandom ?? this.dependencies.deckRandom).clone();
    const botRandom = (this.game?.botRandom ?? this.dependencies.botRandom).clone();
    const gameId = randomUUID();
    const hand = createHand(botCount, randomUUID(), { deckRandom,
      ...(this.dependencies.deck === undefined ? {} : { deck: this.dependencies.deck }) });
    const configured = dependenciesConfigured(this.dependencies, this.aiConfig);
    const candidate: GameState = { gameId, version: 1, botCount, handNumber: 1,
      hand, history: recordInitial(hand), previousResult: null, deckRandom, botRandom,
      aiDecisionOrdinal: 0, ai: { mode: aiMode ? 'on' : 'off',
        availability: configured ? 'configured' : 'unavailable', active: null, lastBotOutcome: null,
        analysis: { status: 'idle', interactionId: null, result: null } }, facts: createMatchFacts(gameId) };
    if (!aiMode || !configured) {
      const beforeActor = candidate.hand.actorId;
      runBots(candidate);
      if (aiMode && beforeActor !== candidate.hand.actorId) {
        candidate.ai.lastBotOutcome = { handId: candidate.hand.handId, actorId: beforeActor!,
          decisionOrdinal: ++candidate.aiDecisionOrdinal, outcome: 'local_fallback', attemptCount: 0, finalModel: null };
      }
    }
    this.game = candidate;
    if (aiMode && configured) queueMicrotask(() => this.kickBot());
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
      const observation = buildBotObservationForHuman(candidate);
      candidate.facts = recordHumanDecision(candidate.facts, candidate, action, observation);
      applyAndRecord(candidate, human.id, action);
      if (candidate.ai.mode === 'off' || candidate.ai.availability === 'unavailable') {
        const firstBot = candidate.hand.players.find(p => p.id === candidate.hand.actorId && p.kind === 'bot');
        runBots(candidate);
        if (candidate.ai.mode === 'on' && firstBot) candidate.ai.lastBotOutcome = {
          handId: candidate.hand.handId, actorId: firstBot.id,
          decisionOrdinal: ++candidate.aiDecisionOrdinal, outcome: 'local_fallback',
          attemptCount: 0, finalModel: null };
      }
      candidate.facts = attachHandOutcome(candidate.facts, candidate);
      this.dependencies.beforeActionCommit?.();
    } catch (error) {
      if (error instanceof BettingError) throw new SessionError('ILLEGAL_ACTION', error.message);
      if (error instanceof SessionError) throw error;
      throw new SessionError('INTERNAL_ERROR', 'Interna greška pri obradi poteza.');
    }
    candidate.version++;
    this.game = candidate;
    if (candidate.ai.mode === 'on' && candidate.ai.availability === 'configured') queueMicrotask(() => this.kickBot());
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
      if (candidate.ai.mode === 'off' || candidate.ai.availability === 'unavailable') {
        const firstBot = candidate.hand.players.find(p => p.id === candidate.hand.actorId && p.kind === 'bot');
        runBots(candidate);
        if (candidate.ai.mode === 'on' && firstBot) candidate.ai.lastBotOutcome = {
          handId: candidate.hand.handId, actorId: firstBot.id,
          decisionOrdinal: ++candidate.aiDecisionOrdinal, outcome: 'local_fallback',
          attemptCount: 0, finalModel: null };
      }
      this.dependencies.beforeNextHandCommit?.();
      candidate.version++;
      this.game = candidate;
      if (candidate.ai.mode === 'on' && candidate.ai.availability === 'configured') queueMicrotask(() => this.kickBot());
      return candidate;
    } catch (error) {
      if (error instanceof SessionError) throw error;
      throw new SessionError('INTERNAL_ERROR', 'Interna greška pri pokretanju sledeće ruke.');
    }
  }

  private kickBot(): void {
    void this.runOneBotInteraction();
  }

  private async runOneBotInteraction(): Promise<void> {
    const reservation = await this.serial(() => {
      const game = this.game;
      if (!game || game.ai.mode !== 'on' || game.ai.availability !== 'configured' || game.ai.active) return null;
      const actor = game.hand.players.find(p => p.id === game.hand.actorId);
      if (!actor || actor.kind !== 'bot' || game.hand.phase === 'complete') return null;
      const interactionId = randomUUID();
      const controller = new AbortController();
      const ordinal = ++game.aiDecisionOrdinal;
      const context = buildBotDecisionContext(game, actor.id, ordinal);
      game.ai.active = { interactionId, purpose: 'bot', status: 'waiting', attemptCount: 0,
        model: this.aiConfig.primaryModel };
      this.activeBot = { interactionId, controller };
      return { interactionId, controller, context };
    });
    if (!reservation || !this.dependencies.aiProvider) return;
    const result = await coordinateBot(this.dependencies.aiProvider, this.aiConfig, reservation.context,
      reservation.controller.signal, this.dependencies.aiClock ?? systemClock,
      this.dependencies.aiJitter ?? zeroJitter);
    await this.serial(() => this.commitBot(reservation.interactionId, reservation.context, result));
  }

  private commitBot(interactionId: string, context: BotDecisionContext,
    result: Awaited<ReturnType<typeof coordinateBot>>): void {
    const current = this.game;
    if (!current || current.ai.active?.interactionId !== interactionId || this.activeBot?.interactionId !== interactionId
      || current.gameId !== context.gameId || current.hand.handId !== context.handId
      || current.version !== context.expectedVersion || current.hand.actorId !== context.actorId) return;
    const candidate = cloneGame(current);
    const observation = buildBotObservation(candidate.hand, context.actorId, candidate.history.current.events);
    const action = result.ok && result.value ? result.value : safeBotAction(observation.legalActions,
      () => chooseBotAction(observation, candidate.botRandom)).action;
    try { applyAndRecord(candidate, context.actorId, action); }
    catch {
      const fallback = safeBotAction(observation.legalActions, () => { throw new Error('AI proposal rejected'); });
      applyAndRecord(candidate, context.actorId, fallback.action);
    }
    candidate.version++;
    candidate.ai.active = null;
    candidate.ai.lastBotOutcome = { handId: context.handId, actorId: context.actorId,
      decisionOrdinal: context.decisionOrdinal, outcome: result.ok ? 'model' : 'local_fallback',
      attemptCount: result.attempts.length, finalModel: result.finalModel };
    candidate.facts = attachHandOutcome(candidate.facts, candidate);
    this.game = candidate;
    this.activeBot = null;
    queueMicrotask(() => this.kickBot());
  }

  startAnalysis(input: { gameId: string; handId: string; expectedVersion: number }): GameState {
    const game = this.game;
    if (!game || game.gameId !== input.gameId) throw new SessionError('GAME_NOT_FOUND', 'Partija nije pronađena.');
    if (game.hand.handId !== input.handId || game.version !== input.expectedVersion
      || game.hand.phase !== 'complete' || game.hand.gameStatus === 'playing') {
      throw new SessionError('ANALYSIS_NOT_ALLOWED', 'Analiza nije dozvoljena za trenutno stanje.');
    }
    if (game.ai.analysis.status === 'generating') throw new SessionError('AI_ALREADY_PENDING', 'Analiza je već u toku.');
    if (!dependenciesConfigured(this.dependencies, this.aiConfig) || !this.dependencies.aiProvider) {
      game.ai.analysis = { status: 'unavailable', interactionId: null, result: null };
      throw new SessionError('AI_UNAVAILABLE', 'AI analiza nije dostupna.');
    }
    const interactionId = randomUUID();
    const controller = new AbortController();
    game.ai.analysis = { status: 'generating', interactionId, result: null };
    game.ai.active = { interactionId, purpose: 'analysis', status: 'waiting', attemptCount: 0,
      model: this.aiConfig.primaryModel };
    this.activeBot = { interactionId, controller };
    const fingerprint = { gameId: game.gameId, handId: game.hand.handId,
      expectedVersion: game.version, factsRevision: game.facts.revision };
    const context = analysisContext(game.facts);
    void this.runAnalysis(interactionId, controller, fingerprint, context);
    return game;
  }

  private async runAnalysis(interactionId: string, controller: AbortController,
    fingerprint: { gameId: string; handId: string; expectedVersion: number; factsRevision: number },
    context: unknown): Promise<void> {
    const result = await coordinateAnalysis(this.dependencies.aiProvider!, this.aiConfig, context,
      controller.signal, this.dependencies.aiClock ?? systemClock, this.dependencies.aiJitter ?? zeroJitter);
    await this.serial(() => {
      const game = this.game;
      if (!game || game.ai.active?.interactionId !== interactionId || game.gameId !== fingerprint.gameId
        || game.hand.handId !== fingerprint.handId || game.version !== fingerprint.expectedVersion
        || game.facts.revision !== fingerprint.factsRevision) return;
      game.ai.active = null;
      game.ai.analysis = { status: result.ok ? 'completed' : 'failed', interactionId,
        result: result.ok ? result.value ?? null : null };
      this.activeBot = null;
    });
  }
}

function dependenciesConfigured(dependencies: SessionDependencies, config: AiRuntimeConfig): boolean {
  return dependencies.aiProvider !== undefined && config.enabled && config.apiKey !== null;
}

function buildBotObservationForHuman(game: GameState) {
  const human = game.hand.players.find(p => p.kind === 'human')!;
  return legalActions(game.hand, human.id);
}
