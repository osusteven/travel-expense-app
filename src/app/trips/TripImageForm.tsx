"use client";

import { useActionState, useState } from "react";
import { saveTripImageAction, type TripState } from "@/app/actions";
import { toBanner } from "@/lib/imageIcon";

/** Add, change or remove a trip's picture. */
export function TripImageForm({ id, image }: { id: string; image?: string | null }) {
  const [state, action, pending] = useActionState<TripState & { ok?: string }, FormData>(saveTripImageAction, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = preview ?? image ?? null;
  // Chosen but not saved yet (after saving, the page sends it back as `image`).
  const unsaved = !!preview && preview !== image;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="image" value={preview ?? ""} />
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- inline data URL
        <img src={shown} alt="Trip picture" className="aspect-[3/1] w-full rounded-xl object-cover" />
      ) : (
        <div className="grid aspect-[3/1] w-full place-items-center rounded-xl border-2 border-dashed border-line text-sm text-muted">
          No picture yet
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-secondary cursor-pointer">
          {shown ? "Change picture" : "Add a picture"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setError(null);
                setPreview(await toBanner(file));
              } catch {
                setError("Couldn't read that picture. Try a JPEG or PNG.");
              }
            }}
          />
        </label>
        {unsaved && (
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Saving…" : "Save picture"}
          </button>
        )}
        {image && !unsaved && (
          <button type="submit" name="remove" value="1" disabled={pending} className="min-h-11 px-2 text-sm text-muted hover:underline">
            Remove picture
          </button>
        )}
        {state.ok && !pending && !unsaved && <span className="text-sm text-good">{state.ok}</span>}
      </div>
      {(error || state.error) && <p className="text-sm text-bad">{error ?? state.error}</p>}
      <p className="text-xs text-muted">Shown on the Trips list and as the banner on this trip. It&apos;s cropped to a wide strip.</p>
    </form>
  );
}
