import { z } from "zod";
import { isKnownCurrency } from "./currencyData";
import type { Entry } from "./ledger";

const entrySchema = z.object({
  id: z.uuid(),
  kind: z.enum(["expense", "payment"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500),
  amountMinor: z.number().int().positive(),
  currency: z.string().refine(isKnownCurrency, "unknown currency"),
  rate: z.string().regex(/^\d+(\.\d+)?$/),
  rateSource: z.enum(["same", "ecb", "manual", "charged"]),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  homeAmountMinor: z.number().int().positive().nullable(),
  paidBy: z.enum(["p1", "p2"]),
  split: z.enum(["equal", "custom", "payer", "other"]),
  p1ShareMinor: z.number().int().min(0).nullable(),
  notes: z.string().max(2000).default(""),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const fileSchema = z.object({
  homeCurrency: z.string(),
  entries: z.array(z.unknown()),
  settings: z.object({ enabledCurrencies: z.array(z.string()).optional() }).optional(),
});

export type ParsedImport = {
  entries: Entry[];
  homeCurrency: string;
  enabledCurrencies?: string[];
  exportedAt?: string;
};

/**
 * Parses a JSON export or automatic backup from this app.
 * Throws an Error with a readable message if the file isn't valid.
 */
export function parseImport(text: string, expectedHome: string): ParsedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error("That file isn't valid JSON. Use a JSON export or backup from this app (CSV can't be imported).");
  }
  const file = fileSchema.safeParse(raw);
  if (!file.success) throw new Error("That doesn't look like a Travel Ledger export or backup.");
  if (file.data.homeCurrency !== expectedHome) {
    throw new Error(
      `This file uses ${file.data.homeCurrency} as its home currency, but the app uses ${expectedHome}. ` +
        "Set HOME_CURRENCY to match before importing.",
    );
  }
  const entries: Entry[] = [];
  file.data.entries.forEach((item, i) => {
    const r = entrySchema.safeParse(item);
    if (!r.success) {
      const issue = r.error.issues[0];
      throw new Error(`Entry ${i + 1} is invalid (${issue.path.join(".") || "entry"}: ${issue.message}).`);
    }
    if (r.data.split === "custom" && (r.data.p1ShareMinor ?? 0) > r.data.amountMinor) {
      throw new Error(`Entry ${i + 1} has a custom share larger than its amount.`);
    }
    entries.push(r.data);
  });
  const ids = new Set(entries.map((e) => e.id));
  if (ids.size !== entries.length) throw new Error("The file contains the same entry twice.");
  return {
    entries,
    homeCurrency: file.data.homeCurrency,
    enabledCurrencies: file.data.settings?.enabledCurrencies?.filter(isKnownCurrency),
    exportedAt: (raw as { exportedAt?: string }).exportedAt,
  };
}
