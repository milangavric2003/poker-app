import type { GameView, PublicEvent } from '../../../shared/contracts';

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
  return <div className="table-layout"><section className="poker-table" aria-label="Poker sto">
    <header><span>Ruka {game.handNumber} · {game.phase}</span><strong>Pot: {game.totalPot}</strong></header>
    <div className="board" aria-label="Board">{game.board.length ? game.board.map(card => <span className="card" key={card}>{card}</span>) : <span>Board čeka flop</span>}</div>
    <div className="seats">{game.players.map(player => <article className={`seat seat-${player.seat}`} key={player.id}>
      <h3>{player.kind === 'human' ? 'Ti' : `Bot ${player.seat}`}</h3><p>Stack: {player.stack}</p><p>Ulog: {player.streetContribution}</p><p>{player.seat === game.buttonSeat ? 'Button' : ''}</p>
      {player.kind === 'human' && <div><strong>Tvoje karte</strong><div className="cards">{player.cards?.map(card => <span className="card" key={card}>{card}</span>)}</div></div>}
      {player.kind === 'bot' && player.cards && <div className="cards">{player.cards.map(card => <span className="card" key={card}>{card}</span>)}</div>}
    </article>)}</div>
    <div className="pots">{game.pots.map(pot => <span key={pot.id}>{pot.id}: {pot.amount}</span>)}</div>
  </section><aside className="history"><h2>Istorija</h2><ol aria-label="Istorija ruke">{game.events.map(event => <li key={event.seq}>{eventText(event)}</li>)}</ol></aside></div>;
}
