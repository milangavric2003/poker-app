import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, BettingError } from '../../backend/src/engine/betting.js';
import { betting, headsUp, player } from '../helpers/fixtures.js';
import { expectChips } from '../helpers/assertions.js';
import type { BettingState, PokerAction } from '../../backend/src/engine/types.js';
const act = (s: BettingState, id: string, type: 'fold'|'check'|'call'|'all_in') => applyAction(s, id, { type });

describe('reopening / AC08–AC10', () => {
  it('AC08 short raise does not reopen A, even through all_in', () => {
    let s=betting([player('A',0),player('B',1,{stack:140}),player('C',2,{stack:1860})]);
    s=applyAction(s,'A',{type:'bet',amountTo:100});
    s=act(s,'B','all_in'); s=act(s,'C','call');
    expect(s.actorId).toBe('A'); expect(s.lastFullRaise).toBe(100);
    expect(legalActions(s,'A').map(a=>a.type)).toEqual(['fold','call']);
    const before=structuredClone(s);
    expect(()=>act(s,'A','all_in')).toThrow(BettingError);
    expect(s).toEqual(before); expectChips(s,3000);
  });
  it('AC09 cumulative short raises reopen A but not C after A calls', () => {
    let s=betting([player('A',0,{stack:1460}),player('B',1,{stack:140}),
      player('C',2,{stack:2200}),player('D',3,{stack:200})]);
    s=applyAction(s,'A',{type:'bet',amountTo:100});
    s=act(s,'B','all_in'); s=act(s,'C','call'); s=act(s,'D','all_in');
    expect(s.actorId).toBe('A'); expect(s.lastFullRaise).toBe(100);
    expect(legalActions(s,'A')).toContainEqual({type:'raise',minAmountTo:300,maxAmountTo:1460});
    s=act(s,'A','call'); expect(s.actorId).toBe('C');
    expect(legalActions(s,'C').map(a=>a.type)).toEqual(['fold','call']);
    s=act(s,'C','call'); expect(s.actorId).toBeNull(); expectChips(s,4000);
  });
  function shortOpening() {
    let s=betting([player('A',0),player('B',1,{stack:4}),player('C',2,{stack:1996})]);
    s=act(s,'A','check'); return act(s,'B','all_in');
  }
  it('AC10 short opening does not reopen a checker after C calls', () => {
    let s=shortOpening();
    expect(s.lastFullRaise).toBe(10);
    expect(legalActions(s,'C')).toContainEqual({type:'raise',minAmountTo:14,maxAmountTo:1996});
    expect(()=>applyAction(s,'C',{type:'raise',amountTo:10})).toThrow(BettingError);
    s=act(s,'C','call');
    expect(legalActions(s,'A').map(a=>a.type)).toEqual(['fold','call']);
    expectChips(s,3000);
  });
  it('AC10 full raise to14 reopens A with minimum24', () => {
    const s=applyAction(shortOpening(),'C',{type:'raise',amountTo:14});
    expect(legalActions(s,'A')).toContainEqual({type:'raise',minAmountTo:24,maxAmountTo:1000});
  });
  it('check followed by a full opening permits a check-raise', () => {
    let s=betting([player('A',0),player('B',1)]);
    s=act(s,'A','check'); s=applyAction(s,'B',{type:'bet',amountTo:10});
    expect(legalActions(s,'A')).toContainEqual({type:'raise',minAmountTo:20,maxAmountTo:1000});
  });
  it('short stack may call all-in even without reopening rights', () => {
    const s=betting([player('A',0,{stack:20,streetContribution:100,handContribution:100,acted:true,lastFacedBet:100}),
      player('B',1,{stack:1740,streetContribution:140,handContribution:140})],{currentBet:140,lastFullRaise:100});
    expect(legalActions(s,'A')).toContainEqual({type:'all_in',amountTo:120,payAmount:20,classification:'call'});
    expect(act(s,'A','all_in').players[0]).toMatchObject({stack:0,status:'all_in',handContribution:120});
  });
  it('folded and all-in seats are skipped after a raise', () => {
    const s=betting([player('A',0),player('B',1,{status:'folded'}),
      player('C',2,{status:'all_in',stack:0,handContribution:100}),player('D',5,{stack:1900})]);
    const next=applyAction(s,'A',{type:'bet',amountTo:10});
    expect(next.actorId).toBe('D'); expect(next.pendingActors).toEqual(['D']);
  });
});

describe('basic betting / AC04–AC07', () => {
  it('AC04 rejects check facing 20 and preserves state', () => {
    const s = betting([player('A',0), player('B',1,{stack:980,streetContribution:20,handContribution:20})],{currentBet:20});
    const before=structuredClone(s);
    expect(()=>act(s,'A','check')).toThrow(BettingError);
    expect(s).toEqual(before);
  });
  it('AC05 minimum raise is 50, not 49', () => {
    const s=betting([player('A',0),player('B',1,{stack:970,streetContribution:30,handContribution:30})],{currentBet:30,lastFullRaise:20});
    expect(legalActions(s,'A')).toContainEqual({type:'raise',minAmountTo:50,maxAmountTo:1000});
    expect(()=>applyAction(s,'A',{type:'raise',amountTo:49})).toThrow(BettingError);
    const next=applyAction(s,'A',{type:'raise',amountTo:50});
    expect(next.currentBet).toBe(50); expect(next.lastFullRaise).toBe(20);
    expectChips(next,2000);
  });
  it('AC06 raise-to deducts only the difference', () => {
    const s=betting([player('A',0,{stack:90,streetContribution:10,handContribution:10}),player('B',1,{stack:1870,streetContribution:30,handContribution:30})],{currentBet:30,lastFullRaise:20});
    const next=applyAction(s,'A',{type:'raise',amountTo:60});
    expect(next.players[0]).toMatchObject({stack:40,streetContribution:60,handContribution:60});
    expect(next.lastFullRaise).toBe(30); expectChips(next,2000);
    expect(s.players[0]?.stack).toBe(90);
  });
  it('AC07 short call is all-in but not eliminated', () => {
    const s=betting([player('A',0,{stack:40}),player('B',1,{stack:1860,streetContribution:100,handContribution:100})],{currentBet:100,lastFullRaise:100});
    const next=act(s,'A','call');
    expect(next.players[0]).toMatchObject({stack:0,status:'all_in',streetContribution:40});
    expect(next.actorId).toBeNull(); expectChips(next,2000);
  });
  it('BB retains option after limp; equal bets alone do not finish the round', () => {
    const next=act(headsUp(),'A','call');
    expect(next.actorId).toBe('B'); expect(next.pendingActors).toEqual(['B']);
    expect(legalActions(next,'B')).toContainEqual({type:'check'});
    expect(act(next,'B','check').actorId).toBeNull(); expectChips(next,2000);
  });
  it('short blind keeps nominal pre-flop minimum', () => {
    const s=betting([player('A',0,{stack:997,streetContribution:3,handContribution:3}),
      player('B',1,{stack:0,status:'all_in',streetContribution:7,handContribution:7}),
      player('C',2,{stack:1993})],{currentBet:10});
    expect(legalActions(s,'A')).toContainEqual({type:'call',payAmount:7,isAllIn:false});
    expect(legalActions(s,'A')).toContainEqual({type:'raise',minAmountTo:20,maxAmountTo:1000});
  });
  it('one funded player cannot create a dry side pot', () => {
    const s=betting([player('A',0,{stack:1960}),player('B',1,{stack:0,status:'all_in',streetContribution:40,handContribution:40})],{currentBet:40});
    expect(legalActions(s,'A').map(a=>a.type)).toEqual(['fold','call']);
    expect(()=>act(s,'A','all_in')).toThrow(BettingError);
    expect(act(s,'A','call').actorId).toBeNull();
  });
  it('fold leaves contributions and closes the hand', () => {
    const next=act(headsUp(),'A','fold');
    expect(next.players[0]).toMatchObject({status:'folded',handContribution:5,stack:995});
    expect(next.actorId).toBeNull(); expectChips(next,2000);
  });
  it.each([{type:'raise',amountTo:-1},{type:'raise',amountTo:1.5},{type:'raise',amountTo:1001},
    {type:'call',amountTo:5},{type:'dance'}])('rejects bad action %j', action => {
    const s=headsUp();
    expect(()=>applyAction(s,'A',action as PokerAction)).toThrow(BettingError);
    expect(s).toEqual(headsUp());
  });
  it('only active current actor has actions',()=>{
    expect(legalActions(headsUp(),'B')).toEqual([]);
    expect(()=>act(headsUp(),'B','call')).toThrow(BettingError);
    const s=headsUp(); s.actorId=null; s.pendingActors=[];
    expect(legalActions(s,'A')).toEqual([]);
  });
});
