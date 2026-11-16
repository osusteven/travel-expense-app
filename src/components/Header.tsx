import Link from "next/link";
import { logout } from "@/app/login/actions";

export function Header() {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-auto text-lg font-semibold">
          Travel Ledger
        </Link>
        <a href="/api/export?format=csv" className="btn-secondary">
          Export CSV
        </a>
        <a href="/api/export?format=json" className="btn-secondary hidden sm:inline-flex">
          JSON
        </a>
        <form action={logout}>
          <button type="submit" className="px-2 py-2 text-sm text-muted hover:text-foreground">
            Lock
          </button>
        </form>
      </div>
    </header>
  );
}
