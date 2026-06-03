import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getValidToken } from "@/lib/strava";
import { analyzeActivity, type ActivityMetrics } from "@/lib/groq";

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
if (!VERIFY_TOKEN) throw new Error("STRAVA_WEBHOOK_VERIFY_TOKEN env var is not set");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.log("[webhook] Strava verification successful");
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const sig = req.headers.get("x-hub-signature");
    if (sig) {
      const expected = "sha1=" + createHmac("sha1", VERIFY_TOKEN!).update(rawBody).digest("hex");
      if (sig !== expected) {
        console.warn("[webhook] Invalid signature");
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = JSON.parse(rawBody);
    if (body.object_type !== "activity" || body.aspect_type !== "create") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const stravaActivityId = body.object_id;
    const stravaAthleteId  = body.owner_id;

    const [user] = await sql`
      SELECT id, access_token, refresh_token, token_expires_at
      FROM users WHERE strava_id = ${stravaAthleteId} LIMIT 1
    `;
    if (!user) return NextResponse.json({ ok: true, skipped: true });

    const [existing] = await sql`SELECT id FROM activities WHERE strava_id = ${stravaActivityId} LIMIT 1`;
    if (existing) return NextResponse.json({ ok: true, skipped: true });

    const token = await getValidToken(user);
    const activityData = await fetchStravaActivity(stravaActivityId, token);
    if (!activityData) return NextResponse.json({ ok: true, skipped: true });

    const [saved] = await sql`
      INSERT INTO activities (
        user_id, strava_id, name, type,
        distance_km, duration_seconds, moving_seconds,
        avg_speed_kmh, max_speed_kmh, elevation_gain_m,
        hr_avg, hr_max, started_at, raw_data
      ) VALUES (
        ${user.id}, ${stravaActivityId}, ${activityData.name}, ${activityData.type},
        ${activityData.distance / 1000}, ${activityData.elapsed_time}, ${activityData.moving_time},
        ${activityData.average_speed * 3.6}, ${activityData.max_speed * 3.6},
        ${activityData.total_elevation_gain},
        ${activityData.average_heartrate ?? null}, ${activityData.max_heartrate ?? null},
        ${activityData.start_date}, ${JSON.stringify(activityData)}
      ) RETURNING id
    `;

    triggerAnalysis(saved.id, user.id, activityData).catch(console.error);
    return NextResponse.json({ ok: true, activity_id: saved.id });

  } catch (err: any) {
    console.error("[webhook] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function fetchStravaActivity(activityId: number, token: string) {
  const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { console.error("[webhook] Strava API error:", res.status); return null; }
  return res.json();
}

async function triggerAnalysis(activityId: string, userId: string, a: any) {
  const metrics: ActivityMetrics = {
    activity_type: a.type,
    summary:    { duration_seconds: a.elapsed_time, moving_seconds: a.moving_time, started_at: a.start_date },
    metrics:    { distance_km: a.distance / 1000, avg_speed_kmh: a.average_speed * 3.6, max_speed_kmh: a.max_speed * 3.6 },
    elevation:  { elevation_gain_m: a.total_elevation_gain },
    heart_rate: { hr_avg: a.average_heartrate ?? null, hr_max: a.max_heartrate ?? null },
  };

  const cards = await analyzeActivity(metrics, "tr");
  if (!cards.length) return;

  await sql`
    INSERT INTO analyses (activity_id, user_id, cards, ai_model, lang)
    VALUES (${activityId}, ${userId}, ${JSON.stringify(cards)}, 'groq/llama-3.3-70b', 'tr')
  `;
  console.log("[analysis] Saved", cards.length, "cards for activity", activityId);
}
