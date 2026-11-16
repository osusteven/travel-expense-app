import { readBackup } from "@/lib/backup";
import { isSignedIn } from "@/lib/session";

/** GET /api/backups/download?path=backups/... → downloads a stored backup. */
export async function GET(request: Request) {
  if (!(await isSignedIn())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const path = new URL(request.url).searchParams.get("path") ?? "";
  try {
    const body = await readBackup(path);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${path.split("/").pop()}"`,
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Not found" }, { status: 404 });
  }
}
