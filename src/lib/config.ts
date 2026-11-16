/** All settings come from environment variables (see .env.example). */
export const config = {
  /** Shared password that unlocks the app (checked case-insensitively). */
  password: process.env.APP_PASSWORD ?? "Steven",
  person1: process.env.PERSON_1_NAME ?? "Steven",
  person2: process.env.PERSON_2_NAME ?? "Partner",
  /**
   * The currency all balances are settled in. Every entry stores its exchange rate to this currency,
   * so don't change it once entries exist.
   */
  homeCurrency: (process.env.HOME_CURRENCY ?? "USD").toUpperCase(),
  /** Postgres connection string. Vercel's Neon integration sets DATABASE_URL (and POSTGRES_URL). */
  databaseUrl: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
  /** Frankfurter (European Central Bank reference rates). Free, no API key. */
  ratesApiBase: process.env.RATES_API_BASE ?? "https://api.frankfurter.dev/v1",
  /**
   * Fallback for currencies the ECB doesn't publish: currency-api (free, no key), on two mirrors.
   * {date} is YYYY-MM-DD or "latest"; {code} is the lower-case currency code.
   */
  marketRatesUrls: process.env.MARKET_RATES_URL
    ? [process.env.MARKET_RATES_URL]
    : [
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/{code}.min.json",
        "https://{date}.currency-api.pages.dev/v1/currencies/{code}.min.json",
      ],
};

export type People = { p1: string; p2: string };
export const people: People = { p1: config.person1, p2: config.person2 };
