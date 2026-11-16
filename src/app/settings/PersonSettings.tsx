"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { PersonKey } from "@/lib/ledger";
import { savePersonAction, type ActionResult } from "./actions";

/** Center-crops and shrinks a picture to a 256×256 JPEG in the browser, so uploads stay tiny. */
async function toIcon(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function PersonSettings({
  person,
  name,
  photo,
  venmo,
}: {
  person: PersonKey;
  name: string;
  photo?: string;
  venmo?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(savePersonAction, {});
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = remove ? undefined : (newPhoto ?? photo);

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line p-4" style={{ borderTop: `4px solid var(--${person})` }}>
      <input type="hidden" name="person" value={person} />
      <input type="hidden" name="photo" value={newPhoto ?? ""} />
      <input type="hidden" name="removePhoto" value={remove ? "1" : ""} />
      <div className="flex items-center gap-3">
        <Avatar person={person} name={name} photo={shown} size={64} />
        <div className="min-w-0">
          <p className="font-bold">{name}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            <label className="cursor-pointer font-medium text-accent hover:underline">
              {shown ? "Change photo" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setError(null);
                    setNewPhoto(await toIcon(file));
                    setRemove(false);
                  } catch {
                    setError("Couldn't read that picture. Try a JPEG or PNG.");
                  }
                }}
              />
            </label>
            {shown && (
              <button type="button" className="text-muted hover:underline" onClick={() => { setNewPhoto(null); setRemove(true); }}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <label className="block">
        <span className="label">Venmo username</span>
        <div className="mt-1 flex items-center">
          <span className="rounded-l-lg border border-r-0 border-line bg-subtle px-2.5 py-2 text-sm text-muted">@</span>
          <input name="venmo" defaultValue={venmo} placeholder="optional" autoComplete="off" className="input rounded-l-none" />
        </div>
      </label>
      {(error || state.error) && <p className="text-sm text-bad">{error ?? state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save"}
        </button>
        {state.ok && !pending && <span className="text-sm text-good">{state.ok}</span>}
      </div>
    </form>
  );
}
