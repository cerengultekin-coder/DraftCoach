"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Zap, BarChart2, Bell, Shield } from "lucide-react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <main className="landing">

      {/* ── Topbar ── */}
      <header className="landing-nav">
        <div className="landing-nav__brand">
          <WheelIcon />
          <span>DraftCoach</span>
        </div>
        <button
          className="btn-connect-sm"
          onClick={() => signIn("strava", { callbackUrl: "/dashboard" })}
        >
          Connect Strava
        </button>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__badge">🐐 Powered by Coach GOAT</div>
        <h1 className="hero__title">
          Your AI cycling coach,<br />
          <span className="hero__title--accent">activated by every ride.</span>
        </h1>
        <p className="hero__sub">
          Connect Strava once. After each activity, Coach GOAT analyzes your data
          and sends you personalized coaching — performance, recovery, nutrition, technique.
        </p>
        <button
          className="btn-connect-strava"
          onClick={() => signIn("strava", { callbackUrl: "/dashboard" })}
        >
          <StravaIcon />
          Connect with Strava
        </button>
        <p className="hero__fine">Free · No credit card · Works with your existing rides</p>
      </section>

      {/* ── Features ── */}
      <section className="features">
        <div className="feature-card">
          <div className="feature-card__icon"><Zap size={22} /></div>
          <h3>Instant Analysis</h3>
          <p>The moment your activity syncs to Strava, Coach GOAT starts analyzing. No manual uploads, no waiting.</p>
        </div>
        <div className="feature-card">
          <div className="feature-card__icon"><BarChart2 size={22} /></div>
          <h3>Real Data, Real Insights</h3>
          <p>Not generic advice. Coach GOAT reads your actual bpm, km/h, elevation — and tells you what it means.</p>
        </div>
        <div className="feature-card">
          <div className="feature-card__icon"><Bell size={22} /></div>
          <h3>Coaching Cards</h3>
          <p>Performance, recovery, nutrition, technique, next training plan — delivered as clear, actionable cards.</p>
        </div>
        <div className="feature-card">
          <div className="feature-card__icon"><Shield size={22} /></div>
          <h3>Private by Default</h3>
          <p>Your data stays yours. We only read activity data, never post anything to your Strava.</p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta">
        <h2>Ready to train smarter?</h2>
        <p>Join cyclists who get AI coaching after every ride.</p>
        <button
          className="btn-connect-strava"
          onClick={() => signIn("strava", { callbackUrl: "/dashboard" })}
        >
          <StravaIcon />
          Get Started Free
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>© 2026 DraftCoach</span>
        <span>Built by <a href="https://www.linkedin.com/in/ceren-g%C3%BCltekin-2a70841b3/" target="_blank" rel="noopener noreferrer">Ceren Gültekin</a></span>
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