"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * A moment shown in the viewer's own time zone (the server only knows UTC).
 * The server renders UTC as a fallback; the browser swaps in local time right away.
 */
export function LocalTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = dateOnly ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" };
  const text = useSyncExternalStore(
    noSubscribe,
    () => d.toLocaleString(undefined, opts),
    () => d.toLocaleString("en-US", { ...opts, timeZone: "UTC" }) + (dateOnly ? "" : " UTC"),
  );
  return <time dateTime={iso}>{text}</time>;
}
