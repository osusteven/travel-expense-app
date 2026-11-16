import "server-only";
import { config } from "./config";
import { cachedRate, storeRate } from "./db";

export type RateLookup =
  | { ok: true; rate: string; rateDate: string; source: "same" | "ecb" }
  | { ok: false; error: string };

/**
 * Exchange rate for converting `from` into the home currency on `date` (YYYY-MM-DD).
 *
 * Uses the European Central Bank's daily reference rates via Frankfurter. On weekends and holidays the
 * ECB publishes nothing, so the most recent previous business day's rate is returned (rateDate says which).
 * The ECB covers about 30 major currencies; for others the user enters the rate by hand.
 * Past dates are cached forever (historical rates don't change); today's rate is fetched fresh.
 */
export async function lookupRate(from: string, date: string): Promise<RateLookup> {
  const to = config.homeCurrency;
  if (from === to) return { ok: true, rate: "1", rateDate: date, source: "same" };

  const today = new Date().toISOString().slice(0, 10);
  const day = date > today ? today : date;
  const isPast = day < today;

  if (isPast) {
    const hit = await cachedRate(from, to, day).catch(() => null);
    if (hit) return { ok: true, rate: hit.rate, rateDate: hit.rateDate, source: "ecb" };
  }

  try {
    const url = `${config.ratesApiBase}/${isPast ? day : "latest"}?from=${from}&to=${to}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (res.status === 404 || res.status === 422) {
      return { ok: false, error: `No ECB rate for ${from}. Enter the rate manually.` };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Read the raw text so the rate keeps its exact decimal digits.
    const text = await res.text();
    const match = text.match(new RegExp(`"${to}"\\s*:\\s*([0-9.eE+-]+)`));
    const body = JSON.parse(text) as { date?: string };
    if (!match) return { ok: false, error: `No ECB rate for ${from}. Enter the rate manually.` };
    const rate = match[1];
    const rateDate = body.date ?? day;
    if (isPast) await storeRate(from, to, day, rate, rateDate).catch(() => undefined);
    return { ok: true, rate, rateDate, source: "ecb" };
  } catch {
    return { ok: false, error: "Couldn't reach the exchange-rate service. Enter the rate manually." };
  }
}
