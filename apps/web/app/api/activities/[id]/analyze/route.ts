import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { analyzeActivity, type ActivityMetrics } from "@/lib/groq";

const USER_DAILY_LIMIT = parseInt(process.env.USER_DAILY_LIMIT ?? "5");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const stravaId = (session?.user as any)?.stravaId;
  if (!stravaId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lang = "tr" } = await req.json().catch(() => ({}));

  const [userRow] = await sql`SELECT id FROM users WHERE strava_id = ${stravaId} LIMIT 1`;
  if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const userId = userRow.id;

  // Daily limit check
  const [usage] = await sql`
    SELECT COUNT(*)::int AS count FROM analyses
    WHERE user_id = ${userId} AND created_at >= CURRENT_DATE
  `;
  const remaining = USER_DAILY_LIMIT - usage.count;
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "daily_limit_reached", limit: USER_DAILY_LIMIT, used: usage.count },
      { status: 429 }
    );
  }

  const [a] = await sql`
    SELECT * FROM activities WHERE id = ${id} AND user_id = ${userId} LIMIT 1
  `;
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const metrics: ActivityMetrics = {
    activity_type: a.type,
    summary:    { duration_seconds: a.duration_seconds, moving_seconds: a.moving_seconds, started_at: a.started_at },
    metrics:    { distance_km: a.distance_km, avg_speed_kmh: a.avg_speed_kmh, max_speed_kmh: a.max_speed_kmh },
    elevation:  { elevation_gain_m: a.elevation_gain_m },
    heart_rate: { hr_avg: a.hr_avg, hr_max: a.hr_max },
  };

  const cards = await analyzeActivity(metrics, lang);
  if (!cards.length) return NextResponse.json({ error: "No cards generated" }, { status: 500 });

  const [saved] = await sql`
    INSERT INTO analyses (activity_id, user_id, cards, ai_model, lang)
    VALUES (${id}, ${userId}, ${JSON.stringify(cards)}, 'groq/llama-3.3-70b', ${lang})
    RETURNING id, cards, ai_model, lang, created_at
  `;

  return NextResponse.json({
    id: saved.id, cards, ai_model: saved.ai_model, lang: saved.lang,
    remaining: remaining - 1, limit: USER_DAILY_LIMIT,
  });
}
