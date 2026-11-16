import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolClient, types } from "pg";
import { config } from "./config";
import { type Entry, type Trip, slugify } from "./ledger";

/*
 * Storage is Postgres: in production the Neon database you add from Vercel's Storage tab, which sets
 * DATABASE_URL for you. Locally, `vercel env pull .env.local` copies the same setting.
 */

// Return DATE columns as plain "YYYY-MM-DD" strings, not JavaScript Dates (which would shift with time zones).
types.setTypeParser(types.builtins.DATE, (v) => v);
// BIGINT comes back as a string; amounts in minor units fit safely in a JS number.
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!config.databaseUrl) {
      throw new Error(
        "No database configured. Add a Neon Postgres database from your Vercel project's Storage tab " +
          "(it sets DATABASE_URL), or run `vercel env pull .env.local` for local development.",
      );
    }
    pool = new Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 5000 });
    // On Vercel, lets idle connections be closed before a function is suspended.
    attachDatabasePool(pool);
  }
  return pool;
}

const schema = `
  CREATE TABLE IF NOT EXISTS entries (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('expense', 'payment')),
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    rate NUMERIC NOT NULL,
    rate_source TEXT NOT NULL,
    rate_date DATE,
    home_amount_minor BIGINT,
    paid_by TEXT NOT NULL CHECK (paid_by IN ('p1', 'p2')),
    split TEXT NOT NULL,
    p1_share_minor BIGINT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );
  -- Every create/edit/delete is recorded so you can see what changed when reconciling.
  CREATE TABLE IF NOT EXISTS entry_log (
    seq BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entry_id UUID NOT NULL,
    action TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS entry_log_entry ON entry_log (entry_id);
  -- Fetched exchange rates are cached so each (currency, date) is only looked up once.
  CREATE TABLE IF NOT EXISTS rates (
    base CHAR(3) NOT NULL,
    quote CHAR(3) NOT NULL,
    date DATE NOT NULL,
    rate NUMERIC NOT NULL,
    rate_date DATE NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (base, quote, date)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- One row per backup attempt (scheduled or manual), successful or not.
  CREATE TABLE IF NOT EXISTS backup_runs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    trigger TEXT NOT NULL,
    ok BOOLEAN NOT NULL,
    pathname TEXT,
    entries INTEGER,
    bytes INTEGER,
    error TEXT
  );
  CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- Added with trips: each entry belongs to a trip; payments can record how they were made.
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS trip_id UUID;
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS method TEXT;
  CREATE INDEX IF NOT EXISTS entries_trip ON entries (trip_id);
  -- Trip web addresses (/trips/japan-korea).
  ALTER TABLE trips ADD COLUMN IF NOT EXISTS slug TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS trips_slug ON trips (slug);
`;

/** Entries from before trips existed are moved into a first trip, which becomes the current one. */
const migrateToTrips = `
  WITH orphans AS (SELECT 1 FROM entries WHERE trip_id IS NULL LIMIT 1),
  new_trip AS (
    INSERT INTO trips (id, name, created_at)
    SELECT gen_random_uuid(), 'My first trip', COALESCE((SELECT min(created_at) FROM entries), now())
    WHERE EXISTS (SELECT 1 FROM orphans)
    RETURNING id
  ),
  moved AS (UPDATE entries SET trip_id = (SELECT id FROM new_trip) WHERE trip_id IS NULL AND EXISTS (SELECT 1 FROM new_trip))
  INSERT INTO settings (key, value)
  SELECT 'currentTripId', to_jsonb(id::text) FROM new_trip
  ON CONFLICT (key) DO NOTHING;
`;

/** Creates the tables on first use. The advisory lock stops two cold starts from racing. */
async function db(): Promise<Pool> {
  const p = getPool();
  ready ??= (async () => {
    const client = await p.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(727274)");
      await client.query(schema);
      await client.query(migrateToTrips);
      // Give trips created before addresses existed a slug.
      const unnamed = await client.query("SELECT id, name FROM trips WHERE slug IS NULL ORDER BY created_at");
      for (const t of unnamed.rows) {
        await client.query("UPDATE trips SET slug = $2 WHERE id = $1", [t.id, await uniqueSlug(client, String(t.name))]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  })().catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return p;
}

async function inTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await (await db()).connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

type Row = Record<string, unknown>;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function toEntry(r: Row): Entry {
  return {
    id: String(r.id),
    tripId: String(r.trip_id),
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
    method: r.method == null ? null : (String(r.method) as Entry["method"]),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** Entries of one trip (or of all trips), newest transaction first. */
export async function listEntries(tripId?: string): Promise<Entry[]> {
  const res = tripId
    ? await (await db()).query("SELECT * FROM entries WHERE trip_id = $1 ORDER BY date DESC, created_at DESC", [tripId])
    : await (await db()).query("SELECT * FROM entries ORDER BY date DESC, created_at DESC");
  return res.rows.map(toEntry);
}

export async function getEntry(id: string): Promise<Entry | null> {
  if (!isUuid(id)) return null;
  const res = await (await db()).query("SELECT * FROM entries WHERE id = $1", [id]);
  return res.rows[0] ? toEntry(res.rows[0]) : null;
}

const columns = [
  "id", "kind", "date", "description", "amount_minor", "currency", "rate", "rate_source", "rate_date",
  "home_amount_minor", "paid_by", "split", "p1_share_minor", "notes", "created_at", "updated_at",
  "trip_id", "method",
] as const;

const entryValues = (e: Entry) => [
  e.id, e.kind, e.date, e.description, e.amountMinor, e.currency, e.rate, e.rateSource, e.rateDate,
  e.homeAmountMinor, e.paidBy, e.split, e.p1ShareMinor, e.notes, e.createdAt, e.updatedAt,
  e.tripId, e.method,
];

const upsertSql = `
  INSERT INTO entries (${columns.join(", ")})
  VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})
  ON CONFLICT (id) DO UPDATE SET
  ${columns.filter((c) => c !== "id" && c !== "created_at").map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`;

/** Inserts or updates an entry and records it in the change log, in one transaction. */
export async function saveEntry(e: Entry, action: "create" | "update"): Promise<void> {
  await inTransaction(async (c) => {
    await c.query(upsertSql, entryValues(e));
    await c.query("INSERT INTO entry_log (entry_id, action, snapshot, at) VALUES ($1, $2, $3, $4)", [
      e.id, action, JSON.stringify(e), e.updatedAt,
    ]);
  });
}

export async function deleteEntry(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await inTransaction(async (c) => {
    const res = await c.query("DELETE FROM entries WHERE id = $1 RETURNING *", [id]);
    if (res.rows[0]) {
      await c.query("INSERT INTO entry_log (entry_id, action, snapshot) VALUES ($1, 'delete', $2)", [
        id, JSON.stringify(toEntry(res.rows[0])),
      ]);
    }
  });
}

export interface LogItem {
  action: "create" | "update" | "delete" | "import";
  at: string;
  snapshot: Entry;
}

const toLog = (r: Row): LogItem => ({
  action: r.action as LogItem["action"],
  at: iso(r.at),
  snapshot: r.snapshot as Entry,
});

export async function entryHistory(id: string): Promise<LogItem[]> {
  if (!isUuid(id)) return [];
  const res = await (await db()).query(
    "SELECT action, at, snapshot FROM entry_log WHERE entry_id = $1 ORDER BY seq",
    [id],
  );
  return res.rows.map(toLog);
}

/** Deleted entries (most recent first), so a mistaken delete can be seen and re-entered. */
export async function deletedEntries(tripId?: string): Promise<LogItem[]> {
  const res = tripId
    ? await (await db()).query(
        "SELECT action, at, snapshot FROM entry_log WHERE action = 'delete' AND snapshot->>'tripId' = $1 ORDER BY seq DESC",
        [tripId],
      )
    : await (await db()).query("SELECT action, at, snapshot FROM entry_log WHERE action = 'delete' ORDER BY seq DESC");
  return res.rows.map(toLog);
}

export async function cachedRate(base: string, quote: string, date: string) {
  const res = await (await db()).query(
    "SELECT rate::text AS rate, rate_date FROM rates WHERE base = $1 AND quote = $2 AND date = $3",
    [base, quote, date],
  );
  const r = res.rows[0];
  return r ? { rate: String(r.rate), rateDate: String(r.rate_date) } : null;
}

export async function storeRate(base: string, quote: string, date: string, rate: string, rateDate: string) {
  await (await db()).query(
    `INSERT INTO rates (base, quote, date, rate, rate_date) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (base, quote, date) DO UPDATE SET rate = EXCLUDED.rate, rate_date = EXCLUDED.rate_date, fetched_at = now()`,
    [base, quote, date, rate, rateDate],
  );
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ---- Settings ----

export async function getSetting<T>(key: string): Promise<T | null> {
  const res = await (await db()).query("SELECT value FROM settings WHERE key = $1", [key]);
  return res.rows[0] ? (res.rows[0].value as T) : null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

// ---- Import ----

/**
 * Writes imported trips and entries in one transaction. "merge" adds new ones and overwrites ones with the same id;
 * "replace" first deletes all entries and trips (each deleted entry is logged, so it shows under Deleted entries).
 */
export async function importData(
  trips: Trip[],
  entries: Entry[],
  mode: "merge" | "replace",
): Promise<{ added: number; updated: number; removed: number }> {
  return inTransaction(async (c) => {
    let removed = 0;
    if (mode === "replace") {
      const res = await c.query("DELETE FROM entries RETURNING *");
      removed = res.rowCount ?? 0;
      for (const r of res.rows) {
        await c.query("INSERT INTO entry_log (entry_id, action, snapshot) VALUES ($1, 'delete', $2)", [
          r.id, JSON.stringify(toEntry(r)),
        ]);
      }
      await c.query("DELETE FROM trips");
    }
    for (const t of trips) {
      await c.query(
        `INSERT INTO trips (id, name, slug, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug`,
        [t.id, t.name, await uniqueSlug(c, t.name, t.id), t.createdAt],
      );
    }
    let added = 0;
    let updated = 0;
    for (const e of entries) {
      const exists = await c.query("SELECT 1 FROM entries WHERE id = $1", [e.id]);
      await c.query(upsertSql, entryValues(e));
      await c.query("INSERT INTO entry_log (entry_id, action, snapshot) VALUES ($1, 'import', $2)", [
        e.id, JSON.stringify(e),
      ]);
      if (exists.rowCount) updated++;
      else added++;
    }
    return { added, updated, removed };
  });
}

// ---- Trips ----

const toTrip = (r: Row): Trip => ({ id: String(r.id), name: String(r.name), slug: String(r.slug), createdAt: iso(r.created_at) });

/** A slug from the name that no other trip uses ("japan", "japan-2", …). */
async function uniqueSlug(c: Pool | PoolClient, name: string, exceptId?: string): Promise<string> {
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const res = await c.query("SELECT 1 FROM trips WHERE slug = $1 AND id IS DISTINCT FROM $2::uuid", [candidate, exceptId ?? null]);
    if (!res.rowCount) return candidate;
  }
}

export async function listTrips(): Promise<Trip[]> {
  const res = await (await db()).query("SELECT * FROM trips ORDER BY created_at DESC");
  return res.rows.map(toTrip);
}

/** Finds a trip by its address (slug) or its id. */
export async function getTrip(idOrSlug: string): Promise<Trip | null> {
  const res = isUuid(idOrSlug)
    ? await (await db()).query("SELECT * FROM trips WHERE id = $1", [idOrSlug])
    : await (await db()).query("SELECT * FROM trips WHERE slug = $1", [idOrSlug.toLowerCase()]);
  return res.rows[0] ? toTrip(res.rows[0]) : null;
}

export async function createTrip(name: string): Promise<Trip> {
  const p = await db();
  const trip: Trip = { id: crypto.randomUUID(), name, slug: await uniqueSlug(p, name), createdAt: new Date().toISOString() };
  await p.query("INSERT INTO trips (id, name, slug, created_at) VALUES ($1, $2, $3, $4)", [trip.id, trip.name, trip.slug, trip.createdAt]);
  return trip;
}

/** Renames a trip; its address changes to match the new name. Returns the updated trip. */
export async function renameTrip(id: string, name: string): Promise<Trip | null> {
  if (!isUuid(id)) return null;
  const p = await db();
  await p.query("UPDATE trips SET name = $2, slug = $3 WHERE id = $1", [id, name, await uniqueSlug(p, name, id)]);
  return getTrip(id);
}

/** Deletes a trip and its entries (each entry is logged, so it can still be seen under Deleted entries). */
export async function deleteTrip(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await inTransaction(async (c) => {
    const res = await c.query("DELETE FROM entries WHERE trip_id = $1 RETURNING *", [id]);
    for (const r of res.rows) {
      await c.query("INSERT INTO entry_log (entry_id, action, snapshot) VALUES ($1, 'delete', $2)", [
        r.id, JSON.stringify(toEntry(r)),
      ]);
    }
    await c.query("DELETE FROM trips WHERE id = $1", [id]);
  });
}

// ---- Backup runs ----

export interface BackupRun {
  at: string;
  trigger: string;
  ok: boolean;
  pathname: string | null;
  entries: number | null;
  bytes: number | null;
  error: string | null;
}

export async function recordBackupRun(run: Omit<BackupRun, "at">): Promise<void> {
  await (await db()).query(
    "INSERT INTO backup_runs (trigger, ok, pathname, entries, bytes, error) VALUES ($1, $2, $3, $4, $5, $6)",
    [run.trigger, run.ok, run.pathname, run.entries, run.bytes, run.error],
  );
}

export async function recentBackupRuns(limit = 10): Promise<BackupRun[]> {
  const res = await (await db()).query("SELECT * FROM backup_runs ORDER BY id DESC LIMIT $1", [limit]);
  return res.rows.map((r) => ({
    at: iso(r.at),
    trigger: String(r.trigger),
    ok: Boolean(r.ok),
    pathname: r.pathname == null ? null : String(r.pathname),
    entries: r.entries == null ? null : Number(r.entries),
    bytes: r.bytes == null ? null : Number(r.bytes),
    error: r.error == null ? null : String(r.error),
  }));
}

/** True if a backup already succeeded since the given time. */
export async function backupSucceededSince(since: Date): Promise<boolean> {
  const res = await (await db()).query("SELECT 1 FROM backup_runs WHERE ok AND at >= $1 LIMIT 1", [since]);
  return (res.rowCount ?? 0) > 0;
}
