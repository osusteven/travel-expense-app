import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { Header } from "@/components/Header";
import { config, people } from "@/lib/config";
import { listEntries, listTrips } from "@/lib/db";
import { chronological, settlement, summarize } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { requireAuth } from "@/lib/session";
import { currentTripId, profiles } from "@/lib/settings";

const fmt = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function TripsPage() {
  await requireAuth();
  const home = config.homeCurrency;
  const [trips, entries, current, prof] = await Promise.all([listTrips(), listEntries(), currentTripId(), profiles()]);

  const rows = trips.map((t) => {
    const list = entries.filter((e) => e.tripId === t.id).sort(chronological);
    const s = summarize(list, home);
    return {
      trip: t,
      count: list.length,
      first: list[0]?.date,
      last: list[list.length - 1]?.date,
      currencies: [...new Set(list.map((e) => e.currency))],
      total: s.totalSpent,
      owed: settlement(s.balance),
      lastActivity: list.reduce((m, e) => (e.createdAt > m ? e.createdAt : m), t.createdAt),
    };
  });
  // Most recently used trips first.
  rows.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  const allTotal = rows.reduce((a, r) => a + r.total, 0);

  return (
    <>
      <Header active="trips" />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <h1 className="text-2xl font-extrabold tracking-tight">Trips</h1>
            <p className="text-sm text-muted">
              {rows.length} {rows.length === 1 ? "trip" : "trips"} · {formatMoney(allTotal, home)} spent in total
            </p>
          </div>
          <Link href="/trips/new" className="btn-primary">
            + New trip
          </Link>
        </div>

        {rows.length === 0 && <p className="card text-sm text-muted">No trips yet.</p>}

        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.trip.id}>
              <Link
                href={`/trips/${r.trip.id}`}
                className="card flex flex-wrap items-center gap-4 transition hover:-translate-y-px hover:shadow-lg"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-lg font-bold">
                    <span className="truncate">{r.trip.name}</span>
                    {current === r.trip.id && <span className="chip shrink-0 bg-accent/15 text-accent">Current</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {r.first ? (r.first === r.last ? fmt(r.first) : `${fmt(r.first)} – ${fmt(r.last!)}`) : "No entries yet"}
                    {r.count > 0 && ` · ${r.count} ${r.count === 1 ? "entry" : "entries"}`}
                  </p>
                  {r.currencies.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1.5 text-lg">
                      {r.currencies.map((c) => (
                        <Flag key={c} currency={c} />
                      ))}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold tabular-nums">{formatMoney(r.total, home)}</p>
                  {r.owed ? (
                    <p className="mt-1 flex items-center justify-end gap-1.5 text-xs font-medium">
                      <Avatar person={r.owed.from} name={people[r.owed.from]} photo={prof[r.owed.from].photo} size={20} />
                      {people[r.owed.from]} owes {formatMoney(r.owed.amount, home)}
                    </p>
                  ) : (
                    r.count > 0 && <p className="mt-1 text-xs font-semibold text-good">✓ Settled</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
