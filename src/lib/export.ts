import { type Entry, chronological, entryEffect, summarize, type PersonKey } from "./ledger";
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
export function toCsv(entries: Entry[], home: string, people: People): string {
  const name = (p: PersonKey) => people[p];
  const summary = summarize(entries, home);
  const header = [
    "date", "type", "description", "paid_by", "split", "amount", "currency",
    `rate_to_${home}`, "rate_source", "rate_date", `amount_${home}`,
    `${people.p1}_share_${home}`, `${people.p2}_share_${home}`,
    `balance_after_${home} (positive = ${people.p2} owes ${people.p1})`,
    "notes", "id", "created_at", "updated_at",
  ];
  const rows = [...entries].sort(chronological).map((e) => {
    const fx = entryEffect(e, home);
    return [
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
      plainAmount(summary.runningBalance.get(e.id) ?? 0, home),
      e.notes,
      e.id,
      e.createdAt,
      e.updatedAt,
    ];
  });
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Full-fidelity JSON export (amounts in minor units plus readable values), usable as a backup. */
export function toJson(entries: Entry[], home: string, people: People) {
  const summary = summarize(entries, home);
  return {
    exportedAt: new Date().toISOString(),
    homeCurrency: home,
    people,
    summary: {
      balance: plainAmount(summary.balance, home),
      balanceMeaning: `positive = ${people.p2} owes ${people.p1}`,
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
        balanceAfter: plainAmount(summary.runningBalance.get(e.id) ?? 0, home),
      };
    }),
  };
}
