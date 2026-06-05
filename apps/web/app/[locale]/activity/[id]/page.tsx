"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useRouter } from "@/navigation";
import { ArrowLeft, Activity, Clock, TrendingUp, Mountain, Heart, Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { SportHeroBg, CoachGoatBadge } from "@/app/components/GoatArt";
import SportIcon from "@/app/components/SportIcon";
import { sportColor } from "@/lib/sports";

const GOAT_MESSAGES: Record<string, string[]> = {
  tr: [
    "🐐 BAAAA... verilerini işliyorum...",
    "Dağın tepesindeki keçi gibi analiz ediyorum...",
    "GOAT olmak kolay değil, biraz sabır 🐐",
    "BAAAAnalize başladım, hazır ol...",
    "Sürünüzün en iyisi devrede! 🐐",
    "Antrenmanını didik didik ediyorum...",
    "En iyi keçi, en iyi analizi yapar 🐐",
    "Veriyi otluyorum... az kaldı 🐐",
  ],
  en: [
    "🐐 BAAAA... processing your data...",
    "The GOAT never rushes. Almost there...",
    "Greatest Of All Time analysis loading...",
    "BAAAAnalyzing your performance...",
    "Climbing the mountain of your workout data 🐐",
    "Hooves busy, brain busier. Analyzing...",
    "The GOAT sees all. Processing...",
    "Grazing through your metrics... 🐐",
  ],
};


type CoachCard = { title: string; detail: string; severity: "info" | "warning" | "error" };
type Analysis  = { id: string; cards: CoachCard[]; ai_model: string; lang: string; created_at: string };
type ActivityDetail = {
  id: string; strava_id: number; name: string; type: string;
  distance_km: number; duration_seconds: number; moving_seconds: number;
  avg_speed_kmh: number; max_speed_kmh: number; elevation_gain_m: number;
  hr_avg: number | null; hr_max: number | null; started_at: string;
  analyses: Analysis[];
};

function fmtDur(s: number): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
}

function fmtNum(n: number | null | undefined, decimals = 1): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

export default function ActivityDetailPage() {
  const t      = useTranslations("activity");
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const params = useParams<{ id: string }>();

  const [activity, setActivity]     = useState<ActivityDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [analyzing, setAnalyzing]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [remaining, setRemaining]     = useState<number | null>(null);
  const [dailyLimit, setDailyLimit]   = useState<number>(5);
  const [translating, setTranslating] = useState(false);
  const [goatMsgIdx, setGoatMsgIdx]   = useState(0);

  const goatMessages = GOAT_MESSAGES[locale] ?? GOAT_MESSAGES.en;

  useEffect(() => {
    if (!analyzing && !translating) return;
    const iv = setInterval(() => setGoatMsgIdx(i => (i + 1) % goatMessages.length), 2200);
    return () => clearInterval(iv);
  }, [analyzing, translating, goatMessages.length]);

  useEffect(() => {
    fetch(`/api/activities/${params.id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setActivity)
      .catch(() => setError("not_found"))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleAnalyze() {
    if (!activity) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/activities/${activity.id}/analyze`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lang: locale }),
      });

      if (res.status === 429) {
        setError("daily_limit_reached");
        setRemaining(0);
        return;
      }
      if (!res.ok) throw new Error();

      const { id, cards, ai_model, lang, created_at, remaining: rem, limit } = await res.json();
      setRemaining(rem);
      if (limit) setDailyLimit(limit);
      setActivity(prev => prev ? {
        ...prev,
        analyses: [{ id, cards, ai_model, lang: lang ?? locale, created_at: created_at ?? new Date().toISOString() }, ...prev.analyses],
      } : prev);
    } catch {
      setError("analyze_failed");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner-large" />
        <p>{t("loading")}</p>
      </div>
    );
  }

  if (error === "not_found" || !activity) {
    return (
      <div className="activity-detail-error">
        <p>{t("notFound")}</p>
        <button className="btn-back" onClick={() => router.push("/dashboard")}>
          <ArrowLeft size={16} /> {t("back")}
        </button>
      </div>
    );
  }

  async function handleTranslate() {
    if (!activity || !latestAnalysis) return;
    setTranslating(true);
    setError(null);
    try {
      const res = await fetch(`/api/activities/${activity.id}/translate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lang: locale, analysis_id: latestAnalysis.id }),
      });
      if (!res.ok) throw new Error();
      const { id, cards, ai_model, lang } = await res.json();
      setActivity(prev => prev ? {
        ...prev,
        analyses: [{ id, cards, ai_model, lang, created_at: new Date().toISOString() }, ...prev.analyses],
      } : prev);
    } catch {
      setError("analyze_failed");
    } finally {
      setTranslating(false);
    }
  }

  const date  = new Date(activity.started_at).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hasAnalysis = activity.analyses.length > 0;
  const latestAnalysis = activity.analyses[0];
  const analysisLangMismatch = hasAnalysis && latestAnalysis.lang && latestAnalysis.lang !== locale;

  return (
    <div className="activity-detail">

      {/* ── Header ── */}
      <div className="detail-header">
        <button className="btn-back" onClick={() => router.push("/dashboard")}>
          <ArrowLeft size={16} /> {t("back")}
        </button>
        <div className="detail-hero" style={{ "--sport-color": sportColor(activity.type) } as React.CSSProperties}>
          <SportHeroBg type={activity.type} />
          <div className="detail-hero__text">
            <span className="detail-type-badge">
              <SportIcon type={activity.type} size={13} /> {activity.type}
            </span>
            <h1 className="detail-title">{activity.name}</h1>
            <span className="detail-date">{date}</span>
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="detail-stats">
        <div className="stat-card stat-card--dist">
          <Activity size={18} />
          <span className="stat-card__label">{t("stats.distance")}</span>
          <span className="stat-card__value">{fmtNum(activity.distance_km, 2)}<em>km</em></span>
        </div>
        <div className="stat-card stat-card--time">
          <Clock size={18} />
          <span className="stat-card__label">{t("stats.duration")}</span>
          <span className="stat-card__value">{fmtDur(activity.duration_seconds)}</span>
          {activity.moving_seconds && activity.moving_seconds !== activity.duration_seconds && (
            <span className="stat-card__sub">{t("stats.moving")}: {fmtDur(activity.moving_seconds)}</span>
          )}
        </div>
        <div className="stat-card stat-card--speed">
          <TrendingUp size={18} />
          <span className="stat-card__label">{t("stats.avgSpeed")}</span>
          <span className="stat-card__value">{fmtNum(activity.avg_speed_kmh)}<em>km/h</em></span>
          {activity.max_speed_kmh > 0 && (
            <span className="stat-card__sub">max {fmtNum(activity.max_speed_kmh)} km/h</span>
          )}
        </div>
        <div className="stat-card stat-card--elev">
          <Mountain size={18} />
          <span className="stat-card__label">{t("stats.elevation")}</span>
          <span className="stat-card__value">{fmtNum(activity.elevation_gain_m, 0)}<em>m</em></span>
        </div>
        {activity.hr_avg && (
          <div className="stat-card stat-card--hr">
            <Heart size={18} />
            <span className="stat-card__label">{t("stats.hrAvg")}</span>
            <span className="stat-card__value">{Math.round(activity.hr_avg)}<em>bpm</em></span>
            {activity.hr_max && (
              <span className="stat-card__sub">max {Math.round(activity.hr_max)} bpm</span>
            )}
          </div>
        )}
      </div>

      {/* ── Coach GOAT section ── */}
      <div className="detail-coach">
        <div className="detail-coach__header">
          <div className="detail-coach__title-wrap">
            <CoachGoatBadge />
            <div>
              <span className="detail-coach__title">Coach GOAT</span>
              {remaining !== null && remaining > 0 && (
                <div className="daily-quota">
                  <div className="daily-quota__bar">
                    <div className="daily-quota__fill" style={{ width: `${(remaining / dailyLimit) * 100}%` }} />
                  </div>
                  <span className="daily-quota__text">
                    {t("limitRemaining", { remaining, limit: dailyLimit })}
                  </span>
                </div>
              )}
            </div>
          </div>
          {!analyzing && remaining !== 0 && (
            <button
              className={`btn-analyze ${hasAnalysis ? "btn-analyze--rerun" : ""}`}
              onClick={handleAnalyze}
            >
              <Zap size={15} />
              {hasAnalysis ? t("reanalyze") : t("analyze")}
            </button>
          )}
        </div>

        {(analyzing || translating) && (
          <div className="detail-analyzing">
            <div className="goat-thinking">
              <span className="goat-thinking__emoji">🐐</span>
              <div className="goat-thinking__dots"><span/><span/><span/></div>
            </div>
            <p className="goat-thinking__msg">{goatMessages[goatMsgIdx]}</p>
          </div>
        )}

        {analysisLangMismatch && !translating && !analyzing && (
          <div className="detail-lang-notice">
            <span>🌐 {t("langMismatch", { lang: latestAnalysis.lang === "tr" ? "Türkçe" : "English" })}</span>
            <button className="btn-translate" onClick={handleTranslate}>
              {t("translateTo", { lang: locale === "tr" ? "Türkçe" : "English" })}
            </button>
          </div>
        )}

        {error === "analyze_failed" && (
          <p className="detail-error-msg">{t("analyzeFailed")}</p>
        )}
        {error === "daily_limit_reached" && (
          <div className="detail-limit-banner">
            ⚠️ {t("limitReached", { limit: dailyLimit })}
          </div>
        )}

        {!hasAnalysis && !analyzing && (
          <div className="detail-empty-analysis">
            <p>{t("noAnalysis")}</p>
          </div>
        )}

        {hasAnalysis && !analyzing && (
          <div className="detail-cards">
            {latestAnalysis.cards.map((card, i) => (
              <div key={i} className={`coach-card coach-card--${card.severity}`}>
                <div className="coach-card__header">
                  <div className="coach-card__ico-wrap">
                    {card.severity === "info"    && <Zap size={16} color="var(--blue)" />}
                    {card.severity === "warning" && <Zap size={16} color="var(--amber)" />}
                    {card.severity === "error"   && <Zap size={16} color="var(--red)" />}
                  </div>
                  <span className="coach-card__title">{card.title}</span>
                </div>
                <div className="coach-card__body">{card.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
