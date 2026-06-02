import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
if (!VERIFY_TOKEN) {
  throw new Error("STRAVA_WEBHOOK_VERIFY_TOKEN env var is not set");
}

// GET — Strava webhook verification challenge
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

// POST — Strava activity event
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify Strava webhook signature
    const sig = req.headers.get("x-hub-signature");
    if (sig) {
      const expected = "sha1=" + createHmac("sha1", VERIFY_TOKEN!).update(rawBody).digest("hex");
      if (sig !== expected) {
        console.warn("[webhook] Invalid signature");
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = JSON.parse(rawBody);
    console.log("[webhook] Received event:", JSON.stringify(body));

    if (body.object_type !== "activity" || body.aspect_type !== "create") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const stravaActivityId = body.object_id;
    const stravaAthleteId  = body.owner_id;

    // Find user
    const users = await sql`
      SELECT id, access_token, refresh_token, token_expires_at
      FROM users
      WHERE strava_id = ${stravaAthleteId}
      LIMIT 1
    `;
    if (!users.length) {
      console.error("[webhook] User not found for athlete:", stravaAthleteId);
      return NextResponse.json({ ok: true, skipped: true });
    }
    const user = users[0];

    // Check if activity already exists
    const existing = await sql`
      SELECT id FROM activities WHERE strava_id = ${stravaActivityId} LIMIT 1
    `;
    if (existing.length) {
      console.log("[webhook] Activity already processed:", stravaActivityId);
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Fetch activity from Strava API
    const token = await getValidToken(user);
    const activityData = await fetchStravaActivity(stravaActivityId, token);
    if (!activityData) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Save activity
    const saved = await sql`
      INSERT INTO activities (
        user_id, strava_id, name, type,
        distance_km, duration_seconds, moving_seconds,
        avg_speed_kmh, max_speed_kmh, elevation_gain_m,
        hr_avg, hr_max, started_at, raw_data
      ) VALUES (
        ${user.id},
        ${stravaActivityId},
        ${activityData.name},
        ${activityData.type},
        ${activityData.distance / 1000},
        ${activityData.elapsed_time},
        ${activityData.moving_time},
        ${activityData.average_speed * 3.6},
        ${activityData.max_speed * 3.6},
        ${activityData.total_elevation_gain},
        ${activityData.average_heartrate ?? null},
        ${activityData.max_heartrate ?? null},
        ${activityData.start_date},
        ${JSON.stringify(activityData)}
      )
      RETURNING id
    `;

    const activityId = saved[0].id;
    triggerAnalysis(activityId, user.id, activityData).catch(console.error);

    console.log("[webhook] Activity saved:", activityId);
    return NextResponse.json({ ok: true, activity_id: activityId });

  } catch (err: any) {
    console.error("[webhook] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getValidToken(user: any): Promise<string> {
  const expiresAt = new Date(user.token_expires_at).getTime();
  if (expiresAt > Date.now() + 60_000) return user.access_token;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type:    "refresh_token",
      refresh_token: user.refresh_token,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  await sql`
    UPDATE users SET
      access_token     = ${data.access_token},
      refresh_token    = ${data.refresh_token},
      token_expires_at = ${new Date(data.expires_at * 1000).toISOString()},
      updated_at       = NOW()
    WHERE id = ${user.id}
  `;

  return data.access_token;
}

async function fetchStravaActivity(activityId: number, token: string) {
  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    console.error("[webhook] Strava API error:", res.status);
    return null;
  }
  return res.json();
}

async function triggerAnalysis(activityId: string, userId: string, activityData: any) {
  const apiBase = process.env.INTERNAL_API_URL ?? "http://localhost:8000";

  const metrics = {
    activity_type: activityData.type,
    summary: {
      duration_seconds: activityData.elapsed_time,
      moving_seconds:   activityData.moving_time,
      points_count:     0,
      started_at:       activityData.start_date,
    },
    metrics: {
      distance_km:   activityData.distance / 1000,
      avg_speed_kmh: activityData.average_speed * 3.6,
      max_speed_kmh: activityData.max_speed * 3.6,
    },
    elevation: { elevation_gain_m: activityData.total_elevation_gain },
    heart_rate: {
      hr_avg: activityData.average_heartrate,
      hr_max: activityData.max_heartrate,
    },
  };

  const res = await fetch(`${apiBase}/v1/activities:ai-coach?lang=tr`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(metrics),
  });

  if (!res.ok) {
    console.error("[analysis] AI coach failed:", res.status);
    return;
  }

  const reader = res.body!.getReader();
  const dec    = new TextDecoder();
  let   buf    = "";
  let   cards: any[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.done && ev.cards) cards = ev.cards;
      } catch {}
    }
  }

  if (!cards.length) return;

  await sql`
    INSERT INTO analyses (activity_id, user_id, cards, ai_model)
    VALUES (${activityId}, ${userId}, ${JSON.stringify(cards)}, 'groq/llama-3.3-70b')
  `;

  console.log("[analysis] Saved", cards.length, "cards for activity", activityId);
}
