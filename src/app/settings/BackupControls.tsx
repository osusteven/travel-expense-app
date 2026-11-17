"use client";

import { useActionState } from "react";
import { backupNowAction, importAction, restoreBackupAction, type ActionResult } from "./actions";

function Result({ state }: { state: ActionResult }) {
  if (state.ok) return <p className="text-sm text-good">{state.ok}</p>;
  if (state.error) return <p className="text-sm text-bad">{state.error}</p>;
  return null;
}

export function BackupNowButton({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<ActionResult>(backupNowAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending || disabled} className="btn-primary">
        {pending ? "Backing up…" : "Back up now"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function RestoreButton({ path, uploadedAt }: { path: string; uploadedAt: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(restoreBackupAction, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const label = new Date(uploadedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
        if (!confirm(`Replace all current entries with the backup from ${label}? A safety backup of the current data is made first.`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="path" value={path} />
      <button type="submit" disabled={pending} className="text-sm font-medium text-accent hover:underline">
        {pending ? "Restoring…" : "Restore"}
      </button>
      {(state.ok || state.error) && (
        <span className={`ml-2 text-xs ${state.ok ? "text-good" : "text-bad"}`}>{state.ok ?? state.error}</span>
      )}
    </form>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(importAction, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const data = new FormData(e.currentTarget);
        if (data.get("mode") === "replace" && !confirm("Replace ALL current entries with the file's entries?")) {
          e.preventDefault();
        }
      }}
      className="space-y-3"
    >
      <input
        type="file"
        name="file"
        accept=".json,application/json"
        required
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent/15 file:px-3 file:py-2 file:font-medium file:text-accent"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-start gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/5">
          <input type="radio" name="mode" value="merge" defaultChecked className="mt-0.5" />
          <span>
            <b>Merge</b>
            <span className="block text-muted">Add entries that are missing and update ones that already exist. Nothing is removed.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/5">
          <input type="radio" name="mode" value="replace" className="mt-0.5" />
          <span>
            <b>Replace everything</b>
            <span className="block text-muted">Make the ledger exactly match the file. Use this to recover after a problem.</span>
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Importing…" : "Import"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}
