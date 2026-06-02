from __future__ import annotations

import json
import os
import threading
from datetime import date

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="DraftCoach API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "https://draft-coach.vercel.app",
        "https://draft-coach.vercel.app/en",
        "https://draft-coach.vercel.app/tr"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


# ─── Helpers ────────────────────────────────────────────────────────────────

def _lang(lang: str | None) -> str:
    return "en" if lang == "en" else "tr"


# ─── Groq AI Coach endpoint ──────────────────────────────────────────────────

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"   # ücretsiz, güçlü model

# ── Usage counter (in-memory, resets on server restart or new day) ────────────
_usage: dict = {"date": "", "count": 0}
DAILY_LIMIT  = 14_000          # Groq free tier daily limit
WARN_AT      = [0.70, 0.90]    # warn at 70% and 90%
_warned: set = set()

def _track_usage() -> int:
    """Increment counter, send email if crossing a threshold. Returns new count."""
    today = date.today().isoformat()
    if _usage["date"] != today:
        _usage["date"]  = today
        _usage["count"] = 0
        _warned.clear()
    _usage["count"] += 1
    count = _usage["count"]

    # Check thresholds
    pct = count / DAILY_LIMIT
    for threshold in WARN_AT:
        if pct >= threshold and threshold not in _warned:
            _warned.add(threshold)
            threading.Thread(
                target=_send_telegram_alert,
                args=(count, int(threshold * 100)),
                daemon=True,
            ).start()

    return count


def _send_telegram_alert(count: int, pct: int):
    """Send warning email via Resend API."""
    api_key  = os.environ.get("RESEND_API_KEY", "")
    to_email = os.environ.get("ALERT_EMAIL_TO", "")

    emoji = "🚨" if pct >= 90 else "⚠️"
    print(f"{emoji} [DraftCoach] Groq usage at {pct}% — {count}/{DAILY_LIMIT} requests today")

    if not api_key or not to_email:
        print("   [INFO] RESEND_API_KEY or ALERT_EMAIL_TO not set — skipping email")
        return

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": "DraftCoach <onboarding@resend.dev>",
                "to": [to_email],
                "subject": f"DraftCoach: Groq limit %{pct} doldu ({count}/{DAILY_LIMIT})",
                "html": (
                    f'<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">'
                    f'<h2 style="color:#1D4ED8">DraftCoach — Groq API Uyarisi</h2>'
                    f'<p>Gunluk limit <strong>%{pct}</strong> doldu.</p>'
                    f'<div style="background:#F1F5F9;border-radius:8px;padding:16px;margin:16px 0">'
                    f'<p>Kullanim: <strong>{count} / {DAILY_LIMIT}</strong></p>'
                    f'<p>Kalan: <strong>{DAILY_LIMIT - count} istek</strong></p>'
                    f'<p>Tarih: {date.today().isoformat()}</p>'
                    f'</div>'
                    f'<p style="color:#EF4444">{"Kritik! Yeni Groq API key ekle." if pct >= 90 else "Yakinda limit dolabilir."}</p>'
                    f'</div>'
                ),
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            print(f"   [INFO] Resend email sent OK — id: {resp.json().get('id','?')}")
        else:
            print(f"   [ERROR] Resend {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"   [ERROR] Resend failed: {e}")


_SPORT_COACH: dict[str, tuple[str, str]] = {
    # tr, en
    "cycling":  ("deneyimli bir bisiklet antrenörüsün", "an experienced cycling coach"),
    "running":  ("deneyimli bir koşu antrenörüsün",     "an experienced running coach"),
    "swimming": ("deneyimli bir yüzme antrenörüsün",    "an experienced swimming coach"),
    "walking":  ("deneyimli bir yürüyüş ve outdoor antrenörüsün", "an experienced hiking and outdoor coach"),
    "strength": ("deneyimli bir kuvvet ve kondisyon antrenörüsün", "an experienced strength and conditioning coach"),
    "yoga":     ("deneyimli bir yoga eğitmenisin",      "an experienced yoga instructor"),
    "water":    ("deneyimli bir su sporları antrenörüsün", "an experienced water sports coach"),
    "winter":   ("deneyimli bir kış sporları antrenörüsün", "an experienced winter sports coach"),
    "default":  ("deneyimli bir spor antrenörüsün",     "an experienced sports coach"),
}

_SPORT_MAP: dict[str, str] = {
    **{t: "cycling"  for t in ["Ride","VirtualRide","EBikeRide","Velomobile","Handcycle"]},
    **{t: "running"  for t in ["Run","VirtualRun","TrailRun"]},
    **{t: "swimming" for t in ["Swim"]},
    **{t: "walking"  for t in ["Walk","Hike"]},
    **{t: "strength" for t in ["WeightTraining","Workout","Crossfit","RockClimbing"]},
    **{t: "yoga"     for t in ["Yoga"]},
    **{t: "water"    for t in ["Rowing","Kayaking","Canoeing","Surfing","SUP","Windsurf","Kitesurf"]},
    **{t: "winter"   for t in ["AlpineSki","BackcountrySki","CrossCountrySkiing","Snowboard","Snowshoe","IceSkate","NordicSki"]},
}


def _build_coach_prompt(lang: str, data: dict) -> str:
    activity_type = data.get("activity_type", "")
    sport_key  = _SPORT_MAP.get(activity_type, "default")
    coach_tr, coach_en = _SPORT_COACH[sport_key]
    coach_role = coach_en if lang == "en" else coach_tr

    m  = data.get("metrics", {})
    s  = data.get("summary", {})
    e  = data.get("elevation", {})
    hr = data.get("heart_rate", {})

    dist     = m.get("distance_km")
    avg_spd  = m.get("avg_speed_kmh")
    max_spd  = m.get("max_speed_kmh")
    dur_s    = s.get("duration_seconds")
    mov_s    = s.get("moving_seconds")
    gain     = e.get("elevation_gain_m")
    hr_avg   = hr.get("hr_avg")
    hr_max   = hr.get("hr_max")
    hr_min   = hr.get("hr_min")
    pts      = s.get("points_count")
    started  = s.get("started_at", "")

    def fmt_dur(sec):
        if not sec: return "unknown"
        h, m2 = divmod(int(sec), 3600)
        m2, ss = divmod(m2, 60)
        if h: return f"{h}h {m2}m {ss}s"
        return f"{m2}m {ss}s"

    def f(val, fmt=".1f", fallback="N/A"):
        return format(val, fmt) if val is not None else fallback

    stats_block = f"""
Activity type: {activity_type or "Unknown"}
Activity stats:
- Distance: {f(dist, ".2f")} km
- Elapsed time: {fmt_dur(dur_s)}
- Moving time: {fmt_dur(mov_s)}
- Average speed: {f(avg_spd)} km/h
- Max speed: {f(max_spd)} km/h
- Elevation gain: {f(gain, ".0f")} m
- Heart rate avg: {f(hr_avg, ".0f")} bpm
- Heart rate max: {f(hr_max, ".0f")} bpm
- Heart rate min: {f(hr_min, ".0f")} bpm
- GPS points: {pts if pts is not None else "N/A"}
- Started at: {started}
"""

    if lang == "tr":
        return f"""Sen {coach_role}. Aşağıdaki aktivite verisini analiz et ve sporcuya kişisel, detaylı ve aksiyonel antrenman tavsiyeleri ver.

{stats_block}

Lütfen şu formatta JSON döndür (başka hiçbir şey yazma, sadece JSON):
{{
  "cards": [
    {{
      "title": "Kısa başlık (max 6 kelime)",
      "detail": "Detaylı analiz ve tavsiye (2-4 cümle, spesifik ve aksiyonel)",
      "severity": "info" | "warning" | "error"
    }}
  ]
}}

Kurallar:
- Tam olarak 4-6 kart üret
- Her kart farklı bir konuya odaklanmalı: performans, toparlanma, beslenme/hidrasyon, teknik, gelecek antrenman planı
- Spor tipine ({activity_type}) özel tavsiyeler ver
- Genel tavsiyelerden kaçın — spesifik sayıları (bpm, km, hız) kullan
- severity: info = pozitif/nötr bilgi, warning = dikkat et, error = ciddi sorun
- Sadece JSON döndür"""
    else:
        return f"""You are {coach_role}. Analyze the activity data below and provide personalized, detailed, actionable coaching advice.

{stats_block}

Return ONLY valid JSON in this exact format (no other text):
{{
  "cards": [
    {{
      "title": "Short title (max 6 words)",
      "detail": "Detailed analysis and advice (2-4 sentences, specific and actionable)",
      "severity": "info" | "warning" | "error"
    }}
  ]
}}

Rules:
- Generate exactly 4-6 cards
- Each card should cover a different topic: performance, recovery, nutrition/hydration, technique, next training plan
- Tailor advice specifically for {activity_type} — avoid generic advice
- Reference specific numbers (bpm, km, speed) from the data
- severity: info = positive/neutral insight, warning = pay attention, error = serious concern
- Return ONLY the JSON"""


@app.post("/v1/activities:ai-coach")
async def ai_coach(
    request: dict,
    lang: str = Query("tr"),
):
    """
    Aktivite verisini Groq'a gönderir, streaming olarak AI koç kartları döndürür.
    Body: /v1/activities:upload endpoint'inin tam JSON response'u
    """
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set. Terminalde: set GROQ_API_KEY=gsk_...")

    lang = _lang(lang)
    prompt = _build_coach_prompt(lang, request)

    # Track usage + warn if nearing limit
    current_count = _track_usage()
    if current_count >= DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Günlük Groq API limiti doldu. Yarın tekrar deneyin."
        )

    payload = {
        "model": GROQ_MODEL,
        "max_tokens": 1500,
        "stream": True,
        "messages": [
            {
                "role": "system",
                "content": "You are an expert cycling coach. Always respond with valid JSON only, no markdown, no extra text."
            },
            {"role": "user", "content": prompt}
        ],
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async def stream_cards():
        full_text = ""
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream("POST", GROQ_API_URL, json=payload, headers=headers) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        yield f"data: {json.dumps({'error': body.decode()})}\n\n"
                        return

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:]
                        if raw.strip() == "[DONE]":
                            break
                        try:
                            ev = json.loads(raw)
                        except Exception:
                            continue

                        # OpenAI-compatible streaming format
                        choices = ev.get("choices", [])
                        if not choices:
                            continue
                        delta = choices[0].get("delta", {})
                        chunk = delta.get("content", "")
                        if chunk:
                            full_text += chunk
                            yield f"data: {json.dumps({'chunk': chunk})}\n\n"

        except Exception as ex:
            yield f"data: {json.dumps({'error': str(ex)})}\n\n"
            return

        # Parse final JSON and emit cards
        try:
            clean = full_text.strip()
            # Strip markdown fences if model added them
            if clean.startswith("```"):
                lines_c = clean.split("\n")
                clean = "\n".join(lines_c[1:] if len(lines_c) > 1 else lines_c)
            if clean.endswith("```"):
                lines_c = clean.split("\n")
                clean = "\n".join(lines_c[:-1])
            parsed = json.loads(clean.strip())
            cards  = parsed.get("cards", [])
            yield f"data: {json.dumps({'done': True, 'cards': cards})}\n\n"
        except Exception as ex:
            yield f"data: {json.dumps({'done': True, 'cards': [], 'parse_error': str(ex), 'raw': full_text[:500]})}\n\n"

    return StreamingResponse(stream_cards(), media_type="text/event-stream")

@app.get("/v1/usage")
def get_usage():
    """Groq API günlük kullanım durumu"""
    from datetime import date as _date
    today = _date.today().isoformat()
    count = _usage["count"] if _usage["date"] == today else 0
    return {
        "date": today,
        "groq_requests": count,
        "limit": DAILY_LIMIT,
        "percent": round(count / DAILY_LIMIT * 100, 1),
        "remaining": max(0, DAILY_LIMIT - count),
        "status": "ok" if count < DAILY_LIMIT * 0.7 else "warning" if count < DAILY_LIMIT * 0.9 else "critical",
    }