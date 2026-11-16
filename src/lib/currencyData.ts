/**
 * Active ISO 4217 currencies with the country (ISO 3166 region code) they belong to,
 * used for the flag and the country name next to each currency.
 * Currencies shared by several countries get a descriptive label instead.
 */
const table: Record<string, string> = {
  AED: "AE", AFN: "AF", ALL: "AL", AMD: "AM", AOA: "AO", ARS: "AR", AUD: "AU", AWG: "AW", AZN: "AZ",
  BAM: "BA", BBD: "BB", BDT: "BD", BGN: "BG", BHD: "BH", BIF: "BI", BMD: "BM", BND: "BN", BOB: "BO",
  BRL: "BR", BSD: "BS", BTN: "BT", BWP: "BW", BYN: "BY", BZD: "BZ", CAD: "CA", CDF: "CD", CHF: "CH",
  CLP: "CL", CNY: "CN", COP: "CO", CRC: "CR", CUP: "CU", CVE: "CV", CZK: "CZ", DJF: "DJ", DKK: "DK",
  DOP: "DO", DZD: "DZ", EGP: "EG", ERN: "ER", ETB: "ET", EUR: "EU", FJD: "FJ", FKP: "FK", GBP: "GB",
  GEL: "GE", GHS: "GH", GIP: "GI", GMD: "GM", GNF: "GN", GTQ: "GT", GYD: "GY", HKD: "HK", HNL: "HN",
  HTG: "HT", HUF: "HU", IDR: "ID", ILS: "IL", INR: "IN", IQD: "IQ", IRR: "IR", ISK: "IS", JMD: "JM",
  JOD: "JO", JPY: "JP", KES: "KE", KGS: "KG", KHR: "KH", KMF: "KM", KPW: "KP", KRW: "KR", KWD: "KW",
  KYD: "KY", KZT: "KZ", LAK: "LA", LBP: "LB", LKR: "LK", LRD: "LR", LSL: "LS", LYD: "LY", MAD: "MA",
  MDL: "MD", MGA: "MG", MKD: "MK", MMK: "MM", MNT: "MN", MOP: "MO", MRU: "MR", MUR: "MU", MVR: "MV",
  MWK: "MW", MXN: "MX", MYR: "MY", MZN: "MZ", NAD: "NA", NGN: "NG", NIO: "NI", NOK: "NO", NPR: "NP",
  NZD: "NZ", OMR: "OM", PAB: "PA", PEN: "PE", PGK: "PG", PHP: "PH", PKR: "PK", PLN: "PL", PYG: "PY",
  QAR: "QA", RON: "RO", RSD: "RS", RUB: "RU", RWF: "RW", SAR: "SA", SBD: "SB", SCR: "SC", SDG: "SD",
  SEK: "SE", SGD: "SG", SHP: "SH", SLE: "SL", SOS: "SO", SRD: "SR", SSP: "SS", STN: "ST", SYP: "SY",
  SZL: "SZ", THB: "TH", TJS: "TJ", TMT: "TM", TND: "TN", TOP: "TO", TRY: "TR", TTD: "TT", TWD: "TW",
  TZS: "TZ", UAH: "UA", UGX: "UG", USD: "US", UYU: "UY", UZS: "UZ", VES: "VE", VND: "VN", VUV: "VU",
  WST: "WS", XAF: "CM", XCD: "AG", XCG: "CW", XOF: "SN", XPF: "PF", YER: "YE", ZAR: "ZA", ZMW: "ZM",
  ZWG: "ZW",
};

const labels: Record<string, string> = {
  EUR: "Eurozone",
  XAF: "Central Africa (CFA)",
  XOF: "West Africa (CFA)",
  XCD: "Eastern Caribbean",
  XCG: "Curaçao & Sint Maarten",
  XPF: "French Pacific",
  USD: "United States",
  GBP: "United Kingdom",
};

/** Currencies offered first and enabled by default for new installs. */
export const POPULAR = [
  "USD", "EUR", "GBP", "CAD", "MXN", "JPY", "AUD", "NZD", "CHF", "CNY", "HKD", "SGD", "THB", "KRW", "VND",
  "IDR", "PHP", "MYR", "INR", "AED", "TRY", "CZK", "HUF", "PLN", "SEK", "NOK", "DKK", "ISK", "BRL", "ARS",
  "CLP", "COP", "PEN", "CRC", "ZAR", "MAD", "EGP",
];

export const ALL_CURRENCIES: string[] = Object.keys(table).sort();

export function isKnownCurrency(code: string): boolean {
  return code in table;
}

/** Lower-case region code for flag-icons ("jp", "eu"). */
export function flagCode(currency: string): string | null {
  return table[currency]?.toLowerCase() ?? null;
}

let regionNames: Intl.DisplayNames | null = null;

export function countryName(currency: string): string {
  if (labels[currency]) return labels[currency];
  const region = table[currency];
  if (!region) return currency;
  regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
  return regionNames.of(region) ?? region;
}

export function currencyName(currency: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Countries get one of 8 validated, colorblind-safe colors (CSS variables --series-1 … --series-8, defined for
 * light and dark mode in globals.css), assigned in the order countries first appear in the trip.
 * Colors are never reused: a 9th country or later is gray ("other") and is identified by its flag and name.
 */
export const SERIES_SLOTS = 8;

export function countrySlots(currenciesInOrder: string[]): Record<string, number> {
  const slots: Record<string, number> = {};
  let next = 1;
  for (const c of currenciesInOrder) {
    if (slots[c] === undefined) slots[c] = next <= SERIES_SLOTS ? next++ : 0;
  }
  return slots;
}

export function slotColor(slot: number | undefined): string {
  return slot ? `var(--series-${slot})` : "var(--series-other)";
}
