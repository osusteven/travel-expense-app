import { config, people } from "@/lib/config";
import { getTrip, listEntries, listTrips } from "@/lib/db";
import { toCsv, toJson } from "@/lib/export";
import { buildFullExport } from "@/lib/fullExport";
import { isSignedIn } from "@/lib/session";

/**
 * GET /api/export?format=csv|json[&trip=<id>] → file download.
 * Without `trip`, everything is exported; the JSON is then a complete backup that Import can restore.
 */
export async function GET(request: Request) {
  if (!(await isSignedIn())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "json" ? "json" : "csv";
  const trip = params.get("trip") ? await getTrip(params.get("trip")!) : null;
  if (params.get("trip") && !trip) return Response.json({ error: "Trip not found" }, { status: 404 });

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = trip ? `-${trip.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "";
  const filename = `travel-ledger${slug}-${stamp}.${format}`;
  const disposition = `attachment; filename="${filename}"`;

  if (format === "json") {
    const data = trip
      ? toJson(await listEntries(trip.id), config.homeCurrency, people, {}, [trip])
      : (await buildFullExport()).data;
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": disposition },
    });
  }
  const [entries, trips] = trip ? [await listEntries(trip.id), [trip]] : await Promise.all([listEntries(), listTrips()]);
  return new Response(toCsv(entries, config.homeCurrency, people, trips), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": disposition },
  });
}
