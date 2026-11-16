"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

/** Saves this device's appearance choice (no password needed: it only affects this browser). */
export async function setThemeAction(theme: string) {
  const value = parseTheme(theme);
  const jar = await cookies();
  if (value === "system") jar.delete(THEME_COOKIE);
  else jar.set(THEME_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365 * 2, sameSite: "lax" });
}
