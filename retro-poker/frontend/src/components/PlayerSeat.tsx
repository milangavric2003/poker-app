import type { GameView } from '../../../shared/contracts';
import { ChipAmount } from './ChipAmount';
import { PlayingCard } from './PlayingCard';

const statuses = { active: 'U ruci', folded: 'Fold', all_in: 'All-in', eliminated: 'Eliminisan' };

export function PlayerSeat({ player, game, position }: {
  player: GameView['players'][number]; game: GameView; position: number;
}) {
  const human = player.kind === 'human';
  const name = human ? 'Ti' : `Bot ${player.seat}`;
  const active = game.actorId === player.id;
  return <article className={`seat seat-position-${position} seat-${player.status}${human ? ' seat-human' : ''}${active ? ' seat-current' : ''}`}
    aria-label={`${name}, mesto ${player.seat + 1}`}>
    <div className="seat-heading"><h3>{name}</h3><span className="seat-status">{active ? 'Na potezu' : statuses[player.status]}</span></div>
    <div className="seat-badges">
      {player.seat === game.buttonSeat && <span className="dealer-badge">Button</span>}
      {player.seat === game.smallBlindSeat && <span>SB · Mali blind</span>}
      {player.seat === game.bigBlindSeat && <span>BB · Veliki blind</span>}
    </div>
    <div className="seat-body"><div className="seat-stats">
      <ChipAmount label="Stack" amount={player.stack} />
      <ChipAmount label="Ulog" amount={player.streetContribution} />
    </div><div className="seat-hand">
      {human && <strong className="sr-only">Tvoje karte</strong>}
      <div className="cards" aria-label={human ? 'Tvoje karte' : `Karte: ${name}`}>
        {player.status !== 'eliminated' && (player.cards
          ? player.cards.map(card => <PlayingCard card={card} key={card} />)
          : <><PlayingCard card={null} /><PlayingCard card={null} /></>)}
      </div>
    </div></div>
  </article>;
}
