import { timingSafeEqual } from "node:crypto";
import { backupsConfigured, runBackup } from "@/lib/backup";
import { backupSucceededSince } from "@/lib/db";

/*
 * Daily backup with hourly retries.
 * Called once a day by Vercel Cron (vercel.json) and every hour by GitHub Actions (.github/workflows/backup.yml).
 * If today's backup (UTC) already succeeded it does nothing, so the hourly calls only retry after a failure.
 * Both callers authenticate with "Authorization: Bearer <CRON_SECRET>".
 */
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (!authorized(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!backupsConfigured()) {
    return Response.json({ ok: false, error: "No Vercel Blob store connected" }, { status: 503 });
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  if (await backupSucceededSince(startOfDay)) {
    return Response.json({ ok: true, skipped: "Today's backup already succeeded" });
  }
  try {
    const result = await runBackup("scheduled");
    return Response.json({ ok: true, ...result });
  } catch (err) {
    // A 500 makes the GitHub Actions run show as failed; the next hourly run retries.
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
