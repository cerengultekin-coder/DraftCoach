"use client";

import { useTranslations, useLocale } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Activity, LogOut, Zap, Clock, TrendingUp, Heart } from "lucide-react";
import Image from "next/image";
import { useRouter } from "@/navigation";
import LanguageToggle from "../../components/LanguageToggle";
import ThemeToggle from "../../components/ThemeToggle";

type ActivityRow = {
  id: string;
  strava_id: number;
  name: string;
  type: string;
  distance_km: number;
  duration_seconds: number;
  avg_speed_kmh: number;
  elevation_gain_m: number;
  hr_avg: number | null;
  started_at: string;
  analyses: { id: string; cards: any[] }[];
};

export default function Dashboard() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (!(session?.user as any)?.stravaId) {
      setLoading(false);
      return;
    }

    async function fetchActivities() {
      try {
        const res = await fetch("/api/activities");
        if (res.ok) {
          const data = await res.json();
          setActivities(data);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner-large" />
        <p>{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="dashboard">

      {/* ── Topbar ── */}
      <header className="dash-nav">
        <div className="dash-nav__brand">
          <WheelIcon />
          <span>DraftCoach</span>
        </div>
        <div className="dash-nav__right">
          <ThemeToggle />
          <LanguageToggle />
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt={session.user.name ?? ""}
              width={32}
              height={32}
              className="dash-avatar"
            />
          )}
          <span className="dash-nav__name">{session?.user?.name}</span>
          <button className="btn-signout" onClick={() => signOut({ callbackUrl: `/${locale}/` })}>
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div className="dash-body">

        {/* ── Sidebar ── */}
        <aside className="dash-sidebar">
          <nav className="dash-nav-links">
            <a className="dash-nav-link active" href={`/${locale}/dashboard`}>
              <Activity size={16} /> {t("activities")}
            </a>
          </nav>
          <div className="dash-connect-hint">
            <p>{t("hint")}</p>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="dash-main">
          <div className="dash-header">
            <h1>{t("title")}</h1>
            <p className="dash-header__sub">
              {activities.length === 0
                ? t("empty.desc")
                : t("analyzed", { count: activities.length })}
            </p>
          </div>

          {activities.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty__icon">🐐</div>
              <h2>{t("empty.title")}</h2>
              <p>{t("empty.desc")}</p>
            </div>
          ) : (
            <div className="activity-list">
              {activities.map((a) => (
                <ActivityCard key={a.id} activity={a} locale={locale} />
              ))}
            </div>
          )}
        </main>

      </div>
    </div>
  );
}

const SPORT_EMOJI: Record<string, string> = {
  Ride: "🚴", VirtualRide: "🚴", EBikeRide: "🚴", Velomobile: "🚴", Handcycle: "🚴",
  Run: "🏃", VirtualRun: "🏃", TrailRun: "🏃",
  Swim: "🏊",
  Walk: "🚶", Hike: "🥾",
  WeightTraining: "🏋️", Workout: "💪", Crossfit: "💪", RockClimbing: "🧗",
  Yoga: "🧘",
  Rowing: "🚣", Kayaking: "🚣", Canoeing: "🚣", Surfing: "🏄", SUP: "🏄",
  AlpineSki: "⛷️", BackcountrySki: "⛷️", CrossCountrySkiing: "⛷️",
  Snowboard: "🏂", Snowshoe: "🥾", IceSkate: "⛸️",
  Tennis: "🎾", Soccer: "⚽", Basketball: "🏀",
};

function sportEmoji(type: string): string {
  return SPORT_EMOJI[type] ?? "🏅";
}

function ActivityCard({ activity: a, locale }: { activity: ActivityRow; locale: string }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const hasAnalysis = a.analyses?.length > 0;
  const date = new Date(a.started_at).toLocaleDateString(locale, {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div
      className={`activity-card ${hasAnalysis ? "has-analysis" : ""}`}
      onClick={() => router.push(`/activity/${a.id}`)}
    >
      <div className="activity-card__header">
        <div className="activity-card__info">
          <span className="activity-card__type">{sportEmoji(a.type)} {a.type}</span>
          <h3 className="activity-card__name">{a.name}</h3>
          <span className="activity-card__date">{date}</span>
        </div>
        {hasAnalysis && (
          <div className="activity-card__badge">
            <Zap size={12} /> {t("goatAnalyzed")}
          </div>
        )}
      </div>

      <div className="activity-card__metrics">
        <div className="activity-card__metric">
          <Activity size={13} />
          <span>{a.distance_km?.toFixed(1)} km</span>
        </div>
        <div className="activity-card__metric">
          <Clock size={13} />
          <span>{fmtDur(a.duration_seconds)}</span>
        </div>
        {a.avg_speed_kmh && (
          <div className="activity-card__metric">
            <TrendingUp size={13} />
            <span>{a.avg_speed_kmh?.toFixed(1)} km/h</span>
          </div>
        )}
        {a.hr_avg && (
          <div className="activity-card__metric">
            <Heart size={13} />
            <span>{a.hr_avg} bpm</span>
          </div>
        )}
      </div>

      {hasAnalysis && (
        <div className="activity-card__preview">
          {a.analyses[0].cards.slice(0, 2).map((card: any, i: number) => (
            <div key={i} className={`activity-card__chip chip--${card.severity}`}>
              {card.title}
            </div>
          ))}
          {a.analyses[0].cards.length > 2 && (
            <div className="activity-card__chip chip--more">
              {t("more", { count: a.analyses[0].cards.length - 2 })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtDur(s: number): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function WheelIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="2"/>
      <circle cx="14" cy="14" r="3" fill="currentColor"/>
      <line x1="14" y1="2"  x2="14" y2="11"  stroke="currentColor" strokeWidth="1.5"/>
      <line x1="14" y1="17" x2="14" y2="26"  stroke="currentColor" strokeWidth="1.5"/>
      <line x1="2"  y1="14" x2="11" y2="14"  stroke="currentColor" strokeWidth="1.5"/>
      <line x1="17" y1="14" x2="26" y2="14"  stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
