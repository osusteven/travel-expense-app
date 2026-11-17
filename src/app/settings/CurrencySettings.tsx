"use client";

import { useActionState, useState } from "react";
import { Flag } from "@/components/Flag";
import type { CurrencyOption } from "@/components/CurrencyPicker";
import { saveCurrenciesAction, type ActionResult } from "./actions";

export function CurrencySettings({
  all,
  enabled,
  popular,
  home,
  inUse,
}: {
  all: CurrencyOption[];
  enabled: string[];
  popular: string[];
  home: string;
  /** Currencies that already have entries (shown with a badge). */
  inUse: string[];
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveCurrenciesAction, {});
  const [checked, setChecked] = useState(() => new Set(enabled));
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((o) => `${o.code} ${o.country} ${o.name}`.toLowerCase().includes(q)) : all;

  const set = (codes: Iterable<string>) => setChecked(new Set([home, ...codes]));
  const toggle = (code: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      next.add(home);
      return next;
    });

  return (
    <form action={action} className="space-y-3">
      {[...checked].map((c) => (
        <input key={c} type="hidden" name="currency" value={c} />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search currency or country"
          aria-label="Search currency or country"
          className="input max-w-xs"
        />
        <button type="button" className="btn-secondary" onClick={() => set(popular)}>
          Popular only
        </button>
        <button type="button" className="btn-secondary" onClick={() => set(all.map((o) => o.code))}>
          All
        </button>
        <button type="button" className="btn-secondary" onClick={() => set([])}>
          None
        </button>
        <span className="text-sm text-muted">{checked.size} selected</span>
      </div>
      <ul className="grid max-h-[26rem] grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
        {shown.map((o) => {
          const isHome = o.code === home;
          return (
            <li key={o.code}>
              <label
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle ${
                  checked.has(o.code) ? "" : "opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked.has(o.code)}
                  disabled={isHome}
                  onChange={() => toggle(o.code)}
                  className="accent-[var(--accent)]"
                />
                <Flag currency={o.code} />
                <span className="w-10 font-semibold">{o.code}</span>
                <span className="min-w-0 flex-1 truncate">{o.country}</span>
                {isHome && <span className="chip bg-accent/15 text-accent">home</span>}
                {!isHome && inUse.includes(o.code) && <span className="chip bg-subtle text-muted">used</span>}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save currencies"}
        </button>
        {state.ok && <p className="text-sm text-good">{state.ok}</p>}
        {state.error && <p className="text-sm text-bad">{state.error}</p>}
      </div>
      <p className="text-xs text-muted">
        Unchecked currencies are hidden from the form. Existing entries in them are kept and still count.
      </p>
    </form>
  );
}
