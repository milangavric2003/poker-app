const denominations = [1000, 500, 100, 25, 5, 1] as const;

/** Representative decoration, never an asserted denomination breakdown. */
export function ChipAmount({ amount, label }: { amount: number; label: string }) {
  const denomination = denominations.find(value => amount >= value) ?? 1;
  const count = amount > 0 ? Math.min(5, Math.ceil(amount / denomination)) : 0;
  return <span className="chip-amount">
    {count > 0 && <span className="chip-stack" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <span key={index}
        className={`poker-chip chip-${denomination}`} data-denomination={denomination}>{denomination}</span>)}
    </span>}
    <span className="amount-value">{label}: {amount}</span>
  </span>;
}
