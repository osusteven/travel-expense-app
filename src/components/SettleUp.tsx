"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { settleUpAction, type SettleState } from "@/app/actions";
import { parseDecimal } from "@/lib/money";
import { Avatar } from "./Avatar";
import { PAYMENT_METHODS, type PaymentMethod, type PersonKey, methodLabel } from "@/lib/ledger";

const noSubscribe = () => () => {};
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const utcToday = () => new Date().toISOString().slice(0, 10);

/**
 * Records a payment that settles the trip. Prefilled with the full balance (which brings it to $0),
 * but any amount can be entered for a partial payment.
 */
export function SettleUp({
  tripId,
  tripName,
  from,
  people,
  photos = {},
  fromName,
  toName,
  amount,
  homeCurrency,
  toVenmo,
}: {
  tripId: string;
  tripName: string;
  from: PersonKey;
  /** Both names, to show person 1 on the left and person 2 on the right. */
  people: Record<PersonKey, string>;
  photos?: Partial<Record<PersonKey, string>>;
  fromName: string;
  toName: string;
  /** Plain decimal string of the full balance, e.g. "737.15". */
  amount: string;
  homeCurrency: string;
  /** The creditor's Venmo username, if set in Settings. */
  toVenmo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SettleState, FormData>(settleUpAction, {});
  const today = useSyncExternalStore(noSubscribe, localToday, utcToday);
  const [value, setValue] = useState(amount);
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<PaymentMethod>(toVenmo ? "venmo" : "cash");
  const [reference, setReference] = useState(`${tripName}: settling up`);

  // Venmo opens with the recipient, amount and note filled in (USD only).
  const venmoUrl =
    toVenmo && homeCurrency === "USD"
      ? `https://venmo.com/${encodeURIComponent(toVenmo)}?txn=pay&amount=${encodeURIComponent(value)}&note=${encodeURIComponent(reference)}`
      : null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-900 shadow-md transition hover:bg-white/90"
      >
        Settle up
      </button>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Paying more than is owed flips the debt; make sure that's intended.
        const paid = parseDecimal(value);
        const owed = parseDecimal(amount);
        if (paid && owed && paid.gt(owed)) {
          const extra = paid.minus(owed).toFixed(2);
          if (!confirm(`That's ${extra} ${homeCurrency} more than the ${amount} ${homeCurrency} ${fromName} owes. After this, ${toName} would owe ${fromName} ${extra} ${homeCurrency}.\n\nRecord it anyway?`)) {
            e.preventDefault();
          }
        }
      }}
      className="mx-auto mt-1 max-w-md space-y-3 rounded-2xl border border-line bg-card p-4 text-left text-foreground shadow-xl"
    >
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="from" value={from} />
      {/* Same order as everywhere else: person 1 (red) left, person 2 (blue) right; the arrow shows who pays whom. */}
      <div className="flex items-center gap-2" aria-hidden>
        <Avatar person="p1" name={people.p1} photo={photos.p1} size={32} />
        <span className="flex-1 border-t-2 border-dashed border-line" />
        <span className="text-lg font-bold text-muted">{from === "p1" ? "→" : "←"}</span>
        <span className="flex-1 border-t-2 border-dashed border-line" />
        <Avatar person="p2" name={people.p2} photo={photos.p2} size={32} />
      </div>
      <p className="text-center text-sm font-semibold">
        {fromName} pays {toName}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted">
          Amount ({homeCurrency})
          <input
            name="amount"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input mt-1"
          />
        </label>
        <label className="block text-xs font-medium text-muted">
          Date paid
          <input
            type="date"
            name="date"
            value={date || today}
            onChange={(e) => setDate(e.target.value)}
            className="input mt-1"
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-muted">
        Paid with
        <select
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          className="input mt-1"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {methodLabel[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-muted">
        Note or reference (optional)
        <input
          name="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. Venmo note or confirmation number"
          className="input mt-1"
        />
      </label>
      {method === "venmo" &&
        (venmoUrl ? (
          <a
            href={venmoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#008cff] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Open Venmo to pay @{toVenmo}
          </a>
        ) : (
          <p className="text-xs text-muted">
            {homeCurrency === "USD"
              ? `Add ${toName}'s Venmo username in Settings to open Venmo with this payment filled in.`
              : "Venmo only works in USD."}
          </p>
        ))}
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          {pending ? "Saving…" : "Record payment"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle">
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted">
        Record it once the money has been sent. Paying the full {amount} {homeCurrency} settles the trip; less is
        recorded as a partial payment.
      </p>
    </form>
  );
}
