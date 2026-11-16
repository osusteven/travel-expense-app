import type { CurrencyOption } from "@/components/CurrencyPicker";
import { countryName, currencyName } from "./currencyData";

export function toOptions(codes: string[]): CurrencyOption[] {
  return codes.map((code) => ({ code, country: countryName(code), name: currencyName(code) }));
}

/** The home currency (e.g. USD) first, then the others alphabetically. */
export function homeFirst(home: string, codes: string[]): string[] {
  return [home, ...[...new Set(codes)].filter((c) => c !== home).sort()];
}
