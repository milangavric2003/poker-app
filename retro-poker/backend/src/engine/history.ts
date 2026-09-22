import type { PublicEvent } from '../../../shared/contracts.js';

export interface HandHistory {
  handId: string;
  events: PublicEvent[];
}

export interface GameHistory {
  current: HandHistory;
  previous: HandHistory | null;
}

type EventInput = PublicEvent extends infer Event
  ? Event extends PublicEvent ? Omit<Event, 'seq' | 'handId'> : never
  : never;

const eventKeys: Record<PublicEvent['type'], readonly string[]> = {
  hand_started: ['type', 'street', 'number', 'buttonSeat', 'smallBlindSeat', 'bigBlindSeat'],
  blind_posted: ['type', 'street', 'playerId', 'blind', 'amount'],
  action: ['type', 'street', 'playerId', 'actionType', 'payAmount', 'amountTo'],
  board_dealt: ['type', 'street', 'cards'],
  refund: ['type', 'street', 'playerId', 'amount'],
  settled: ['type', 'street', 'reason'],
};

export function createHistory(handId: string): GameHistory {
  return { current: { handId, events: [] }, previous: null };
}

export function appendEvent(history: GameHistory, input: EventInput): GameHistory {
  const allowed = eventKeys[input.type];
  if (!allowed || Object.keys(input).some(key => !allowed.includes(key))) {
    throw new Error('Invalid public event');
  }
  const event = { ...input, seq: history.current.events.length + 1,
    handId: history.current.handId } as PublicEvent;
  return { ...history, current: { ...history.current,
    events: [...history.current.events, event] } };
}

export function completeHistory(history: GameHistory, nextHandId: string): GameHistory {
  return { previous: history.current, current: { handId: nextHandId, events: [] } };
}
