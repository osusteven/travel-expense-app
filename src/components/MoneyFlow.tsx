import type { PersonKey } from "@/lib/ledger";
import { Avatar } from "./Avatar";

type Direction = "left" | "right";

/** Arrow between the two people, pointing toward whoever is owed. */
export function FlowArrow({ direction }: { direction: Direction }) {
  return (
    <div aria-hidden className="relative mx-1 h-9">
      <span className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/60" />
      <span
        className={`absolute top-1/2 -translate-y-1/2 text-2xl font-bold leading-none text-white/90 ${
          direction === "right" ? "right-0" : "left-0"
        }`}
      >
        {direction === "right" ? "›" : "‹"}
      </span>
    </div>
  );
}

// Fixed pseudo-random layout, so the server and browser draw the same thing.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DROPS = (() => {
  const rand = seeded(20261116);
  return Array.from({ length: 16 }, () => {
    const duration = 4 + rand() * 5; // 4–9 s to cross
    return {
      top: 4 + rand() * 88, // % down the block
      size: 0.85 + rand() * 1.15, // rem
      duration,
      delay: -rand() * duration, // already mid-flight on load
      drift: (rand() - 0.5) * 30, // px of up/down wobble
      opacity: 0.55 + rand() * 0.4,
    };
  });
})();

/**
 * Green dollar signs drifting sideways across the whole balance block, like rain blown toward whoever is owed.
 * Decorative only (the text says who owes whom); hidden when the device asks for reduced motion.
 */
export type Face = { person: PersonKey; name: string; photo?: string };

/*
 * Every 15 seconds one of the dollar signs is one of your icons instead, alternating between the two of you.
 * Each face has a 30 s cycle and crosses in the first 5 s of it; the second face is offset by 15 s.
 * The negative delays make the first one appear about 3 s after the page opens.
 */
const FACE_DELAYS = ["-27s", "-12s"];
const FACE_TOPS = ["30%", "58%"];

export function MoneyRain({ direction, faces = [] }: { direction: Direction; faces?: Face[] }) {
  return (
    <div aria-hidden className="money-rain pointer-events-none absolute inset-0 overflow-hidden">
      {faces.slice(0, 2).map((f, i) => (
        <span
          key={f.person}
          className="money-face"
          data-person={f.person}
          style={{
            top: FACE_TOPS[i],
            animationDelay: FACE_DELAYS[i],
            animationDirection: direction === "right" ? "normal" : "reverse",
          }}
        >
          <Avatar person={f.person} name={f.name} photo={f.photo} size={40} />
        </span>
      ))}
      {DROPS.map((d, i) => (
        <span
          key={i}
          className="money-drop"
          style={{
            top: `${d.top}%`,
            fontSize: `${d.size}rem`,
            opacity: d.opacity,
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
            animationDirection: direction === "right" ? "normal" : "reverse",
            ["--drift" as string]: `${d.drift}px`,
          }}
        >
          $
        </span>
      ))}
    </div>
  );
}
