"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, LogOut, Zap, Clock, TrendingUp, Heart } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if ((session?.user as any)?.stravaId) return;

    async function fetchActivities() {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          id, strava_id, name, type, distance_km, duration_seconds,
          avg_speed_kmh, elevation_gain_m, hr_avg, started_at,
          analyses(id, cards)
        `)
        .order("started_at", { ascending: false })
        .limit(20);

      if (!error && data) setActivities(data as any);
      setLoading(false);
    }

    fetchActivities();
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner-large" />
        <p>Loading your rides...</p>
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
          <button className="btn-signout" onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div className="dash-body">

        {/* ── Sidebar ── */}
        <aside className="dash-sidebar">
          <nav className="dash-nav-links">
            <a className="dash-nav-link active" href="/dashboard">
              <Activity size={16} /> Activities
            </a>
          </nav>
          <div className="dash-connect-hint">
            <p>New rides are analyzed automatically when you finish on Strava.</p>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="dash-main">
          <div className="dash-header">
            <h1>Your Rides</h1>
            <p className="dash-header__sub">
              {activities.length === 0
                ? "No rides yet — go for a ride and it will appear here automatically."
                : `${activities.length} rides analyzed by Coach GOAT`}
            </p>
          </div>

          {activities.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty__icon">🐐</div>
              <h2>Waiting for your first ride</h2>
              <p>Complete a cycling activity on Strava and Coach GOAT will analyze it automatically.</p>
            </div>
          ) : (
            <div className="activity-list">
              {activities.map((a) => (
                <ActivityCard key={a.id} activity={a} />
              ))}
            </div>
          )}
        </main>

      </div>
    </div>
  );
}

function ActivityCard({ activity: a }: { activity: ActivityRow }) {
  const router = useRouter();
  const hasAnalysis = a.analyses?.length > 0;
  const date = new Date(a.started_at).toLocaleDateString("en", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div
      className={`activity-card ${hasAnalysis ? "has-analysis" : ""}`}
      onClick={() => router.push(`/activity/${a.id}`)}
    >
      <div className="activity-card__header">
        <div className="activity-card__info">
          <span className="activity-card__type">{a.type}</span>
          <h3 className="activity-card__name">{a.name}</h3>
          <span className="activity-card__date">{date}</span>
        </div>
        {hasAnalysis && (
          <div className="activity-card__badge">
            <Zap size={12} /> GOAT analyzed
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
              +{a.analyses[0].cards.length - 2} more
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