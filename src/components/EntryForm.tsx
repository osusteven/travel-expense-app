"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveEntryAction, type SaveState } from "@/app/actions";
import type { People } from "@/lib/config";
import { CurrencyPicker, type CurrencyOption } from "./CurrencyPicker";
import { type Entry, type EntryKind, type PersonKey, type SplitMode, entryEffect, other } from "@/lib/ledger";
import { formatMoney, formatRate, parseDecimal, plainAmount, toMinor } from "@/lib/money";

type RateState = {
  rate: string;
  source: Entry["rateSource"];
  rateDate: string;
  status: "idle" | "loading" | "error";
  message?: string;
};

const noSubscribe = () => () => {};
const utcToday = () => new Date().toISOString().slice(0, 10);

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function EntryForm({
  people,
  homeCurrency,
  currencies,
  defaultCurrency,
  entry,
}: {
  people: People;
  homeCurrency: string;
  /** Currencies for the dropdown (the enabled ones from Settings), most useful first. */
  currencies: CurrencyOption[];
  defaultCurrency: string;
  /** Present when editing. */
  entry?: Entry;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveEntryAction, { errors: {} });
  const e = state.errors;

  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? "expense");
  // All fields are controlled: React resets uncontrolled fields after a form action, even when it returns errors.
  const [description, setDescription] = useState(entry?.description ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [pickedDate, setDate] = useState(entry?.date ?? "");
  // New entries default to today in the browser's time zone (the server only knows UTC).
  const today = useSyncExternalStore(noSubscribe, localToday, utcToday);
  const date = pickedDate || today;
  const [amount, setAmount] = useState(entry ? plainAmount(entry.amountMinor, entry.currency) : "");
  const [currency, setCurrency] = useState(entry?.currency ?? defaultCurrency);
  const [paidBy, setPaidBy] = useState<PersonKey>(entry?.paidBy ?? "p1");
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

  const foreign = currency !== homeCurrency;

  // Look up the exchange rate when the currency or date changes (but keep a stored rate when editing,
  // and never overwrite a rate the person typed in).
  const skipNextLookup = useRef(!!entry);
  const rateTyped = useRef(false);
  async function fetchRate(force = false) {
    if (!foreign || !date || (!force && rateTyped.current)) return;
    setRate((r) => ({ ...r, status: "loading", message: undefined }));
    try {
      const res = await fetch(`/api/rate?from=${currency}&date=${date}`);
      const data = await res.json();
      if (data.ok) {
        rateTyped.current = false;
        setRate({ rate: data.rate, source: data.source, rateDate: data.rateDate, status: "idle" });
      } else {
        setRate((r) => ({ ...r, source: "manual", status: "error", message: data.error }));
      }
    } catch {
      setRate((r) => ({ ...r, source: "manual", status: "error", message: "Couldn't fetch a rate. Enter it manually." }));
    }
  }
  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false;
      return;
    }
    void fetchRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, date]);

  // Live preview of what this entry does to the balance.
  const preview = (() => {
    const a = parseDecimal(amount);
    const amountMinor = a && a.gt(0) ? toMinor(a, currency) : null;
    if (amountMinor == null) return null;
    let homeAmountMinor: number | null = null;
    let r = "1";
    if (foreign) {
      if (rateMode === "charged") {
        const h = parseDecimal(homeAmount);
        homeAmountMinor = h && h.gt(0) ? toMinor(h, homeCurrency) : null;
        if (homeAmountMinor == null) return null;
      } else {
        const pr = parseDecimal(rate.rate);
        if (!pr || pr.lte(0)) return null;
        r = pr.toFixed();
      }
    }
    const share = parseDecimal(p1Share);
    const fake: Entry = {
      id: "", kind, date, description: "", amountMinor, currency, rate: r, rateSource: "manual", rateDate: null,
      homeAmountMinor, paidBy, split: kind === "payment" ? "other" : split,
      p1ShareMinor: share ? toMinor(share, currency) : 0, notes: "", createdAt: "", updatedAt: "",
    };
    return entryEffect(fake, homeCurrency);
  })();

  const name = (p: PersonKey) => people[p];
  const p2ShareText = (() => {
    const a = parseDecimal(amount);
    const s = parseDecimal(p1Share);
    return a && s ? a.minus(s).toFixed() : "";
  })();

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {entry && <input type="hidden" name="id" value={entry.id} />}
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

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label={kind === "payment" ? "Note (optional)" : "What was it?"} error={e.description}>
          <input
            name="description"
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
            placeholder={kind === "payment" ? "e.g. Paid back for hotel" : "e.g. Dinner in Kyoto"}
            className="input"
            maxLength={200}
          />
        </Field>
        <Field label="Date" error={e.date}>
          <input type="date" name="date" value={date} onChange={(ev) => setDate(ev.target.value)} className="input" required />
        </Field>
      </div>

      <div className="grid grid-cols-[1fr_minmax(9rem,13rem)] gap-4">
        <Field label="Amount" error={e.amount}>
          <input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(ev) => setAmount(ev.target.value)}
            placeholder="0.00"
            className="input"
          />
        </Field>
        <Field label="Currency" error={e.currency}>
          <CurrencyPicker
            name="currency"
            value={currency}
            options={currencies}
            onChange={(code) => {
              rateTyped.current = false;
              setCurrency(code);
            }}
          />
        </Field>
      </div>

      {foreign && (
        <div className="space-y-3 rounded-lg border border-line bg-subtle p-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={rateMode === "rate"} onChange={() => setRateMode("rate")} />
              Use exchange rate
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={rateMode === "charged"} onChange={() => setRateMode("charged")} />
              I know the {homeCurrency} amount charged
            </label>
          </div>
          {rateMode === "rate" ? (
            <Field label={`1 ${currency} = ? ${homeCurrency}`} error={e.rate}>
              <div className="flex gap-2">
                <input
                  name="rate"
                  inputMode="decimal"
                  autoComplete="off"
                  value={rate.rate}
                  onChange={(ev) => {
                    rateTyped.current = true;
                    setRate({ ...rate, rate: ev.target.value, source: "manual", status: "idle", message: undefined });
                  }}
                  className="input"
                />
                <button type="button" onClick={() => fetchRate(true)} className="btn-secondary whitespace-nowrap">
                  {rate.status === "loading" ? "Fetching…" : "Get ECB rate"}
                </button>
              </div>
              <p className={`mt-1 text-xs ${rate.status === "error" ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
                {rate.status === "error"
                  ? rate.message
                  : rate.source === "ecb" && rate.rate
                    ? `European Central Bank reference rate for ${rate.rateDate}`
                    : rate.rate
                      ? "Rate entered manually"
                      : ""}
              </p>
            </Field>
          ) : (
            <Field label={`Amount charged in ${homeCurrency}`} error={e.homeAmount}>
              <input
                name="homeAmount"
                inputMode="decimal"
                autoComplete="off"
                value={homeAmount}
                onChange={(ev) => setHomeAmount(ev.target.value)}
                placeholder="From your card or bank statement"
                className="input"
              />
              <p className="mt-1 text-xs text-muted">
                Most accurate: includes your bank&apos;s actual rate and fees.
                {(() => {
                  const a = parseDecimal(amount);
                  const h = parseDecimal(homeAmount);
                  return a && h && a.gt(0) && h.gt(0)
                    ? ` Effective rate: 1 ${currency} = ${formatRate(h.div(a).toSignificantDigits(12).toFixed())} ${homeCurrency}.`
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
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(
              [
                ["equal", "Split 50 / 50"],
                ["custom", "Custom amounts"],
                ["payer", `No split: ${name(paidBy)}'s own`],
                ["other", `No split: all for ${name(other(paidBy))}`],
              ] as [SplitMode, string][]
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                <input type="radio" checked={split === value} onChange={() => setSplit(value)} />
                {label}
              </label>
            ))}
          </div>
          {split === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Field label={`${people.p1}'s share (${currency})`} error={e.p1Share}>
                <input
                  name="p1Share"
                  inputMode="decimal"
                  autoComplete="off"
                  value={p1Share}
                  onChange={(ev) => setP1Share(ev.target.value)}
                  className="input"
                />
              </Field>
              <Field label={`${people.p2}'s share (${currency})`}>
                <input value={p2ShareText} readOnly tabIndex={-1} className="input opacity-70" />
              </Field>
            </div>
          )}
        </fieldset>
      ) : (
        <input type="hidden" name="split" value="other" />
      )}

      <Field label="Notes (optional)">
        <textarea name="notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} rows={2} className="input" maxLength={1000} />
      </Field>

      {preview && (
        <p className="rounded-md bg-accent/10 px-3 py-2 text-sm">
          {foreign && <>{formatMoney(preview.home, homeCurrency)} · </>}
          {kind === "payment" ? (
            <>
              Reduces what {name(paidBy)} owes {name(other(paidBy))} by {formatMoney(preview.home, homeCurrency)}
            </>
          ) : preview.balanceDelta === 0 ? (
            <>Nobody owes anything for this</>
          ) : (
            <>
              {name(other(paidBy))} owes {name(paidBy)}{" "}
              {formatMoney(Math.abs(preview.balanceDelta), homeCurrency)}
            </>
          )}
        </p>
      )}

      {state.message && <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
        {pending ? "Saving…" : entry ? "Save changes" : "Add entry"}
      </button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
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
            className={`px-3 py-2 text-sm font-medium transition-colors ${
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
