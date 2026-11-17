"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { People } from "@/lib/config";
import { slotColor } from "@/lib/currencyData";
import { type PersonKey, methodLabel, other } from "@/lib/ledger";
import { formatMoney, formatRate } from "@/lib/money";
import type { HistoryItem } from "@/lib/stats";
import { HISTORY_SORTS, HISTORY_SORT_COOKIE, type HistorySort, groupsByDay } from "@/lib/historySort";
import { Avatar } from "./Avatar";
import { Flag } from "./Flag";

type KindFilter = "all" | "expense" | "payment";

const dayHeading = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export type Photos = Partial<Record<PersonKey, string>>;

/** Remembers the sort on this device (a cookie, so the page also loads already sorted). */
function saveSort(value: HistorySort) {
  document.cookie = `${HISTORY_SORT_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365 * 2}; samesite=lax`;
}

function sortItems(list: HistoryItem[], sort: HistorySort): HistoryItem[] {
  const byNewest = (a: HistoryItem, b: HistoryItem) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
  const sorted = [...list];
  switch (sort) {
    case "newest":
      return sorted.sort(byNewest);
    case "oldest":
      return sorted.sort((a, b) => -byNewest(a, b));
    case "amount-desc":
      return sorted.sort((a, b) => b.home - a.home || byNewest(a, b));
    case "amount-asc":
      return sorted.sort((a, b) => a.home - b.home || byNewest(a, b));
    case "az":
      return sorted.sort((a, b) => a.description.localeCompare(b.description, "en", { sensitivity: "base" }) || byNewest(a, b));
  }
}

export function History({
  items,
  people,
  home,
  photos = {},
  initialSort = "newest",
}: {
  items: HistoryItem[];
  people: People;
  home: string;
  photos?: Photos;
  initialSort?: HistorySort;
}) {
  const [sort, setSort] = useState<HistorySort>(initialSort);
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<PersonKey | "all">("all");
  const [currency, setCurrency] = useState<string>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const name = (p: PersonKey) => people[p];

  const countries = useMemo(() => {
    const seen = new Map<string, HistoryItem>();
    for (const i of [...items].reverse()) if (!seen.has(i.currency)) seen.set(i.currency, i);
    return [...seen.values()].sort((a, b) => (a.slot || 99) - (b.slot || 99));
  }, [items]);

  const q = query.trim().toLowerCase();
  const shown = sortItems(items, sort).filter(
    (i) =>
      (person === "all" || i.paidBy === person) &&
      (currency === "all" || i.currency === currency) &&
      (kind === "all" || i.kind === kind) &&
      (!q || `${i.description} ${i.notes} ${i.country} ${i.currency}`.toLowerCase().includes(q)),
  );
  const shownSpent = shown.filter((i) => i.kind === "expense").reduce((a, i) => a + i.home, 0);
  const filtering = q || person !== "all" || currency !== "all" || kind !== "all";

  const days = new Map<string, HistoryItem[]>();
  for (const i of shown) days.set(i.date, [...(days.get(i.date) ?? []), i]);

  if (items.length === 0) {
    return <p className="card text-sm text-muted">Nothing yet. Add your first expense above and it will show up here.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 !p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search descriptions, notes, currencies…"
          aria-label="Search history"
          className="input"
        />
        <div role="group" aria-label="Paid by" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted">Paid by</span>
          <FilterChip on={person === "all"} onClick={() => setPerson("all")}>
            Everyone
          </FilterChip>
          {(["p1", "p2"] as const).map((p) => (
            <FilterChip key={p} on={person === p} color={`var(--${p})`} onClick={() => setPerson(person === p ? "all" : p)}>
              <Avatar person={p} name={name(p)} photo={photos[p]} size={16} />
              {name(p)}
            </FilterChip>
          ))}
        </div>
        <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted">Show</span>
          <FilterChip on={kind === "all"} onClick={() => setKind("all")}>
            Everything
          </FilterChip>
          <FilterChip on={kind === "expense"} onClick={() => setKind(kind === "expense" ? "all" : "expense")}>
            🧾 Expenses
          </FilterChip>
          <FilterChip on={kind === "payment"} onClick={() => setKind(kind === "payment" ? "all" : "payment")}>
            💸 Payments
          </FilterChip>
        </div>
        {countries.length > 1 && (
          <div role="group" aria-label="Currency" className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted">Currency</span>
            <FilterChip on={currency === "all"} onClick={() => setCurrency("all")}>
              All
            </FilterChip>
            {countries.map((c) => (
              <FilterChip key={c.currency} on={currency === c.currency} onClick={() => setCurrency(currency === c.currency ? "all" : c.currency)}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: slotColor(c.slot) }} />
                <Flag currency={c.currency} />
                {c.currency}
              </FilterChip>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {filtering ? `${shown.length} of ${items.length} entries · ${formatMoney(shownSpent, home)} spent` : ""}
          </p>
          <label className="flex items-center gap-2 text-xs font-medium text-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => {
                const value = e.target.value as HistorySort;
                setSort(value);
                saveSort(value);
              }}
              className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-foreground"
            >
              {(Object.keys(HISTORY_SORTS) as HistorySort[]).map((k) => (
                <option key={k} value={k}>
                  {HISTORY_SORTS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {shown.length === 0 && <p className="card text-sm text-muted">No entries match these filters.</p>}

      {!groupsByDay(sort) && (
        <ul className="space-y-2">
          {shown.map((i) => (
            <HistoryCard key={i.id} item={i} people={people} home={home} photos={photos} showDate />
          ))}
        </ul>
      )}

      {groupsByDay(sort) && [...days.entries()].map(([date, list]) => {
        const dayTotal = list.filter((i) => i.kind === "expense").reduce((a, i) => a + i.home, 0);
        return (
          <section key={date} aria-label={dayHeading(date)}>
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <h3 className="text-sm font-bold">{dayHeading(date)}</h3>
              {dayTotal > 0 && <span className="text-xs font-medium tabular-nums text-muted">{formatMoney(dayTotal, home)} spent</span>}
            </div>
            <ul className="space-y-2">
              {list.map((i) => (
                <HistoryCard key={i.id} item={i} people={people} home={home} photos={photos} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function HistoryCard({
  item: i,
  people,
  home,
  photos,
  showDate = false,
}: {
  item: HistoryItem;
  people: People;
  home: string;
  photos: Photos;
  /** Shown when the list isn't grouped by day. */
  showDate?: boolean;
}) {
  const foreign = i.currency !== home;
  const isPayment = i.kind === "payment";
  const color = slotColor(i.slot);
  const effect = isPayment
    ? `${people[i.paidBy]} gave ${people[other(i.paidBy)]} ${formatMoney(i.home, home)}`
    : i.delta === 0
      ? "No one owes anything"
      : `${people[i.delta > 0 ? "p2" : "p1"]} owes ${people[i.delta > 0 ? "p1" : "p2"]} ${formatMoney(Math.abs(i.delta), home)}`;
  const splitText = isPayment
    ? "Payment"
    : { equal: "Split 50/50", custom: "Custom split", payer: "Not split", other: `All for ${people[other(i.paidBy)]}` }[i.split];
  // Rates typed in by hand are marked with a star (kept as entered; there may be a reason for them).
  const handRate = foreign && i.rateSource === "manual";
  const rateText = !foreign
    ? null
    : i.rateSource === "charged"
      ? "Charged amount from statement"
      : `1 ${i.currency} = ${formatRate(i.rate)} ${home} (1 ${home} = ${inverseRate(i.rate)} ${i.currency}) · ${
          i.rateSource === "ecb" ? `ECB ${i.rateDate ?? ""}` : i.rateSource === "market" ? `market rate ${i.rateDate ?? ""}` : "rate entered by hand"
        }`;
  // The running balance is always in date order; say so when the list is sorted some other way.
  const after = showDate ? "After this (in date order)" : "After this";
  const balance =
    i.balanceAfter === 0
      ? `${after}: all square`
      : `${after}: ${people[i.balanceAfter > 0 ? "p2" : "p1"]} owes ${formatMoney(Math.abs(i.balanceAfter), home)}`;

  return (
    <li id={`entry-${i.id}`}>
      <Link
        href={`/entries/${i.id}`}
        className="group relative flex gap-3 overflow-hidden rounded-2xl border border-line bg-card p-3 pl-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
        <span
          aria-hidden
          className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg"
          style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}
        >
          {isPayment ? (
            <Avatar person={i.paidBy} name={people[i.paidBy]} photo={photos[i.paidBy]} size={40} />
          ) : (
            <Flag currency={i.currency} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {handRate && (
              <span className="mr-1 text-amber-500" title="Exchange rate entered by hand" aria-label="Exchange rate entered by hand">
                ★
              </span>
            )}
            {i.description}
          </p>
          {showDate && <p className="text-xs font-medium text-muted">{dayHeading(i.date)}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="chip border border-line">
              <Avatar person={i.paidBy} name={people[i.paidBy]} photo={photos[i.paidBy]} size={14} />
              {isPayment ? `From ${people[i.paidBy]}` : `Paid by ${people[i.paidBy]}`}
            </span>
            <span className="chip bg-subtle">{splitText}</span>
            {isPayment && i.method && (
              <span className="chip bg-[#008cff]/12 font-semibold text-[#0070cc] dark:text-[#5cb3ff]">{methodLabel[i.method]}</span>
            )}
            <span className="chip" style={{ background: `color-mix(in oklab, ${color} 14%, transparent)` }}>
              <Flag currency={i.currency} /> {i.country}
            </span>
            {i.updated && <span className="chip bg-subtle text-muted">edited</span>}
          </div>
          {rateText && (
            <p className={`mt-1 text-xs ${handRate ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted"}`}>
              {handRate && "★ "}
              {rateText}
            </p>
          )}
          {i.notes && <p className="mt-1 text-xs italic text-muted">“{i.notes}”</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold tabular-nums">{formatMoney(i.amountMinor, i.currency)}</p>
          {foreign && <p className="text-xs tabular-nums text-muted">≈ {formatMoney(i.home, home)}</p>}
          <p className="mt-1 text-xs font-medium">{effect}</p>
          {isPayment && i.balanceAfter === 0 ? (
            <p className="mt-0.5 inline-block rounded-full bg-good/12 px-2 py-0.5 text-[11px] font-bold text-good">
              ✓ Balance: {formatMoney(0, home)}
            </p>
          ) : (
            <p className="text-[11px] text-muted">{balance}</p>
          )}
        </div>
      </Link>
    </li>
  );
}

function FilterChip({
  on,
  onClick,
  children,
  color,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** For a person's chip: their color when selected. */
  color?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={on && color ? { background: color, borderColor: color } : undefined}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
        on ? "border-accent bg-accent text-white" : "border-line bg-card hover:border-accent/50"
      }`}
    >
      {children}
    </button>
  );
}

/** "1 USD = 21,834 LAK": the other way round, so an implausible rate is easy to spot. */
function inverseRate(rate: string): string {
  const r = Number(rate);
  if (!(r > 0)) return "?";
  const inv = 1 / r;
  return inv >= 100 ? Math.round(inv).toLocaleString("en-US") : inv.toLocaleString("en-US", { maximumSignificantDigits: 6 });
}
