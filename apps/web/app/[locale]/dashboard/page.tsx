"use client";

import { useTranslations, useLocale } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { Activity, LogOut, Clock, TrendingUp, Heart, ChevronRight, ChevronLeft } from "lucide-react";
import Image from "next/image";
import { useRouter } from "@/navigation";
import { sportEmoji, sportColor } from "@/lib/sports";

type ActivityRow = {
  id: string; strava_id: number; name: string; type: string;
  distance_km: number; duration_seconds: number; avg_speed_kmh: number;
  elevation_gain_m: number; hr_avg: number | null; started_at: string;
  analyses: { id: string; cards: any[] }[];
};

function fmtDur(s: number): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Dashboard() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activities, setActivities]     = useState<ActivityRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [importing, setImporting]       = useState(false);
  const [pageLoading, setPageLoading]   = useState(false);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [total, setTotal]               = useState(0);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  const fetchPage = useCallback(async (p: number) => {
    const res = await fetch(`/api/activities?page=${p}`);
    if (!res.ok) return null;
    return res.json();
  }, []);

  // Initial load (+ first-time import)
  useEffect(() => {
    if (!(session?.user as any)?.stravaId) { setLoading(false); return; }

    async function init() {
      try {
        let json = await fetchPage(1);
        if (json && json.activities.length === 0) {
          setImporting(true);
          await fetch("/api/activities/import", { method: "POST" });
          json = await fetchPage(1);
          setImporting(false);
        }
        if (json) {
          setActivities(json.activities);
          setTotal(json.total ?? 0);
          setTotalAnalyzed(json.totalAnalyzed ?? 0);
          setTotalPages(json.totalPages ?? 1);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [session, fetchPage]);

  const goToPage = useCallback(async (p: number) => {
    if (p < 1 || p > totalPages || p === page || pageLoading) return;
    setPageLoading(true);
    try {
      const json = await fetchPage(p);
      if (json) {
        setActivities(json.activities);
        setTotal(json.total ?? total);
        setTotalAnalyzed(json.totalAnalyzed ?? totalAnalyzed);
        setTotalPages(json.totalPages ?? totalPages);
        setPage(p);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setPageLoading(false);
    }
  }, [totalPages, page, pageLoading, fetchPage, total, totalAnalyzed]);

  if (status === "loading" || loading) {
    return (
      <div className="dashboard-loading">
        <div className="goat-loader">
          <span className="goat-loader__emoji">🐐</span>
          <p>{importing ? "Strava'dan aktiviteler getiriliyor..." : t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dash-body">

        {/* ── Sidebar ── */}
        <aside className="dash-sidebar">
          <div className="dash-user">
            <button className="btn-signout" onClick={() => signOut({ callbackUrl: `/${locale}/` })} title="Çıkış yap">
              <LogOut size={15} />
            </button>
            <div className="dash-user__avatar-wrap">
              {session?.user?.image && (
                <Image src={session.user.image} alt="" width={92} height={92} className="dash-avatar" />
              )}
              <span className="dash-user__strava-dot" title="Strava bağlı">🔗</span>
            </div>
            <div className="dash-user__info">
              <span className="dash-user__name">{session?.user?.name}</span>
              <span className="dash-user__sub">
                {totalAnalyzed > 0 ? `${totalAnalyzed} 🐐 analiz` : "Strava bağlı"}
              </span>
            </div>
          </div>

          <nav className="dash-nav-links">
            <a className="dash-nav-link active" href={`/${locale}/dashboard`}>
              <Activity size={16} /> {t("activities")}
            </a>
          </nav>

          {total > 0 && (
            <div className="dash-stats-mini">
              <div className="dash-stats-mini__item">
                <span className="dash-stats-mini__val">{total}</span>
                <span className="dash-stats-mini__label">aktivite</span>
              </div>
              <div className="dash-stats-mini__divider" />
              <div className="dash-stats-mini__item">
                <span className="dash-stats-mini__val" style={{ color: "var(--green)" }}>{totalAnalyzed}</span>
                <span className="dash-stats-mini__label">🐐 analiz</span>
              </div>
            </div>
          )}

          <div className="dash-connect-hint">
            <p>{t("hint")}</p>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="dash-main">
          <div className="dash-header">
            <h1>{t("title")}</h1>
            {total > 0 && (
              <p className="dash-header__sub">{t("analyzed", { count: totalAnalyzed })}</p>
            )}
          </div>

          {activities.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty__goat">🐐</div>
              <h2>{t("empty.title")}</h2>
              <p>{t("empty.desc")}</p>
              <p className="dash-empty__goat-quote">"{t("empty.goatQuote")}"</p>
            </div>
          ) : (
            <>
              <div className={`activity-list ${pageLoading ? "activity-list--loading" : ""}`}>
                {activities.map((a, i) => (
                  <ActivityCard key={a.id} activity={a} locale={locale} index={i} />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  disabled={pageLoading}
                  onChange={goToPage}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ─── Pagination ─────────────────────────────────────────────────────────── */
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const left  = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

function Pagination({
  page, totalPages, disabled, onChange,
}: {
  page: number; totalPages: number; disabled: boolean;
  onChange: (p: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="pagination__arrow"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page === 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {pageNumbers(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="pagination__gap">…</span>
        ) : (
          <button
            key={p}
            className={`pagination__num ${p === page ? "is-active" : ""}`}
            onClick={() => onChange(p)}
            disabled={disabled}
          >
            {p}
          </button>
        )
      )}

      <button
        className="pagination__arrow"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page === totalPages}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

function ActivityCard({ activity: a, locale, index }: { activity: ActivityRow; locale: string; index: number }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const hasAnalysis = a.analyses?.length > 0;
  const date = new Date(a.started_at).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  const color = sportColor(a.type);

  return (
    <div
      className={`activity-card ${hasAnalysis ? "has-analysis" : ""}`}
      style={{ "--sport-color": color, animationDelay: `${(index % 5) * 0.06}s` } as any}
      onClick={() => router.push(`/activity/${a.id}`)}
    >
      <div className="activity-card__sport-bar" />
      <div className="activity-card__left">
        <span className="activity-card__emoji">{sportEmoji(a.type)}</span>
      </div>
      <div className="activity-card__center">
        <div className="activity-card__top">
          <span className="activity-card__type">{a.type}</span>
          <span className="activity-card__date">{date}</span>
        </div>
        <h3 className="activity-card__name">{a.name}</h3>
        <div className="activity-card__metrics">
          {a.distance_km > 0 && (
            <span className="activity-card__metric"><Activity size={12} />{a.distance_km.toFixed(1)} km</span>
          )}
          <span className="activity-card__metric"><Clock size={12} />{fmtDur(a.duration_seconds)}</span>
          {a.avg_speed_kmh > 0 && (
            <span className="activity-card__metric"><TrendingUp size={12} />{a.avg_speed_kmh.toFixed(1)} km/h</span>
          )}
          {a.hr_avg && (
            <span className="activity-card__metric"><Heart size={12} />{Math.round(a.hr_avg)} bpm</span>
          )}
        </div>
        {hasAnalysis && (
          <div className="activity-card__chips">
            {a.analyses[0].cards.slice(0, 2).map((card: any, i: number) => (
              <span key={i} className={`chip chip--${card.severity}`}>{card.title}</span>
            ))}
            {a.analyses[0].cards.length > 2 && (
              <span className="chip chip--more">{t("more", { count: a.analyses[0].cards.length - 2 })}</span>
            )}
          </div>
        )}
      </div>
      <div className="activity-card__right">
        {hasAnalysis
          ? <span className="activity-card__badge">🐐 GOAT</span>
          : <span className="activity-card__badge activity-card__badge--pending">{t("pending")}</span>
        }
        <ChevronRight size={16} className="activity-card__arrow" />
      </div>
    </div>
  );
}
