import sql from "@/lib/db";
import { getValidToken } from "@/lib/strava";
import { getAuthedUser, ok, unauthorized } from "@/lib/api";

const IMPORT_COUNT = 30;

export async function POST() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const [row] = await sql`
    SELECT id, access_token, refresh_token, token_expires_at
    FROM users WHERE id = ${user.id} LIMIT 1
  `;
  if (!row) return unauthorized();

  const token = await getValidToken(row);

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${IMPORT_COUNT}&page=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    console.error("[import] Strava API error:", res.status);
    return Response.json({ error: "Strava API error" }, { status: 502 });
  }

  const activities = await res.json();
  if (!Array.isArray(activities)) return ok({ imported: 0 });

  let imported = 0;
  for (const a of activities) {
    const result = await sql`
      INSERT INTO activities (
        user_id, strava_id, name, type,
        distance_km, duration_seconds, moving_seconds,
        avg_speed_kmh, max_speed_kmh, elevation_gain_m,
        hr_avg, hr_max, started_at, raw_data
      ) VALUES (
        ${user.id}, ${a.id}, ${a.name}, ${a.type},
        ${a.distance / 1000}, ${a.elapsed_time}, ${a.moving_time},
        ${(a.average_speed ?? 0) * 3.6}, ${(a.max_speed ?? 0) * 3.6},
        ${a.total_elevation_gain ?? 0},
        ${a.average_heartrate ?? null}, ${a.max_heartrate ?? null},
        ${a.start_date}, ${JSON.stringify(a)}
      )
      ON CONFLICT (strava_id) DO NOTHING
      RETURNING id
    `;
    if (result.length) imported++;
  }

  return ok({ imported });
}
