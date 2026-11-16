import Link from "next/link";
import { Header } from "@/components/Header";
import { listTrips } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { NewTripForm } from "../TripForms";

export default async function NewTripPage() {
  await requireAuth();
  const hasTrips = (await listTrips()).length > 0;
  return (
    <>
      <Header active="trips" />
      <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-6">
        {hasTrips && (
          <Link href="/trips" className="text-sm font-medium text-accent hover:underline">
            ← All trips
          </Link>
        )}
        <section className="card">
          <h1 className="section-title mb-4">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-base">🧳</span>
            {hasTrips ? "New trip" : "Start your first trip"}
          </h1>
          <NewTripForm />
        </section>
      </main>
    </>
  );
}
