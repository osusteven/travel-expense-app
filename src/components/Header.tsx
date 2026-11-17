import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { PersonKey } from "@/lib/ledger";

/**
 * The top bar uses the two people's colors (person 1 red, person 2 blue). On a trip it matches the balance below:
 * whoever owes on the left, whoever is owed on the right, so it swaps when the balance flips.
 */
export function Header({
  active,
  left = "p1",
  right = "p2",
}: {
  active?: "trips" | "settings";
  left?: PersonKey;
  right?: PersonKey;
}) {
  const background = `linear-gradient(110deg, color-mix(in oklab, var(--${left}) 85%, black), color-mix(in oklab, var(--${left}) 50%, var(--${right})) 50%, color-mix(in oklab, var(--${right}) 85%, black))`;
  const link = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition sm:px-3 ${on ? "bg-white/25" : "hover:bg-white/15"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="text-white shadow-lg shadow-black/15" style={{ background }}>
      <div className="mx-auto flex max-w-3xl items-center gap-0.5 px-3 py-2 sm:gap-1 sm:px-4 sm:py-3">
        <Link href="/" className="mr-auto flex min-h-11 items-center gap-2 whitespace-nowrap text-base font-extrabold tracking-tight sm:text-lg">
          <span aria-hidden className="hidden h-8 w-8 place-items-center rounded-xl bg-white/20 text-base min-[400px]:grid">✈︎</span>
          Travel Ledger
        </Link>
        {link("/trips", "Trips", active === "trips")}
        {link("/settings", "Settings", active === "settings")}
        <form action={logout}>
          <button type="submit" className="min-h-11 rounded-lg px-2.5 py-1.5 sm:px-3 text-sm font-medium text-white/80 hover:bg-white/15 hover:text-white">
            Lock
          </button>
        </form>
      </div>
    </header>
  );
}
