import type { People } from "@/lib/config";
import { slotColor } from "@/lib/currencyData";
import { formatMoney } from "@/lib/money";
import type { Stats } from "@/lib/stats";
import { Avatar } from "./Avatar";
import { Flag } from "./Flag";
import type { PersonKey } from "@/lib/ledger";

export function Statistics({
  stats: s,
  people,
  home,
  photos = {},
}: {
  stats: Stats;
  people: People;
  home: string;
  photos?: Partial<Record<PersonKey, string>>;
}) {
  if (s.expenseCount === 0) {
    return <p className="card text-sm text-muted">Statistics appear once you&apos;ve added some expenses.</p>;
  }
  const money = (m: number) => formatMoney(m, home);
  const maxCountry = Math.max(...s.byCountry.map((c) => c.home), 1);
  const maxPeriod = Math.max(...s.periods.map((p) => p.total), 1);
  const countryOrder = s.byCountry.map((c) => c.currency);
  const slotOf = Object.fromEntries(s.byCountry.map((c) => [c.currency, c.slot]));

  return (
    <div className="space-y-4">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Total spent" value={money(s.totalSpent)} tint="var(--accent)" />
        <Tile label={`Per day (${s.days} ${s.days === 1 ? "day" : "days"})`} value={money(s.perDay)} tint="var(--accent-2)" />
        <Tile label="Expenses" value={String(s.expenseCount)} sub={s.payments.count ? `+ ${s.payments.count} ${s.payments.count === 1 ? "payment" : "payments"}` : undefined} tint="var(--accent-3)" />
        <Tile
          label="Biggest expense"
          value={s.largest ? money(s.largest.home) : "–"}
          sub={s.largest?.description}
          tint="var(--series-3)"
        />
      </div>

      {/* By country */}
      <section className="card">
        <h3 className="mb-3 font-bold">Spending by currency</h3>
        <ul className="space-y-2.5">
          {s.byCountry.map((c) => (
            <li key={c.currency} className="group">
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Flag currency={c.currency} />
                  <span className="truncate font-medium">{c.country}</span>
                  <span className="text-xs text-muted">
                    {c.count} · {formatMoney(c.original, c.currency)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <b>{money(c.home)}</b>{" "}
                  <span className="text-xs text-muted">{Math.round((c.home / s.totalSpent) * 100)}%</span>
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-subtle">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max((c.home / maxCountry) * 100, 1.5)}%`, background: slotColor(c.slot) }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Over time */}
      <section className="card">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-bold">Spending per {s.periodUnit}</h3>
          {s.byCountry.length > 1 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-label="Legend">
              {s.byCountry.map((c) => (
                <li key={c.currency} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: slotColor(c.slot) }} />
                  {c.country}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex h-44 items-end gap-[3px] border-b border-line" role="img" aria-label={`Spending per ${s.periodUnit} chart; see the table below`}>
          {s.periods.map((p) => (
            <div key={p.start} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
              {/* Stacked by country, largest country at the bottom, 2px gaps between segments */}
              <div className="flex flex-col-reverse gap-[2px]" style={{ height: `${(p.total / maxPeriod) * 100}%` }}>
                {countryOrder
                  .filter((cur) => p.byCurrency[cur])
                  .map((cur, idx, arr) => (
                    <div
                      key={cur}
                      className={idx === arr.length - 1 ? "rounded-t" : ""}
                      style={{ flexGrow: p.byCurrency[cur], minHeight: 2, background: slotColor(slotOf[cur]) }}
                    />
                  ))}
              </div>
              {/* Hover tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-[14rem] -translate-x-1/2 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-lg group-hover:block">
                <p className="font-semibold">{p.label}</p>
                <p className="tabular-nums">{money(p.total)}</p>
                {countryOrder
                  .filter((cur) => p.byCurrency[cur])
                  .map((cur) => (
                    <p key={cur} className="flex items-center gap-1 text-muted">
                      <span className="h-2 w-2 rounded-sm" style={{ background: slotColor(slotOf[cur]) }} />
                      {s.byCountry.find((c) => c.currency === cur)?.country}: {money(p.byCurrency[cur])}
                    </p>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>{s.periods[0]?.label}</span>
          {s.periods.length > 1 && <span>{s.periods[s.periods.length - 1]?.label}</span>}
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-accent">Show as table</summary>
          <table className="mt-2 w-full text-xs">
            <tbody className="divide-y divide-line">
              {s.periods
                .filter((p) => p.total > 0)
                .map((p) => (
                  <tr key={p.start}>
                    <td className="py-1">{p.label}</td>
                    <td className="py-1 text-right tabular-nums">{money(p.total)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      </section>

      {/* People */}
      <section className="grid gap-3 sm:grid-cols-2">
        {(["p1", "p2"] as const).map((p) => {
          const { paid, share } = s.people[p];
          return (
            <div key={p} className="card">
              <p className="flex items-center gap-2 font-bold">
                <Avatar person={p} name={people[p]} photo={photos[p]} size={32} />
                {people[p]}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">Paid for expenses</dt>
                  <dd className="font-semibold tabular-nums">{money(paid)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Their share</dt>
                  <dd className="font-semibold tabular-nums">{money(share)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted">
                Paid {s.totalSpent ? Math.round((paid / s.totalSpent) * 100) : 0}% of the trip, used{" "}
                {s.totalSpent ? Math.round((share / s.totalSpent) * 100) : 0}% of it.
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Tile({ label, value, sub, tint }: { label: string; value: string; sub?: string; tint: string }) {
  return (
    <div className="card relative overflow-hidden !p-3.5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: tint }} />
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}
