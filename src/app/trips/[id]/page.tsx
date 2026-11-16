import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { makeCurrentTripAction } from "@/app/actions";
import { BalanceHero } from "@/components/BalanceHero";
import { EntryForm } from "@/components/EntryForm";
import { Flag } from "@/components/Flag";
import { Header } from "@/components/Header";
import { History } from "@/components/History";
import { Statistics } from "@/components/Statistics";
import { config, people } from "@/lib/config";
import { homeFirst, toOptions } from "@/lib/currencyOptions";
import { deletedEntries, getTrip, listEntries } from "@/lib/db";
import { settlement, summarize, tripPath } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { requireAuth } from "@/lib/session";
import { currentTripId, defaultCurrency, enabledCurrencies, profiles } from "@/lib/settings";
import { computeStats, historyItems } from "@/lib/stats";

export default async function TripPage({ params, searchParams }: PageProps<"/trips/[id]">) {
  await requireAuth();
  const { id } = await params;
  const { saved, settled } = await searchParams;
  const trip = await getTrip(id);
  if (!trip) notFound();
  // Old links used the trip's id; send them to its address.
  if (id !== trip.slug) redirect(tripPath(trip));
  const home = config.homeCurrency;
  const [entries, deleted, enabled, prof, current] = await Promise.all([
    listEntries(trip.id),
    deletedEntries(trip.id),
    enabledCurrencies(),
    profiles(),
    currentTripId(),
  ]);
  const summary = summarize(entries, home);
  const owed = settlement(summary.balance);
  // Only entries that are still gone (not restored or re-imported), each listed once.
  const liveIds = new Set(entries.map((e) => e.id));
  const gone = [...new Map(deleted.filter((d) => !liveIds.has(d.snapshot.id)).map((d) => [d.snapshot.id, d])).values()];
  // Home currency first, then the rest alphabetically; the form starts with the one this device used last.
  const currencies = homeFirst(home, enabled);

  return (
    <>
      <Header active="trips" left={owed?.from ?? "p1"} right={owed?.to ?? "p2"} />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/trips" className="text-sm font-medium text-accent hover:underline">
            ← All trips
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold tracking-tight">{trip.name}</h1>
          {current === trip.id ? (
            <span className="chip bg-accent/15 text-accent">Current trip</span>
          ) : (
            <form action={makeCurrentTripAction}>
              <input type="hidden" name="id" value={trip.id} />
              <button type="submit" className="btn-secondary !py-1 text-xs">
                Make current trip
              </button>
            </form>
          )}
          <Link href={`${tripPath(trip)}/edit`} className="btn-secondary !py-1 text-xs">
            Trip settings
          </Link>
        </div>

        <BalanceHero
          tripId={trip.id}
          tripName={trip.name}
          summary={summary}
          people={people}
          profiles={prof}
          home={home}
          hasEntries={entries.length > 0}
        />
        {settled && (
          <p className="-mt-4 rounded-lg bg-good/10 px-3 py-2 text-center text-sm font-medium text-good">
            Payment recorded ✓ It&apos;s in the History below.
          </p>
        )}

        <section className="card">
          <h2 className="section-title mb-4">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-base">＋</span>
            Add an entry
          </h2>
          {saved && <p className="mb-4 rounded-lg bg-good/10 px-3 py-2 text-sm font-medium text-good">Saved ✓</p>}
          <EntryForm
            // Remount after each save so the form starts empty again.
            key={entries.length + (entries[0]?.updatedAt ?? "")}
            tripId={trip.id}
            people={people}
            homeCurrency={home}
            currencies={toOptions(currencies)}
            defaultCurrency={await defaultCurrency(currencies)}
          />
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="section-title mr-auto">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-accent-2/15 text-base">🧾</span>
              History <span className="text-sm font-normal text-muted">({entries.length})</span>
            </h2>
            {entries.length > 0 && (
              <>
                <a href={`/api/export?format=csv&trip=${trip.id}`} className="btn-secondary !py-1 text-xs">
                  Export CSV
                </a>
                <a href={`/api/export?format=json&trip=${trip.id}`} className="btn-secondary !py-1 text-xs">
                  JSON
                </a>
              </>
            )}
          </div>
          <History items={historyItems(entries, home)} people={people} home={home} photos={{ p1: prof.p1.photo, p2: prof.p2.photo }} />
          {gone.length > 0 && (
            <details className="card mt-4 text-sm">
              <summary className="cursor-pointer font-semibold">Deleted entries ({gone.length})</summary>
              <ul className="mt-2 space-y-1.5 text-muted">
                {gone.map((d) => (
                  <li key={d.snapshot.id + d.at} className="flex items-center gap-2">
                    <Flag currency={d.snapshot.currency} />
                    <span>
                      {d.snapshot.date} · {d.snapshot.description} · {formatMoney(d.snapshot.amountMinor, d.snapshot.currency)}{" "}
                      <span className="text-xs">(deleted {new Date(d.at).toLocaleDateString("en-US")})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section>
          <h2 className="section-title mb-3">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-accent-3/15 text-base">📊</span>
            Statistics
          </h2>
          <Statistics stats={computeStats(entries, home)} people={people} home={home} photos={{ p1: prof.p1.photo, p2: prof.p2.photo }} />
        </section>
      </main>
    </>
  );
}
