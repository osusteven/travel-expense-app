import { createHash, timingSafeEqual } from "node:crypto";
import { config } from "./config";

/*
 * A shared password keeps bots and strangers out. It isn't per-person login.
 * Entering it once sets an httpOnly cookie holding a hash of the password, so changing APP_PASSWORD
 * signs every device out.
 */

export const AUTH_COOKIE = "ledger_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export function authToken(): string {
  return createHash("sha256").update(`travel-ledger:v1:${config.password.trim().toLowerCase()}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isValidToken(token: string | undefined): boolean {
  return !!token && safeEqual(token, authToken());
}

export function checkPassword(input: string): boolean {
  return safeEqual(
    createHash("sha256").update(input.trim().toLowerCase()).digest("hex"),
    createHash("sha256").update(config.password.trim().toLowerCase()).digest("hex"),
  );
}
