"use client";

import { sportEmoji, sportColor } from "@/lib/sports";

/* ─── Sport hero background watermark ─────────────────────────────────────
   Renders a large sport emoji + GOAT emoji as a transparent decorative
   element in the top-right of the activity detail header.
─────────────────────────────────────────────────────────────────────────── */
export function SportHeroBg({ type }: { type: string }) {
  const emoji = sportEmoji(type);
  const color = sportColor(type);

  return (
    <div
      className="sport-hero-bg"
      aria-hidden
      style={{ "--sport-color": color } as React.CSSProperties}
    >
      <span className="sport-hero-bg__sport">{emoji}</span>
    </div>
  );
}

/* ─── Coach GOAT badge ─────────────────────────────────────────────────────
   Clean emoji badge used in the Coach GOAT section header.
─────────────────────────────────────────────────────────────────────────── */
export function CoachGoatBadge() {
  return (
    <div className="coach-goat-badge" aria-hidden>
      🐐
    </div>
  );
}
