import { expect, it } from 'vitest';
import { GameSession } from '../../backend/src/session';
import { toGameView } from '../../backend/src/view';
import { GameViewSchema } from '../../shared/contracts';
import { ac23Deck, sequenceRandom } from '../helpers/fixtures';
import { act, createHand } from '../../backend/src/engine/hand';
import { legalActions } from '../../backend/src/engine/betting';

function session() {
  const s = new GameSession({ deck: ac23Deck, deckRandom: sequenceRandom([]), botRandom: sequenceRandom(Array(50).fill(0.9)) });
  s.create(1); return s;
}
function inspect(s: GameSession, reveal = false) {
  const view = toGameView(s.get()!);
  expect(GameViewSchema.safeParse(view).success).toBe(true);
  const json = JSON.stringify(view);
  for (const key of ['deck', 'burnCards', 'holeCards', 'deckRandom', 'botRandom', 'observation', 'pendingActors', 'seed']) {
    expect(json).not.toContain(`"${key}"`);
  }
  if (!reveal) for (const card of ['Kc', 'Kd']) expect(json).not.toContain(`"${card}"`);
  return view;
}
it('AC19: preflop/flop/turn/river skrivaju bot karte u celom odgovoru; showdown ih otkriva', () => {
  const s = session();
  for (const phase of ['preflop', 'flop', 'turn', 'river']) {
    const v = inspect(s); expect(v.phase).toBe(phase);
    s.action({ gameId: v.gameId, handId: v.handId, expectedVersion: v.version, type: phase === 'preflop' ? 'call' : 'check' });
  }
  expect(inspect(s, true).players[1]!.cards).toEqual(['Kc', 'Kd']);
});
it('AC19: fold ne otkriva protivnika ni kroz rezultat ili istoriju', () => {
  const s = session(); const v = inspect(s);
  s.action({ gameId: v.gameId, handId: v.handId, expectedVersion: v.version, type: 'fold' });
  expect(inspect(s).result?.revealedCards).toEqual([]);
});
it('javna projekcija izdvaja nested event/result polja bez internih dodataka', () => {
  const s = session(); let v = inspect(s);
  s.action({ gameId: v.gameId, handId: v.handId, expectedVersion: v.version, type: 'fold' });
  const g = s.get()!;
  for (const event of g.history.current.events) Object.assign(event, { observation: { holeCards: ['Kc', 'Kd'] } });
  Object.assign(g.hand.result!, { deck: ['Kc', 'Kd'] });
  for (const pot of g.hand.result!.pots) {
    Object.assign(pot, { seed: 123 });
    for (const payout of pot.payouts) Object.assign(payout, { observation: 'private' });
  }
  g.previousResult = g.hand.result;
  v = inspect(s); expect(v.previousResult).toEqual(v.result);
});
it('svaki nested objekat svih event unija i showdown/previousResult ostaje javna projekcija', () => {
  const s = session();
  for (const type of ['call', 'check', 'check', 'check'] as const) {
    const g = s.get()!;
    s.action({ gameId: g.gameId, handId: g.hand.handId, expectedVersion: g.version, type });
  }
  const g = s.get()!; g.previousResult = structuredClone(g.hand.result);
  const expected = toGameView(g);
  function contaminate(value: unknown) {
    if (Array.isArray(value)) { value.forEach(contaminate); return; }
    if (!value || typeof value !== 'object') return;
    Object.values(value).forEach(contaminate);
    Object.assign(value, { observation: { seed: 42, deck: ['6c'] } });
  }
  contaminate(g.history.current.events); contaminate(g.hand.result); contaminate(g.previousResult);
  expect(toGameView(g)).toEqual(expected);
  expect(GameViewSchema.safeParse(toGameView(g)).success).toBe(true);
});
it('foldovani bot ostaje skriven kada drugi učesnici stignu na showdown', () => {
  const s = session(); const g = s.get()!;
  g.botCount = 2;
  g.hand = createHand(2, g.hand.handId, { deckRandom: sequenceRandom(Array(60).fill(0.4)) });
  const hidden = g.hand.players[1]!.holeCards;
  let count = 0;
  while (g.hand.phase !== 'complete' && count++ < 30) {
    const actor = g.hand.actorId!;
    const options = legalActions(g.hand, actor);
    const action = actor === 'player-1' ? { type: 'fold' as const }
      : options.find(a => a.type === 'check') ?? options.find(a => a.type === 'call')!;
    g.hand = act(g.hand, actor, action);
  }
  const view = toGameView(g);
  expect(view.result?.reason).toBe('showdown');
  expect(view.players[1]!.cards).toBeNull();
  for (const card of hidden) expect(JSON.stringify(view)).not.toContain(`"${card}"`);
  expect(GameViewSchema.safeParse(view).success).toBe(true);
});
