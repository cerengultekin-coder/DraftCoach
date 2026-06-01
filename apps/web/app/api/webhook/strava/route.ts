import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? "draftcoach_webhook";

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
    const body = await req.json();
    console.log("[webhook] Received event:", JSON.stringify(body));

    // Only process activity create/update events
    if (body.object_type !== "activity" || body.aspect_type !== "create") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const stravaActivityId = body.object_id;
    const stravaAthleteId  = body.owner_id;

    // Find user in Supabase
    const supabase = supabaseAdmin();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, access_token, refresh_token, token_expires_at")
      .eq("strava_id", stravaAthleteId)
      .single();

    if (userError || !user) {
      console.error("[webhook] User not found for athlete:", stravaAthleteId);
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Check if activity already exists
    const { data: existing } = await supabase
      .from("activities")
      .select("id")
      .eq("strava_id", stravaActivityId)
      .single();

    if (existing) {
      console.log("[webhook] Activity already processed:", stravaActivityId);
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Fetch activity from Strava API
    const token = await getValidToken(user, supabase);
    const activityData = await fetchStravaActivity(stravaActivityId, token);

    if (!activityData) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Only process cycling activities
    const cyclingTypes = ["Ride", "VirtualRide", "EBikeRide", "Velomobile", "Handcycle"];
    if (!cyclingTypes.includes(activityData.type)) {
      console.log("[webhook] Skipping non-cycling activity:", activityData.type);
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Save activity to Supabase
    const { data: savedActivity, error: saveError } = await supabase
      .from("activities")
      .insert({
        user_id:          user.id,
        strava_id:        stravaActivityId,
        name:             activityData.name,
        type:             activityData.type,
        distance_km:      activityData.distance / 1000,
        duration_seconds: activityData.elapsed_time,
        moving_seconds:   activityData.moving_time,
        avg_speed_kmh:    activityData.average_speed * 3.6,
        max_speed_kmh:    activityData.max_speed * 3.6,
        elevation_gain_m: activityData.total_elevation_gain,
        hr_avg:           activityData.average_heartrate ?? null,
        hr_max:           activityData.max_heartrate ?? null,
        started_at:       activityData.start_date,
        raw_data:         activityData,
      })
      .select()
      .single();

    if (saveError) {
      console.error("[webhook] Failed to save activity:", saveError.message);
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    // Trigger AI analysis in background
    triggerAnalysis(savedActivity.id, user.id, activityData).catch(console.error);

    console.log("[webhook] Activity saved:", savedActivity.id);
    return NextResponse.json({ ok: true, activity_id: savedActivity.id });

  } catch (err: any) {
    console.error("[webhook] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getValidToken(user: any, supabase: any): Promise<string> {
  const expiresAt = new Date(user.token_expires_at).getTime();
  const now       = Date.now();

  // Token still valid
  if (expiresAt > now + 60_000) return user.access_token;

  // Refresh token
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

  // Update in Supabase
  await supabase
    .from("users")
    .update({
      access_token:    data.access_token,
      refresh_token:   data.refresh_token,
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
      updated_at:      new Date().toISOString(),
    })
    .eq("id", user.id);

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
    elevation: {
      elevation_gain_m: activityData.total_elevation_gain,
    },
    heart_rate: {
      hr_avg: activityData.average_heartrate,
      hr_max: activityData.max_heartrate,
    },
  };

  // Call FastAPI AI coach
  const res = await fetch(`${apiBase}/v1/activities:ai-coach?lang=tr`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(metrics),
  });

  if (!res.ok) {
    console.error("[analysis] AI coach failed:", res.status);
    return;
  }

  // Collect streaming response
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

  // Save analysis to Supabase
  const supabase = supabaseAdmin();
  await supabase.from("analyses").insert({
    activity_id: activityId,
    user_id:     userId,
    cards,
    ai_model:    "groq/llama-3.3-70b",
  });

  console.log("[analysis] Saved", cards.length, "cards for activity", activityId);
}