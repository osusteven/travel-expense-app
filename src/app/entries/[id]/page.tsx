import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEntryAction } from "@/app/actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EntryForm } from "@/components/EntryForm";
import { Header } from "@/components/Header";
import { config, people } from "@/lib/config";
import { toOptions } from "@/lib/currencyOptions";
import { enabledCurrencies } from "@/lib/settings";
import { entryHistory, getEntry } from "@/lib/db";
import type { Entry } from "@/lib/ledger";
import { formatMoney, formatRate } from "@/lib/money";
import { requireAuth } from "@/lib/session";

export default async function EditEntryPage({ params }: PageProps<"/entries/[id]">) {
  await requireAuth();
  const { id } = await params;
  const [entry, history, enabled] = await Promise.all([getEntry(id), entryHistory(id), enabledCurrencies()]);
  if (!entry) notFound();
  const home = config.homeCurrency;

  return (
    <>
      <Header active="home" />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <Link href="/" className="text-sm text-accent">
          ← Back
        </Link>
        <section className="card">
          <h1 className="mb-4 text-lg font-semibold">Edit entry</h1>
          <EntryForm
            people={people}
            homeCurrency={home}
            // Keep the entry's own currency available even if it's been unchecked in Settings.
            currencies={toOptions([...new Set([entry.currency, ...enabled])])}
            defaultCurrency={entry.currency}
            entry={entry}
          />
        </section>

        <section className="card text-sm">
          <h2 className="mb-2 font-semibold">Change history</h2>
          <ol className="space-y-1.5">
            {history.map((h, i) => (
              <li key={i}>
                <span className="font-medium">{{ create: "Created", update: "Edited", import: "Imported", delete: "Deleted" }[h.action]}</span>{" "}
                <span className="text-muted">{new Date(h.at).toLocaleString("en-US")}</span>
                <span className="block text-xs text-muted">{describe(h.snapshot)}</span>
              </li>
            ))}
          </ol>
        </section>

        <form action={deleteEntryAction}>
          <input type="hidden" name="id" value={entry.id} />
          <ConfirmSubmit message="Delete this entry? It will still be listed under Deleted entries." className="btn-secondary text-red-600">
            Delete entry
          </ConfirmSubmit>
        </form>
      </main>
    </>
  );

  function describe(e: Entry) {
    const who = e.paidBy === "p1" ? people.p1 : people.p2;
    const rate = e.currency === home ? "" : e.homeAmountMinor != null ? ` (charged ${formatMoney(e.homeAmountMinor, home)})` : ` @ ${formatRate(e.rate)}`;
    return `${e.date} · ${e.description} · ${formatMoney(e.amountMinor, e.currency)}${rate} · paid by ${who} · ${e.kind === "payment" ? "payment" : e.split}`;
  }
}
