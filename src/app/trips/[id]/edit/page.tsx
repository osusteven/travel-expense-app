import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTripAction } from "@/app/actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Header } from "@/components/Header";
import { getTrip, listEntries } from "@/lib/db";
import { tripPath } from "@/lib/ledger";
import { requireAuth } from "@/lib/session";
import { RenameTripForm } from "../../TripForms";

export default async function EditTripPage({ params }: PageProps<"/trips/[id]/edit">) {
  await requireAuth();
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();
  const count = (await listEntries(trip.id)).length;
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
            Deletes this trip and its {count} {count === 1 ? "entry" : "entries"}. Download a JSON export first if you
            might want it back; automatic backups also keep a copy.
          </p>
          <form action={deleteTripAction}>
            <input type="hidden" name="id" value={trip.id} />
            <ConfirmSubmit
              message={`Delete "${trip.name}" and its ${count} entries? This can't be undone here (restore a backup to recover).`}
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
