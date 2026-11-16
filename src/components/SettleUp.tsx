"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { settleUpAction, type SettleState } from "@/app/actions";
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
  fromName,
  toName,
  amount,
  homeCurrency,
  toVenmo,
}: {
  tripId: string;
  tripName: string;
  from: PersonKey;
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
        className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-900 shadow-md transition hover:bg-white/90"
      >
        Settle up
      </button>
    );
  }

  return (
    <form action={action} className="mx-auto mt-1 max-w-md space-y-3 rounded-2xl bg-white p-4 text-left text-gray-900 shadow-xl">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="from" value={from} />
      <p className="text-sm font-semibold">
        {fromName} pays {toName}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-gray-500">
          Amount ({homeCurrency})
          <input
            name="amount"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 sm:text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-gray-500">
          Date paid
          <input
            type="date"
            name="date"
            value={date || today}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 sm:text-sm"
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-500">
        Paid with
        <select
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {methodLabel[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-gray-500">
        Note or reference (optional)
        <input
          name="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. Venmo note or confirmation number"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 sm:text-sm"
        />
      </label>
      {method === "venmo" &&
        (venmoUrl ? (
          <a
            href={venmoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg bg-[#008cff] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Open Venmo to pay @{toVenmo}
          </a>
        ) : (
          <p className="text-xs text-gray-500">
            {homeCurrency === "USD"
              ? `Add ${toName}'s Venmo username in Settings to open Venmo with this payment filled in.`
              : "Venmo only works in USD."}
          </p>
        ))}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          {pending ? "Saving…" : "Record payment"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
          Cancel
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Record it once the money has been sent. The full amount brings this trip to {homeCurrency === "USD" ? "$0" : "zero"}.
      </p>
    </form>
  );
}
