import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { getTrip, listTrips } from "@/lib/db";
import { tripPath } from "@/lib/ledger";
import { requireAuth } from "@/lib/session";
import { currentTripId } from "@/lib/settings";

/** Opens the current trip (or the newest one); with no trips yet, starts a new one. */
export default async function Home() {
  await requireAuth();
  if (!config.databaseUrl) return <SetupNeeded />;
  const id = await currentTripId();
  const trip = (id && (await getTrip(id))) || (await listTrips())[0];
  redirect(trip ? tripPath(trip) : "/trips/new");
}

function SetupNeeded() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <div className="card space-y-3">
        <h1 className="text-xl font-semibold">Almost there: connect a database</h1>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            In your Vercel project, open <b>Storage → Create Database → Neon (Postgres)</b>, choose the free plan, and
            connect it to this project. That sets <code>DATABASE_URL</code>.
          </li>
          <li>
            Redeploy: <b>Deployments → ⋯ → Redeploy</b>.
          </li>
        </ol>
        <p className="text-sm text-muted">The tables are created automatically the first time the app runs.</p>
      </div>
    </main>
  );
}
