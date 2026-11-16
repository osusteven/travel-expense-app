import "server-only";
import { createClient, type Client, type Row } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { config } from "./config";
import type { Entry } from "./ledger";

/*
 * Storage is libSQL (SQLite). Locally it's a file (data/ledger.db). In production, point DATABASE_URL at a
 * hosted libSQL database such as Turso, because serverless hosts like Vercel have no persistent disk.
 */

let client: Client | null = null;
let ready: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    if (config.databaseUrl.startsWith("file:")) {
      const path = config.databaseUrl.slice("file:".length);
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (dir) mkdirSync(dir, { recursive: true });
    }
    client = createClient({ url: config.databaseUrl, authToken: config.databaseAuthToken });
  }
  return client;
}

async function db(): Promise<Client> {
  const c = getClient();
  ready ??= c
    .batch(
      [
        `CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          date TEXT NOT NULL,
          description TEXT NOT NULL,
          amount_minor INTEGER NOT NULL,
          currency TEXT NOT NULL,
          rate TEXT NOT NULL,
          rate_source TEXT NOT NULL,
          rate_date TEXT,
          home_amount_minor INTEGER,
          paid_by TEXT NOT NULL,
          split TEXT NOT NULL,
          p1_share_minor INTEGER,
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        // Every create/edit/delete is recorded so you can see what changed when reconciling.
        `CREATE TABLE IF NOT EXISTS entry_log (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id TEXT NOT NULL,
          action TEXT NOT NULL,
          snapshot TEXT NOT NULL,
          at TEXT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS entry_log_entry ON entry_log(entry_id)`,
        // Fetched exchange rates are cached so each (currency, date) is only looked up once.
        `CREATE TABLE IF NOT EXISTS rates (
          base TEXT NOT NULL,
          quote TEXT NOT NULL,
          date TEXT NOT NULL,
          rate TEXT NOT NULL,
          rate_date TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          PRIMARY KEY (base, quote, date)
        )`,
      ],
      "write",
    )
    .then(() => undefined)
    .catch((err) => {
      ready = null;
      throw err;
    });
  await ready;
  return c;
}

function toEntry(r: Row): Entry {
  return {
    id: String(r.id),
    kind: r.kind as Entry["kind"],
    date: String(r.date),
    description: String(r.description),
    amountMinor: Number(r.amount_minor),
    currency: String(r.currency),
    rate: String(r.rate),
    rateSource: r.rate_source as Entry["rateSource"],
    rateDate: r.rate_date == null ? null : String(r.rate_date),
    homeAmountMinor: r.home_amount_minor == null ? null : Number(r.home_amount_minor),
    paidBy: r.paid_by as Entry["paidBy"],
    split: r.split as Entry["split"],
    p1ShareMinor: r.p1_share_minor == null ? null : Number(r.p1_share_minor),
    notes: String(r.notes ?? ""),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

/** All entries, newest transaction first. */
export async function listEntries(): Promise<Entry[]> {
  const res = await (await db()).execute("SELECT * FROM entries ORDER BY date DESC, created_at DESC");
  return res.rows.map(toEntry);
}

export async function getEntry(id: string): Promise<Entry | null> {
  const res = await (await db()).execute({ sql: "SELECT * FROM entries WHERE id = ?", args: [id] });
  return res.rows[0] ? toEntry(res.rows[0]) : null;
}

const columns = [
  "id", "kind", "date", "description", "amount_minor", "currency", "rate", "rate_source", "rate_date",
  "home_amount_minor", "paid_by", "split", "p1_share_minor", "notes", "created_at", "updated_at",
] as const;

function values(e: Entry) {
  return [
    e.id, e.kind, e.date, e.description, e.amountMinor, e.currency, e.rate, e.rateSource, e.rateDate,
    e.homeAmountMinor, e.paidBy, e.split, e.p1ShareMinor, e.notes, e.createdAt, e.updatedAt,
  ];
}

function logStatement(entryId: string, action: string, snapshot: unknown, at: string) {
  return {
    sql: "INSERT INTO entry_log (entry_id, action, snapshot, at) VALUES (?, ?, ?, ?)",
    args: [entryId, action, JSON.stringify(snapshot), at],
  };
}

/** Inserts or replaces an entry and records it in the change log. */
export async function saveEntry(e: Entry, action: "create" | "update"): Promise<void> {
  const c = await db();
  await c.batch(
    [
      {
        sql: `INSERT OR REPLACE INTO entries (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
        args: values(e),
      },
      logStatement(e.id, action, e, e.updatedAt),
    ],
    "write",
  );
}

export async function deleteEntry(id: string): Promise<void> {
  const c = await db();
  const existing = await getEntry(id);
  if (!existing) return;
  await c.batch(
    [
      { sql: "DELETE FROM entries WHERE id = ?", args: [id] },
      logStatement(id, "delete", existing, new Date().toISOString()),
    ],
    "write",
  );
}

export interface LogItem {
  action: "create" | "update" | "delete";
  at: string;
  snapshot: Entry;
}

export async function entryHistory(id: string): Promise<LogItem[]> {
  const res = await (await db()).execute({
    sql: "SELECT action, at, snapshot FROM entry_log WHERE entry_id = ? ORDER BY seq",
    args: [id],
  });
  return res.rows.map((r) => ({
    action: r.action as LogItem["action"],
    at: String(r.at),
    snapshot: JSON.parse(String(r.snapshot)) as Entry,
  }));
}

/** Deleted entries (most recent first), so a mistaken delete can be seen and re-entered. */
export async function deletedEntries(): Promise<LogItem[]> {
  const res = await (await db()).execute(
    "SELECT action, at, snapshot FROM entry_log WHERE action = 'delete' ORDER BY seq DESC",
  );
  return res.rows.map((r) => ({
    action: "delete",
    at: String(r.at),
    snapshot: JSON.parse(String(r.snapshot)) as Entry,
  }));
}

export async function cachedRate(base: string, quote: string, date: string) {
  const res = await (await db()).execute({
    sql: "SELECT rate, rate_date FROM rates WHERE base = ? AND quote = ? AND date = ?",
    args: [base, quote, date],
  });
  const r = res.rows[0];
  return r ? { rate: String(r.rate), rateDate: String(r.rate_date) } : null;
}

export async function storeRate(base: string, quote: string, date: string, rate: string, rateDate: string) {
  await (await db()).execute({
    sql: "INSERT OR REPLACE INTO rates (base, quote, date, rate, rate_date, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [base, quote, date, rate, rateDate, new Date().toISOString()],
  });
}
