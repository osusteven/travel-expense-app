"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { createTrip, deleteEntry, deleteTrip, getEntry, getTrip, listEntries, listTrips, renameTrip, saveEntry } from "@/lib/db";
import { type Entry, PAYMENT_METHODS, type PaymentMethod, summarize, tripPath } from "@/lib/ledger";
import { parseDecimal, toMinor } from "@/lib/money";
import { requireAuth } from "@/lib/session";
import { LAST_CURRENCY_COOKIE, LAST_PAYER_COOKIE, currentTripId, setCurrentTrip } from "@/lib/settings";
import { type FieldErrors, parseEntryForm } from "@/lib/validate";

export type SaveState = { errors: FieldErrors; message?: string };

const fieldNames = [
  "kind", "date", "description", "amount", "currency", "paidBy", "split", "p1Share",
  "rateMode", "rate", "rateSource", "rateDate", "homeAmount", "notes", "method",
] as const;

/** Creates an entry in a trip, or updates one when the form includes an `id`. */
export async function saveEntryAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireAuth();
  const fields: Record<string, string> = {};
  for (const name of fieldNames) {
    const v = form.get(name);
    if (typeof v === "string") fields[name] = v;
  }
  const parsed = parseEntryForm(fields, config.homeCurrency);
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };

  const id = String(form.get("id") ?? "");
  const now = new Date().toISOString();
  let tripId: string;
  if (id) {
    const existing = await getEntry(id);
    if (!existing) return { errors: {}, message: "This entry no longer exists." };
    tripId = existing.tripId;
    await saveEntry({ ...existing, ...parsed.value, updatedAt: now }, "update");
  } else {
    const trip = await getTrip(String(form.get("tripId") ?? ""));
    if (!trip) return { errors: {}, message: "This trip no longer exists." };
    tripId = trip.id;
    await saveEntry({ ...parsed.value, id: crypto.randomUUID(), tripId, createdAt: now, updatedAt: now }, "create");
    // Remember this device's currency and payer so the next entry starts with them.
    const jar = await cookies();
    const opts = {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax" as const,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };
    jar.set(LAST_CURRENCY_COOKIE, parsed.value.currency, opts);
    jar.set(LAST_PAYER_COOKIE, parsed.value.paidBy, opts);
  }
  revalidatePath("/", "layout");
  const path = tripPath((await getTrip(tripId)) ?? { slug: tripId });
  redirect(id ? `${path}#entry-${id}` : `${path}?saved=1`);
}

export async function deleteEntryAction(form: FormData) {
  await requireAuth();
  const entry = await getEntry(String(form.get("id")));
  if (!entry) redirect("/");
  await deleteEntry(entry.id);
  revalidatePath("/", "layout");
  redirect(tripPath((await getTrip(entry.tripId)) ?? { slug: entry.tripId }));
}

export type SettleState = { error?: string };

/**
 * Records a payment from one person to the other (settling up), with its date, method and an optional
 * reference such as the Venmo note. Paying the full balance brings the trip to $0.
 */
export async function settleUpAction(_prev: SettleState, form: FormData): Promise<SettleState> {
  await requireAuth();
  const home = config.homeCurrency;
  const trip = await getTrip(String(form.get("tripId") ?? ""));
  if (!trip) return { error: "This trip no longer exists." };
  const from = form.get("from") === "p2" ? "p2" : "p1";
  const amount = parseDecimal(String(form.get("amount") ?? ""));
  const amountMinor = amount && amount.gt(0) ? toMinor(amount, home) : null;
  if (amountMinor == null) return { error: `Enter the amount paid in ${home}.` };
  const date = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the date it was paid." };
  const m = String(form.get("method") ?? "");
  const method: PaymentMethod = (PAYMENT_METHODS as readonly string[]).includes(m) ? (m as PaymentMethod) : "other";
  const reference = String(form.get("reference") ?? "").trim().slice(0, 500);

  // Name it by what it does: only a payment that brings the trip to exactly zero is "Settled up".
  const balance = summarize(await listEntries(trip.id), home).balance;
  const debt = Math.abs(balance);
  const fromOwes = from === "p2" ? balance > 0 : balance < 0;
  const description = !fromOwes || amountMinor > debt ? "Overpayment" : amountMinor === debt ? "Settled up" : "Partial payment";

  const now = new Date().toISOString();
  const entry: Entry = {
    id: crypto.randomUUID(),
    tripId: trip.id,
    kind: "payment",
    date,
    description,
    amountMinor,
    currency: home,
    rate: "1",
    rateSource: "same",
    rateDate: date,
    homeAmountMinor: null,
    paidBy: from,
    split: "other",
    p1ShareMinor: null,
    notes: reference,
    method,
    createdAt: now,
    updatedAt: now,
  };
  await saveEntry(entry, "create");
  revalidatePath("/", "layout");
  redirect(`${tripPath(trip)}?settled=1`);
}

// ---- Trips ----

export type TripState = { error?: string };

export async function createTripAction(_prev: TripState, form: FormData): Promise<TripState> {
  await requireAuth();
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Give the trip a name." };
  const trip = await createTrip(name);
  await setCurrentTrip(trip.id);
  revalidatePath("/", "layout");
  redirect(tripPath(trip));
}

export async function renameTripAction(_prev: TripState, form: FormData): Promise<TripState> {
  await requireAuth();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Give the trip a name." };
  const trip = await renameTrip(id, name);
  if (!trip) return { error: "This trip no longer exists." };
  revalidatePath("/", "layout");
  redirect(tripPath(trip));
}

/** Makes a trip the one new entries go into by default (shared by both people). */
export async function makeCurrentTripAction(form: FormData) {
  await requireAuth();
  const trip = await getTrip(String(form.get("id") ?? ""));
  if (trip) await setCurrentTrip(trip.id);
  revalidatePath("/", "layout");
}

export async function deleteTripAction(form: FormData) {
  await requireAuth();
  const id = String(form.get("id") ?? "");
  await deleteTrip(id);
  if ((await currentTripId()) === id) {
    const next = (await listTrips())[0];
    if (next) await setCurrentTrip(next.id);
  }
  revalidatePath("/", "layout");
  redirect("/trips");
}
