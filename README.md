# Travel Ledger

A small Next.js app for two people (Steven and a travel partner) to record shared expenses in any currency
and see who owes whom.

| Trips | A trip | Settle up |
|---|---|---|
| ![Trips](docs/screenshots/1_trips.png) | ![Trip](docs/screenshots/2_dashboard.png) | ![Settle up](docs/screenshots/settle_up.png) |

| Who owes whom (sides swap) | | Payment in History |
|---|---|---|
| ![McAlnois owes](docs/screenshots/hero_mcalnois_owes.png) | ![Browning owes](docs/screenshots/hero_browning_owes.png) | ![Payment](docs/screenshots/history_payment.png) |

Also: [settings](docs/screenshots/5_settings.png) · [people](docs/screenshots/settings_people.png) · [phone](docs/screenshots/7_mobile.png) · [dark mode](docs/screenshots/8_dark.png)

## What it does

- **Trips.** Each trip has its own entries, balance, history and statistics, and is settled on its own. Each trip
  has its own address made from its name, e.g. `/trips/japan-korea-2026` (renaming changes it). **Trips**
  lists every trip with its dates, countries, total and whether it's settled. The *current* trip (shared by both
  of you) opens by default. Past trips stay viewable, and you can rename or delete them.
- **People.** Upload a photo for each person in **Settings → People**. It's shrunk to a small round icon and used in
  the balance at the top, History and Statistics. Person 1 is red and person 2 is blue. In the balance (and the
  header bar above it), whoever owes is on the left and whoever is owed is on the right, so the sides and colors swap
  when the balance flips. Each person's total sits on their side, with the trip total in the middle.
- **Settle up.** Record a payment with the amount (prefilled with the full balance), date, method (Venmo, cash,
  Zelle, PayPal, bank transfer or other) and a note or reference. History shows it with **✓ Balance: $0.00** when
  it settles the trip. With a Venmo username saved in Settings, **Open Venmo** opens Venmo with the recipient, amount
  and note filled in. Venmo can't tell the app a payment went through, so tap **Record payment** after paying.
- **One form for everything.** Each entry has a description, date, amount and currency, who paid, and how it's split:
  - 50/50
  - custom amounts
  - not split, the payer's own (tracked, but nobody owes anything)
  - not split, all for the other person (they owe the full amount)

  There's also a **Payment / cash given** type for paying each other back.
- **Running balance.** The top of the page shows who owes whom in your home currency. **Record settlement** adds the
  payment that brings it to zero.
- **Editable.** Click any entry to change or delete it. Every create, edit and delete is kept in a change log, shown
  on the entry's page, and deleted entries stay listed, so you can see what changed when you reconcile.
- **History.** Every entry, grouped by day with daily totals, color-coded by country (flag, country name and a color
  bar). Each entry shows who paid, the split, the exchange rate used, notes, what it means for the balance, and the
  running balance after it. Filter by person, country or payments, or search descriptions and notes.
- **Statistics.** Total spent, average per day, the biggest expense, spending by country, spending per day (stacked
  by country, with hover details and a table view), and what each person paid compared with their share.
- **Settings.** Choose which currencies appear in the form. Each currency is shown with its country and flag. The
  form remembers the last currency used on each device.
- **Import.** Load a JSON export or backup, either merging it in or replacing everything. A safety backup is taken
  first.
- **Automatic backups.** See [Backups](#backups) below.
- **Export.** **CSV** opens in Excel, Numbers or Google Sheets. It has one row per entry with the original
  amount, the rate used, the converted amount, each person's share and the running balance. **JSON** is a complete
  backup.
- **Password gate.** See [the password](#the-password) below.

## Handling multiple currencies

The app follows these practices, and they're also good rules if you ever reconcile by hand:

1. **Settle in one home currency.** Every balance is calculated in `HOME_CURRENCY` (USD by default). Pick it once and
   don't change it after you've added entries.
2. **Always record the original amount and currency** exactly as charged (¥84,000, not "$562.80"). The converted
   value is derived from it, so nothing is lost and you can check it against receipts.
3. **Freeze the rate at the time of the expense.** Each entry stores its own rate, the rate's source and the rate's
   date. Converting old expenses at today's rate would shift the balance every day, so it's never done.
4. **Use the rate from the transaction date.** The app looks up the European Central Bank reference rate for that
   date. On weekends and holidays there's no ECB rate, so it uses the previous business day and says so. The ECB only
   covers about 30 major currencies. For the rest (e.g. Laos LAK, Cambodia KHR, Vietnam VND) it uses the free
   [currency-api](https://github.com/fawazahmed0/exchange-api) daily market rates, which cover about 200 currencies,
   and labels them "Market rate". If neither has a rate, you type it in.
5. **Best of all, use what you were actually charged.** Pick "I know the USD amount charged" and enter the amount from
   your card or bank statement. That includes your bank's real rate and any foreign-transaction fees, so the split is
   exactly what left your account. The app works out the effective rate and stores the exact charged amount.
6. **Never use floating-point numbers for money.** Amounts are stored as whole cents (or whole yen, since some
   currencies have 0 or 3 decimals). Rates are exact decimals, and each conversion rounds only once, at the end.
   When a 50/50 split leaves an odd cent, it stays with the payer, so nobody is ever charged more than half.
7. **Settle in one currency at the end.** Pay the balance in the home currency and record it as a payment or with
   **Record settlement**.

## The password

You suggested a password field whose answer is "Steven". That's a sensible way to keep bots out, with a few changes:

- **Asked once per device, not on every entry.** The password unlocks the whole app, including viewing and
  exporting, not just the form. A bot or a stranger who finds the URL shouldn't be able to read your expenses either.
  After you enter it once, a secure cookie keeps that browser unlocked for 180 days. **Lock** signs that device out.
- **Checked on the server, never in the page's code.** A check in the browser could be read or skipped by any bot.
  Every page, form action and API call verifies the cookie.
- **Not case-sensitive**, so "steven" from a phone keyboard works.
- **Changeable without code.** Set `APP_PASSWORD` in your hosting settings. Changing it signs out every device.
- **Extra bot defenses:** a hidden "honeypot" field that only bots fill in, a one-second delay after a wrong
  password, and `noindex` plus `robots.txt` so search engines don't list the site.

This is a speed bump, not real security. Anyone who knows or guesses the password gets in. That's fine for a shared
travel ledger, but use something less guessable than a name if the URL will be shared widely.

## Deploying on Vercel (free for this size)

1. **Import the repository** at [vercel.com/new](https://vercel.com/new) and deploy. The first deploy shows a
   "No database configured" error until step 2 is done.
2. **Add the database.** In the Vercel project, open **Storage → Create Database → Neon (Postgres)**, pick the free
   plan and a region near you, and connect it to the project. This sets `DATABASE_URL` automatically.
3. **Set the other settings** under **Settings → Environment Variables**:
   - `APP_PASSWORD`
   - `PERSON_1_NAME` and `PERSON_2_NAME`
   - `HOME_CURRENCY`
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the new settings take effect. Tables are created automatically on
   first use.

Neon backs the database up for you. The JSON export also works as your own backup.

## Backups

Once a day the app saves a full JSON backup, privately, to **Vercel Blob** storage. That storage is separate from
the database, so a database problem can't take the backups with it. If a backup fails, it's retried every hour until
one succeeds. The last 60 are kept. **Settings** shows when the last backup succeeded and lists the stored backups,
each with **Download** and **Restore** buttons.

One-time setup:

1. **Storage.** In the Vercel project, open **Storage → Create → Blob**, choose **Private** access, and connect it to
   the project. This sets `BLOB_READ_WRITE_TOKEN`.
2. **Secret.** Under **Environment Variables**, add `CRON_SECRET` set to any long random text (for example from a
   password generator). It stops anyone else from triggering backups.
3. **Daily run.** Redeploy. Vercel then calls the backup once a day (`vercel.json`).
4. **Hourly retry** (GitHub Actions, free). In the GitHub repository open **Settings → Secrets and variables →
   Actions**:
   - Add a **secret** `CRON_SECRET` with the same value as in Vercel.
   - Add a **variable** `APP_URL` = `https://travel-expense-app-rho.vercel.app`.

   GitHub only runs scheduled jobs from the repository's **default branch**, so merge this branch into `main` for the
   hourly retry to start. Until then, the Vercel daily run still makes the backup.

To recover after a problem, use **Restore** on a backup, or download one and load it under **Settings → Import** with
**Replace everything**.

## Running it locally

```bash
npm install
npx vercel link                # connect this folder to the Vercel project
npx vercel env pull .env.local # copies DATABASE_URL and the other settings
npm run dev                    # http://localhost:3000
```

This uses the same database as the live site. To keep test data separate, create a Neon branch and point
`DATABASE_URL` at it, or use any local Postgres.

Other commands: `npm test` (unit tests for the money and balance logic), `npm run lint`, `npm run build`.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `APP_PASSWORD` | `Steven` | Shared password (case-insensitive) |
| `PERSON_1_NAME` / `PERSON_2_NAME` | `Steven` / `Partner` | Names shown in the app |
| `HOME_CURRENCY` | `USD` | Currency balances are settled in |
| `DATABASE_URL` | set by Vercel | Postgres connection string (Neon) |
| `BLOB_READ_WRITE_TOKEN` | set by Vercel | Backup storage (Vercel Blob, private) |
| `CRON_SECRET` | | Protects the backup endpoint; same value as the GitHub secret |
| `RATES_API_BASE` | `https://api.frankfurter.dev/v1` | Exchange-rate service (ECB data, no key needed) |
| `MARKET_RATES_URL` | currency-api on jsDelivr, then Cloudflare | Fallback rates for currencies the ECB doesn't cover |
