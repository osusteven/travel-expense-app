import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, isValidToken } from "./auth";

export async function isSignedIn(): Promise<boolean> {
  return isValidToken((await cookies()).get(AUTH_COOKIE)?.value);
}

/** Call at the top of every page, server action and route handler that touches data. */
export async function requireAuth(): Promise<void> {
  if (!(await isSignedIn())) redirect("/login");
}
