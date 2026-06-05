"use client";

import { useTranslations, useLocale } from "next-intl";
import { signIn, useSession } from "next-auth/react";
import { Zap, BarChart2, Bell, Shield } from "lucide-react";

export default function LandingPage() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const { data: session, status } = useSession();

  const handleConnect = () => signIn("strava", { callbackUrl: `/${locale}/dashboard` });

  return (
    <main className="landing">

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__badge">{t("hero.badge")}</div>
        <h1 className="hero__title">
          {t("hero.title")}<br />
          <span className="hero__title--accent">{t("hero.titleAccent")}</span>
        </h1>
        <p className="hero__sub">{t("hero.sub")}</p>
        {status === "authenticated" ? (
          <a className="btn-connect-strava" href={`/${locale}/dashboard`}>
            <Zap size={20} />
            {t("hero.dashboard")}
          </a>
        ) : (
          <button className="btn-connect-strava" onClick={handleConnect}>
            <StravaIcon />
            {t("hero.cta")}
          </button>
        )}
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
          <a href="https://www.linkedin.com/in/ceren-g%C3%BCltekin-2a70841b3/" target="_blank" rel="noopener noreferrer">
            {t("footer.credit")}
          </a>
          {" · "}
          <a href="https://github.com/cerengultekin-coder/DraftCoach" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </span>
      </footer>

    </main>
  );
}


function StravaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
    </svg>
  );
}
