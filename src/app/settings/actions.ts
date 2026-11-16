"use server";

import { revalidatePath } from "next/cache";
import { backupsConfigured, readBackup, runBackup } from "@/lib/backup";
import { config } from "@/lib/config";
import { isKnownCurrency } from "@/lib/currencyData";
import { importEntries, setSetting } from "@/lib/db";
import { parseImport } from "@/lib/importData";
import { requireAuth } from "@/lib/session";

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

export async function importAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const file = form.get("file");
  const mode = form.get("mode") === "replace" ? "replace" : "merge";
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a JSON export or backup file." };
  try {
    const parsed = parseImport(await file.text(), config.homeCurrency);
    const blocked = await safetyBackup("before-import");
    if (blocked) return { error: blocked };
    const r = await importEntries(parsed.entries, mode);
    if (parsed.enabledCurrencies?.length) await setSetting("enabledCurrencies", parsed.enabledCurrencies);
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
    const r = await importEntries(parsed.entries, "replace");
    if (parsed.enabledCurrencies?.length) await setSetting("enabledCurrencies", parsed.enabledCurrencies);
    revalidatePath("/", "layout");
    return { ok: `Restored ${r.added + r.updated} entries from the backup.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Restore failed." };
  }
}
