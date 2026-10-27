import type { GameView, PublicEvent } from '../../../shared/contracts';
import { ChipAmount } from './ChipAmount';
import { PlayingCard } from './PlayingCard';
import { PlayerSeat } from './PlayerSeat';

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
  const botPositions = game.botCount === 1 ? [2] : game.botCount === 2 ? [1, 3] : [1, 2, 3, 4, 5];
  const blindAmount = (blind: 'small' | 'big') => game.events.find(event => event.type === 'blind_posted' && event.blind === blind);
  const smallBlind = blindAmount('small');
  const bigBlind = blindAmount('big');
  const fallbackBlindAmount = (seat: number) => game.players.find(player => player.seat === seat)?.streetContribution ?? 0;
  return <div className="table-layout"><section className="poker-table" aria-label="Poker sto">
    <header><span>Ruka {game.handNumber}</span><span className="phase-badge">{game.phase}</span><span>NO LIMIT</span></header>
    <p className="blind-summary">Mali blind: {playerName(game.smallBlindSeat)}, {smallBlind?.type === 'blind_posted' ? smallBlind.amount : fallbackBlindAmount(game.smallBlindSeat)} · Veliki blind: {playerName(game.bigBlindSeat)}, {bigBlind?.type === 'blind_posted' ? bigBlind.amount : fallbackBlindAmount(game.bigBlindSeat)}</p>
    <div className="table-arena">
      <div className="table-center">
        <span className="table-wordmark" aria-hidden="true">RETRO POKER</span>
        <div className="board" aria-label="Board">{game.board.length ? <><span className="sr-only" aria-hidden="true">{game.board.join('')}</span>{game.board.map(card => <PlayingCard card={card} key={card} />)}</> : <span className="board-waiting">Board čeka flop</span>}</div>
        <div className="total-pot" aria-label="Ukupni pot"><ChipAmount label="Pot" amount={game.totalPot} /></div>
        <div className="pots" aria-label="Potovi">{game.pots.map((pot, index) => <span key={pot.id}>
          {pot.contributorIds.length === 1 ? 'Nepotvrđen ulog' : index === 0 ? 'Glavni pot' : 'Side pot'} · {pot.id}: {pot.amount}
        </span>)}</div>
      </div>
      {game.players.filter(player => player.kind === 'bot').map((player, index) => <PlayerSeat key={player.id} player={player} game={game} position={botPositions[index] ?? 5} />)}
      {game.players.filter(player => player.kind === 'human').map(player => <PlayerSeat key={player.id} player={player} game={game} position={0} />)}
    </div>
    <p className="chip-note">Čipovi su ilustracija · tačan iznos je uz oznaku</p>
  </section><aside className="history" aria-label="Istorija"><h2>Istorija</h2><ol aria-label="Istorija ruke">{game.events.map(event => <li key={event.seq}>{eventText(event)}</li>)}</ol></aside></div>;
}
