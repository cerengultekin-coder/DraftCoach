"use client";

import { useTranslations, useLocale } from "next-intl";
import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "@/navigation";
import { Zap, BarChart2, Bell, Shield } from "lucide-react";
import LanguageToggle from "../components/LanguageToggle";
import ThemeToggle from "../components/ThemeToggle";

export default function LandingPage() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  const handleConnect = () => signIn("strava", { callbackUrl: `/${locale}/dashboard` });

  return (
    <main className="landing">

      {/* ── Topbar ── */}
      <header className="landing-nav">
        <div className="landing-nav__brand">
          <WheelIcon />
          <span>DraftCoach</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__badge">{t("hero.badge")}</div>
        <h1 className="hero__title">
          {t("hero.title")}<br />
          <span className="hero__title--accent">{t("hero.titleAccent")}</span>
        </h1>
        <p className="hero__sub">{t("hero.sub")}</p>
        <button className="btn-connect-strava" onClick={handleConnect}>
          <StravaIcon />
          {t("hero.cta")}
        </button>
        <p className="hero__fine">{t("hero.fine")}</p>
      </section>

      {/* ── Features ── */}
      <section className="features">
        <div className="feature-card">
          <div className="feature-card__icon"><Zap size={22} /></div>
          <h3>{t("features.instant.title")}</h3>
          <p>{t("features.instant.desc")}</p>
        </div>
        <div className="feature-card">
          <div className="feature-card__icon"><BarChart2 size={22} /></div>
          <h3>{t("features.data.title")}</h3>
          <p>{t("features.data.desc")}</p>
        </div>
        <div className="feature-card">
          <div className="feature-card__icon"><Bell size={22} /></div>
          <h3>{t("features.cards.title")}</h3>
          <p>{t("features.cards.desc")}</p>
        </div>
        <div className="feature-card">
          <div className="feature-card__icon"><Shield size={22} /></div>
          <h3>{t("features.private.title")}</h3>
          <p>{t("features.private.desc")}</p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta">
        <h2>{t("cta.title")}</h2>
        <p>{t("cta.sub")}</p>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>© 2026 DraftCoach</span>
        <span>
          {t("footer.builtBy")}{" "}
          <a href="https://www.linkedin.com/in/ceren-g%C3%BCltekin-2a70841b3/" target="_blank" rel="noopener noreferrer">
            Ceren Gültekin
          </a>
        </span>
      </footer>

    </main>
  );
}

function WheelIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="2"/>
      <circle cx="14" cy="14" r="3" fill="currentColor"/>
      <line x1="14" y1="2"  x2="14" y2="11"  stroke="currentColor" strokeWidth="1.5"/>
      <line x1="14" y1="17" x2="14" y2="26"  stroke="currentColor" strokeWidth="1.5"/>
      <line x1="2"  y1="14" x2="11" y2="14"  stroke="currentColor" strokeWidth="1.5"/>
      <line x1="17" y1="14" x2="26" y2="14"  stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function StravaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
    </svg>
  );
}
