import Link from "next/link";
import { logout } from "@/app/login/actions";

export function Header({ active }: { active?: "trips" | "settings" }) {
  const link = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${on ? "bg-white/25" : "hover:bg-white/15"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="hero text-white shadow-lg shadow-accent/20">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-auto flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-white/20 text-base">✈︎</span>
          Travel Ledger
        </Link>
        {link("/trips", "Trips", active === "trips")}
        {link("/settings", "Settings", active === "settings")}
        <form action={logout}>
          <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/15 hover:text-white">
            Lock
          </button>
        </form>
      </div>
    </header>
  );
}
