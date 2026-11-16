import type { PersonKey } from "@/lib/ledger";

/** A person's round icon: their photo if one was uploaded, otherwise their initial on their color. */
export function Avatar({
  person,
  name,
  photo,
  size = 40,
  ring = false,
}: {
  person: PersonKey;
  name: string;
  photo?: string;
  size?: number;
  /** White ring, for use on colored backgrounds. */
  ring?: boolean;
}) {
  const style = { width: size, height: size, fontSize: size * 0.42, background: `var(--${person})` };
  const cls = `inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white ${
    ring ? "ring-4 ring-white/80 shadow-lg" : ""
  }`;
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- small inline data URL, nothing to optimize
    <img src={photo} alt={name} width={size} height={size} className={`${cls} object-cover`} style={style} />
  ) : (
    <span className={cls} style={style} role="img" aria-label={name}>
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
