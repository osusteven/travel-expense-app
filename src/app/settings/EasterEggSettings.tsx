"use client";

import { useActionState, useState } from "react";
import { toIcon } from "@/lib/imageIcon";
import { saveEasterEggAction, type ActionResult } from "./actions";

export function EasterEggSettings({ photo }: { photo?: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveEasterEggAction, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = preview ?? photo;
  // A picture has been chosen but not saved yet (after saving, the page sends it back as `photo`).
  const unsaved = !!preview && preview !== photo;

  return (
    <form action={action} className="flex flex-wrap items-center gap-4">
      <input type="hidden" name="photo" value={preview ?? ""} />
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- small inline data URL
        <img src={shown} alt="Easter egg" width={64} height={64} className="h-16 w-16 rounded-full object-cover ring-4 ring-[#4ade80]" />
      ) : (
        <span className="grid h-16 w-16 place-items-center rounded-full bg-subtle text-2xl">🥚</span>
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="cursor-pointer font-medium text-accent hover:underline">
            {shown ? "Change picture" : "Choose picture"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setError(null);
                  setPreview(await toIcon(file));
                } catch {
                  setError("Couldn't read that picture. Try a JPEG or PNG.");
                }
              }}
            />
          </label>
          {photo && !unsaved && (
            <button type="submit" name="remove" value="1" className="text-muted hover:underline">
              Remove
            </button>
          )}
        </div>
        {unsaved && (
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Saving…" : "Save picture"}
          </button>
        )}
        {(error || state.error) && <p className="text-sm text-bad">{error ?? state.error}</p>}
        {state.ok && !pending && !unsaved && <p className="text-sm text-good">{state.ok}</p>}
      </div>
    </form>
  );
}
