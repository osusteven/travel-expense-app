"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Flag } from "./Flag";

export type CurrencyOption = { code: string; country: string; name: string };

/** Searchable currency dropdown showing flag, code and country. Submits as a hidden input. */
export function CurrencyPicker({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: CurrencyOption[];
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.code === value);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => `${o.code} ${o.country} ${o.name}`.toLowerCase().includes(q))
    : options;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={root} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Currency: ${value}${current ? `, ${current.country}` : ""}`}
        onClick={() => {
          setOpen((o) => !o);
          setActive(0);
        }}
        className="input flex items-center gap-2 text-left"
      >
        <Flag currency={value} className="shrink-0" />
        <span className="font-semibold">{value}</span>
        <span className="min-w-0 flex-1 truncate text-muted">{current?.country}</span>
        <span aria-hidden className="text-muted">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-card shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[active]) choose(filtered[active].code);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Search currency or country"
            aria-label="Search currency or country"
            aria-controls={listId}
            className="w-full border-b border-line bg-transparent px-3 py-2.5 text-sm outline-none"
          />
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">No match. Enable more currencies in Settings.</li>}
            {filtered.map((o, i) => (
              <li
                key={o.code}
                role="option"
                aria-selected={o.code === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o.code)}
                onMouseEnter={() => setActive(i)}
                className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                  i === active ? "bg-subtle" : ""
                } ${o.code === value ? "font-semibold" : ""}`}
              >
                <Flag currency={o.code} className="shrink-0" />
                <span className="w-10 font-semibold">{o.code}</span>
                <span className="min-w-0 flex-1 truncate">{o.country}</span>
                <span className="hidden truncate text-xs text-muted sm:inline">{o.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
