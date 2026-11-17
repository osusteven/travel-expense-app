import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteTripAction } from "@/app/actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Header } from "@/components/Header";
import { getTrip, listEntries, recentBackupRuns } from "@/lib/db";
import { backupsConfigured } from "@/lib/backup";
import { LocalTime } from "@/components/LocalTime";
import { tripPath } from "@/lib/ledger";
import { requireAuth } from "@/lib/session";
import { RenameTripForm } from "../../TripForms";

export default async function EditTripPage({ params }: PageProps<"/trips/[id]/edit">) {
  await requireAuth();
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();
  // Old addresses forward to the current one.
  if (id !== trip.slug) redirect(`${tripPath(trip)}/edit`);
  const count = (await listEntries(trip.id)).length;
  // Only mention backups if one has actually been made.
  const lastBackup = backupsConfigured() ? ((await recentBackupRuns(20)).find((r) => r.ok)?.at ?? null) : null;
  return (
    <>
      <Header active="trips" />
      <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-6">
        <Link href={tripPath(trip)} className="text-sm font-medium text-accent hover:underline">
          ← Back to {trip.name}
        </Link>
        <section className="card">
          <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Trip settings</h1>
          <h2 className="section-title mb-3">Name</h2>
          <RenameTripForm id={trip.id} name={trip.name} />
        </section>
        <section className="card space-y-3">
          <h2 className="section-title text-bad">Delete trip</h2>
          <p className="text-sm text-muted">
            Deletes this trip and its {count} {count === 1 ? "entry" : "entries"}.{" "}
            {lastBackup ? (
              <>
                The last automatic backup (<LocalTime iso={lastBackup} />) has a copy, but anything added since then
                isn&apos;t in it, so download a JSON export first if you might want it back.
              </>
            ) : (
              <>
                <b>Automatic backups aren&apos;t set up</b>, so nothing else keeps a copy. Download a{" "}
                <a href={`/api/export?format=json&trip=${trip.id}`} className="font-medium text-accent hover:underline">
                  JSON export of this trip
                </a>{" "}
                first if you might want it back.
              </>
            )}
          </p>
          <form action={deleteTripAction}>
            <input type="hidden" name="id" value={trip.id} />
            <ConfirmSubmit
              message={`Delete "${trip.name}" and its ${count} entries? This can't be undone${lastBackup ? " here (restoring a backup brings back what it contains)" : ""}.`}
              className="btn-secondary text-bad"
            >
              Delete trip
            </ConfirmSubmit>
          </form>
        </section>
      </main>
    </>
  );
}
