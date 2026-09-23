import type { GameView, PublicEvent } from '../../../shared/contracts';

const rankNames: Record<string, string> = { T: '10', J: 'Žandar', Q: 'Dama', K: 'Kralj', A: 'As' };
const suits = {
  c: { symbol: '♣', name: 'tref', tone: 'black' },
  d: { symbol: '♦', name: 'karo', tone: 'red' },
  h: { symbol: '♥', name: 'herc', tone: 'red' },
  s: { symbol: '♠', name: 'pik', tone: 'black' },
} as const;

function Card({ card }: { card: string }) {
  const rank = card[0] ?? '';
  const suit = suits[card[1] as keyof typeof suits];
  const label = `${rankNames[rank] ?? rank} ${suit?.name ?? ''}`.trim();
  return <span className={`card card-${suit?.tone ?? 'black'}`} aria-label={label}>
    <span aria-hidden="true">{rank}{suit?.symbol}</span><small aria-hidden="true">{card}</small>
  </span>;
}

function eventText(event: PublicEvent): string {
  switch (event.type) {
    case 'hand_started': return `Početak ruke ${event.number}`;
    case 'blind_posted': return `${event.playerId}: ${event.blind === 'small' ? 'mali' : 'veliki'} blind ${event.amount}`;
    case 'action': return `${event.playerId}: ${event.actionType} — doplata ${event.payAmount}, ukupno ${event.amountTo}`;
    case 'board_dealt': return `${event.cards.length === 3 ? 'Flop' : 'Board'}: ${event.cards.join(' ')}`;
    case 'refund': return `${event.playerId}: povraćaj ${event.amount}`;
    case 'settled': return `Ruka završena: ${event.reason}`;
  }
}

export function Table({ game }: { game: GameView }) {
  const playerName = (seat: number) => seat === 0 ? 'Ti' : `Bot ${seat}`;
  return <div className="table-layout"><section className="poker-table" aria-label="Poker sto">
    <header><span>Ruka {game.handNumber} · {game.phase}</span><strong>Pot: {game.totalPot}</strong></header>
    <p className="blind-summary">Mali blind: {playerName(game.smallBlindSeat)}, {game.players.find(player => player.seat === game.smallBlindSeat)?.streetContribution ?? 0} · Veliki blind: {playerName(game.bigBlindSeat)}, {game.players.find(player => player.seat === game.bigBlindSeat)?.streetContribution ?? 0}</p>
    <div className="board" aria-label="Board">{game.board.length ? <><span className="sr-only" aria-hidden="true">{game.board.join('')}</span>{game.board.map(card => <Card card={card} key={card} />)}</> : <span>Board čeka flop</span>}</div>
    <div className="seats">{game.players.map(player => <article className={`seat seat-${player.seat}`} aria-label={`${playerName(player.seat)}, mesto ${player.seat + 1}`} key={player.id}>
      <h3>{playerName(player.seat)}</h3><div className="seat-stats"><span>Stack: {player.stack}</span><span>Ulog: {player.streetContribution}</span></div><p className="seat-marker">{player.seat === game.buttonSeat ? 'Button' : 'Mesto ' + (player.seat + 1)}</p>
      {player.kind === 'human' && <div><strong>Tvoje karte</strong><div className="cards">{player.cards?.map(card => <Card card={card} key={card} />)}</div></div>}
      {player.kind === 'bot' && player.cards && <div className="cards">{player.cards.map(card => <Card card={card} key={card} />)}</div>}
    </article>)}</div>
    <div className="pots" aria-label="Potovi">{game.pots.map(pot => <span key={pot.id}>{pot.id}: {pot.amount}</span>)}</div>
  </section><aside className="history" aria-label="Istorija"><h2>Istorija</h2><ol aria-label="Istorija ruke">{game.events.map(event => <li key={event.seq}>{eventText(event)}</li>)}</ol></aside></div>;
}
