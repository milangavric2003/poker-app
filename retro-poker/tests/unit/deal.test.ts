import { describe, expect, it, vi } from 'vitest';
import { createDeck, prepareDeck } from '../../backend/src/engine/cards.js';
import { act, createHand, settleHand, type ActiveHand } from '../../backend/src/engine/hand.js';
import { initialPositions } from '../../backend/src/engine/positions.js';
import { legalActions } from '../../backend/src/engine/betting.js';
import type { Card, PokerAction } from '../../backend/src/engine/types.js';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures.js';
import { expectChips } from '../helpers/assertions.js';

// Independent card catalogue and literal oracles; never computed by the engine.
const ordered = ('2c 3c 4c 5c 6c 7c 8c 9c Tc Jc Qc Kc Ac '
  + '2d 3d 4d 5d 6d 7d 8d 9d Td Jd Qd Kd Ad '
  + '2h 3h 4h 5h 6h 7h 8h 9h Th Jh Qh Kh Ah '
  + '2s 3s 4s 5s 6s 7s 8s 9s Ts Js Qs Ks As').split(' ') as Card[];
const handId = '22222222-2222-4222-8222-222222222222';
const start = (bots = 1, deck: readonly Card[] = ac23Deck) =>
  createHand(bots, handId, { deck, deckRandom: sequenceRandom([]) });

function invariant(hand: ActiveHand, total: number): void {
  expectChips(hand, total);
  const used = [...hand.players.flatMap(p => p.holeCards), ...hand.burnCards, ...hand.board];
  expect(used).toHaveLength(hand.deckCursor);
  expect(new Set([...used, ...hand.deck.slice(hand.deckCursor)]).size).toBe(52);
  expect(hand.pendingActors.every(id => hand.players.some(p =>
    p.id === id && p.status === 'active' && p.stack > 0))).toBe(true);
  if (hand.phase !== 'complete') {
    expect(hand.actorId).not.toBeNull();
    expect(hand.pendingActors).toContain(hand.actorId);
  } else {
    expect(hand.actorId).toBeNull();
    expect(hand.pendingActors).toEqual([]);
  }
}

function move(hand: ActiveHand, seat: number, action: PokerAction): ActiveHand {
  const player = hand.players.find(p => p.seat === seat)!;
  expect(hand.actorId).toBe(player.id);
  const before = structuredClone(hand);
  const total = hand.players.reduce((sum, p) => sum + p.stack + p.handContribution, 0);
  const next = act(hand, player.id, action);
  expect(hand).toEqual(before);
  invariant(next, total);
  return next;
}

describe('T014 špil i ubrizgana slučajnost', () => {
  it('pravi sve 52 jedinstvene karte bez džokera i nezavisne nizove', () => {
    const deck = createDeck();
    expect(deck).toEqual(ordered);
    expect(new Set(deck).size).toBe(52);
    deck.pop();
    expect(createDeck()).toEqual(ordered);
  });

  it('Fisher–Yates sa 51 nulom daje unapred poznatu rotaciju', () => {
    const rng = sequenceRandom(Array<number>(51).fill(0));
    const next = vi.spyOn(rng, 'next');
    expect(prepareDeck(rng)).toEqual([...ordered.slice(1), '2c']);
    expect(next).toHaveBeenCalledTimes(51);
    expect(prepareDeck(sequenceRandom(Array<number>(51).fill(0.999999)))).toEqual(ordered);
  });

  it('kontrolisani prefiks dopunjava do 52 bez mutacije i trošenja RNG-a', () => {
    const prefix = Object.freeze([...ac23Deck]);
    const deck = prepareDeck(sequenceRandom([]), prefix);
    expect(deck.slice(0, 12)).toEqual(ac23Deck);
    expect(deck).toHaveLength(52);
    expect(new Set(deck)).toEqual(new Set(ordered));
    expect(prefix).toEqual(ac23Deck);
  });

  it.each([['As', 'As'], ['1c'], ['XX'], [...ordered, 'As']])(
    'odbija nevalidan ili dupliran kontrolisani špil %#', (...cards) => {
      expect(() => prepareDeck(sequenceRandom([]), cards as Card[])).toThrow('Invalid deck');
    });

  it.each([-0.1, 1, NaN, Infinity])('odbija RNG vrednost %s', value => {
    const rng = { next: () => value, clone() { return this; } };
    expect(() => prepareDeck(rng)).toThrow('Invalid random value');
  });
});

describe('T014 AC01/AC02/validni AC03: početak ruke', () => {
  it.each([
    { bots: 1, blinds: [0, 1], first: 0, cards: [['3c', '5c'], ['2c', '4c']] },
    { bots: 2, blinds: [1, 2], first: 0, cards: [['4c', '7c'], ['2c', '5c'], ['3c', '6c']] },
    { bots: 3, blinds: [1, 2], first: 3, cards: [['5c', '9c'], ['2c', '6c'], ['3c', '7c'], ['4c', '8c']] },
    { bots: 4, blinds: [1, 2], first: 3, cards: [['6c', 'Jc'], ['2c', '7c'], ['3c', '8c'], ['4c', '9c'], ['5c', 'Tc']] },
    { bots: 5, blinds: [1, 2], first: 3, cards: [['7c', 'Kc'], ['2c', '8c'], ['3c', '9c'], ['4c', 'Tc'], ['5c', 'Jc'], ['6c', 'Qc']] },
  ])('$bots botova: početne pozicije, blindovi i dva kruga deljenja', ({ bots, blinds, first, cards }) => {
    const hand = start(bots, ordered);
    expect(hand.players).toHaveLength(bots + 1);
    expect(hand.players.map(p => p.seat)).toEqual(Array.from({ length: bots + 1 }, (_, i) => i));
    expect(hand.players.map(p => p.kind)).toEqual(['human', ...Array<string>(bots).fill('bot')]);
    expect(new Set(hand.players.map(p => p.id)).size).toBe(bots + 1);
    expect(hand.handId).toBe(handId);
    expect(hand.buttonSeat).toBe(0);
    expect([hand.smallBlindSeat, hand.bigBlindSeat]).toEqual(blinds);
    expect(initialPositions(bots)).toEqual({ buttonSeat: 0, smallBlindSeat: blinds[0], bigBlindSeat: blinds[1] });
    expect(hand.actorId).toBe(hand.players[first]!.id);
    expect(hand.players.map(p => p.holeCards)).toEqual(cards);
    expect(hand.players.every(p => p.stackAtHandStart === 1000 && !p.acted)).toBe(true);
    expect(hand.players[blinds[0]!]!.stack).toBe(995);
    expect(hand.players[blinds[1]!]!.stack).toBe(990);
    expect(hand.players.reduce((sum, p) => sum + p.handContribution, 0)).toBe(15);
    expect(hand.currentBet).toBe(10);
    expect(hand.lastFullRaise).toBe(10);
    expect(hand.phase).toBe('preflop');
    expect(hand.result).toBeNull();
    expect(hand.settled).toBe(false);
    expect(hand.board).toEqual([]);
    expect(hand.burnCards).toEqual([]);
    invariant(hand, (bots + 1) * 1000);
  });

  it('bez kontrolisanog špila koristi ubrizgani RNG i čuva bot RNG', () => {
    const botRandom = sequenceRandom([0.25]);
    const dependencies = {
      deckRandom: sequenceRandom(Array<number>(51).fill(0)), botRandom,
    };
    const hand = createHand(1, handId, dependencies);
    expect(hand.deck).toEqual([...ordered.slice(1), '2c']);
    expect(hand.players.map(p => p.holeCards)).toEqual([['4c', '6c'], ['3c', '5c']]);
    expect(botRandom.next()).toBe(0.25);
  });

  it.each([0, 6, 1.5, NaN])('odbija nevalidan broj botova %s pre RNG-a', bots => {
    expect(() => createHand(bots, handId, { deckRandom: sequenceRandom([]) })).toThrow('Invalid bot count');
  });
});

describe('T014 tok runde do settlement-a', () => {
  it.each([1, 2, 3, 4, 5])('%s botova: legalni call/check tok završava bez zastoja', bots => {
    let hand = start(bots, ordered);
    let actions = 0;
    while (hand.phase !== 'complete' && actions++ < 30) {
      const player = hand.players.find(p => p.id === hand.actorId)!;
      const action = legalActions(hand, player.id).find(a => a.type === 'check' || a.type === 'call')!;
      hand = move(hand, player.seat, { type: action.type } as PokerAction);
    }
    expect(hand.phase).toBe('complete');
    expect(actions).toBe((bots + 1) * 4);
    expect(hand.deckCursor).toBe((bots + 1) * 2 + 8);
    expect(hand.result?.pots.reduce((sum, pot) => sum + pot.amount, 0)).toBe((bots + 1) * 10);
  });

  it('AC02/AC23: BB dobija prvu kartu, ima opciju, board je 3–1–1 sa burn-ovima', () => {
    let hand = start();
    expect(hand.players.map(p => p.holeCards)).toEqual([['As', 'Ah'], ['Kc', 'Kd']]);
    hand = move(hand, 0, { type: 'call' });
    expect(hand.phase).toBe('preflop');
    expect(hand.board).toEqual([]);
    expect(legalActions(hand, hand.players[1]!.id)).toContainEqual({ type: 'check' });
    hand = move(hand, 1, { type: 'check' });
    expect(hand.phase).toBe('flop');
    expect(hand.board).toEqual(['2c', '3d', '7h']);
    expect(hand.burnCards).toEqual(['6c']);
    expect(hand.deckCursor).toBe(8);
    expect(hand.currentBet).toBe(0);
    expect(hand.players.map(p => [p.streetContribution, p.handContribution, p.acted, p.lastFacedBet]))
      .toEqual([[0, 10, false, 0], [0, 10, false, 0]]);
    hand = move(hand, 1, { type: 'check' });
    expect(hand.phase).toBe('flop');
    hand = move(hand, 0, { type: 'check' });
    expect(hand.phase).toBe('turn');
    expect(hand.board).toEqual(['2c', '3d', '7h', '9s']);
    expect(hand.burnCards).toEqual(['6c', '8c']);
    expect(hand.deckCursor).toBe(10);
    hand = move(hand, 1, { type: 'check' });
    hand = move(hand, 0, { type: 'check' });
    expect(hand.phase).toBe('river');
    expect(hand.board).toEqual(['2c', '3d', '7h', '9s', 'Jc']);
    expect(hand.burnCards).toEqual(['6c', '8c', 'Tc']);
    expect(hand.deckCursor).toBe(12);
    hand = move(hand, 1, { type: 'check' });
    expect(hand.result).toBeNull();
    hand = move(hand, 0, { type: 'check' });
    expect(hand.phase).toBe('complete');
    expect(hand.players.map(p => p.stack)).toEqual([1010, 990]);
    expect(hand.result?.pots[0]?.payouts).toEqual([{ playerId: hand.players[0]!.id, amount: 20 }]);
    expect(hand.result?.netChanges.map(p => p.amount)).toEqual([10, -10]);
    expect(hand.result?.reason).toBe('showdown');
    expect(hand.result?.revealedCards).toHaveLength(2);
    expect(settleHand(hand)).toEqual(hand);
    expect(() => act(hand, hand.players[0]!.id, { type: 'check' })).toThrow();
  });

  it('AC16: fold odmah isplaćuje 995/1005 bez burn-a ili board-a', () => {
    const hand = move(start(), 0, { type: 'fold' });
    expect(hand.phase).toBe('complete');
    expect(hand.players.map(p => p.stack)).toEqual([995, 1005]);
    expect(hand.board).toEqual([]);
    expect(hand.burnCards).toEqual([]);
    expect(hand.deckCursor).toBe(4);
    expect(hand.result?.reason).toBe('uncontested');
    expect(hand.result?.refunds).toEqual([{ playerId: hand.players[1]!.id, amount: 5 }]);
    expect(hand.result?.revealedCards).toEqual([]);
  });

  it('all-in čeka odgovor na dug pa automatski deli ostatak i isplaćuje jednom', () => {
    let hand = move(start(), 0, { type: 'all_in' });
    expect(hand.phase).toBe('preflop');
    expect(hand.board).toEqual([]);
    expect(hand.players[0]!.status).toBe('all_in');
    hand = move(hand, 1, { type: 'call' });
    expect(hand.phase).toBe('complete');
    expect(hand.board).toEqual(['2c', '3d', '7h', '9s', 'Jc']);
    expect(hand.burnCards).toEqual(['6c', '8c', 'Tc']);
    expect(hand.players.map(p => p.stack)).toEqual([2000, 0]);
    expect(hand.result?.gameStatus).toBe('won');
    expect(settleHand(hand)).toEqual(hand);
  });

  it('all-in na flop-u ne deli flop ponovo i resetuje puni raise na novoj ulici', () => {
    let hand = move(start(), 0, { type: 'raise', amountTo: 30 });
    expect(hand.lastFullRaise).toBe(20);
    hand = move(hand, 1, { type: 'call' });
    expect(hand.phase).toBe('flop');
    expect(hand.lastFullRaise).toBe(10);
    hand = move(hand, 1, { type: 'all_in' });
    hand = move(hand, 0, { type: 'call' });
    expect(hand.phase).toBe('complete');
    expect(hand.deckCursor).toBe(12);
    expect(hand.burnCards).toEqual(['6c', '8c', 'Tc']);
    expect(hand.players.map(p => p.stack)).toEqual([2000, 0]);
  });

  it('preskače folded/all-in mesta, ali dva solventna igrača nastavljaju za side pot', () => {
    const deck: Card[] = ['Kc', 'Qc', 'Jc', 'As', 'Kd', 'Qd', 'Jd', 'Ah',
      '6c', '2c', '3d', '7h', '8c', '9s', 'Tc', '4c'];
    let hand = start(3, deck);
    // In-process later-hand snapshot, not a user-configurable starting stack.
    hand.players[0]!.stack += 990;
    hand.players[0]!.stackAtHandStart += 990;
    hand.players[3]!.stack = 10;
    hand.players[3]!.stackAtHandStart = 10;
    hand = move(hand, 3, { type: 'all_in' });
    hand = move(hand, 0, { type: 'call' });
    hand = move(hand, 1, { type: 'fold' });
    hand = move(hand, 2, { type: 'check' });
    expect(hand.phase).toBe('flop');
    expect(hand.pendingActors).toEqual([hand.players[2]!.id, hand.players[0]!.id]);
    hand = move(hand, 2, { type: 'bet', amountTo: 20 });
    hand = move(hand, 0, { type: 'call' });
    expect(hand.phase).toBe('turn');
    for (let street = 0; street < 2; street++) {
      hand = move(hand, 2, { type: 'check' });
      hand = move(hand, 0, { type: 'check' });
    }
    expect(hand.phase).toBe('complete');
    expect(hand.players.map(p => p.stack)).toEqual([2035, 995, 970, 0]);
    expect(hand.result?.pots.map(p => p.amount)).toEqual([20, 15, 40]);
    expect(hand.result?.revealedCards.map(p => p.playerId))
      .toEqual([hand.players[0]!.id, hand.players[2]!.id, hand.players[3]!.id]);
  });

  it('jedini solventni igrač ne dobija novu rundu protiv all-in protivnika', () => {
    let hand = start();
    hand.players[0]!.stack += 960;
    hand.players[0]!.stackAtHandStart += 960;
    hand.players[1]!.stack -= 960;
    hand.players[1]!.stackAtHandStart -= 960;
    hand = move(hand, 0, { type: 'raise', amountTo: 100 });
    hand = move(hand, 1, { type: 'call' });
    expect(hand.phase).toBe('complete');
    expect(hand.players.map(p => p.stack)).toEqual([2000, 0]);
    expect(hand.result?.refunds).toEqual([{ playerId: hand.players[0]!.id, amount: 60 }]);
    expect(hand.result?.pots[0]?.amount).toBe(80);
    expect(hand.deckCursor).toBe(12);
  });

  it('odbijena akcija ne menja karte, cursor, žetone ili red poteza', () => {
    const hand = start();
    const before = structuredClone(hand);
    expect(() => act(hand, hand.players[0]!.id, { type: 'check' })).toThrow();
    expect(() => act(hand, hand.players[1]!.id, { type: 'call' })).toThrow();
    expect(hand).toEqual(before);
  });
});
