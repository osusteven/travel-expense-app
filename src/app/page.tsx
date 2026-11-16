import Link from "next/link";
import { settleUpAction } from "./actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EntryForm } from "@/components/EntryForm";
import { Header } from "@/components/Header";
import { config, people } from "@/lib/config";
import { currencyOptions } from "@/lib/currencies";
import { deletedEntries, listEntries } from "@/lib/db";
import { type Entry, type PersonKey, entryEffect, other, settlement, summarize } from "@/lib/ledger";
import { formatMoney, formatRate } from "@/lib/money";
import { requireAuth } from "@/lib/session";

export default async function Home({ searchParams }: PageProps<"/">) {
  await requireAuth();
  if (!config.databaseUrl) return <SetupNeeded />;
  const { saved } = await searchParams;
  const home = config.homeCurrency;
  const [entries, deleted] = await Promise.all([listEntries(), deletedEntries()]);
  const summary = summarize(entries, home);
  const owed = settlement(summary.balance);
  const name = (p: PersonKey) => people[p];
  const recentCurrencies = [...new Set(entries.map((e) => e.currency))].slice(0, 5);
  const lastExpense = entries.find((e) => e.kind === "expense");

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <section className="card text-center">
          {owed ? (
            <>
              <p className="text-sm text-muted">
                {name(owed.from)} owes {name(owed.to)}
              </p>
              <p className="my-1 text-4xl font-bold tracking-tight">{formatMoney(owed.amount, home)}</p>
              <form action={settleUpAction} className="mt-3">
                <ConfirmSubmit
                  className="btn-secondary"
                  message={`Record that ${name(owed.from)} paid ${name(owed.to)} ${formatMoney(owed.amount, home)}? This brings the balance to zero.`}
                >
                  Record settlement
                </ConfirmSubmit>
              </form>
            </>
          ) : (
            <p className="py-3 text-2xl font-semibold">{entries.length ? "All square 🎉" : "No entries yet"}</p>
          )}
          {summary.totalSpent > 0 && (
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
              <Stat label="Total spent" value={formatMoney(summary.totalSpent, home)} />
              {(["p1", "p2"] as const).map((p) => (
                <Stat
                  key={p}
                  label={name(p)}
                  value={`paid ${formatMoney(summary.paid[p], home)}`}
                  sub={`share ${formatMoney(summary.share[p], home)}`}
                />
              ))}
            </dl>
          )}
        </section>

        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Add an entry</h2>
          {saved && <p className="mb-4 rounded-md bg-accent/10 px-3 py-2 text-sm">Saved ✓</p>}
          <EntryForm
            // Remount after each save so the form starts empty again.
            key={entries.length + (entries[0]?.updatedAt ?? "")}
            people={people}
            homeCurrency={home}
            currencies={currencyOptions(home, recentCurrencies)}
            defaultCurrency={lastExpense?.currency ?? home}
          />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">
            Entries <span className="text-sm font-normal text-muted">({entries.length})</span>
          </h2>
          {entries.length === 0 ? (
            <p className="card text-sm text-muted">Nothing yet. Add your first expense above.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
              {entries.map((e) => (
                <EntryRow key={e.id} entry={e} balanceAfter={summary.runningBalance.get(e.id) ?? 0} />
              ))}
            </ul>
          )}
        </section>

        {Object.keys(summary.byCurrency).length > 1 && (
          <section className="card text-sm">
            <h2 className="mb-2 font-semibold">Spent by currency</h2>
            <ul className="space-y-1">
              {Object.entries(summary.byCurrency)
                .sort()
                .map(([cur, minor]) => (
                  <li key={cur} className="flex justify-between">
                    <span className="text-muted">{cur}</span>
                    <span>{formatMoney(minor, cur)}</span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {deleted.length > 0 && (
          <details className="card text-sm">
            <summary className="cursor-pointer font-semibold">Deleted entries ({deleted.length})</summary>
            <ul className="mt-2 space-y-1 text-muted">
              {deleted.map((d) => (
                <li key={d.snapshot.id + d.at}>
                  {d.snapshot.date} · {d.snapshot.description} · {formatMoney(d.snapshot.amountMinor, d.snapshot.currency)}{" "}
                  <span className="text-xs">(deleted {new Date(d.at).toLocaleString("en-US")})</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </>
  );

  function EntryRow({ entry: e, balanceAfter }: { entry: Entry; balanceAfter: number }) {
    const fx = entryEffect(e, home);
    const foreign = e.currency !== home;
    const effect =
      e.kind === "payment"
        ? `${name(e.paidBy)} → ${name(other(e.paidBy))}`
        : fx.balanceDelta === 0
          ? `${name(e.paidBy)}'s own`
          : `${name(fx.balanceDelta > 0 ? "p2" : "p1")} owes ${formatMoney(Math.abs(fx.balanceDelta), home)}`;
    const splitText =
      e.kind === "payment"
        ? "payment"
        : { equal: "50/50", custom: "custom split", payer: "not split", other: `for ${name(other(e.paidBy))}` }[e.split];
    return (
      <li id={`entry-${e.id}`}>
        <Link href={`/entries/${e.id}`} className="flex gap-3 px-4 py-3 hover:bg-subtle">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {e.kind === "payment" && <span className="mr-1">💸</span>}
              {e.description}
            </p>
            <p className="text-xs text-muted">
              {e.date} · paid by {name(e.paidBy)} · {splitText}
              {foreign && (
                <>
                  {" "}
                  · {e.rateSource === "charged" ? "charged amount" : `@ ${formatRate(e.rate)}`}
                </>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-medium tabular-nums">{formatMoney(e.amountMinor, e.currency)}</p>
            {foreign && <p className="text-xs tabular-nums text-muted">≈ {formatMoney(fx.home, home)}</p>}
            <p className="text-xs text-accent">{effect}</p>
            <p className="sr-only">Balance after: {formatMoney(balanceAfter, home)}</p>
          </div>
        </Link>
      </li>
    );
  }
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
      {sub && <dd className="text-xs tabular-nums text-muted">{sub}</dd>}
    </div>
  );
}

function SetupNeeded() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <div className="card space-y-3">
        <h1 className="text-xl font-semibold">Almost there: connect a database</h1>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            In your Vercel project, open <b>Storage → Create Database → Neon (Postgres)</b>, choose the free plan, and
            connect it to this project. That sets <code>DATABASE_URL</code>.
          </li>
          <li>
            Redeploy: <b>Deployments → ⋯ → Redeploy</b>.
          </li>
        </ol>
        <p className="text-sm text-muted">The tables are created automatically the first time the app runs.</p>
      </div>
    </main>
  );
}
