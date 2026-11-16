import "server-only";
import Decimal from "decimal.js";
import { config } from "./config";
import { cachedRate, storeRate } from "./db";

export type RateLookup =
  | { ok: true; rate: string; rateDate: string; source: "same" | "ecb" | "market" }
  | { ok: false; error: string };

type Found = { rate: string; rateDate: string };

/**
 * Exchange rate for converting `from` into the home currency on `date` (YYYY-MM-DD).
 *
 * 1. The European Central Bank's daily reference rate (via Frankfurter): official, but only ~30 major currencies.
 *    On weekends and holidays the ECB publishes nothing, so the previous business day's rate is used.
 * 2. For everything else (e.g. LAK, KHR, MMK) the free currency-api dataset, which has daily market rates for
 *    ~200 currencies. It's tried on two mirrors.
 * If neither has a rate, the person enters it by hand. rateDate always says which day the rate is from.
 * Past dates are cached (historical rates don't change); today's rate is fetched fresh.
 */
export async function lookupRate(from: string, date: string): Promise<RateLookup> {
  const to = config.homeCurrency;
  if (from === to) return { ok: true, rate: "1", rateDate: date, source: "same" };

  const today = new Date().toISOString().slice(0, 10);
  const day = date > today ? today : date;
  const isPast = day < today;

  if (isPast) {
    const hit = await cachedRate(from, to, day).catch(() => null);
    if (hit) return { ok: true, rate: hit.rate, rateDate: hit.rateDate, source: hit.source };
  }

  let reachedAny = false;
  for (const [source, find] of [
    ["ecb", ecbRate],
    ["market", marketRate],
  ] as const) {
    try {
      const found = await find(from, to, isPast ? day : "latest");
      reachedAny = true;
      if (found) {
        if (isPast) await storeRate(from, to, day, found.rate, found.rateDate, source).catch(() => undefined);
        return { ok: true, ...found, source };
      }
    } catch {
      // Service unreachable: try the next one.
    }
  }
  return {
    ok: false,
    error: reachedAny
      ? `No published rate for ${from}. Enter the rate manually.`
      : "Couldn't reach the exchange-rate services. Enter the rate manually.",
  };
}

const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });

/** Plain decimal string (no exponent), keeping the source's digits: "4.58e-05" → "0.0000458". */
function exact(text: string, key: string): string | null {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*([0-9.eE+-]+)`));
  if (!m) return null;
  const d = new Decimal(m[1]);
  return d.gt(0) ? d.toFixed() : null;
}

/** European Central Bank via Frankfurter. Returns null when the ECB doesn't publish this currency. */
async function ecbRate(from: string, to: string, day: string): Promise<Found | null> {
  const res = await get(`${config.ratesApiBase}/${day}?from=${from}&to=${to}`);
  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const rate = exact(text, to);
  return rate ? { rate, rateDate: (JSON.parse(text) as { date?: string }).date ?? day } : null;
}

/**
 * currency-api (github.com/fawazahmed0/exchange-api), one JSON file per base currency per day:
 *   { "date": "2026-10-05", "lak": { "usd": 0.0000458, ... } }
 * If that exact day isn't published (e.g. too recent), the latest file is used and rateDate says so.
 */
async function marketRate(from: string, to: string, day: string): Promise<Found | null> {
  const base = from.toLowerCase();
  const quote = to.toLowerCase();
  let reached = false;
  for (const d of day === "latest" ? ["latest"] : [day, "latest"]) {
    for (const template of config.marketRatesUrls) {
      try {
        const res = await get(template.replace("{date}", d).replace("{code}", base));
        reached = true;
        if (!res.ok) continue;
        const text = await res.text();
        const body = JSON.parse(text) as { date?: string; [k: string]: unknown };
        const rates = body[base];
        if (!rates || typeof rates !== "object") continue;
        // Match within the base currency's block only.
        const rate = exact(JSON.stringify(rates), quote);
        if (rate) return { rate, rateDate: body.date ?? (d === "latest" ? new Date().toISOString().slice(0, 10) : d) };
      } catch {
        // Try the other mirror.
      }
    }
  }
  if (!reached) throw new Error("unreachable");
  return null;
}
