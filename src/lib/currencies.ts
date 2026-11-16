const popular = ["USD", "EUR", "GBP", "CAD", "AUD", "MXN", "JPY", "CHF", "CNY", "HKD", "SGD", "THB", "KRW", "INR", "NZD", "SEK", "NOK", "DKK", "CZK", "PLN", "HUF", "TRY", "BRL", "ZAR", "AED", "VND", "IDR", "PHP", "MAD", "ISK"];

/** Home currency and recently used ones first, then popular ones, then every other ISO currency. */
export function currencyOptions(home: string, recent: string[]): string[] {
  const all: string[] = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : popular;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [home, ...recent, ...popular, ...all]) {
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}
