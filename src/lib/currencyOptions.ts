import type { CurrencyOption } from "@/components/CurrencyPicker";
import { countryName, currencyName } from "./currencyData";

export function toOptions(codes: string[]): CurrencyOption[] {
  return codes.map((code) => ({ code, country: countryName(code), name: currencyName(code) }));
}
