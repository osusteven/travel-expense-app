import Decimal from "decimal.js";
import { isKnownCurrency } from "./currencyData";

/*
 * Money rules used throughout the app:
 * - Amounts are stored as integers in the currency's minor unit (cents, or whole yen),
 *   never as floating point numbers.
 * - Each currency's number of decimals comes from ISO 4217 (USD 2, JPY 0, KWD 3).
 * - Exchange rates are exact decimal strings, and conversions round half-up only once, at the end.
 */

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const exponentCache = new Map<string, number>();

/** Number of decimal places for a currency (2 for USD, 0 for JPY, 3 for KWD). */
export function currencyExponent(code: string): number {
  const cached = exponentCache.get(code);
  if (cached !== undefined) return cached;
  let digits = 2;
  try {
    digits = new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    // Unknown code: fall back to 2 decimals.
  }
  exponentCache.set(code, digits);
  return digits;
}

/** Only active ISO 4217 currencies are accepted (Intl alone would accept any three letters). */
export function isValidCurrency(code: string): boolean {
  return isKnownCurrency(code);
}

/**
 * Parses user input like "12.50", "12,50", "1,234.56" or "1 234,5" into a Decimal.
 * Returns null if it isn't a number.
 */
export function parseDecimal(input: string): Decimal | null {
  let s = input.trim().replace(/[\s ']/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Whichever separator comes last is the decimal separator.
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    s = s.split(thousandsSep).join("").replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    // "1,234" (thousands) vs "12,5" (decimal): treat as thousands only if groups of exactly 3.
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, "");
  }
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null;
  try {
    return new Decimal(s);
  } catch {
    return null;
  }
}

/** Converts a decimal amount to integer minor units. Returns null if it has more decimals than the currency allows. */
export function toMinor(amount: Decimal, currency: string): number | null {
  const scaled = amount.mul(new Decimal(10).pow(currencyExponent(currency)));
  if (!scaled.isInteger()) return null;
  return scaled.toNumber();
}

export function fromMinor(minor: number, currency: string): Decimal {
  return new Decimal(minor).div(new Decimal(10).pow(currencyExponent(currency)));
}

/**
 * Converts an amount in minor units of `from` into minor units of `to`,
 * using `rate` = units of `to` per 1 unit of `from`. Rounds half-up once.
 */
export function convertMinor(minor: number, from: string, to: string, rate: Decimal.Value): number {
  if (from === to) return minor;
  return fromMinor(minor, from)
    .mul(rate)
    .mul(new Decimal(10).pow(currencyExponent(to)))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function formatMoney(minor: number, currency: string, locale = "en-US"): string {
  const value = fromMinor(minor, currency).toNumber();
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(currencyExponent(currency))} ${currency}`;
  }
}

/** Plain number without symbol or grouping, for form fields and CSV, e.g. "1234.50". */
export function plainAmount(minor: number, currency: string): string {
  return fromMinor(minor, currency).toFixed(currencyExponent(currency));
}

/** Rate shown to people: up to 8 significant decimals, no trailing zeros. */
export function formatRate(rate: string): string {
  const d = new Decimal(rate);
  return d.toSignificantDigits(8).toFixed();
}

/** "3 expenses · 1 payment": the same wording on the Trips list and the trip page. */
export function countLabel(expenses: number, payments: number): string {
  const e = `${expenses} ${expenses === 1 ? "expense" : "expenses"}`;
  return payments ? `${e} · ${payments} ${payments === 1 ? "payment" : "payments"}` : e;
}
