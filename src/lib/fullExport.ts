import "server-only";
import { config, people } from "./config";
import { getSetting, listEntries, listTrips } from "./db";
import { toJson } from "./export";
import { currentTripId, profiles } from "./settings";

/** Everything needed to rebuild the ledger: trips, entries, currency choices, photos and Venmo names. */
export async function buildFullExport() {
  const [entries, trips, enabledCurrencies, prof, current] = await Promise.all([
    listEntries(),
    listTrips(),
    getSetting<string[]>("enabledCurrencies"),
    profiles(),
    currentTripId(),
  ]);
  const data = toJson(
    entries,
    config.homeCurrency,
    people,
    { ...(enabledCurrencies ? { enabledCurrencies } : {}), profiles: prof, ...(current ? { currentTripId: current } : {}) },
    trips,
  );
  return { data, entries: entries.length };
}
