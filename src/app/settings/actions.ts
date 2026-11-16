"use server";

import { revalidatePath } from "next/cache";
import { backupsConfigured, readBackup, runBackup } from "@/lib/backup";
import { config } from "@/lib/config";
import { isKnownCurrency } from "@/lib/currencyData";
import { importData, setSetting } from "@/lib/db";
import { type ParsedImport, parseImport } from "@/lib/importData";
import { requireAuth } from "@/lib/session";
import { profiles, saveProfiles, setCurrentTrip } from "@/lib/settings";

export type ActionResult = { ok?: string; error?: string };

export async function saveCurrenciesAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const codes = [...new Set(form.getAll("currency").map(String))].filter(isKnownCurrency);
  if (!codes.includes(config.homeCurrency)) codes.unshift(config.homeCurrency);
  await setSetting("enabledCurrencies", codes);
  revalidatePath("/", "layout");
  return { ok: `Saved. ${codes.length} currencies are offered in the form.` };
}

export async function backupNowAction(): Promise<ActionResult> {
  await requireAuth();
  try {
    const r = await runBackup("manual");
    revalidatePath("/settings");
    return { ok: `Backed up ${r.entries} entries.` };
  } catch (err) {
    revalidatePath("/settings");
    return { error: `Backup failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Takes a safety backup first when backups are set up; refuses to continue if that fails. */
async function safetyBackup(trigger: "before-import" | "before-restore"): Promise<string | null> {
  if (!backupsConfigured()) return null;
  try {
    await runBackup(trigger);
    return null;
  } catch (err) {
    return `Stopped: couldn't make a safety backup first (${err instanceof Error ? err.message : String(err)}).`;
  }
}

/** Restores currency choices, photos/Venmo names and the current trip from an imported file. */
async function applyImportedSettings(parsed: ParsedImport, mode: "merge" | "replace") {
  if (parsed.enabledCurrencies?.length) await setSetting("enabledCurrencies", parsed.enabledCurrencies);
  if (parsed.profiles && (mode === "replace" || !(await profiles()).p1.photo)) await saveProfiles(parsed.profiles);
  const current = parsed.currentTripId && parsed.trips.some((t) => t.id === parsed.currentTripId) ? parsed.currentTripId : null;
  if (mode === "replace" || current) {
    const fallback = parsed.trips[0]?.id;
    if (current ?? fallback) await setCurrentTrip((current ?? fallback)!);
  }
}

export async function importAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const file = form.get("file");
  const mode = form.get("mode") === "replace" ? "replace" : "merge";
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a JSON export or backup file." };
  try {
    const parsed = parseImport(await file.text(), config.homeCurrency);
    const blocked = await safetyBackup("before-import");
    if (blocked) return { error: blocked };
    const r = await importData(parsed.trips, parsed.entries, mode);
    await applyImportedSettings(parsed, mode);
    revalidatePath("/", "layout");
    return {
      ok:
        `Imported ${parsed.entries.length} entries: ${r.added} added, ${r.updated} updated` +
        (mode === "replace" ? `, ${r.removed} previous entries removed` : "") +
        ".",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Import failed." };
  }
}

export async function restoreBackupAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const path = String(form.get("path") ?? "");
  try {
    const parsed = parseImport(await readBackup(path), config.homeCurrency);
    const blocked = await safetyBackup("before-restore");
    if (blocked) return { error: blocked };
    const r = await importData(parsed.trips, parsed.entries, "replace");
    await applyImportedSettings(parsed, "replace");
    revalidatePath("/", "layout");
    return { ok: `Restored ${r.added + r.updated} entries from the backup.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Restore failed." };
  }
}

// ---- People ----

const PHOTO_PREFIX = "data:image/jpeg;base64,";

export async function savePersonAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const person = form.get("person") === "p2" ? "p2" : "p1";
  const current = await profiles();
  const next = { ...current[person] };

  const photo = String(form.get("photo") ?? "");
  if (form.get("removePhoto") === "1") delete next.photo;
  else if (photo) {
    // Photos are resized to a small square in the browser before upload.
    if (!photo.startsWith(PHOTO_PREFIX) || photo.length > 150_000) return { error: "That photo couldn't be used. Try another." };
    next.photo = photo;
  }
  const venmo = String(form.get("venmo") ?? "").trim().replace(/^@/, "");
  if (venmo && !/^[A-Za-z0-9_-]{2,30}$/.test(venmo)) return { error: "Venmo usernames use letters, numbers, - and _." };
  if (venmo) next.venmo = venmo;
  else delete next.venmo;

  await saveProfiles({ ...current, [person]: next });
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function saveEasterEggAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();
  if (form.get("remove") === "1") {
    await setSetting("easterEggPhoto", null);
  } else {
    const photo = String(form.get("photo") ?? "");
    if (!photo.startsWith(PHOTO_PREFIX) || photo.length > 150_000) return { error: "Choose a picture first." };
    await setSetting("easterEggPhoto", photo);
  }
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}
