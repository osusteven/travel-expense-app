"use client";

import { useActionState } from "react";
import { createTripAction, renameTripAction, type TripState } from "@/app/actions";

export function NewTripForm() {
  const [state, action, pending] = useActionState<TripState, FormData>(createTripAction, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="label">Trip name</span>
        <input name="name" required maxLength={100} autoFocus placeholder="e.g. Japan & Korea 2026" className="input mt-1" />
      </label>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creating…" : "Create trip"}
      </button>
      <p className="text-xs text-muted">The new trip becomes the current one, so new entries go into it.</p>
    </form>
  );
}

export function RenameTripForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<TripState, FormData>(renameTripAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="block">
        <span className="label">Trip name</span>
        <input name="name" required maxLength={100} defaultValue={name} className="input mt-1" />
      </label>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}
