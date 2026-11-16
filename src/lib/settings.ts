import "server-only";
import { cookies } from "next/headers";
import { config } from "./config";
import { POPULAR, isKnownCurrency } from "./currencyData";
import { getSetting } from "./db";

export const LAST_CURRENCY_COOKIE = "ledger_last_currency";

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
