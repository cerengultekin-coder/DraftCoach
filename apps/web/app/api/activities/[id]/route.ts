import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const stravaId = (session?.user as any)?.stravaId;
  if (!stravaId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT
      a.id, a.strava_id, a.name, a.type,
      a.distance_km, a.duration_seconds, a.moving_seconds,
      a.avg_speed_kmh, a.max_speed_kmh, a.elevation_gain_m,
      a.hr_avg, a.hr_max, a.started_at,
      COALESCE(
        json_agg(
          json_build_object('id', an.id, 'cards', an.cards, 'ai_model', an.ai_model, 'lang', COALESCE(an.lang, 'tr'), 'created_at', an.created_at)
          ORDER BY an.created_at DESC
        ) FILTER (WHERE an.id IS NOT NULL),
        '[]'
      ) AS analyses
    FROM activities a
    LEFT JOIN analyses an ON an.activity_id = a.id
    WHERE a.id = ${id}
      AND a.user_id = (SELECT id FROM users WHERE strava_id = ${stravaId} LIMIT 1)
    GROUP BY a.id
  `;

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
