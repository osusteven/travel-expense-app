import "server-only";
import { cookies } from "next/headers";
import { config } from "./config";
import { POPULAR, isKnownCurrency } from "./currencyData";
import { getSetting, setSetting } from "./db";
import type { PersonKey } from "./ledger";

export const LAST_CURRENCY_COOKIE = "ledger_last_currency";
export const LAST_PAYER_COOKIE = "ledger_last_payer";

/** Currencies offered in the form. Defaults to the popular list; the home currency is always included. */
export async function enabledCurrencies(): Promise<string[]> {
  const saved = await getSetting<string[]>("enabledCurrencies");
  const list = (saved ?? POPULAR).filter(isKnownCurrency);
  return [config.homeCurrency, ...list.filter((c) => c !== config.homeCurrency)];
}

/** The currency this device used last, if it's still enabled; otherwise the home currency. */
export async function defaultCurrency(enabled: string[]): Promise<string> {
  const last = (await cookies()).get(LAST_CURRENCY_COOKIE)?.value;
  return last && enabled.includes(last) ? last : config.homeCurrency;
}

/** Who this device picked under "Paid by" on its last added entry (person 1 if none yet). */
export async function defaultPayer(): Promise<PersonKey> {
  return (await cookies()).get(LAST_PAYER_COOKIE)?.value === "p2" ? "p2" : "p1";
}

// ---- Trips ----

/** The trip both people are currently adding to (shared, stored in the database). */
export async function currentTripId(): Promise<string | null> {
  return getSetting<string>("currentTripId");
}

export async function setCurrentTrip(id: string): Promise<void> {
  await setSetting("currentTripId", id);
}

// ---- People ----

export interface PersonProfile {
  /** Small square JPEG as a data URL, used as the avatar icon. */
  photo?: string;
  /** Venmo username without the @, used to open Venmo with a payment filled in. */
  venmo?: string;
}
export type Profiles = Record<PersonKey, PersonProfile>;

export async function profiles(): Promise<Profiles> {
  const saved = await getSetting<Partial<Profiles>>("profiles");
  return { p1: saved?.p1 ?? {}, p2: saved?.p2 ?? {} };
}

export async function saveProfiles(value: Profiles): Promise<void> {
  await setSetting("profiles", value);
}

// ---- Easter egg ----

/** A picture (small square JPEG data URL) that floats across the balance once a minute. */
export async function easterEggPhoto(): Promise<string | undefined> {
  return (await getSetting<string>("easterEggPhoto")) ?? undefined;
}
