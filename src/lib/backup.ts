import "server-only";
import { del, get, list, put } from "@vercel/blob";
import { config, people } from "./config";
import { getSetting, listEntries, recordBackupRun } from "./db";
import { toJson } from "./export";

/*
 * Backups are JSON files (the same format as the JSON export) stored privately in Vercel Blob,
 * which is separate from the database, so they survive a database problem.
 * Add a Blob store from the Vercel Storage tab (choose Private); it sets BLOB_READ_WRITE_TOKEN.
 */

const PREFIX = "backups/";
/** How many backups to keep (about two months of daily backups, plus any manual ones). */
const KEEP = 60;

export function backupsConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function buildBackupJson(): Promise<{ body: string; entries: number }> {
  const [entries, enabledCurrencies] = await Promise.all([
    listEntries(),
    getSetting<string[]>("enabledCurrencies"),
  ]);
  const data = toJson(entries, config.homeCurrency, people, enabledCurrencies ? { enabledCurrencies } : undefined);
  return { body: JSON.stringify(data, null, 2), entries: entries.length };
}

/** Writes a backup to Blob storage and records the attempt. Throws if it fails. */
export async function runBackup(trigger: "scheduled" | "manual" | "before-restore" | "before-import") {
  try {
    if (!backupsConfigured()) throw new Error("Backup storage isn't set up (no Vercel Blob store connected).");
    const { body, entries } = await buildBackupJson();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pathname = `${PREFIX}travel-ledger-${stamp}-${trigger}.json`;
    await put(pathname, body, { access: "private", contentType: "application/json", allowOverwrite: true });
    await prune().catch(() => undefined);
    await recordBackupRun({ trigger, ok: true, pathname, entries, bytes: Buffer.byteLength(body), error: null });
    return { pathname, entries };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordBackupRun({ trigger, ok: false, pathname: null, entries: null, bytes: null, error: message.slice(0, 500) }).catch(
      () => undefined,
    );
    throw err;
  }
}

export interface StoredBackup {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

export async function listBackups(): Promise<StoredBackup[]> {
  if (!backupsConfigured()) return [];
  const blobs: StoredBackup[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) {
      blobs.push({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt).toISOString() });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** Reads a stored backup. Only names that appear in the backup list are accepted. */
export async function readBackup(pathname: string): Promise<string> {
  if (!pathname.startsWith(PREFIX)) throw new Error("Invalid backup name");
  const match = (await listBackups()).find((b) => b.pathname === pathname);
  if (!match) throw new Error("Backup not found");
  const res = await get(match.url, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) throw new Error("Backup not found");
  return await new Response(res.stream).text();
}

async function prune() {
  const all = await listBackups();
  const old = all.slice(KEEP).map((b) => b.url);
  if (old.length) await del(old);
}
