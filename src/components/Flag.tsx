import { flagCode } from "@/lib/currencyData";

/** Country flag for a currency (SVG from flag-icons, so it also shows on Windows). */
export function Flag({ currency, className = "" }: { currency: string; className?: string }) {
  const code = flagCode(currency);
  if (!code) return <span className={`inline-block h-[0.75em] w-[1em] rounded-sm bg-line ${className}`} aria-hidden />;
  return <span className={`fi fi-${code} ${className}`} aria-hidden />;
}
