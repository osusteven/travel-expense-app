"use client";

import { useRef, useState } from "react";

import type { TabId } from "@/lib/tabs";

type Tab = { id: TabId; label: string; icon: string; badge?: string; content: React.ReactNode };

/** Remembers the open tab in the address (?tab=history) without reloading, so refresh and links keep it. */
function rememberTab(id: TabId) {
  const url = new URL(window.location.href);
  if (id === "add") url.searchParams.delete("tab");
  else url.searchParams.set("tab", id);
  url.searchParams.delete("saved");
  url.searchParams.delete("settled");
  window.history.replaceState(window.history.state, "", url);
}

/**
 * The trip page's main sections as tabs. Every panel stays rendered (just hidden), so a half-filled
 * form or a History filter survives switching tabs.
 */
export function TripTabs({ tabs, initial }: { tabs: Tab[]; initial: TabId }) {
  const [active, setActive] = useState<TabId>(initial);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function select(i: number) {
    const id = tabs[i].id;
    setActive(id);
    rememberTab(id);
    buttons.current[i]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Trip sections"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-card p-1 shadow-sm"
        onKeyDown={(e) => {
          const i = tabs.findIndex((t) => t.id === active);
          if (e.key === "ArrowRight") select((i + 1) % tabs.length);
          else if (e.key === "ArrowLeft") select((i - 1 + tabs.length) % tabs.length);
          else if (e.key === "Home") select(0);
          else if (e.key === "End") select(tabs.length - 1);
          else return;
          e.preventDefault();
        }}
      >
        {tabs.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(i)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition ${
                on ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow" : "text-muted hover:bg-subtle hover:text-foreground"
              }`}
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
              {t.badge && (
                <span className={`rounded-full px-1.5 text-xs ${on ? "bg-white/25" : "bg-subtle"}`}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
          className="pt-4"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
