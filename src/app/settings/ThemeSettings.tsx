"use client";

import { useState, useTransition } from "react";
import { setThemeAction } from "@/app/theme-actions";
import type { Theme } from "@/lib/theme";

const options: { value: Theme; label: string; icon: string; hint: string }[] = [
  { value: "system", label: "System", icon: "🖥️", hint: "Follow this device's setting" },
  { value: "light", label: "Light", icon: "☀️", hint: "Always light" },
  { value: "dark", label: "Dark", icon: "🌙", hint: "Always dark" },
];

/** Switches the page's colors right away, without waiting for a reload. */
function applyTheme(value: Theme) {
  const html = document.documentElement;
  if (value === "system") html.removeAttribute("data-theme");
  else html.setAttribute("data-theme", value);
}

export function ThemeSettings({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [, startTransition] = useTransition();

  function choose(value: Theme) {
    setTheme(value);
    // Apply instantly, then remember it for this device.
    applyTheme(value);
    startTransition(() => setThemeAction(value));
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => choose(o.value)}
          className={`rounded-xl border p-3 text-left transition ${
            theme === o.value ? "border-accent bg-accent/10 ring-2 ring-accent/30" : "border-line hover:border-accent/50"
          }`}
        >
          <span aria-hidden className="text-xl">{o.icon}</span>
          <span className="mt-1 block text-sm font-semibold">{o.label}</span>
          <span className="block text-xs text-muted">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}
