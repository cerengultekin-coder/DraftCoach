import { NextRequest } from "next/server";
import sql from "@/lib/db";
import { getAuthedUser, ok, unauthorized } from "@/lib/api";

const PAGE_SIZE = 8;

export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const page   = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [counts] = await sql`
    SELECT
      COUNT(DISTINCT a.id)::int AS total,
      COUNT(DISTINCT a.id) FILTER (WHERE an.id IS NOT NULL)::int AS analyzed
    FROM activities a
    LEFT JOIN analyses an ON an.activity_id = a.id
    WHERE a.user_id = ${user.id}
  `;
  const total = counts?.total ?? 0;
  const totalAnalyzed = counts?.analyzed ?? 0;

  const activities = await sql`
    SELECT
      a.id, a.strava_id, a.name, a.type,
      a.distance_km, a.duration_seconds, a.avg_speed_kmh,
      a.elevation_gain_m, a.hr_avg, a.started_at,
      COALESCE(
        json_agg(json_build_object('id', an.id, 'cards', an.cards))
        FILTER (WHERE an.id IS NOT NULL),
        '[]'
      ) AS analyses
    FROM activities a
    LEFT JOIN analyses an ON an.activity_id = a.id
    WHERE a.user_id = ${user.id}
    GROUP BY a.id
    ORDER BY a.started_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  return ok({
    activities,
    page,
    total,
    totalAnalyzed,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
