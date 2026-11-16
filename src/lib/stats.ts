import { countryName, countrySlots } from "./currencyData";
import { type Entry, type PersonKey, chronological, entryEffect, other, summarize } from "./ledger";

/** One entry with everything the History list needs, precomputed on the server. */
export interface HistoryItem {
  id: string;
  kind: Entry["kind"];
  date: string;
  description: string;
  notes: string;
  amountMinor: number;
  currency: string;
  country: string;
  slot: number;
  rate: string;
  rateSource: Entry["rateSource"];
  rateDate: string | null;
  paidBy: PersonKey;
  split: Entry["split"];
  home: number;
  share: Record<PersonKey, number>;
  /** Positive: person 2 owes person 1 for this entry. */
  delta: number;
  /** Running balance after this entry. */
  balanceAfter: number;
  updated: boolean;
}

export function historyItems(entries: Entry[], home: string): HistoryItem[] {
  const summary = summarize(entries, home);
  const slots = countrySlots([...entries].sort(chronological).map((e) => e.currency));
  return entries.map((e) => {
    const fx = entryEffect(e, home);
    return {
      id: e.id,
      kind: e.kind,
      date: e.date,
      description: e.description,
      notes: e.notes,
      amountMinor: e.amountMinor,
      currency: e.currency,
      country: countryName(e.currency),
      slot: slots[e.currency] ?? 0,
      rate: e.rate,
      rateSource: e.rateSource,
      rateDate: e.rateDate,
      paidBy: e.paidBy,
      split: e.split,
      home: fx.home,
      share: fx.share,
      delta: fx.balanceDelta,
      balanceAfter: summary.runningBalance.get(e.id) ?? 0,
      updated: e.updatedAt !== e.createdAt,
    };
  });
}

export interface CountryStat {
  currency: string;
  country: string;
  slot: number;
  home: number;
  original: number;
  count: number;
}

export interface Stats {
  totalSpent: number;
  expenseCount: number;
  days: number;
  perDay: number;
  largest: { description: string; home: number; currency: string; amountMinor: number } | null;
  byCountry: CountryStat[];
  /** Spending per period (day, or week for long trips), split by currency. */
  periods: { label: string; start: string; total: number; byCurrency: Record<string, number> }[];
  periodUnit: "day" | "week";
  people: Record<PersonKey, { paid: number; share: number }>;
  payments: { count: number; total: number };
}

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toDate = (t: number) => new Date(t).toISOString().slice(0, 10);

export function computeStats(entries: Entry[], home: string): Stats {
  const expenses = entries.filter((e) => e.kind === "expense");
  const slots = countrySlots([...entries].sort(chronological).map((e) => e.currency));
  const summary = summarize(entries, home);

  const byCountry = new Map<string, CountryStat>();
  let largest: Stats["largest"] = null;
  const perDate = new Map<string, Record<string, number>>();
  for (const e of expenses) {
    const h = entryEffect(e, home).home;
    const c = byCountry.get(e.currency) ?? {
      currency: e.currency, country: countryName(e.currency), slot: slots[e.currency] ?? 0, home: 0, original: 0, count: 0,
    };
    c.home += h;
    c.original += e.amountMinor;
    c.count++;
    byCountry.set(e.currency, c);
    if (!largest || h > largest.home) largest = { description: e.description, home: h, currency: e.currency, amountMinor: e.amountMinor };
    const d = perDate.get(e.date) ?? {};
    d[e.currency] = (d[e.currency] ?? 0) + h;
    perDate.set(e.date, d);
  }

  const dates = [...perDate.keys()].sort();
  const first = dates.length ? toTime(dates[0]) : 0;
  const last = dates.length ? toTime(dates[dates.length - 1]) : 0;
  const days = dates.length ? Math.round((last - first) / DAY) + 1 : 0;

  // Daily bars for trips up to ~2 months, weekly beyond that.
  const periodUnit: Stats["periodUnit"] = days > 62 ? "week" : "day";
  const periods: Stats["periods"] = [];
  if (dates.length) {
    const step = periodUnit === "day" ? DAY : 7 * DAY;
    let start = first;
    if (periodUnit === "week") {
      const dow = (new Date(first).getUTCDay() + 6) % 7; // Monday = 0
      start = first - dow * DAY;
    }
    for (let t = start; t <= last; t += step) {
      const byCurrency: Record<string, number> = {};
      for (let d = t; d < t + step; d += DAY) {
        for (const [cur, v] of Object.entries(perDate.get(toDate(d)) ?? {})) byCurrency[cur] = (byCurrency[cur] ?? 0) + v;
      }
      const total = Object.values(byCurrency).reduce((a, b) => a + b, 0);
      const label = new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      periods.push({ label: periodUnit === "week" ? `Week of ${label}` : label, start: toDate(t), total, byCurrency });
    }
  }

  const payments = entries.filter((e) => e.kind === "payment");
  return {
    totalSpent: summary.totalSpent,
    expenseCount: expenses.length,
    days,
    perDay: days ? Math.round(summary.totalSpent / days) : 0,
    largest,
    byCountry: [...byCountry.values()].sort((a, b) => b.home - a.home),
    periods,
    periodUnit,
    people: {
      p1: { paid: summary.paid.p1, share: summary.share.p1 },
      p2: { paid: summary.paid.p2, share: summary.share.p2 },
    },
    payments: { count: payments.length, total: payments.reduce((a, e) => a + entryEffect(e, home).home, 0) },
  };
}

export { other };
