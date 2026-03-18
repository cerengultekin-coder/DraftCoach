"use client";

import dynamic from "next/dynamic";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Upload, MapPin, Timer, Gauge, TrendingUp,
  Heart, Mountain, ChevronRight, Activity,
  AlertTriangle, Info, ShieldAlert, Bike, Zap, Sparkles,
  Sun, Moon,
} from "lucide-react";

const RouteMap = dynamic(() => import("../components/RouteMap"), { ssr: false });
const ActivityCharts = dynamic(() => import("../components/ActivityCharts"), { ssr: false });

// ── Inline translations (state-based, works with locale override) ──────────
const MESSAGES = {
  tr: {
    uploadCardTitle: "GPX Yükle",
    chooseFile: "GPX dosyanızı yükleyin",
    uploadHint: "",
    uploadBtn: "Yükle & Analiz Et",
    uploading: "Analiz ediliyor…",
    summaryTitle: "Aktivite Özeti",
    emptyText: "GPX dosyası yükle, rota ve metrikler burada görünür.",
    noCardsTitle: "Henüz analiz yok",
    noCardsText: "GPX yükleyip \"GOAT'a Danış\" butonuna tıkla.",
    coachEyebrow: "Kişisel Antrenman",
    coachTitle: "AI Koç Önerileri",
    coachHint: "Sürüşünü yapay zeka ile analiz et.",
    metrics: {
      distance: "Mesafe", duration: "Toplam süre", movingTime: "Hareket:",
      avgSpeed: "Ort. hız", elevGain: "Tırmanış",
    },
  },
  en: {
    uploadCardTitle: "Upload GPX",
    chooseFile: "Upload your GPX file",
    uploadHint: "",
    uploadBtn: "Upload & Analyze",
    uploading: "Analyzing…",
    summaryTitle: "Activity Summary",
    emptyText: "Upload a GPX file to see route and metrics here.",
    noCardsTitle: "No analysis yet",
    noCardsText: "Upload a GPX and click \"Ask GOAT\".",
    coachEyebrow: "Personalized Coaching",
    coachTitle: "AI Coach Insights",
    coachHint: "Analyze your ride with AI.",
    metrics: {
      distance: "Distance", duration: "Elapsed time", movingTime: "Moving:",
      avgSpeed: "Avg speed", elevGain: "Elevation gain",
    },
  },
} as const;

function useT(locale: "tr" | "en") {
  const m = MESSAGES[locale];
  return (key: string) => {
    const parts = key.split(".");
    let val: any = m;
    for (const p of parts) val = val?.[p];
    return (val as string) ?? key;
  };
}

type Locale    = "tr" | "en";
type Severity  = "info" | "warning" | "error";
type CoachCard = { title: string; detail: string; severity: Severity };
type RouteBounds = { min_lat: number; min_lon: number; max_lat: number; max_lon: number };

type UploadResult = {
  activity_id: string; filename: string; size_bytes: number; status: string;
  summary?: { points_count: number; started_at: string | null; ended_at: string | null; duration_seconds: number | null; moving_seconds?: number | null };
  metrics?: { distance_km: number; distance_km_raw?: number; avg_speed_kmh: number | null; avg_speed_kmh_elapsed?: number | null; max_speed_kmh?: number | null };
  elevation?: { min_ele_m?: number; max_ele_m?: number; elevation_gain_m?: number; elevation_loss_m?: number };
  heart_rate?: { hr_min?: number; hr_max?: number; hr_avg?: number };
  route?: { segments: [number, number][][]; bounds: RouteBounds | null };
  coach_cards?: CoachCard[];
  timeseries?: { t: number; distance_km: number; ele: number | null; hr: number | null; speed_kmh: number | null }[];
};

const fmt = (v: number | null | undefined, d = 1) => v == null ? "—" : v.toFixed(d);

function fmtDur(s: number | null | undefined): string {
  if (s == null) return "—";
  const sec = Math.max(0, s);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }); }
  catch { return ""; }
}

function normalizeLocale(x: unknown): Locale { return x === "en" ? "en" : "tr"; }
const SEV_LABELS: Record<Severity, string> = { info: "INFO", warning: "WARN", error: "CRIT" };

function SevIcon({ s, size=16 }: { s: Severity; size?: number }) {
  const c: Record<Severity, string> = { info:"var(--blue)", warning:"var(--amber)", error:"var(--red)" };
  const style = { color: c[s], width: size, height: size };
  if (s === "error")   return <ShieldAlert style={style}/>;
  if (s === "warning") return <AlertTriangle style={style}/>;
  return <Info style={style}/>;
}

/* ── Brand wheel icon ── */
function WheelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.9"/>
      <circle cx="10" cy="10" r="2" fill="white"/>
      <line x1="10" y1="1.5" x2="10" y2="8"    stroke="white" strokeWidth="1.2" strokeOpacity="0.75"/>
      <line x1="10" y1="12"  x2="10" y2="18.5"  stroke="white" strokeWidth="1.2" strokeOpacity="0.75"/>
      <line x1="1.5" y1="10" x2="8"  y2="10"   stroke="white" strokeWidth="1.2" strokeOpacity="0.75"/>
      <line x1="12"  y1="10" x2="18.5" y2="10" stroke="white" strokeWidth="1.2" strokeOpacity="0.75"/>
      <line x1="3.1" y1="3.1"  x2="7.9" y2="7.9"   stroke="white" strokeWidth="1.2" strokeOpacity="0.5"/>
      <line x1="12.1" y1="12.1" x2="16.9" y2="16.9" stroke="white" strokeWidth="1.2" strokeOpacity="0.5"/>
      <line x1="16.9" y1="3.1"  x2="12.1" y2="7.9"  stroke="white" strokeWidth="1.2" strokeOpacity="0.5"/>
      <line x1="7.9"  y1="12.1" x2="3.1"  y2="16.9" stroke="white" strokeWidth="1.2" strokeOpacity="0.5"/>
      <path d="M14.5 5.5 A6 6 0 0 1 18 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/* ── APEX Avatar — pro aero helmet + mirror sunglasses ── */
function GoatAvatar({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="bike-clip">
          <circle cx="40" cy="40" r="38"/>
        </clipPath>
      </defs>
      <circle cx="40" cy="40" r="40" fill="#DBEAFE"/>
      <g clipPath="url(#bike-clip)">
        {/* rear wheel */}
        <circle cx="22" cy="50" r="16" stroke="#2563EB" strokeWidth="3.5" fill="none"/>
        <circle cx="22" cy="50" r="3" fill="#2563EB"/>
        <line x1="22" y1="34" x2="22" y2="66" stroke="#93C5FD" strokeWidth="1.5"/>
        <line x1="6"  y1="50" x2="38" y2="50" stroke="#93C5FD" strokeWidth="1.5"/>
        <line x1="11" y1="39" x2="33" y2="61" stroke="#93C5FD" strokeWidth="1.5"/>
        <line x1="11" y1="61" x2="33" y2="39" stroke="#93C5FD" strokeWidth="1.5"/>
        {/* front wheel */}
        <circle cx="58" cy="50" r="16" stroke="#2563EB" strokeWidth="3.5" fill="none"/>
        <circle cx="58" cy="50" r="3" fill="#2563EB"/>
        <line x1="58" y1="34" x2="58" y2="66" stroke="#93C5FD" strokeWidth="1.5"/>
        <line x1="42" y1="50" x2="74" y2="50" stroke="#93C5FD" strokeWidth="1.5"/>
        <line x1="47" y1="39" x2="69" y2="61" stroke="#93C5FD" strokeWidth="1.5"/>
        <line x1="47" y1="61" x2="69" y2="39" stroke="#93C5FD" strokeWidth="1.5"/>
        {/* frame - diamond shape */}
        <line x1="38" y1="28" x2="38" y2="50" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round"/>
        <line x1="38" y1="28" x2="58" y2="50" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round"/>
        <line x1="38" y1="50" x2="22" y2="50" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round"/>
        <line x1="38" y1="28" x2="22" y2="50" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round"/>
        <line x1="38" y1="28" x2="55" y2="34" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round"/>
        <line x1="55" y1="34" x2="58" y2="50" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round"/>
        {/* seat */}
        <line x1="38" y1="28" x2="36" y2="20" stroke="#1D4ED8" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M30 20 Q36 17 42 20" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" fill="none"/>
        {/* handlebar */}
        <line x1="55" y1="34" x2="55" y2="26" stroke="#1D4ED8" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M51 26 Q55 23 59 26" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" fill="none"/>
      </g>
    </svg>
  );
}

function GoatAvatarSmall() {
  return <GoatAvatar size={26}/>;
}


/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
export default function Home() {
  const params     = useParams();
  const urlLocale  = normalizeLocale((params as any)?.locale);
  const router     = useRouter();
  const pathname   = usePathname();

  // Lang override — switch language without page reload
  const [langOverride, setLangOverride] = useState<Locale | null>(null);
  const locale = langOverride ?? urlLocale;

  // Translation function — reacts to locale state
  const t = useT(locale);

  function switchLocale(next: Locale) {
    if (next === locale) return;
    // If there's an active analysis, just override locally — no navigation
    if (result) {
      setLangOverride(next);
    } else {
      // No analysis active — do proper navigation
      const parts = (pathname || `/${urlLocale}`).split("/").filter(Boolean);
      parts[0] = next;
      router.push("/" + parts.join("/"));
    }
  }
  const [file, setFile]         = useState<File | null>(null);
  const [result, setResult]     = useState<UploadResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [aiCards, setAiCards]   = useState<CoachCard[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStream, setAiStream] = useState("");
  const [aiError, setAiError]   = useState<string | null>(null);

  const [dark, setDark]         = useState(false);
  const DAILY_LIMIT = 5;
  const LIMIT_KEY   = "goat_daily";

  function getLimitData(): { date: string; count: number } {
    try {
      const raw = localStorage.getItem(LIMIT_KEY);
      if (!raw) return { date: "", count: 0 };
      return JSON.parse(raw);
    } catch { return { date: "", count: 0 }; }
  }

  function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  const [aiUsed, setAiUsed] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const d = getLimitData();
    return d.date === getTodayStr() ? d.count : 0;
  });

  const aiLimitReached = aiUsed >= DAILY_LIMIT;
  const aiRemaining    = Math.max(0, DAILY_LIMIT - aiUsed);

  function incrementLimit() {
    const today = getTodayStr();
    const d = getLimitData();
    const newCount = (d.date === today ? d.count : 0) + 1;
    localStorage.setItem(LIMIT_KEY, JSON.stringify({ date: today, count: newCount }));
    setAiUsed(newCount);
  }

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  // Re-fetch coach cards when language changes (if analysis exists)
  const prevLocaleRef = useRef(locale);
  useEffect(() => {
    if (prevLocaleRef.current !== locale && result) {
      prevLocaleRef.current = locale;
      setAiCards(null);
      setAiStream("");
      setAiError(null);
      fetchAiCoach();
    } else {
      prevLocaleRef.current = locale;
    }
  }, [locale]);

  const fileMeta = useMemo(() => {
    if (!file) return null;
    const kb = file.size / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(2)} MB`;
  }, [file]);

  async function onUpload() {
    if (!file || loading) return;
    setError(null); setResult(null); setLoading(true);
    setAiCards(null); setAiStream(""); setAiError(null);
    try {
      const form = new FormData(); form.append("file", file);
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
      const res = await fetch(`${base}/v1/activities:upload?lang=${locale}`, { method:"POST", body:form });
      if (!res.ok) { const txt = await res.text(); throw new Error(`${res.status} ${res.statusText}\n${txt}`); }
      setResult(await res.json());
    } catch (e: any) { setError(e?.message ?? "Unknown error"); }
    finally { setLoading(false); }
  }

  async function fetchAiCoach() {
    if (!result || aiLoading || aiLimitReached) return;
    setAiLoading(true); setAiCards(null); setAiStream(""); setAiError(null);
    incrementLimit();
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
      const res = await fetch(`${base}/v1/activities:ai-coach?lang=${locale}`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(result),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream:true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.chunk) setAiStream(s => s + ev.chunk);
            if (ev.done) { if (ev.cards?.length) setAiCards(ev.cards); else setAiError("Yanıt ayrıştırılamadı"); }
            if (ev.error) setAiError(ev.error);
          } catch {}
        }
      }
    } catch (e: any) { setAiError(e?.message ?? "Hata"); }
    finally { setAiLoading(false); setAiStream(""); }
  }

  const hasResult    = !!result;
  const hasRoute     = !!result?.route?.segments?.length;
  const hasHR        = result?.heart_rate?.hr_avg != null;
  const hasEle       = result?.elevation?.elevation_gain_m != null;
  const displayCards = aiCards ?? result?.coach_cards ?? [];

  return (
    <div className="app">

      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar__brand">
          <div className="brand-icon"><WheelIcon/></div>
          <div className="brand-wordmark">
            <span className="brand-wordmark__top">DraftCoach</span>
            <span className="brand-wordmark__sub">Performance Analytics</span>
          </div>
        </div>
        <div className="topbar__right">
          <button className="theme-toggle" onClick={() => setDark(d => !d)} title={dark ? "Light mode" : "Dark mode"}>
            {dark ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
          <div className="lang-toggle">
            <button className={`lang-toggle__btn ${locale==="tr"?"active":""}`} onClick={()=>switchLocale("tr")}>TR</button>
            <button className={`lang-toggle__btn ${locale==="en"?"active":""}`} onClick={()=>switchLocale("en")}>EN</button>
          </div>
        </div>
      </header>

      <div className="body">

        {/* ── Col 1: Upload + Metrics ── */}
        <aside className="left-panel">
          <div className="upload-panel">

            <label className={`drop-zone ${file?"has-file":""}`}>
              <input type="file" accept=".gpx" onChange={e=>{setFile(e.target.files?.[0]??null);setResult(null);setError(null);}}/>
              <div className="drop-zone__icon"><Upload size={26}/></div>
              {!file ? (
                <>
                  <div className="drop-zone__title">{t("chooseFile")}</div>
                  {t("uploadHint") && <div className="drop-zone__sub">.gpx — {t("uploadHint")}</div>}
                </>
              ) : (
                <div className="drop-zone__file">
                  <Activity size={11}/>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:155}}>{file.name}</span>
                  <span className="file-size">{fileMeta}</span>
                </div>
              )}
            </label>
            <button className="btn-upload" onClick={onUpload} disabled={!file||loading}>
              {loading ? <span className="btn-loading"><span className="spinner"/>{t("uploading")}</span> : t("uploadBtn")}
            </button>
            {error && <div className="error-msg">{error}</div>}
          </div>

          {/* Metrics */}
          {hasResult && result?.metrics && (
            <div className="metrics-panel">
              <div className="sec-label"><Gauge size={9}/>{t("summaryTitle")}<span className="sec-label__line"/></div>
              <div className="metric-row metric-row--dist">
                <span className="metric-row__label"><MapPin size={10}/>{t("metrics.distance")}</span>
                <div className="metric-row__right">
                  <div className="metric-row__value">{fmt(result.metrics.distance_km,2)}<em>km</em></div>
                  {result.metrics.distance_km_raw!=null && Math.abs(result.metrics.distance_km_raw-result.metrics.distance_km)>0.05 && (
                    <div className="metric-row__sub">raw {fmt(result.metrics.distance_km_raw,2)} km</div>
                  )}
                </div>
              </div>
              <div className="metric-row metric-row--time">
                <span className="metric-row__label"><Timer size={10}/>{t("metrics.duration")}</span>
                <div className="metric-row__right">
                  <div className="metric-row__value">{fmtDur(result.summary?.duration_seconds)}</div>
                  {result.summary?.moving_seconds && <div className="metric-row__sub">{t("metrics.movingTime")} {fmtDur(result.summary.moving_seconds)}</div>}
                </div>
              </div>
              <div className="metric-row metric-row--speed">
                <span className="metric-row__label"><Gauge size={10}/>{t("metrics.avgSpeed")}</span>
                <div className="metric-row__right">
                  <div className="metric-row__value">{fmt(result.metrics.avg_speed_kmh)}<em>km/h</em></div>
                  {result.metrics.max_speed_kmh!=null && <div className="metric-row__sub">max {fmt(result.metrics.max_speed_kmh)} km/h</div>}
                </div>
              </div>
              {hasEle && (<>
                <div className="metric-divider"/>
                <div className="metric-row metric-row--elev">
                  <span className="metric-row__label"><TrendingUp size={10}/>{t("metrics.elevGain")}</span>
                  <div className="metric-row__right">
                    <div className="metric-row__value">{fmt(result.elevation?.elevation_gain_m,0)}<em>m</em></div>
                    <div className="metric-row__sub">↓ {fmt(result.elevation?.elevation_loss_m,0)} m</div>
                  </div>
                </div>
              </>)}
              {result.summary?.started_at && (<>
                <div className="metric-divider"/>
                <div className="metric-meta">{fmtDate(result.summary.started_at)} · {result.summary.points_count} pts</div>
              </>)}
            </div>
          )}

          {/* Badges */}
          {hasResult && (hasHR||hasEle) && (
            <div className="badge-grid">
              {hasHR && (<>
                <div className="badge badge--hr"><div className="badge__label">{locale==="tr"?"Ort. Nabız":"Avg HR"}</div><div className="badge__val">{result!.heart_rate!.hr_avg}<span className="badge__unit">bpm</span></div></div>
                <div className="badge badge--hr"><div className="badge__label">{locale==="tr"?"Maks Nabız":"Max HR"}</div><div className="badge__val">{result!.heart_rate!.hr_max}<span className="badge__unit">bpm</span></div></div>
              </>)}
              {hasEle && (<>
                <div className="badge badge--ele"><div className="badge__label">{locale==="tr"?"Maks İrt.":"Max Alt"}</div><div className="badge__val">{fmt(result!.elevation!.max_ele_m,0)}<span className="badge__unit">m</span></div></div>
                <div className="badge badge--ele"><div className="badge__label">{locale==="tr"?"Min İrt.":"Min Alt"}</div><div className="badge__val">{fmt(result!.elevation!.min_ele_m,0)}<span className="badge__unit">m</span></div></div>
              </>)}
            </div>
          )}
        </aside>

        {/* ── Col 2: Map + Charts ── */}
        <div className="map-col">
          <div className="map-area">
            {!hasRoute ? (
              <div className="map-empty">
                <div className="map-empty__ring"><Bike size={24}/></div>
                <div className="map-empty__text">{t("emptyText")}</div>
              </div>
            ) : (
              <>
                <RouteMap segments={result!.route!.segments} bounds={result!.route!.bounds}/>
                <div className="map-pills">
                  <div className="map-pill"><span className="pill-dot" style={{background:"#06B6D4"}}/>{locale==="tr"?"Başlangıç":"Start"}</div>
                  <div className="map-pill"><span className="pill-dot" style={{background:"#6366F1"}}/>{locale==="tr"?"Bitiş":"Finish"}</div>
                  {result?.metrics?.distance_km!=null && <div className="map-pill"><MapPin size={10}/>{fmt(result.metrics.distance_km,2)} km</div>}
                </div>
              </>
            )}
          </div>
          {hasResult && result?.timeseries && result.timeseries.length > 0 && (
            <div className="charts-area">
              <ActivityCharts timeseries={result.timeseries} locale={locale}/>
            </div>
          )}
        </div>

        {/* ── Col 3: APEX ── */}
        <div className="coach-col">

          {/* APEX header */}
          <div className="goat-header">
            <div className="goat-avatar-wrap">
              <div className="goat-avatar"><GoatAvatar size={96}/></div>
              <div className="goat-status">
                <span className="goat-status__dot"/>
                {locale==="tr" ? "Hazır" : "Ready"}
              </div>
            </div>
            <div className="goat-intro">
              <div className="goat-name">Coach GOAT</div>
              <div className="goat-role">{locale==="tr" ? "AI Performans Koçu" : "AI Performance Coach"}</div>
              <div className="goat-tagline">
                {aiCards
                  ? (locale==="tr" ? "Analiz tamamlandı. İşte sürüşün için önerilerim:" : "Analysis complete. Here are my recommendations for your ride:")
                  : hasResult
                  ? (locale==="tr" ? "Sürüşünü incelemeye hazırım — butona bas!" : "Ready to review your ride — hit the button!")
                  : (locale==="tr" ? "Merhaba! GPX'ini yükle, analiz edeyim." : "Hey! Upload your GPX and I'll break it down for you.")}
              </div>
            </div>
          </div>

          {/* Action */}
          {hasResult && (
            <div className="goat-action">
              <button
                className={`btn-ai-coach ${aiLoading?"loading":""} ${aiLimitReached?"limit":""}`}
                onClick={fetchAiCoach}
                disabled={aiLoading || aiLimitReached}
              >
                {aiLoading
                  ? <><span className="spinner" style={{borderTopColor:"#fff"}}/>{locale==="tr"?"GOAT analiz ediyor…":"GOAT is analyzing…"}</>
                  : aiLimitReached
                  ? <>{locale==="tr"?"Günlük limit doldu (5/5)":"Daily limit reached (5/5)"}</>
                  : <><Sparkles size={15}/>{locale==="tr"?`GOAT'a Danış (${aiRemaining} hak)`:`Ask GOAT (${aiRemaining} left)`}</>
                }
              </button>
              {aiLimitReached && (
                <div style={{marginTop:8,fontSize:11,color:"var(--text-3)",fontFamily:"'Fira Code',monospace",textAlign:"center"}}>
                  {locale==="tr" ? "Yarın 5 yeni hak yüklenir 🐐" : "5 new credits tomorrow 🐐"}
                </div>
              )}
              {aiError && <div className="error-msg" style={{marginTop:8}}>{aiError}</div>}
            </div>
          )}

          {/* Streaming */}
          {aiLoading && aiStream && (
            <div className="ai-stream-preview">
              <div className="ai-stream-header">
                <div className="ai-stream-avatar"><GoatAvatarSmall/></div>
                <span>{locale==="tr" ? "GOAT yazıyor…" : "GOAT is typing…"}</span>
              </div>
              <div className="ai-stream-text">{aiStream}<span className="ai-cursor"/></div>
            </div>
          )}

          {/* Cards */}
          {!hasResult || !displayCards.length ? (
            <div className="coach-empty">
              <div className="goat-empty-avatar"><GoatAvatar size={96}/></div>
              <div className="coach-empty__title">{t("noCardsTitle")}</div>
              <div className="coach-empty__sub">{t("noCardsText")}</div>
            </div>
          ) : (
            <div className="coach-body">
              {aiCards && <div className="ai-badge"><Sparkles size={11}/> GOAT · {locale==="tr"?"AI Koç":"AI Coach"}</div>}
              {displayCards.map((card, i) => (
                <details key={i} className={`coach-card coach-card--${card.severity}`}>
                  <summary>
                    <div className="coach-card__ico-wrap"><SevIcon s={card.severity}/></div>
                    <span className="coach-card__title">{card.title}</span>
                    <div className="coach-card__right">
                      <span className="coach-card__sev">{SEV_LABELS[card.severity]}</span>
                      <ChevronRight className="coach-card__chev"/>
                    </div>
                  </summary>
                  <div className="coach-card__body">{card.detail}</div>
                </details>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}