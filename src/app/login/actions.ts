"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, AUTH_MAX_AGE, authToken, checkPassword } from "@/lib/auth";

export async function login(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const password = String(form.get("password") ?? "");
  // Honeypot: a field people never see. Bots that fill in every field get rejected.
  const honeypot = String(form.get("website") ?? "");
  if (honeypot || !checkPassword(password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "That's not it. Try again." };
  }
  (await cookies()).set(AUTH_COOKIE, authToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
