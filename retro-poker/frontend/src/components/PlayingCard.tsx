const rankNames: Record<string, string> = { T: '10', J: 'Žandar', Q: 'Dama', K: 'Kralj', A: 'As' };
const suits = {
  c: { symbol: '♣', name: 'tref', tone: 'black' },
  d: { symbol: '♦', name: 'karo', tone: 'red' },
  h: { symbol: '♥', name: 'herc', tone: 'red' },
  s: { symbol: '♠', name: 'pik', tone: 'black' },
} as const;

/** Only accepts a public card; null never renders rank/suit metadata. */
export function PlayingCard({ card }: { card: string | null }) {
  if (card === null) return <span className="card card-back" role="img" aria-label="Skrivena karta">
    <span className="card-back-pattern" aria-hidden="true">RP</span>
  </span>;
  const rank = card[0] ?? '';
  const suit = suits[card[1] as keyof typeof suits];
  const displayRank = rank === 'T' ? '10' : rank;
  const label = `${rankNames[rank] ?? rank} ${suit?.name ?? ''}`.trim();
  return <span className={`card card-${suit?.tone ?? 'black'}`} role="img" aria-label={label}>
    <span className="card-corner" aria-hidden="true">{displayRank}{suit?.symbol}</span>
    <span className="card-pip" aria-hidden="true">{suit?.symbol}</span>
    <span className="card-corner card-corner-bottom" aria-hidden="true">{displayRank}{suit?.symbol}</span>
  </span>;
}
