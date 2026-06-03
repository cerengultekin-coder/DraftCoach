import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { getValidToken } from "@/lib/strava";

export async function POST() {
  const session = await auth();
  const stravaId = (session?.user as any)?.stravaId;
  if (!stravaId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await sql`
    SELECT id, access_token, refresh_token, token_expires_at
    FROM users WHERE strava_id = ${stravaId} LIMIT 1
  `;
  if (!users.length) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const user = users[0];
  const token = await getValidToken(user);

  // Strava activity list — last 30 activities
  const res = await fetch(
    "https://www.strava.com/api/v3/athlete/activities?per_page=30&page=1",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    console.error("[import] Strava API error:", res.status);
    return NextResponse.json({ error: "Strava API error" }, { status: 502 });
  }

  const activities = await res.json();
  if (!Array.isArray(activities)) {
    return NextResponse.json({ imported: 0 });
  }

  let imported = 0;
  for (const a of activities) {
    const result = await sql`
      INSERT INTO activities (
        user_id, strava_id, name, type,
        distance_km, duration_seconds, moving_seconds,
        avg_speed_kmh, max_speed_kmh, elevation_gain_m,
        hr_avg, hr_max, started_at, raw_data
      ) VALUES (
        ${user.id},
        ${a.id},
        ${a.name},
        ${a.type},
        ${a.distance / 1000},
        ${a.elapsed_time},
        ${a.moving_time},
        ${(a.average_speed ?? 0) * 3.6},
        ${(a.max_speed ?? 0) * 3.6},
        ${a.total_elevation_gain ?? 0},
        ${a.average_heartrate ?? null},
        ${a.max_heartrate ?? null},
        ${a.start_date},
        ${JSON.stringify(a)}
      )
      ON CONFLICT (strava_id) DO NOTHING
      RETURNING id
    `;
    if (result.length) imported++;
  }

  console.log(`[import] Imported ${imported} activities for athlete ${stravaId}`);
  return NextResponse.json({ imported });
}
