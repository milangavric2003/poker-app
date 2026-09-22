import { z } from 'zod';

export const CardSchema = z.string().regex(/^[2-9TJQKA][cdhs]$/);
export const ChipsSchema = z.number().int().min(0).max(6000);
export const SeatSchema = z.number().int().min(0).max(5);
const PositiveChips = ChipsSchema.min(1);
const Version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const Identity = { gameId: z.uuid(), handId: z.uuid(), expectedVersion: Version };
export const GameConfigSchema = z.strictObject({ botCount: z.number().int().min(1).max(5) });
export const NextHandSchema = z.strictObject(Identity);
export const PlayerActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...Identity, type: z.literal('fold') }),
  z.strictObject({ ...Identity, type: z.literal('check') }),
  z.strictObject({ ...Identity, type: z.literal('call') }),
  z.strictObject({ ...Identity, type: z.literal('all_in') }),
  z.strictObject({ ...Identity, type: z.literal('bet'), amountTo: PositiveChips }),
  z.strictObject({ ...Identity, type: z.literal('raise'), amountTo: PositiveChips }),
]);

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type PlayerAction = z.infer<typeof PlayerActionSchema>;
export type NextHand = z.infer<typeof NextHandSchema>;

const Id = z.string().min(1);
const Status = z.enum(['playing', 'won', 'lost']);
const Phase = z.enum(['preflop', 'flop', 'turn', 'river', 'complete']);
const Reason = z.enum(['showdown', 'uncontested']);
const Kind = z.enum(['human', 'bot']);
const PlayerStatus = z.enum(['active', 'folded', 'all_in', 'eliminated']);
const ActionType = z.enum(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
const unique = <T>(values: T[]) => new Set(values).size === values.length;
const Ids = z.array(Id).max(6).refine(unique, 'Duplicate IDs');
const Cards = z.array(CardSchema).refine(unique, 'Duplicate cards');
const HoleCards = z.tuple([CardSchema, CardSchema]).refine(unique, 'Duplicate cards');
const Amount = z.strictObject({ playerId: Id, amount: ChipsSchema });
const Positions = { buttonSeat: SeatSchema, smallBlindSeat: SeatSchema, bigBlindSeat: SeatSchema };

export const LegalActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('fold') }),
  z.strictObject({ type: z.literal('check') }),
  z.strictObject({ type: z.literal('call'), payAmount: PositiveChips, isAllIn: z.boolean() }),
  z.strictObject({ type: z.literal('bet'), minAmountTo: PositiveChips, maxAmountTo: PositiveChips }),
  z.strictObject({ type: z.literal('raise'), minAmountTo: PositiveChips, maxAmountTo: PositiveChips }),
  z.strictObject({ type: z.literal('all_in'), amountTo: PositiveChips, payAmount: PositiveChips,
    classification: z.enum(['call', 'bet', 'raise']) }),
]).refine(a => {
  if (a.type === 'bet' || a.type === 'raise') return a.minAmountTo <= a.maxAmountTo;
  if (a.type === 'all_in') return a.payAmount <= a.amountTo;
  return true;
}, 'Invalid action amounts');

const EventBase = { seq: Version.min(1), handId: z.uuid(), street: Phase };
export const PublicEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...EventBase, type: z.literal('hand_started'), number: Version.min(1), ...Positions }),
  z.strictObject({ ...EventBase, type: z.literal('blind_posted'), playerId: Id,
    blind: z.enum(['small', 'big']), amount: ChipsSchema }),
  z.strictObject({ ...EventBase, type: z.literal('action'), playerId: Id,
    actionType: ActionType, payAmount: ChipsSchema, amountTo: ChipsSchema }),
  z.strictObject({ ...EventBase, type: z.literal('board_dealt'), cards: Cards.refine(c => c.length === 1 || c.length === 3) }),
  z.strictObject({ ...EventBase, type: z.literal('refund'), ...Amount.shape }),
  z.strictObject({ ...EventBase, type: z.literal('settled'), reason: Reason }),
]);

const ResultPot = z.strictObject({
  id: Id, amount: ChipsSchema, eligibleIds: Ids, winnerIds: Ids,
  payouts: z.array(Amount).min(1).max(6),
}).refine(p => p.winnerIds.length > 0
  && p.winnerIds.every(id => p.eligibleIds.includes(id))
  && unique(p.payouts.map(a => a.playerId))
  && p.payouts.length === p.winnerIds.length
  && p.payouts.every(a => p.winnerIds.includes(a.playerId))
  && p.payouts.reduce((sum, a) => sum + a.amount, 0) === p.amount, 'Invalid pot payout');

export const HandResultSchema = z.strictObject({
  handId: z.uuid(), reason: Reason, gameStatus: Status, pots: z.array(ResultPot).max(6),
  refunds: z.array(Amount).max(6),
  revealedCards: z.array(z.strictObject({ playerId: Id, cards: HoleCards })).max(6),
  netChanges: z.array(z.strictObject({ playerId: Id, amount: z.number().int().min(-6000).max(6000) })).min(2).max(6),
}).refine(r => {
  const ids = r.netChanges.map(n => n.playerId);
  const references = [...r.refunds.map(a => a.playerId), ...r.revealedCards.map(a => a.playerId),
    ...r.pots.flatMap(p => [...p.eligibleIds, ...p.winnerIds])];
  return unique(ids) && r.netChanges.reduce((s, n) => s + n.amount, 0) === 0
    && unique(r.pots.map(p => p.id)) && unique(r.refunds.map(a => a.playerId))
    && unique(r.revealedCards.map(a => a.playerId))
    && unique(r.revealedCards.flatMap(a => a.cards))
    && references.every(id => ids.includes(id));
}, 'Invalid result references or balance');

const PlayerView = z.strictObject({
  id: Id, seat: SeatSchema, kind: Kind, stack: ChipsSchema,
  streetContribution: ChipsSchema, handContribution: ChipsSchema, status: PlayerStatus,
  cards: HoleCards.nullable(),
}).refine(p => p.streetContribution <= p.handContribution
  && (p.status !== 'eliminated' || (p.stack === 0 && p.cards === null)), 'Invalid player');
const PotView = z.strictObject({
  id: Id, amount: ChipsSchema, contributionCap: ChipsSchema, contributorIds: Ids, eligibleIds: Ids,
}).refine(p => p.eligibleIds.every(id => p.contributorIds.includes(id)), 'Invalid pot eligibility');

export const GameViewSchema = z.strictObject({
  gameId: z.uuid(), handId: z.uuid(), version: Version,
  botCount: z.number().int().min(1).max(5), handNumber: Version.min(1),
  status: Status, phase: Phase, ...Positions, actorId: Id.nullable(),
  board: Cards.refine(c => [0, 3, 4, 5].includes(c.length)),
  players: z.array(PlayerView).min(2).max(6), totalPot: ChipsSchema, pots: z.array(PotView).max(6),
  legalActions: z.array(LegalActionSchema).max(6), events: z.array(PublicEventSchema),
  result: HandResultSchema.nullable(), previousResult: HandResultSchema.nullable(),
}).refine(v => {
  const ids = v.players.map(p => p.id);
  const visibleCards = [...v.board, ...v.players.flatMap(p => p.cards ?? [])];
  if (v.players.length !== v.botCount + 1 || !unique(ids)
    || !unique(v.players.map(p => p.seat)) || !unique(visibleCards)
    || v.players.some(p => p.seat > v.botCount)
    || v.players.filter(p => p.kind === 'human' && p.seat === 0).length !== 1
    || v.players.filter(p => p.kind === 'human').length !== 1
    || [v.buttonSeat, v.smallBlindSeat, v.bigBlindSeat].some(s => s > v.botCount)) return false;
  if (v.players.reduce((s, p) => s + p.stack + p.handContribution, 0) !== (v.botCount + 1) * 1000
    || v.players.reduce((s, p) => s + p.handContribution, 0) !== v.totalPot
    || v.pots.reduce((s, p) => s + p.amount, 0) !== v.totalPot) return false;
  if (!unique(v.pots.map(p => p.id))
    || v.pots.some(p => [...p.contributorIds, ...p.eligibleIds].some(id => !ids.includes(id)))
    || !unique(v.legalActions.map(a => a.type))) return false;
  if (v.events.some((e, i) => e.handId !== v.handId
    || (i > 0 && e.seq <= v.events[i - 1]!.seq)
    || ('playerId' in e && !ids.includes(e.playerId)))) return false;
  if (v.phase === 'complete') {
    if (!v.result || v.result.handId !== v.handId || v.result.gameStatus !== v.status
      || v.actorId !== null || v.legalActions.length || v.totalPot || v.pots.length) return false;
  } else {
    if (v.result !== null || v.status !== 'playing'
      || v.board.length !== ({ preflop: 0, flop: 3, turn: 4, river: 5 }[v.phase])) return false;
    const actor = v.players.find(p => p.id === v.actorId);
    if (!actor || actor.status !== 'active' || actor.stack === 0) return false;
    if (actor.kind !== 'human' && v.legalActions.length) return false;
  }
  const results = [v.result, v.previousResult].filter(r => r !== null);
  if (results.some(r => r.netChanges.length !== ids.length || r.netChanges.some(n => !ids.includes(n.playerId)))) return false;
  return v.players.every(p => {
    if (p.kind === 'human' || p.cards === null) return true;
    const shown = v.result?.revealedCards.find(r => r.playerId === p.id);
    return v.phase === 'complete' && v.result?.reason === 'showdown'
      && p.status !== 'folded' && !!shown && shown.cards.every((c, i) => c === p.cards?.[i]);
  });
}, 'Inconsistent or private game snapshot');

export const GameResponseSchema = z.strictObject({ game: GameViewSchema.nullable() });
export const GameErrorSchema = z.strictObject({ error: z.strictObject({
  code: z.enum(['INVALID_INPUT', 'GAME_NOT_FOUND', 'STALE_STATE', 'ILLEGAL_ACTION',
    'PRECONDITION_REQUIRED', 'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'INTERNAL_ERROR']),
  message: z.string().min(1),
}) });
export type GameView = z.infer<typeof GameViewSchema>;
export type LegalAction = z.infer<typeof LegalActionSchema>;
export type HandResult = z.infer<typeof HandResultSchema>;
export type PublicEvent = z.infer<typeof PublicEventSchema>;
export type GameError = z.infer<typeof GameErrorSchema>;
