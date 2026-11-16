import { settleUpAction } from "./actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EntryForm } from "@/components/EntryForm";
import { Flag } from "@/components/Flag";
import { Header } from "@/components/Header";
import { History } from "@/components/History";
import { Statistics } from "@/components/Statistics";
import { config, people } from "@/lib/config";
import { toOptions } from "@/lib/currencyOptions";
import { deletedEntries, listEntries } from "@/lib/db";
import { type PersonKey, settlement, summarize } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { requireAuth } from "@/lib/session";
import { defaultCurrency, enabledCurrencies } from "@/lib/settings";
import { computeStats, historyItems } from "@/lib/stats";

export default async function Home({ searchParams }: PageProps<"/">) {
  await requireAuth();
  if (!config.databaseUrl) return <SetupNeeded />;
  const { saved } = await searchParams;
  const home = config.homeCurrency;
  const [entries, deleted, enabled] = await Promise.all([listEntries(), deletedEntries(), enabledCurrencies()]);
  const summary = summarize(entries, home);
  // Only entries that are still gone (not restored or re-imported), each listed once.
  const liveIds = new Set(entries.map((e) => e.id));
  const gone = [...new Map(deleted.filter((d) => !liveIds.has(d.snapshot.id)).map((d) => [d.snapshot.id, d])).values()];
  const owed = settlement(summary.balance);
  const name = (p: PersonKey) => people[p];

  // Recently used currencies first, then the rest of the enabled ones.
  const recent = [...new Set([...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((e) => e.currency))]
    .filter((c) => enabled.includes(c))
    .slice(0, 5);
  const ordered = [...new Set([home, ...recent, ...enabled])];

  return (
    <>
      <Header active="home" />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6">
        {/* Balance */}
        <section className="hero relative overflow-hidden rounded-3xl p-6 text-center text-white shadow-xl shadow-accent/25">
          <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <span aria-hidden className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
          {owed ? (
            <div className="relative">
              <p className="text-sm font-medium text-white/85">
                {name(owed.from)} owes {name(owed.to)}
              </p>
              <p className="my-1 text-5xl font-extrabold tracking-tight drop-shadow-sm">{formatMoney(owed.amount, home)}</p>
              <form action={settleUpAction} className="mt-4">
                <ConfirmSubmit
                  className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[var(--hero-via)] shadow-md transition hover:bg-white/90"
                  message={`Record that ${name(owed.from)} paid ${name(owed.to)} ${formatMoney(owed.amount, home)}? This brings the balance to zero.`}
                >
                  Record settlement
                </ConfirmSubmit>
              </form>
            </div>
          ) : (
            <p className="relative py-4 text-3xl font-extrabold">{entries.length ? "All square 🎉" : "Let's go! ✈︎"}</p>
          )}
          {summary.totalSpent > 0 && (
            <dl className="relative mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-white/12 p-3 text-sm backdrop-blur">
              <div>
                <dt className="text-white/75">Total spent</dt>
                <dd className="font-bold tabular-nums">{formatMoney(summary.totalSpent, home)}</dd>
              </div>
              {(["p1", "p2"] as const).map((p) => (
                <div key={p}>
                  <dt className="text-white/75">{name(p)} paid</dt>
                  <dd className="font-bold tabular-nums">{formatMoney(summary.paid[p], home)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* Add */}
        <section className="card">
          <h2 className="section-title mb-4">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-base">＋</span>
            Add an entry
          </h2>
          {saved && <p className="mb-4 rounded-lg bg-good/10 px-3 py-2 text-sm font-medium text-good">Saved ✓</p>}
          <EntryForm
            // Remount after each save so the form starts empty again.
            key={entries.length + (entries[0]?.updatedAt ?? "")}
            people={people}
            homeCurrency={home}
            currencies={toOptions(ordered)}
            defaultCurrency={await defaultCurrency(ordered)}
          />
        </section>

        {/* History */}
        <section>
          <h2 className="section-title mb-3">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-accent-2/15 text-base">🧾</span>
            History <span className="text-sm font-normal text-muted">({entries.length})</span>
          </h2>
          <History items={historyItems(entries, home)} people={people} home={home} />
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

        {/* Statistics */}
        <section>
          <h2 className="section-title mb-3">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-accent-3/15 text-base">📊</span>
            Statistics
          </h2>
          <Statistics stats={computeStats(entries, home)} people={people} home={home} />
        </section>
      </main>
    </>
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
