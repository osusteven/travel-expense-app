import { Header } from "@/components/Header";
import { backupsConfigured, listBackups } from "@/lib/backup";
import { config, people } from "@/lib/config";
import { ALL_CURRENCIES, POPULAR } from "@/lib/currencyData";
import { toOptions } from "@/lib/currencyOptions";
import { listEntries, recentBackupRuns } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { enabledCurrencies } from "@/lib/settings";
import { BackupNowButton, ImportForm, RestoreButton } from "./BackupControls";
import { CurrencySettings } from "./CurrencySettings";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function SettingsPage() {
  await requireAuth();
  const home = config.homeCurrency;
  const configured = backupsConfigured();
  const [enabled, entries, runs, backups] = await Promise.all([
    enabledCurrencies(),
    listEntries(),
    recentBackupRuns(8),
    listBackups().catch(() => null),
  ]);
  const lastOk = runs.find((r) => r.ok);
  const lastRun = runs[0];
  const inUse = [...new Set(entries.map((e) => e.currency))];

  return (
    <>
      <Header active="settings" />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>

        <section className="card space-y-3">
          <h2 className="section-title">
            <span aria-hidden>💱</span> Currencies
          </h2>
          <p className="text-sm text-muted">Choose which currencies appear in the form.</p>
          <CurrencySettings all={toOptions(ALL_CURRENCIES)} enabled={enabled} popular={POPULAR} home={home} inUse={inUse} />
        </section>

        <section className="card space-y-4">
          <h2 className="section-title">
            <span aria-hidden>🛟</span> Automatic backups
          </h2>
          {!configured ? (
            <div className="rounded-xl bg-accent-3/10 p-3 text-sm">
              <b>Not set up yet.</b> In Vercel, open <b>Storage → Create → Blob</b>, choose <b>Private</b>, and connect it
              to this project. Then add a <code>CRON_SECRET</code> environment variable (any long random text) and
              redeploy. See the README for the hourly retry setup.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Status
                label="Last successful backup"
                value={lastOk ? when(lastOk.at) : "None yet"}
                tone={lastOk ? "good" : "bad"}
                detail={lastOk ? `${lastOk.entries} entries · ${lastOk.trigger}` : undefined}
              />
              <Status
                label="Last attempt"
                value={lastRun ? when(lastRun.at) : "None yet"}
                tone={!lastRun || lastRun.ok ? "good" : "bad"}
                detail={lastRun && !lastRun.ok ? `Failed: ${lastRun.error}` : lastRun ? "Succeeded" : undefined}
              />
            </div>
          )}
          <p className="text-sm text-muted">
            A backup is made once a day. If it fails, it&apos;s retried every hour until it works. The last 60 are kept,
            privately, in Vercel Blob storage, separate from the database.
          </p>
          <BackupNowButton disabled={!configured} />
          {configured && backups && backups.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-subtle text-left text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Backup</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {backups.slice(0, 15).map((b) => (
                    <tr key={b.pathname}>
                      <td className="px-3 py-2">
                        {when(b.uploadedAt)}
                        <span className="block text-xs text-muted">{b.pathname.split("-").pop()?.replace(".json", "")}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted">{(b.size / 1024).toFixed(1)} KB</td>
                      <td className="space-x-3 px-3 py-2 text-right whitespace-nowrap">
                        <a className="text-sm font-medium text-accent hover:underline" href={`/api/backups/download?path=${encodeURIComponent(b.pathname)}`}>
                          Download
                        </a>
                        <RestoreButton path={b.pathname} label={when(b.uploadedAt)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card space-y-3">
          <h2 className="section-title">
            <span aria-hidden>📥</span> Import
          </h2>
          <p className="text-sm text-muted">
            Load a JSON export or a downloaded backup from this app, for example to recover after a problem or move to a
            new database.
          </p>
          <ImportForm />
        </section>

        <section className="card space-y-3">
          <h2 className="section-title">
            <span aria-hidden>📤</span> Export
          </h2>
          <div className="flex flex-wrap gap-2">
            <a href="/api/export?format=csv" className="btn-secondary">
              Download CSV (spreadsheet)
            </a>
            <a href="/api/export?format=json" className="btn-secondary">
              Download JSON (full backup)
            </a>
          </div>
        </section>

        <section className="card text-sm">
          <h2 className="section-title mb-2">
            <span aria-hidden>ℹ️</span> About this ledger
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">People</dt>
            <dd>
              {people.p1} &amp; {people.p2}
            </dd>
            <dt className="text-muted">Home currency</dt>
            <dd>{home}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted">
            Names, password and home currency are set as environment variables in Vercel (see the README).
          </p>
        </section>
      </main>
    </>
  );
}

function Status({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-semibold">
        <span aria-hidden className={tone === "good" ? "text-good" : "text-bad"}>
          {tone === "good" ? "●" : "▲"}
        </span>
        {value}
      </p>
      {detail && <p className={`mt-0.5 text-xs ${tone === "bad" ? "text-bad" : "text-muted"}`}>{detail}</p>}
    </div>
  );
}
