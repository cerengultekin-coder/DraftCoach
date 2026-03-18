from __future__ import annotations

import math
from datetime import timezone
from uuid import uuid4
from typing import Optional

import gpxpy
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="DraftCoach API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


# ─── Helpers ────────────────────────────────────────────────────────────────

def _iso(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _lang(lang: str | None) -> str:
    return "en" if lang == "en" else "tr"


def _extract_points(gpx) -> list:
    points: list = []
    for track in gpx.tracks:
        for segment in track.segments:
            points.extend(segment.points)
    if len(points) < 2:
        for route in gpx.routes:
            points.extend(route.points)
    if len(points) < 2:
        points.extend(gpx.waypoints)
    return points


def _bounds_from_coords(coords: list[list[float]]):
    if len(coords) < 2:
        return None
    lats = [c[0] for c in coords]
    lons = [c[1] for c in coords]
    return {
        "min_lat": min(lats), "min_lon": min(lons),
        "max_lat": max(lats), "max_lon": max(lons),
    }


def _downsample_coords(coords: list[list[float]], max_points: int) -> list[list[float]]:
    if len(coords) <= max_points:
        return coords
    step = max(1, len(coords) // max_points)
    out = coords[::step]
    if out and out[-1] != coords[-1]:
        out.append(coords[-1])
    return out


def _filter_route_segments(
    points,
    *,
    max_gap_s: int = 120,
    max_speed_kmh: float = 60.0,
    max_points_per_segment: int = 2500,
):
    pts_ll = [
        p for p in points
        if getattr(p, "latitude", None) is not None
        and getattr(p, "longitude", None) is not None
    ]
    if len(pts_ll) < 2:
        return []

    if not any(getattr(p, "time", None) is not None for p in pts_ll):
        coords = [[float(p.latitude), float(p.longitude)] for p in pts_ll]
        coords = _downsample_coords(coords, max_points_per_segment)
        return [coords] if len(coords) >= 2 else []

    pts = [p for p in pts_ll if getattr(p, "time", None) is not None]
    if len(pts) < 2:
        coords = [[float(p.latitude), float(p.longitude)] for p in pts_ll]
        coords = _downsample_coords(coords, max_points_per_segment)
        return [coords] if len(coords) >= 2 else []

    segments: list[list[list[float]]] = []
    cur: list[list[float]] = [[float(pts[0].latitude), float(pts[0].longitude)]]
    prev = pts[0]

    for p in pts[1:]:
        dt = (p.time - prev.time).total_seconds()
        d = _haversine_m(prev.latitude, prev.longitude, p.latitude, p.longitude)

        if dt is None or dt <= 0:
            if len(cur) >= 2:
                segments.append(_downsample_coords(cur, max_points_per_segment))
            cur = [[float(p.latitude), float(p.longitude)]]
            prev = p
            continue

        v_kmh = (d / dt) * 3.6
        if dt > max_gap_s or v_kmh > max_speed_kmh:
            if len(cur) >= 2:
                segments.append(_downsample_coords(cur, max_points_per_segment))
            cur = [[float(p.latitude), float(p.longitude)]]
            prev = p
            continue

        cur.append([float(p.latitude), float(p.longitude)])
        prev = p

    if len(cur) >= 2:
        segments.append(_downsample_coords(cur, max_points_per_segment))

    return segments


# ─── Extension data parsing (HR, cadence, power, elevation) ─────────────────

def _get_extension_value(point, *keys) -> Optional[float]:
    """Try to extract numeric extension values (HR, cadence, power, temp)."""
    try:
        for ext in (point.extensions or []):
            for key in keys:
                # Direct tag match
                tag = ext.tag.split("}")[-1] if "}" in ext.tag else ext.tag
                if tag.lower() == key.lower() and ext.text:
                    return float(ext.text)
                # Check children
                for child in ext:
                    ctag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                    if ctag.lower() == key.lower() and child.text:
                        return float(child.text)
    except Exception:
        pass
    return None


def _parse_timeseries(points, *, max_gap_s: int = 120, max_speed_kmh: float = 60.0):
    """
    Build a rich timeseries list from GPX points.
    Each item: {t, lat, lon, ele, hr, speed_kmh, distance_km}
    """
    pts = [
        p for p in points
        if getattr(p, "latitude", None) is not None
        and getattr(p, "longitude", None) is not None
        and getattr(p, "time", None) is not None
    ]
    if len(pts) < 2:
        return []

    t0 = pts[0].time
    series = []
    cum_dist = 0.0
    prev = pts[0]

    for i, p in enumerate(pts):
        ele = float(p.elevation) if p.elevation is not None else None
        hr = _get_extension_value(p, "hr", "heartrate", "HeartRateBpm", "Value")
        cadence = _get_extension_value(p, "cad", "cadence", "RunCadence")
        power = _get_extension_value(p, "power", "Watts")

        if i == 0:
            series.append({
                "t": 0,
                "lat": float(p.latitude),
                "lon": float(p.longitude),
                "ele": ele,
                "hr": hr,
                "cadence": cadence,
                "power": power,
                "speed_kmh": 0.0,
                "distance_km": 0.0,
            })
            continue

        dt = (p.time - prev.time).total_seconds()
        d = _haversine_m(prev.latitude, prev.longitude, p.latitude, p.longitude)

        if dt <= 0:
            prev = p
            continue

        v_kmh = (d / dt) * 3.6

        # Skip GPS spikes / big gaps from cumulative distance
        if dt <= max_gap_s and v_kmh <= max_speed_kmh:
            cum_dist += d

        elapsed = (p.time - t0).total_seconds()

        series.append({
            "t": int(elapsed),
            "lat": float(p.latitude),
            "lon": float(p.longitude),
            "ele": ele,
            "hr": hr,
            "cadence": cadence,
            "power": power,
            "speed_kmh": round(v_kmh, 2) if v_kmh <= max_speed_kmh else None,
            "distance_km": round(cum_dist / 1000, 3),
        })
        prev = p

    return series


def _elevation_stats(points, smooth_window: int = 5) -> dict:
    eles = [float(p.elevation) for p in points if getattr(p, "elevation", None) is not None]
    if not eles:
        return {}
    # Smooth elevation to remove GPS altitude noise before computing gain/loss
    smoothed: list[float] = []
    for i in range(len(eles)):
        lo = max(0, i - smooth_window // 2)
        hi = min(len(eles), i + smooth_window // 2 + 1)
        smoothed.append(sum(eles[lo:hi]) / (hi - lo))
    gain = 0.0
    loss = 0.0
    for i in range(1, len(smoothed)):
        d = smoothed[i] - smoothed[i - 1]
        if d > 0:
            gain += d
        else:
            loss += abs(d)
    return {
        "min_ele_m": round(min(eles), 1),
        "max_ele_m": round(max(eles), 1),
        "elevation_gain_m": round(gain, 1),
        "elevation_loss_m": round(loss, 1),
    }


def _hr_stats(timeseries: list) -> dict:
    hrs = [p["hr"] for p in timeseries if p.get("hr") is not None]
    if not hrs:
        return {}
    return {
        "hr_min": int(min(hrs)),
        "hr_max": int(max(hrs)),
        "hr_avg": int(sum(hrs) / len(hrs)),
    }


# ─── Metrics ────────────────────────────────────────────────────────────────

def _smooth_speed(speeds: list[float], window: int = 3) -> list[float]:
    """Simple moving average to smooth speed for max detection."""
    if len(speeds) < window:
        return speeds
    out = []
    for i in range(len(speeds)):
        lo = max(0, i - window // 2)
        hi = min(len(speeds), i + window // 2 + 1)
        out.append(sum(speeds[lo:hi]) / (hi - lo))
    return out


def _compute_metrics(points, *, max_gap_s: int = 120, max_speed_kmh: float = 45.0, moving_speed_kmh: float = 1.5, min_dist_m: float = 10.0):
    pts_ll = [
        p for p in points
        if getattr(p, "latitude", None) is not None
        and getattr(p, "longitude", None) is not None
    ]
    points_count = len(pts_ll)

    distance_m_raw = 0.0
    if len(pts_ll) >= 2:
        prev = None
        for p in pts_ll:
            if prev is not None:
                distance_m_raw += _haversine_m(prev.latitude, prev.longitude, p.latitude, p.longitude)
            prev = p

    pts = [p for p in pts_ll if getattr(p, "time", None) is not None]

    started_at = ended_at = elapsed_seconds = None
    if pts:
        times = [p.time for p in pts]
        started_at = min(times)
        ended_at = max(times)
        elapsed_seconds = int((ended_at - started_at).total_seconds())
        if elapsed_seconds < 0:
            elapsed_seconds = None

    distance_m_filtered = 0.0
    moving_seconds_f = 0.0          # float to avoid int(dt) rounding drift
    valid_speeds: list[float] = []  # only non-spiked speeds

    if len(pts) >= 2:
        prev = pts[0]
        for cur in pts[1:]:
            dt = (cur.time - prev.time).total_seconds()
            d = _haversine_m(prev.latitude, prev.longitude, cur.latitude, cur.longitude)
            if dt is None or dt <= 0:
                prev = cur
                continue
            v_kmh = (d / dt) * 3.6
            # Skip GPS spikes and big time gaps
            if dt > max_gap_s or v_kmh > max_speed_kmh:
                prev = cur
                continue
            # Only count distance for steps ≥ min_dist_m (kills GPS standstill noise)
            if d >= min_dist_m:
                distance_m_filtered += d
            valid_speeds.append(v_kmh)
            if v_kmh >= moving_speed_kmh:
                moving_seconds_f += dt
            prev = cur

    moving_seconds = int(moving_seconds_f)

    # Max speed: smooth over 5 consecutive valid samples to kill 1-point GPS spikes
    max_speed_observed = None
    if valid_speeds:
        smoothed = _smooth_speed(valid_speeds, window=5)
        max_speed_observed = round(max(smoothed), 1)

    distance_km_raw = round(distance_m_raw / 1000.0, 3)
    distance_km = round(distance_m_filtered / 1000.0, 3)

    # Avg speed: use float moving time (matches Garmin/Wahoo behavior)
    avg_speed_kmh = None
    if moving_seconds_f and moving_seconds_f > 0:
        avg_speed_kmh = round((distance_m_filtered / moving_seconds_f) * 3.6, 1)

    # Also compute elapsed-based avg (total time including stops)
    avg_speed_kmh_elapsed = None
    if elapsed_seconds and elapsed_seconds > 0:
        avg_speed_kmh_elapsed = round((distance_m_filtered / elapsed_seconds) * 3.6, 1)

    return {
        "points_count": points_count,
        "started_at": started_at,
        "ended_at": ended_at,
        "elapsed_seconds": elapsed_seconds,
        "moving_seconds": moving_seconds if moving_seconds > 0 else None,
        "distance_km": distance_km,
        "distance_km_raw": distance_km_raw,
        "avg_speed_kmh": avg_speed_kmh,
        "avg_speed_kmh_elapsed": avg_speed_kmh_elapsed,
        "max_speed_kmh": max_speed_observed,
    }


# ─── Coach Cards (richer logic) ─────────────────────────────────────────────

def _build_coach_cards(lang: str, metrics: dict, ele_stats: dict, hr_stats: dict):
    cards: list[dict] = []

    elapsed = metrics.get("elapsed_seconds")
    moving = metrics.get("moving_seconds")
    dist_km = metrics.get("distance_km", 0) or 0
    max_speed = metrics.get("max_speed_kmh")
    avg_speed = metrics.get("avg_speed_kmh")

    def card(title_tr, detail_tr, title_en, detail_en, severity="info"):
        cards.append({
            "title": title_en if lang == "en" else title_tr,
            "detail": detail_en if lang == "en" else detail_tr,
            "severity": severity,
        })

    # ── No timestamps ──────────────────────────────────────────────────
    if elapsed is None:
        card(
            "Zaman verisi eksik", "Bu GPX'te güvenilir zaman damgası yok. Süre tabanlı metrikler hesaplanamadı.",
            "Missing timestamps", "This GPX has no reliable timestamps. Duration-based metrics are unavailable.",
        )

    # ── Ride completed ─────────────────────────────────────────────────
    if dist_km and dist_km > 0:
        if dist_km >= 100:
            card(
                "Muhteşem bir sürüş! 💪", f"{dist_km:.1f} km tamamladın — bu ciddi bir başarı. Toparlanmaya zaman ayır.",
                "Epic ride! 💪", f"You completed {dist_km:.1f} km — that's a serious achievement. Prioritize recovery.",
                "info"
            )
        elif dist_km >= 50:
            card(
                "Harika iş! 🚴", f"{dist_km:.1f} km bitirdin. Kasların için yeterli protein ve karbonhidrat almayı unutma.",
                "Great effort! 🚴", f"You completed {dist_km:.1f} km. Make sure to refuel with protein and carbs.",
                "info"
            )
        elif dist_km >= 20:
            card(
                "Güzel sürüş", f"{dist_km:.1f} km tamamlandı. Düzenli aralıklarla hidrasyon kritik.",
                "Solid ride", f"{dist_km:.1f} km completed. Consistent hydration is key on rides like this.",
                "info"
            )
        elif dist_km < 5:
            card(
                "Kısa aktivite", f"Yalnızca {dist_km:.1f} km. Isınma veya kısa interval antrenmanı olarak değerlendirilebilir.",
                "Short activity", f"Only {dist_km:.1f} km. Could be a warm-up or short interval session.",
                "info"
            )

    # ── Speed analysis ─────────────────────────────────────────────────
    if avg_speed is not None:
        if avg_speed > 40:
            card(
                "Yüksek hız uyarısı ⚡", f"Ortalama {avg_speed:.1f} km/s — bu çok yüksek. GPS spike ihtimali var, verini kontrol et.",
                "High speed warning ⚡", f"Average {avg_speed:.1f} km/h — unusually high. Possible GPS artifact, verify your data.",
                "warning"
            )
        elif avg_speed > 30:
            card(
                "Hız: Pro seviye 🔥", f"Ortalama {avg_speed:.1f} km/s. Bu ciddi bir tempo — aero pozisyon ve beslenme planına dikkat et.",
                "Speed: Pro level 🔥", f"Average {avg_speed:.1f} km/h. Serious tempo — focus on aero position and nutrition timing.",
                "info"
            )
        elif avg_speed > 22:
            card(
                "İyi tempo", f"Ortalama {avg_speed:.1f} km/s — iyi bir hız. Sürdürülebilir zone 3-4 bölgesinde görünüyor.",
                "Good tempo", f"Average {avg_speed:.1f} km/h — solid pace, likely in sustainable zone 3-4.",
                "info"
            )
        elif avg_speed < 12 and dist_km > 5:
            card(
                "Düşük ortalama hız", f"Ortalama {avg_speed:.1f} km/s — bu yokuşlu arazi veya çok mola içerip içermediğini kontrol et.",
                "Low average speed", f"Average {avg_speed:.1f} km/h — check if terrain was hilly or ride included many stops.",
                "info"
            )

    # ── GPS spikes ─────────────────────────────────────────────────────
    if max_speed is not None and max_speed > 70:
        card(
            "GPS sıçraması tespit edildi", f"Maks hız {max_speed:.0f} km/s — bu gerçekçi değil. Sıçramalar mesafe hesabından çıkarıldı.",
            "GPS spike detected", f"Peak speed {max_speed:.0f} km/h — not realistic. Spikes are excluded from distance calculations.",
            "warning"
        )

    # ── Moving vs elapsed time ─────────────────────────────────────────
    if elapsed is not None and moving is not None and elapsed > 0 and moving > 0:
        ratio = moving / elapsed
        stop_min = int((elapsed - moving) / 60)
        if ratio < 0.5:
            card(
                "Uzun duraklamalar var", f"Toplam süreden ~{stop_min} dakika durmaya harcandı. Yarışlarda durak sürelerini kısaltmak önemli.",
                "Long stops detected", f"~{stop_min} minutes spent stopped. In races, minimizing stop time matters.",
                "info"
            )
        elif ratio < 0.8:
            card(
                "Bazı duraklamalar mevcut", f"~{stop_min} dakika durakladın. Normal bir yolculuk için makul.",
                "Some stops detected", f"~{stop_min} minutes stopped. Reasonable for a normal ride.",
                "info"
            )

    # ── Elevation insights ─────────────────────────────────────────────
    if ele_stats:
        gain = ele_stats.get("elevation_gain_m", 0) or 0
        if gain > 2000:
            card(
                "Dağcı seviyesi tırmanış! ⛰️", f"{gain:.0f}m toplam tırmanış — bu çok ciddi. Bacak kaslarına özel toparlanma protokolü uygula.",
                "Mountain-level climbing! ⛰️", f"{gain:.0f}m total elevation gain — very demanding. Apply targeted leg recovery protocol.",
                "warning"
            )
        elif gain > 1000:
            card(
                "Zorlu tırmanış", f"{gain:.0f}m yükseklik kazanımı. Kalp atış hızın yokuş tepelerinde zirve yapıyor olmalı — bu normal.",
                "Challenging climb", f"{gain:.0f}m elevation gain. Heart rate likely peaked on climbs — this is expected.",
                "info"
            )
        elif gain > 300:
            card(
                "Orta düzey arazi", f"{gain:.0f}m tırmanış var. Yokuş segmentlerinde kadansını korumaya çalış.",
                "Rolling terrain", f"{gain:.0f}m of climbing. Try to maintain cadence on uphill segments.",
                "info"
            )
        elif gain < 50 and dist_km > 10:
            card(
                "Düz arazi", f"Yalnızca {gain:.0f}m tırmanış — neredeyse düz. Aero pozisyon ve hız sürekliliğine odaklan.",
                "Flat terrain", f"Only {gain:.0f}m of climbing — nearly flat. Focus on aero position and speed consistency.",
                "info"
            )

    # ── Heart rate insights ─────────────────────────────────────────────
    if hr_stats:
        hr_avg = hr_stats.get("hr_avg")
        hr_max = hr_stats.get("hr_max")
        hr_min = hr_stats.get("hr_min")

        if hr_max and hr_max > 190:
            card(
                "Maksimum kalp atışı çok yüksek ❤️‍🔥", f"Maks {hr_max} bpm — bu limitin üzerinde olabilir. Aşırı yüklenmeden kaçın.",
                "Very high max HR ❤️‍🔥", f"Max {hr_max} bpm — may exceed safe limits. Avoid overexertion.",
                "warning"
            )
        elif hr_max and hr_max > 170:
            card(
                "Yüksek yoğunluklu efor", f"Maks {hr_max} bpm ile zone 5'e girdin. Anaerobik kapasiteni zorladın.",
                "High intensity effort", f"Max {hr_max} bpm — you hit zone 5. You pushed anaerobic capacity.",
                "info"
            )

        if hr_avg and hr_avg < 100 and dist_km > 10:
            card(
                "Düşük ortalama nabız", f"Ort. {hr_avg} bpm — bu oldukça düşük. Rahat tempo veya sensör sorunu olabilir.",
                "Low average HR", f"Avg {hr_avg} bpm — quite low. Could be an easy recovery ride or sensor issue.",
                "info"
            )
        elif hr_avg and 120 <= hr_avg <= 150:
            card(
                "Aerobik bölge ✅", f"Ort. {hr_avg} bpm — mükemmel aerobik bölge. Dayanıklılık geliştirmek için ideal.",
                "Aerobic zone ✅", f"Avg {hr_avg} bpm — excellent aerobic zone. Ideal for building endurance.",
                "info"
            )
        elif hr_avg and hr_avg > 160:
            card(
                "Yüksek tempo antrenmanı", f"Ort. {hr_avg} bpm — sürekli yüksek yoğunluk. Toparlanma gününü atlamayın.",
                "Threshold training", f"Avg {hr_avg} bpm — sustained high intensity. Don't skip recovery days.",
                "warning"
            )

    return cards


# ─── Upload endpoint ─────────────────────────────────────────────────────────

@app.post("/v1/activities:upload")
async def upload_activity(
    file: UploadFile = File(...),
    lang: str = Query("tr"),
):
    lang = _lang(lang)
    activity_id = str(uuid4())

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        text = raw.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode file as text")

    try:
        gpx = gpxpy.parse(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GPX parse failed: {e}")

    points = _extract_points(gpx)
    if len(points) < 2:
        raise HTTPException(status_code=400, detail="GPX has too few points")

    metrics_calc = _compute_metrics(points)
    segments = _filter_route_segments(points)
    flat_coords: list[list[float]] = [c for seg in segments for c in seg]
    bounds = _bounds_from_coords(flat_coords)

    # Rich extras
    timeseries = _parse_timeseries(points)
    ele_stats = _elevation_stats(points)
    hr_stats = _hr_stats(timeseries)

    cards = _build_coach_cards(lang, metrics_calc, ele_stats, hr_stats)

    # Downsample timeseries for frontend (max 500 points)
    ts_step = max(1, len(timeseries) // 500)
    timeseries_sampled = timeseries[::ts_step]

    return {
        "activity_id": activity_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size_bytes": len(raw),
        "status": "parsed",
        "summary": {
            "points_count": metrics_calc["points_count"],
            "started_at": _iso(metrics_calc["started_at"]),
            "ended_at": _iso(metrics_calc["ended_at"]),
            "duration_seconds": metrics_calc["elapsed_seconds"],
            "moving_seconds": metrics_calc["moving_seconds"],
        },
        "metrics": {
            "distance_km": metrics_calc["distance_km"],
            "distance_km_raw": metrics_calc["distance_km_raw"],
            "avg_speed_kmh": metrics_calc["avg_speed_kmh"],
            "avg_speed_kmh_elapsed": metrics_calc["avg_speed_kmh_elapsed"],
            "max_speed_kmh": metrics_calc["max_speed_kmh"],
        },
        "elevation": ele_stats,
        "heart_rate": hr_stats,
        "route": {
            "segments": segments,
            "bounds": bounds,
        },
        "timeseries": timeseries_sampled,
        "coach_cards": cards,
    }


# ─── Groq AI Coach endpoint ──────────────────────────────────────────────────

import os
import json
import httpx
import threading
from datetime import date
from fastapi.responses import StreamingResponse

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


def _build_coach_prompt(lang: str, data: dict) -> str:
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

    stats_block = f"""
Activity stats:
- Distance: {dist:.2f} km
- Elapsed time: {fmt_dur(dur_s)}
- Moving time: {fmt_dur(mov_s)}
- Average speed (moving): {avg_spd:.1f} km/h
- Max speed: {max_spd:.1f} km/h
- Elevation gain: {gain:.0f} m
- Heart rate avg: {hr_avg} bpm
- Heart rate max: {hr_max} bpm
- Heart rate min: {hr_min} bpm
- GPS points: {pts}
- Started at: {started}
"""

    if lang == "tr":
        return f"""Sen deneyimli bir bisiklet antrenörüsün. Aşağıdaki sürüş verisini analiz et ve sporcuya kişisel, detaylı ve aksiyonel antrenman tavsiyeleri ver.

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
- Genel tavsiyelerden kaçın — spesifik sayıları (bpm, km, hız) kullan
- severity: info = pozitif/nötr bilgi, warning = dikkat et, error = ciddi sorun
- Sadece JSON döndür"""
    else:
        return f"""You are an experienced cycling coach. Analyze the ride data below and provide personalized, detailed, actionable coaching advice.

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
- Avoid generic advice — reference specific numbers (bpm, km, speed) from the data
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