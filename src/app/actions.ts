"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { deleteEntry, getEntry, listEntries, saveEntry } from "@/lib/db";
import { type Entry, settlement, summarize } from "@/lib/ledger";
import { requireAuth } from "@/lib/session";
import { LAST_CURRENCY_COOKIE } from "@/lib/settings";
import { type FieldErrors, parseEntryForm } from "@/lib/validate";

export type SaveState = { errors: FieldErrors; message?: string };

const fieldNames = [
  "kind", "date", "description", "amount", "currency", "paidBy", "split", "p1Share",
  "rateMode", "rate", "rateSource", "rateDate", "homeAmount", "notes",
] as const;

/** Creates an entry, or updates one when the form includes an `id`. */
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
  if (id) {
    const existing = await getEntry(id);
    if (!existing) return { errors: {}, message: "This entry no longer exists." };
    await saveEntry({ ...existing, ...parsed.value, updatedAt: now }, "update");
  } else {
    await saveEntry({ ...parsed.value, id: crypto.randomUUID(), createdAt: now, updatedAt: now }, "create");
    // Remember this device's currency so the next entry starts with it.
    (await cookies()).set(LAST_CURRENCY_COOKIE, parsed.value.currency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  revalidatePath("/");
  redirect(id ? `/#entry-${id}` : "/?saved=1");
}

export async function deleteEntryAction(form: FormData) {
  await requireAuth();
  await deleteEntry(String(form.get("id")));
  revalidatePath("/");
  redirect("/");
}

/** Records the payment that brings the balance back to zero. */
export async function settleUpAction() {
  await requireAuth();
  const home = config.homeCurrency;
  const s = settlement(summarize(await listEntries(), home).balance);
  if (!s) return;
  const now = new Date().toISOString();
  const entry: Entry = {
    id: crypto.randomUUID(),
    kind: "payment",
    date: now.slice(0, 10),
    description: "Settled up",
    amountMinor: s.amount,
    currency: home,
    rate: "1",
    rateSource: "same",
    rateDate: now.slice(0, 10),
    homeAmountMinor: null,
    paidBy: s.from,
    split: "other",
    p1ShareMinor: null,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
  await saveEntry(entry, "create");
  revalidatePath("/");
}
