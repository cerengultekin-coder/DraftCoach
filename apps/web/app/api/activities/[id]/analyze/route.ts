import sql from "@/lib/db";
import { analyzeActivity, type ActivityMetrics } from "@/lib/groq";
import { getAuthedUser, asLang, ok, unauthorized, notFound, serverError } from "@/lib/api";

const USER_DAILY_LIMIT = parseInt(process.env.USER_DAILY_LIMIT ?? "5", 10) || 5;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const lang = asLang(body.lang);

  // Enforce per-user daily analysis limit at the database level
  const [usage] = await sql`
    SELECT COUNT(*)::int AS count FROM analyses
    WHERE user_id = ${user.id} AND created_at >= CURRENT_DATE
  `;
  const remaining = USER_DAILY_LIMIT - (usage?.count ?? 0);
  if (remaining <= 0) {
    return Response.json(
      { error: "daily_limit_reached", limit: USER_DAILY_LIMIT, used: usage?.count ?? 0 },
      { status: 429 }
    );
  }

  const [a] = await sql`
    SELECT * FROM activities WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
  `;
  if (!a) return notFound();

  const metrics: ActivityMetrics = {
    activity_type: a.type,
    summary:    { duration_seconds: a.duration_seconds, moving_seconds: a.moving_seconds, started_at: a.started_at },
    metrics:    { distance_km: a.distance_km, avg_speed_kmh: a.avg_speed_kmh, max_speed_kmh: a.max_speed_kmh },
    elevation:  { elevation_gain_m: a.elevation_gain_m },
    heart_rate: { hr_avg: a.hr_avg, hr_max: a.hr_max },
  };

  let cards;
  try {
    cards = await analyzeActivity(metrics, lang);
  } catch (err) {
    console.error("[analyze] Groq error:", err);
    return serverError("AI analysis failed");
  }
  if (!cards.length) return serverError("No cards generated");

  const [saved] = await sql`
    INSERT INTO analyses (activity_id, user_id, cards, ai_model, lang)
    VALUES (${id}, ${user.id}, ${JSON.stringify(cards)}, 'groq/llama-3.3-70b', ${lang})
    RETURNING id, cards, ai_model, lang, created_at
  `;

  return ok({
    id: saved.id, cards, ai_model: saved.ai_model, lang: saved.lang,
    remaining: remaining - 1, limit: USER_DAILY_LIMIT,
  });
}
