# TravelSplit

An Android app for tracking shared travel expenses between two people, similar to Tricount.

## Features

- **Trips**: each trip has two people and a main currency that balances are shown in.
- **Any currency**: record each expense in the currency you paid in. The exchange rate is filled in automatically:
  the last rate you used for that currency on the trip, or otherwise the latest
  [ECB reference rate](https://frankfurter.app) (about 30 major currencies). You can always edit it by hand,
  so the app works offline. The rate is saved with each expense, so later rate changes don't alter past balances.
- **Split options** for each expense:
  - Split equally (50/50)
  - Split by custom amounts
  - No split: only for the payer (tracked in the totals, nobody owes anything)
  - No split: only for the other person (they owe the full amount)
- **Money given**: record cash handed over or a repayment between the two people.
- **Balance**: who owes whom, total trip cost, what each person paid, each person's share, and spending per currency.
  "Record settlement" adds the repayment that brings the balance to zero.
- **Share**: send a plain-text summary of the trip and all its expenses.

All data is stored on the device (Room / SQLite). No account is needed.

## Project structure

| Module | What it contains |
|---|---|
| `core/` | Pure Kotlin: the split and balance math, money rounding and parsing. Unit tested, no Android dependency. |
| `app/`  | The Android app: Jetpack Compose UI (Material 3), Room database, exchange-rate fetching. |

Amounts are stored as exact decimals (`BigDecimal`) and rounded to each currency's own number of decimals
(for example 0 for JPY), so there are no floating-point errors.

## Building

Requirements: JDK 17+ and the Android SDK (Android Studio installs it).

- **Android Studio**: open the project folder and press Run.
- **Command line**: `./gradlew :app:assembleDebug`. The APK is written to `app/build/outputs/apk/debug/`.
- **Core tests only** (no Android SDK needed): `SKIP_ANDROID=1 ./gradlew :core:test`

Each push also builds the debug APK in GitHub Actions. You can download it from the run's **Artifacts** section.
