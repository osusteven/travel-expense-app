import { convertMinor } from "./money";

export type PersonKey = "p1" | "p2";
export const other = (p: PersonKey): PersonKey => (p === "p1" ? "p2" : "p1");

/** expense = something bought; payment = money handed from one person to the other (settling up). */
export type EntryKind = "expense" | "payment";

/**
 * How an expense is shared:
 * - equal:  50/50
 * - custom: person 1's share is given explicitly (in the expense currency); person 2 gets the rest
 * - payer:  not split; the payer's own expense (no one owes anything)
 * - other:  not split; bought entirely for the other person, who owes all of it
 */
export type SplitMode = "equal" | "custom" | "payer" | "other";

/** How a payment between the two people was made. */
export const PAYMENT_METHODS = ["venmo", "cash", "zelle", "paypal", "bank", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const methodLabel: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  cash: "Cash",
  zelle: "Zelle",
  paypal: "PayPal",
  bank: "Bank transfer",
  other: "Other",
};

/** How the exchange rate was obtained. */
export type RateSource = "same" | "ecb" | "market" | "manual" | "charged";

/** How a rate's origin is described to people. */
export function rateSourceLabel(source: RateSource, rateDate: string | null): string {
  switch (source) {
    case "ecb":
      return `European Central Bank rate${rateDate ? ` for ${rateDate}` : ""}`;
    case "market":
      return `Market rate${rateDate ? ` for ${rateDate}` : ""}`;
    case "charged":
      return "Charged amount from statement";
    case "manual":
      return "Rate entered manually";
    default:
      return "";
  }
}

export interface Entry {
  id: string;
  /** The trip this entry belongs to. Each trip has its own balance. */
  tripId: string;
  kind: EntryKind;
  /** ISO date YYYY-MM-DD of the transaction. */
  date: string;
  description: string;
  /** Amount in minor units of `currency`. */
  amountMinor: number;
  currency: string;
  /** Units of the home currency per 1 unit of `currency`, as an exact decimal string. Frozen at entry time. */
  rate: string;
  rateSource: RateSource;
  /** Date the rate applies to (may be the previous business day for ECB rates). */
  rateDate: string | null;
  /**
   * When set, the exact amount in home currency (minor units) that was actually charged,
   * e.g. from a card statement. Takes precedence over amount × rate.
   */
  homeAmountMinor: number | null;
  paidBy: PersonKey;
  split: SplitMode;
  /** For split = custom: person 1's share in minor units of `currency`. */
  p1ShareMinor: number | null;
  notes: string;
  /** For payments: how the money was sent. */
  method: PaymentMethod | null;
  createdAt: string;
  updatedAt: string;
}

export interface Trip {
  id: string;
  name: string;
  /** The trip's web address: /trips/<slug>, made from its name. */
  slug: string;
  /** Optional picture (wide JPEG data URL), shown on the Trips list and as the trip page banner. */
  image?: string | null;
  createdAt: string;
}

/** "Japan & Korea 2026" → "japan-korea-2026". */
export function slugify(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  // "new" is the address of the New trip page.
  return !s ? "trip" : s === "new" ? "new-trip" : s;
}

export const tripPath = (t: Pick<Trip, "slug">) => `/trips/${t.slug}`;

export interface EntryEffect {
  /** Value of the entry in home currency (minor units). */
  home: number;
  /** Each person's share of the cost, in home currency. Always sums to `home`. */
  share: Record<PersonKey, number>;
  /**
   * Change to the balance: positive means person 2 owes person 1 more,
   * negative means person 1 owes person 2 more.
   */
  balanceDelta: number;
}

export function entryEffect(e: Entry, homeCurrency: string): EntryEffect {
  const home = e.homeAmountMinor ?? convertMinor(e.amountMinor, e.currency, homeCurrency, e.rate);
  const payer = e.paidBy;
  const share: Record<PersonKey, number> = { p1: 0, p2: 0 };

  if (e.kind === "payment") {
    // Handing money over: as if the payer bought something worth `home` entirely for the other person.
    share[other(payer)] = home;
  } else {
    switch (e.split) {
      case "equal": {
        // An odd cent goes to the payer's share, so the other person never owes more than half.
        const otherShare = Math.trunc(home / 2);
        share[other(payer)] = otherShare;
        share[payer] = home - otherShare;
        break;
      }
      case "custom": {
        const p1Original = e.p1ShareMinor ?? 0;
        // Scale person 1's share by the same ratio as the total, so it works with a "charged" override too.
        const p1 = e.amountMinor === 0 ? 0 : Math.round((home * p1Original) / e.amountMinor);
        share.p1 = Math.min(Math.max(p1, Math.min(0, home)), Math.max(0, home));
        share.p2 = home - share.p1;
        break;
      }
      case "payer":
        share[payer] = home;
        break;
      case "other":
        share[other(payer)] = home;
        break;
    }
  }

  // The payer is credited with what they paid; each person is debited their share.
  const paid: Record<PersonKey, number> = { p1: 0, p2: 0 };
  paid[payer] = home;
  const p1Net = paid.p1 - share.p1;
  return { home, share, balanceDelta: p1Net };
}

export interface Summary {
  /** Positive: person 2 owes person 1. Negative: person 1 owes person 2. Home currency minor units. */
  balance: number;
  /** Total cost of expenses (payments excluded). */
  totalSpent: number;
  paid: Record<PersonKey, number>;
  share: Record<PersonKey, number>;
  /** Original amounts spent per currency (expenses only). */
  byCurrency: Record<string, number>;
  /** Balance after each entry, keyed by entry id, in chronological order. */
  runningBalance: Map<string, number>;
}

/** Chronological order: by transaction date, then by when it was entered. */
export function chronological(a: Entry, b: Entry): number {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
}

export function summarize(entries: Entry[], homeCurrency: string): Summary {
  const s: Summary = {
    balance: 0,
    totalSpent: 0,
    paid: { p1: 0, p2: 0 },
    share: { p1: 0, p2: 0 },
    byCurrency: {},
    runningBalance: new Map(),
  };
  for (const e of [...entries].sort(chronological)) {
    const fx = entryEffect(e, homeCurrency);
    s.balance += fx.balanceDelta;
    s.runningBalance.set(e.id, s.balance);
    if (e.kind === "expense") {
      s.totalSpent += fx.home;
      s.paid[e.paidBy] += fx.home;
      s.share.p1 += fx.share.p1;
      s.share.p2 += fx.share.p2;
      s.byCurrency[e.currency] = (s.byCurrency[e.currency] ?? 0) + e.amountMinor;
    }
  }
  return s;
}

/** Who owes whom, or null when even. */
export function settlement(balance: number): { from: PersonKey; to: PersonKey; amount: number } | null {
  if (balance > 0) return { from: "p2", to: "p1", amount: balance };
  if (balance < 0) return { from: "p1", to: "p2", amount: -balance };
  return null;
}
