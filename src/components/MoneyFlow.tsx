/**
 * Green dollar signs streaming left to right, from whoever owes (always on the left) to whoever is owed.
 * Purely decorative: the text above already says who owes whom.
 */
export function MoneyFlow() {
  return (
    <div aria-hidden className="money-flow relative -mx-2 h-9">
      {/* faint track */}
      <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-white/0 via-white/45 to-white/0" />
      {/* Phones have a short track, so fewer coins there. */}
      <Coins count={3} className="sm:hidden" />
      <Coins count={5} className="hidden sm:block" />
      {/* arrowhead at the receiving end */}
      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-lg leading-none text-white/70">›</span>
    </div>
  );
}

function Coins({ count, className }: { count: number; className: string }) {
  const duration = 3.2;
  return (
    <div className={`absolute inset-0 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="money-coin"
          // Negative delays start the coins already spread along the track.
          style={{ animationDelay: `${-(i * duration) / count}s`, ["--rest" as string]: `${(100 / count) * (i + 0.5)}%` }}
        >
          $
        </span>
      ))}
    </div>
  );
}
