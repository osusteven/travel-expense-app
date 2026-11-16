import type { People } from "@/lib/config";
import { type PersonKey, type Summary, settlement } from "@/lib/ledger";
import { formatMoney, plainAmount } from "@/lib/money";
import type { Profiles } from "@/lib/settings";
import { Avatar } from "./Avatar";
import { SettleUp } from "./SettleUp";

/**
 * The balance at the top of a trip. Whoever owes is on the left in their color, whoever is owed is on the right
 * in theirs, so the sides (and the gradient) swap when the balance flips.
 */
export function BalanceHero({
  tripId,
  tripName,
  summary,
  people,
  profiles,
  home,
  hasEntries,
}: {
  tripId: string;
  tripName: string;
  summary: Summary;
  people: People;
  profiles: Profiles;
  home: string;
  hasEntries: boolean;
}) {
  const owed = settlement(summary.balance);
  const left: PersonKey = owed ? owed.from : "p1";
  const right: PersonKey = owed ? owed.to : "p2";
  const background = owed
    ? `linear-gradient(110deg, color-mix(in oklab, var(--${left}) 88%, black), color-mix(in oklab, var(--${left}) 55%, var(--${right})) 50%, color-mix(in oklab, var(--${right}) 88%, black))`
    : "linear-gradient(110deg, var(--p1), var(--hero-via), var(--p2))";

  const person = (p: PersonKey, role: string) => (
    <div className="flex w-24 flex-col items-center gap-1.5 sm:w-28">
      <Avatar person={p} name={people[p]} photo={profiles[p].photo} size={64} ring />
      <span className="max-w-full truncate text-sm font-bold">{people[p]}</span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-white/70">{role}</span>
    </div>
  );

  return (
    <section
      aria-label="Balance"
      className="relative overflow-hidden rounded-3xl p-5 text-center text-white shadow-xl shadow-black/15 sm:p-6"
      style={{ background }}
    >
      <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <span aria-hidden className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
      <div className="relative flex items-center justify-between gap-2">
        {person(left, owed ? "owes" : "")}
        <div className="min-w-0 flex-1">
          {owed ? (
            <>
              <p className="text-sm font-medium text-white/85">
                {people[owed.from]} owes {people[owed.to]}
              </p>
              <p className="my-1 text-4xl font-extrabold tracking-tight drop-shadow-sm sm:text-5xl">{formatMoney(owed.amount, home)}</p>
              <p aria-hidden className="text-2xl text-white/80">⟶</p>
            </>
          ) : (
            <p className="py-3 text-2xl font-extrabold sm:text-3xl">{hasEntries ? "All square 🎉" : "Let's go! ✈︎"}</p>
          )}
        </div>
        {person(right, owed ? "is owed" : "")}
      </div>
      {owed && (
        <div className="relative mt-4">
          <SettleUp
            // Reset the form (amount, Venmo link) whenever the balance changes.
            key={`${owed.from}:${owed.amount}`}
            tripId={tripId}
            tripName={tripName}
            from={owed.from}
            fromName={people[owed.from]}
            toName={people[owed.to]}
            amount={plainAmount(owed.amount, home)}
            homeCurrency={home}
            toVenmo={profiles[owed.to].venmo}
          />
        </div>
      )}
      {summary.totalSpent > 0 && (
        <dl className="relative mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-black/15 p-3 text-sm backdrop-blur">
          <div>
            <dt className="text-white/75">Trip total</dt>
            <dd className="font-bold tabular-nums">{formatMoney(summary.totalSpent, home)}</dd>
          </div>
          {(["p1", "p2"] as const).map((p) => (
            <div key={p}>
              <dt className="text-white/75">{people[p]} paid</dt>
              <dd className="font-bold tabular-nums">{formatMoney(summary.paid[p], home)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
