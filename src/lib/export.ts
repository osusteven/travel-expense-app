import { type Entry, type Trip, chronological, entryEffect, methodLabel, summarize, type PersonKey } from "./ledger";
import { plainAmount } from "./money";
import type { People } from "./config";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  // Quote when needed; prefix formula-like text so spreadsheets don't execute it.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const splitLabel: Record<Entry["split"], string> = {
  equal: "split equally",
  custom: "custom split",
  payer: "payer only",
  other: "other person only",
};

/**
 * CSV with one row per entry in chronological order, including the conversion and the running balance.
 * Starts with a UTF-8 byte order mark so Excel shows currency symbols and accents correctly.
 */
export function toCsv(entries: Entry[], home: string, people: People, trips: Trip[] = []): string {
  const name = (p: PersonKey) => people[p];
  const tripName = new Map(trips.map((t) => [t.id, t.name]));
  const running = runningByTrip(entries, home);
  const header = [
    "trip", "date", "type", "description", "paid_by", "split", "amount", "currency",
    `rate_to_${home}`, "rate_source", "rate_date", `amount_${home}`,
    `${people.p1}_share_${home}`, `${people.p2}_share_${home}`,
    `balance_after_${home} (positive = ${people.p2} owes ${people.p1})`,
    "payment_method", "notes", "id", "created_at", "updated_at",
  ];
  const sorted = [...entries].sort((a, b) => (tripName.get(a.tripId) ?? "").localeCompare(tripName.get(b.tripId) ?? "") || chronological(a, b));
  const rows = sorted.map((e) => {
    const fx = entryEffect(e, home);
    return [
      tripName.get(e.tripId) ?? "",
      e.date,
      e.kind,
      e.description,
      name(e.paidBy),
      e.kind === "payment" ? `to ${name(e.paidBy === "p1" ? "p2" : "p1")}` : splitLabel[e.split],
      plainAmount(e.amountMinor, e.currency),
      e.currency,
      e.rate,
      e.rateSource,
      e.rateDate,
      plainAmount(fx.home, home),
      plainAmount(fx.share.p1, home),
      plainAmount(fx.share.p2, home),
      plainAmount(running.get(e.id) ?? 0, home),
      e.method ? methodLabel[e.method] : "",
      e.notes,
      e.id,
      e.createdAt,
      e.updatedAt,
    ];
  });
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export interface ExportSettings {
  enabledCurrencies?: string[];
  profiles?: Record<PersonKey, { photo?: string; venmo?: string }>;
  currentTripId?: string;
}

/** Running balance after each entry, computed separately for each trip (each trip has its own balance). */
export function runningByTrip(entries: Entry[], home: string): Map<string, number> {
  const running = new Map<string, number>();
  for (const tripId of new Set(entries.map((e) => e.tripId))) {
    for (const [id, bal] of summarize(entries.filter((e) => e.tripId === tripId), home).runningBalance) running.set(id, bal);
  }
  return running;
}

/** Full-fidelity JSON export (amounts in minor units plus readable values), usable as a backup. */
export function toJson(entries: Entry[], home: string, people: People, settings?: ExportSettings, trips: Trip[] = []) {
  const summary = summarize(entries, home);
  const running = runningByTrip(entries, home);
  return {
    app: "travel-ledger",
    version: 2,
    exportedAt: new Date().toISOString(),
    homeCurrency: home,
    people,
    settings: settings ?? {},
    trips: trips.map((t) => ({
      ...t,
      balance: plainAmount(summarize(entries.filter((e) => e.tripId === t.id), home).balance, home),
    })),
    summary: {
      balanceMeaning: `trip balances: positive = ${people.p2} owes ${people.p1}`,
      totalSpent: plainAmount(summary.totalSpent, home),
      paid: { [people.p1]: plainAmount(summary.paid.p1, home), [people.p2]: plainAmount(summary.paid.p2, home) },
      share: { [people.p1]: plainAmount(summary.share.p1, home), [people.p2]: plainAmount(summary.share.p2, home) },
    },
    entries: [...entries].sort(chronological).map((e) => {
      const fx = entryEffect(e, home);
      return {
        ...e,
        amount: plainAmount(e.amountMinor, e.currency),
        homeAmount: plainAmount(fx.home, home),
        share: { p1: plainAmount(fx.share.p1, home), p2: plainAmount(fx.share.p2, home) },
        balanceAfter: plainAmount(running.get(e.id) ?? 0, home),
      };
    }),
  };
}
