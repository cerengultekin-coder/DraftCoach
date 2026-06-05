"use client";

import { sportColor } from "@/lib/sports";
import SportIcon from "./SportIcon";

/* ─── Sport hero background watermark ─────────────────────────────────────
   Large, faint sport icon in the top-right of the activity detail header.
─────────────────────────────────────────────────────────────────────────── */
export function SportHeroBg({ type }: { type: string }) {
  return (
    <div
      className="sport-hero-bg"
      aria-hidden
      style={{ "--sport-color": sportColor(type) } as React.CSSProperties}
    >
      <SportIcon type={type} size={150} className="sport-hero-bg__icon" />
    </div>
  );
}

/* ─── Coach GOAT badge ─────────────────────────────────────────────────────
   Brand mark (goat) for the Coach GOAT section header.
─────────────────────────────────────────────────────────────────────────── */
export function CoachGoatBadge() {
  return (
    <div className="coach-goat-badge" aria-hidden>
      🐐
    </div>
  );
}
