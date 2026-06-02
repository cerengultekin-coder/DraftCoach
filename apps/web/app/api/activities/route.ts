import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET() {
  const session = await auth();
  const stravaId = (session?.user as any)?.stravaId;

  if (!stravaId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activities = await sql`
    SELECT
      a.id, a.strava_id, a.name, a.type,
      a.distance_km, a.duration_seconds, a.avg_speed_kmh,
      a.elevation_gain_m, a.hr_avg, a.started_at,
      COALESCE(
        json_agg(
          json_build_object('id', an.id, 'cards', an.cards)
        ) FILTER (WHERE an.id IS NOT NULL),
        '[]'
      ) AS analyses
    FROM activities a
    LEFT JOIN analyses an ON an.activity_id = a.id
    WHERE a.user_id = (
      SELECT id FROM users WHERE strava_id = ${stravaId} LIMIT 1
    )
    GROUP BY a.id
    ORDER BY a.started_at DESC
    LIMIT 20
  `;

  return NextResponse.json(activities);
}
