import { isValidCurrency } from "@/lib/money";
import { lookupRate } from "@/lib/rates";
import { isSignedIn } from "@/lib/session";

/** GET /api/rate?from=JPY&date=2026-10-05 → { ok, rate, rateDate, source } or { ok: false, error } */
export async function GET(request: Request) {
  if (!(await isSignedIn())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const from = (url.searchParams.get("from") ?? "").toUpperCase();
  const date = url.searchParams.get("date") ?? "";
  if (!isValidCurrency(from) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ ok: false, error: "Invalid currency or date" }, { status: 400 });
  }
  return Response.json(await lookupRate(from, date));
}
