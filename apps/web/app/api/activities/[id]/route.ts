import sql from "@/lib/db";
import { getAuthedUser, ok, unauthorized, notFound } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const [activity] = await sql`
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
    WHERE a.id = ${id} AND a.user_id = ${user.id}
    GROUP BY a.id
  `;

  if (!activity) return notFound();
  return ok(activity);
}
