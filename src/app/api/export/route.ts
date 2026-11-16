import { config, people } from "@/lib/config";
import { listEntries } from "@/lib/db";
import { toCsv, toJson } from "@/lib/export";
import { isSignedIn } from "@/lib/session";

/** GET /api/export?format=csv|json → file download of every entry. */
export async function GET(request: Request) {
  if (!(await isSignedIn())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";
  const entries = await listEntries();
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    return new Response(JSON.stringify(toJson(entries, config.homeCurrency, people), null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="travel-ledger-${stamp}.json"`,
      },
    });
  }
  return new Response(toCsv(entries, config.homeCurrency, people), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="travel-ledger-${stamp}.csv"`,
    },
  });
}
