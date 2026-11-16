import Decimal from "decimal.js";
import { z } from "zod";
import { type Entry, PAYMENT_METHODS } from "./ledger";
import { isValidCurrency, parseDecimal, toMinor } from "./money";

export type FieldErrors = Partial<Record<string, string>>;

const raw = z.object({
  kind: z.enum(["expense", "payment"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  description: z.string().trim().max(200),
  amount: z.string(),
  currency: z.string().trim().toUpperCase(),
  paidBy: z.enum(["p1", "p2"]),
  split: z.enum(["equal", "custom", "payer", "other"]),
  p1Share: z.string().optional().default(""),
  rateMode: z.enum(["rate", "charged"]).default("rate"),
  rate: z.string().optional().default(""),
  rateSource: z.enum(["same", "ecb", "manual", "charged"]).default("manual"),
  rateDate: z.string().optional().default(""),
  homeAmount: z.string().optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  method: z.enum(PAYMENT_METHODS).or(z.literal("")).optional().default(""),
});

export type EntryFields = Omit<Entry, "id" | "tripId" | "createdAt" | "updatedAt">;

/** Validates submitted form fields. Returns either the entry fields or per-field error messages. */
export function parseEntryForm(
  form: Record<string, string>,
  homeCurrency: string,
): { ok: true; value: EntryFields } | { ok: false; errors: FieldErrors } {
  const parsed = raw.safeParse(form);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, errors };
  }
  const f = parsed.data;
  const errors: FieldErrors = {};

  if (f.kind === "expense" && !f.description) errors.description = "Describe the expense";
  if (!isValidCurrency(f.currency)) errors.currency = "Choose a currency";

  const amount = parseDecimal(f.amount);
  let amountMinor: number | null = null;
  if (!amount || amount.lte(0)) errors.amount = "Enter an amount greater than 0";
  else if (!errors.currency) {
    amountMinor = toMinor(amount, f.currency);
    if (amountMinor === null) errors.amount = `Too many decimals for ${f.currency}`;
  }

  // Exchange rate: either a rate, or the exact home-currency amount that was charged.
  const same = f.currency === homeCurrency;
  let rate = "1";
  let rateSource: Entry["rateSource"] = "same";
  let homeAmountMinor: number | null = null;
  if (!same && !errors.currency) {
    if (f.rateMode === "charged") {
      const home = parseDecimal(f.homeAmount);
      const homeMinor = home ? toMinor(home, homeCurrency) : null;
      if (!home || home.lte(0) || homeMinor === null) {
        errors.homeAmount = `Enter the ${homeCurrency} amount that was charged`;
      } else if (amount && amount.gt(0)) {
        homeAmountMinor = homeMinor;
        rate = home.div(amount).toSignificantDigits(12).toFixed();
        rateSource = "charged";
      }
    } else {
      const r = parseDecimal(f.rate);
      if (!r || r.lte(0)) errors.rate = "Enter the exchange rate";
      else {
        rate = r.toFixed();
        rateSource = f.rateSource === "ecb" ? "ecb" : "manual";
      }
    }
  }

  let p1ShareMinor: number | null = null;
  if (f.kind === "expense" && f.split === "custom" && amountMinor !== null) {
    const share = parseDecimal(f.p1Share);
    const shareMinor = share ? toMinor(share, f.currency) : null;
    if (!share || share.lt(0) || shareMinor === null || shareMinor > amountMinor) {
      errors.p1Share = "Must be between 0 and the total";
    } else p1ShareMinor = shareMinor;
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      kind: f.kind,
      date: f.date,
      description: f.description || (f.kind === "payment" ? "Payment" : ""),
      amountMinor: amountMinor!,
      currency: f.currency,
      rate: new Decimal(rate).toFixed(),
      rateSource,
      rateDate: same || rateSource === "charged" ? f.date : f.rateDate || f.date,
      homeAmountMinor,
      paidBy: f.paidBy,
      split: f.kind === "payment" ? "other" : f.split,
      p1ShareMinor,
      notes: f.notes,
      method: f.kind === "payment" && f.method ? f.method : null,
    },
  };
}
