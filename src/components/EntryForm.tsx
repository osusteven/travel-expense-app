"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Decimal from "decimal.js";
import { saveEntryAction, type SaveState } from "@/app/actions";
import type { People } from "@/lib/config";
import { CurrencyPicker, type CurrencyOption } from "./CurrencyPicker";
import {
  type Entry,
  type EntryKind,
  PAYMENT_METHODS,
  type PersonKey,
  type SplitMode,
  entryEffect,
  methodLabel,
  other,
  rateSourceLabel,
} from "@/lib/ledger";
import { currencyExponent, formatMoney, formatRate, parseDecimal, plainAmount, toMinor } from "@/lib/money";

type RateState = {
  rate: string;
  source: Entry["rateSource"];
  rateDate: string;
  status: "idle" | "loading" | "error";
  message?: string;
};

/** A published rate (ECB or market) used to sanity-check a rate typed by hand. */
type Reference = { rate: string; source: "ecb" | "market"; rateDate: string; currency: string; date: string };

/** Hand-entered rates further than this from the published rate get a warning. */
const RATE_TOLERANCE = 0.05;
/** Amounts above this (in the home currency) ask for confirmation. */
const LARGE_AMOUNT = 10_000;

const noSubscribe = () => () => {};
const utcToday = () => new Date().toISOString().slice(0, 10);

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function EntryForm({
  tripId,
  people,
  homeCurrency,
  currencies,
  defaultCurrency,
  defaultPaidBy = "p1",
  balanceBefore = 0,
  entry,
}: {
  /** The trip new entries are added to. */
  tripId?: string;
  people: People;
  homeCurrency: string;
  /** Currencies for the dropdown (the enabled ones from Settings), most useful first. */
  currencies: CurrencyOption[];
  defaultCurrency: string;
  /** Who's selected under "Paid by" for a new entry: whoever this device picked last time. */
  defaultPaidBy?: PersonKey;
  /**
   * The trip's balance without this entry (home currency minor units; positive = person 2 owes person 1).
   * Used to describe what a payment does.
   */
  balanceBefore?: number;
  /** Present when editing. */
  entry?: Entry;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveEntryAction, { errors: {} });

  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? "expense");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [method, setMethod] = useState<string>(entry?.method ?? "");
  const [pickedDate, setDate] = useState(entry?.date ?? "");
  // New entries default to today in the browser's time zone (the server only knows UTC).
  const today = useSyncExternalStore(noSubscribe, localToday, utcToday);
  const date = pickedDate || today;
  const [amount, setAmount] = useState(entry ? plainAmount(entry.amountMinor, entry.currency) : "");
  const [currency, setCurrency] = useState(entry?.currency ?? defaultCurrency);
  const [paidBy, setPaidBy] = useState<PersonKey>(entry?.paidBy ?? defaultPaidBy);
  const [split, setSplit] = useState<SplitMode>(entry && entry.kind === "expense" ? entry.split : "equal");
  const [p1Share, setP1Share] = useState(
    entry?.p1ShareMinor != null ? plainAmount(entry.p1ShareMinor, entry.currency) : "",
  );
  const [rateMode, setRateMode] = useState<"rate" | "charged">(entry?.homeAmountMinor != null ? "charged" : "rate");
  const [homeAmount, setHomeAmount] = useState(
    entry?.homeAmountMinor != null ? plainAmount(entry.homeAmountMinor, homeCurrency) : "",
  );
  const [rate, setRate] = useState<RateState>({
    rate: entry && entry.currency !== homeCurrency ? entry.rate : "",
    source: entry?.rateSource ?? "manual",
    rateDate: entry?.rateDate ?? "",
    status: "idle",
  });
  const [reference, setReference] = useState<Reference | null>(
    entry && (entry.rateSource === "ecb" || entry.rateSource === "market")
      ? { rate: entry.rate, source: entry.rateSource, rateDate: entry.rateDate ?? entry.date, currency: entry.currency, date: entry.date }
      : null,
  );

  // ---- Errors: shown until the field is changed; only for fields that apply to what's on screen. ----
  const [cleared, setCleared] = useState<{ state: SaveState; keys: string[] }>({ state, keys: [] });
  const clearedKeys = cleared.state === state ? cleared.keys : [];
  const touch = (key: string) =>
    setCleared((c) => ({ state, keys: [...(c.state === state ? c.keys : []), key] }));
  const foreign = currency !== homeCurrency;
  const applies: Record<string, boolean> = {
    description: kind === "expense",
    p1Share: kind === "expense" && split === "custom",
    rate: foreign && rateMode === "rate",
    homeAmount: foreign && rateMode === "charged",
  };
  const err = (key: string) => (clearedKeys.includes(key) || applies[key] === false ? undefined : state.errors[key]);
  const anyError = Object.keys(state.errors).some((k) => err(k));

  // ---- Exchange rate lookup ----
  // When the currency or date changes, look up the published rate. It fills the field unless the person typed a
  // rate (or is editing a saved entry); either way it's kept as a reference to check hand-entered rates against.
  const keepRate = useRef(!!entry);
  const rateTyped = useRef(false);
  async function fetchRate(force = false) {
    if (!foreign || !date) return;
    const fill = force || (!rateTyped.current && !keepRate.current);
    keepRate.current = false;
    if (fill) setRate((r) => ({ ...r, status: "loading", message: undefined }));
    try {
      const res = await fetch(`/api/rate?from=${currency}&date=${date}`);
      const data = await res.json();
      if (data.ok && data.source !== "same") {
        setReference({ rate: data.rate, source: data.source, rateDate: data.rateDate, currency, date });
        if (fill) {
          rateTyped.current = false;
          setRate({ rate: data.rate, source: data.source, rateDate: data.rateDate, status: "idle" });
          touch("rate");
        }
      } else if (fill) {
        setRate((r) => ({ ...r, source: "manual", status: "error", message: data.error }));
      }
    } catch {
      if (fill) setRate((r) => ({ ...r, source: "manual", status: "error", message: "Couldn't fetch a rate. Enter it manually." }));
    }
  }
  useEffect(() => {
    // Next tick (also skips intermediate values while a date is being typed).
    const t = setTimeout(() => void fetchRate(), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, date]);

  // ---- Derived values ----
  const amountDec = parseDecimal(amount);
  const amountMinor = amountDec && amountDec.gt(0) ? toMinor(amountDec, currency) : null;
  const rateDec = parseDecimal(rate.rate);
  const shareDec = parseDecimal(p1Share);
  const shareMinor = shareDec ? toMinor(shareDec, currency) : null;
  const customInvalid =
    kind === "expense" && split === "custom" && (shareMinor == null || shareMinor < 0 || amountMinor == null || shareMinor > amountMinor);

  // How far a hand-entered rate is from the published one (only when it's the same currency and day).
  const refApplies = reference && reference.currency === currency && reference.date === date;
  const deviation =
    foreign && rateMode === "rate" && rate.source === "manual" && refApplies && rateDec && rateDec.gt(0)
      ? rateDec.div(reference.rate).minus(1).toNumber()
      : null;
  const rateOff = deviation != null && Math.abs(deviation) > RATE_TOLERANCE;

  // Live preview of what this entry does to the balance (hidden while the input is invalid).
  const preview = (() => {
    if (amountMinor == null || customInvalid) return null;
    let homeAmountMinor: number | null = null;
    let r = "1";
    if (foreign) {
      if (rateMode === "charged") {
        const h = parseDecimal(homeAmount);
        homeAmountMinor = h && h.gt(0) ? toMinor(h, homeCurrency) : null;
        if (homeAmountMinor == null) return null;
      } else {
        if (!rateDec || rateDec.lte(0)) return null;
        r = rateDec.toFixed();
      }
    }
    const fake: Entry = {
      id: "", tripId: "", method: null, kind, date, description: "", amountMinor, currency, rate: r, rateSource: "manual",
      rateDate: null, homeAmountMinor, paidBy, split: kind === "payment" ? "other" : split,
      p1ShareMinor: kind === "expense" && split === "custom" ? shareMinor : null, notes: "", createdAt: "", updatedAt: "",
    };
    return entryEffect(fake, homeCurrency);
  })();

  const name = (p: PersonKey) => people[p];
  const owes = (balance: number) =>
    balance === 0 ? "all square" : `${name(balance > 0 ? "p2" : "p1")} owes ${name(balance > 0 ? "p1" : "p2")} ${formatMoney(Math.abs(balance), homeCurrency)}`;
  const p2ShareText = amountDec && shareDec ? amountDec.minus(shareDec).toFixed() : "";

  // ---- Submit: confirm unusual values first, then save without React resetting the form. ----
  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const warnings: string[] = [];
    if (preview && preview.home > LARGE_AMOUNT * 10 ** currencyExponent(homeCurrency)) {
      warnings.push(`This is a large amount: ${formatMoney(preview.home, homeCurrency)}.`);
    }
    const ahead = daysBetween(today, date);
    if (ahead > 1) warnings.push(`The date is ${ahead} days in the future (${date}).`);
    if (rateOff && reference) {
      warnings.push(
        `The exchange rate you entered (1 ${currency} = ${formatRate(rate.rate)} ${homeCurrency}) is ` +
          `${howFar(deviation!, `the published rate (${formatRate(reference.rate)})`)}.`,
      );
    }
    if (warnings.length && !confirm(`${warnings.join("\n\n")}\n\nSave anyway?`)) return;
    const data = new FormData(ev.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {entry && <input type="hidden" name="id" value={entry.id} />}
      {tripId && <input type="hidden" name="tripId" value={tripId} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="paidBy" value={paidBy} />
      <input type="hidden" name="rateSource" value={foreign ? rate.source : "same"} />
      <input type="hidden" name="rateDate" value={rate.rateDate} />
      <input type="hidden" name="rateMode" value={rateMode} />

      <Segmented
        label="Type"
        value={kind}
        onChange={(v) => setKind(v as EntryKind)}
        options={[
          { value: "expense", label: "Expense" },
          { value: "payment", label: "Payment / cash given" },
        ]}
      />

      <div className={`grid gap-4 ${kind === "expense" ? "sm:grid-cols-[1fr_10rem]" : "sm:grid-cols-[10rem]"}`}>
        {kind === "expense" ? (
          <Field label="What was it?" error={err("description")}>
            <input
              name="description"
              value={description}
              onChange={(ev) => {
                setDescription(ev.target.value);
                touch("description");
              }}
              placeholder="e.g. Dinner in Kyoto"
              aria-invalid={!!err("description")}
              className="input"
              maxLength={200}
            />
          </Field>
        ) : (
          // Payments use the note field below; the title ("Payment", "Settled up"…) is kept as it was.
          <input type="hidden" name="description" value={description} />
        )}
        <Field label="Date" error={err("date")}>
          <input
            type="date"
            name="date"
            value={date}
            onChange={(ev) => {
              setDate(ev.target.value);
              touch("date");
            }}
            aria-invalid={!!err("date")}
            className="input"
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_minmax(9rem,13rem)]">
        <Field label="Amount" error={err("amount")}>
          <input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(ev) => {
              setAmount(ev.target.value);
              touch("amount");
            }}
            placeholder="0.00"
            aria-invalid={!!err("amount")}
            className="input"
          />
        </Field>
        <Field label="Currency" error={err("currency")} asDiv>
          <CurrencyPicker
            name="currency"
            value={currency}
            options={currencies}
            onChange={(code) => {
              rateTyped.current = false;
              setCurrency(code);
              touch("currency");
              touch("amount");
            }}
          />
        </Field>
      </div>

      {foreign && (
        <div className="space-y-3 rounded-lg border border-line bg-subtle p-3">
          <div role="radiogroup" aria-label="How to convert" className="flex flex-wrap gap-x-4 text-sm">
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="rateChoice" checked={rateMode === "rate"} onChange={() => setRateMode("rate")} />
              Use exchange rate
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="rateChoice" checked={rateMode === "charged"} onChange={() => setRateMode("charged")} />
              I know the {homeCurrency} amount charged
            </label>
          </div>
          {rateMode === "rate" ? (
            <Field label={`1 ${currency} = ? ${homeCurrency}`} error={err("rate")}>
              <div className="flex gap-2">
                <input
                  name="rate"
                  inputMode="decimal"
                  autoComplete="off"
                  value={rate.rate}
                  onChange={(ev) => {
                    rateTyped.current = true;
                    setRate({ ...rate, rate: ev.target.value, source: "manual", status: "idle", message: undefined });
                    touch("rate");
                  }}
                  aria-invalid={!!err("rate") || rateOff}
                  className="input"
                />
                <button type="button" onClick={() => fetchRate(true)} className="btn-secondary whitespace-nowrap">
                  {rate.status === "loading" ? "Fetching…" : "Get rate"}
                </button>
              </div>
              <p className={`mt-1 text-xs ${rate.status === "error" ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
                {rate.status === "error" ? rate.message : rate.rate ? rateSourceLabel(rate.source, rate.rateDate) : ""}
                {rateDec && rateDec.gt(0) && rate.status !== "error" && (
                  <> · 1 {homeCurrency} = {inverse(rateDec)} {currency}</>
                )}
              </p>
              {rateOff && reference && (
                <p role="alert" className="mt-2 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  ⚠ This rate is{" "}
                  {howFar(deviation!, `the ${reference.source === "ecb" ? "European Central Bank" : "market"} rate for ${reference.rateDate}`)}{" "}
                  (1 {currency} = {formatRate(reference.rate)} {homeCurrency}). Check it before saving.
                </p>
              )}
            </Field>
          ) : (
            <Field label={`Amount charged in ${homeCurrency}`} error={err("homeAmount")}>
              <input
                name="homeAmount"
                inputMode="decimal"
                autoComplete="off"
                value={homeAmount}
                onChange={(ev) => {
                  setHomeAmount(ev.target.value);
                  touch("homeAmount");
                }}
                placeholder="From your card or bank statement"
                aria-invalid={!!err("homeAmount")}
                className="input"
              />
              <p className="mt-1 text-xs text-muted">
                Most accurate: includes your bank&apos;s actual rate and fees.
                {(() => {
                  const h = parseDecimal(homeAmount);
                  return amountDec && h && amountDec.gt(0) && h.gt(0)
                    ? ` Effective rate: 1 ${currency} = ${formatRate(h.div(amountDec).toSignificantDigits(12).toFixed())} ${homeCurrency}.`
                    : "";
                })()}
              </p>
            </Field>
          )}
        </div>
      )}

      <Segmented
        label={kind === "payment" ? "Who gave the money?" : "Paid by"}
        value={paidBy}
        onChange={(v) => setPaidBy(v as PersonKey)}
        options={[
          { value: "p1", label: people.p1 },
          { value: "p2", label: people.p2 },
        ]}
      />

      {kind === "expense" ? (
        <fieldset>
          <legend className="label mb-1">Split</legend>
          <input type="hidden" name="split" value={split} />
          <div role="radiogroup" aria-label="Split" className="grid gap-1.5 sm:grid-cols-2">
            {(
              [
                ["equal", "Split 50 / 50"],
                ["custom", "Custom amounts"],
                ["payer", `No split: ${name(paidBy)}'s own`],
                ["other", `No split: all for ${name(other(paidBy))}`],
              ] as [SplitMode, string][]
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-11 items-center gap-2 rounded-md border border-line px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10"
              >
                <input
                  type="radio"
                  name="splitChoice"
                  value={value}
                  aria-label={label}
                  checked={split === value}
                  onChange={() => {
                    setSplit(value);
                    touch("split");
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          {split === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Field label={`${people.p1}'s share (${currency})`} error={err("p1Share")}>
                <input
                  name="p1Share"
                  inputMode="decimal"
                  autoComplete="off"
                  value={p1Share}
                  onChange={(ev) => {
                    setP1Share(ev.target.value);
                    touch("p1Share");
                  }}
                  aria-invalid={!!err("p1Share")}
                  className="input"
                />
              </Field>
              <Field label={`${people.p2}'s share (${currency})`}>
                <input value={customInvalid ? "" : p2ShareText} readOnly tabIndex={-1} className="input opacity-70" />
              </Field>
            </div>
          )}
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="split" value="other" />
          <Field label="Paid with">
            <select name="method" value={method} onChange={(ev) => setMethod(ev.target.value)} className="input">
              <option value="">Not specified</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {methodLabel[m]}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      <Field label={kind === "payment" ? "Note or reference (optional)" : "Notes (optional)"}>
        <textarea
          name="notes"
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
          placeholder={kind === "payment" ? "e.g. Paid back for the hotel, Venmo note" : ""}
          rows={2}
          className="input"
          maxLength={1000}
        />
      </Field>

      {preview && (
        <div className="rounded-md bg-accent/10 px-3 py-2 text-sm">
          {kind === "payment" ? (
            <PaymentPreview
              payer={paidBy}
              amount={preview.home}
              before={balanceBefore}
              after={balanceBefore + preview.balanceDelta}
              name={name}
              owes={owes}
              money={(m) => formatMoney(m, homeCurrency)}
            />
          ) : (
            <p>
              {foreign && <>{formatMoney(preview.home, homeCurrency)} · </>}
              {preview.balanceDelta === 0
                ? "Nobody owes anything for this"
                : `${name(other(paidBy))} owes ${name(paidBy)} ${formatMoney(Math.abs(preview.balanceDelta), homeCurrency)}`}
            </p>
          )}
        </div>
      )}

      {/* "Please fix the highlighted fields" disappears once they're all fixed; other messages stay. */}
      {state.message && (anyError || !Object.keys(state.errors).length) && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
        {pending ? "Saving…" : entry ? "Save changes" : "Add entry"}
      </button>
    </form>
  );
}

/** Says what a payment does to the actual trip balance (it may not reduce anything). */
function PaymentPreview({
  payer,
  amount,
  before,
  after,
  name,
  owes,
  money,
}: {
  payer: PersonKey;
  amount: number;
  before: number;
  after: number;
  name: (p: PersonKey) => string;
  owes: (balance: number) => string;
  money: (minor: number) => string;
}) {
  const payee = other(payer);
  // payer owes now if the balance points from payer to payee
  const payerOwes = payer === "p2" ? before > 0 : before < 0;
  const debt = Math.abs(before);
  return (
    <div className="space-y-1">
      <p>
        {name(payer)} gives {name(payee)} {money(amount)}.
      </p>
      {payerOwes ? (
        amount <= debt ? (
          <p>
            Reduces what {name(payer)} owes from {money(debt)} to {money(debt - amount)}
            {after === 0 && " ✓ settled"}.
          </p>
        ) : (
          <p className="font-medium text-amber-700 dark:text-amber-300">
            That&apos;s {money(amount - debt)} more than the {money(debt)} {name(payer)} owes. After this, {owes(after)}.
          </p>
        )
      ) : (
        <p className="font-medium text-amber-700 dark:text-amber-300">
          {name(payer)} doesn&apos;t owe {name(payee)} anything right now
          {before !== 0 && ` (${owes(before)})`}, so after this {owes(after)}.
        </p>
      )}
    </div>
  );
}

/** "6%" for small differences, "about 32,751 times" for huge ones (easier to read than 3,275,009%). */
const pct = (d: number) => `${Math.round(Math.abs(d) * 100).toLocaleString("en-US")}%`;
function howFar(d: number, what: string): string {
  if (d >= 9) return `about ${Math.round(d + 1).toLocaleString("en-US")} times ${what}`;
  if (d <= -0.9) return `about 1/${Math.round(1 / (1 + d)).toLocaleString("en-US")} of ${what}`;
  return `${pct(d)} ${d > 0 ? "higher" : "lower"} than ${what}`;
}

/** "1 USD = 21,834 LAK" style inverse, rounded sensibly. */
function inverse(rate: Decimal): string {
  const inv = new Decimal(1).div(rate);
  return inv.gte(100)
    ? inv.toDecimalPlaces(0).toNumber().toLocaleString("en-US")
    : inv.toSignificantDigits(6).toNumber().toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function Field({
  label,
  error,
  children,
  asDiv = false,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  /** For fields whose control is itself a button (a label can't wrap it). */
  asDiv?: boolean;
}) {
  const Tag = asDiv ? "div" : "label";
  return (
    <Tag className={`block ${error ? "field-invalid" : ""}`}>
      <span className="label">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
    </Tag>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div role="radiogroup" aria-label={label} className="mt-1 grid auto-cols-fr grid-flow-col overflow-hidden rounded-md border border-line">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 px-3 py-2 text-sm font-medium transition-colors ${
              value === o.value ? "bg-accent text-white" : "hover:bg-subtle"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
