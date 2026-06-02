"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";

const TIMEOUT_MS = 15 * 60_000; // 15 dakika
const CHECK_MS   = 10_000;      // her 10 saniyede kontrol

export default function InactivityGuard() {
  const { status } = useSession();
  const t = useTranslations("inactivity");
  const locale = useLocale();
  const [warnMin, setWarnMin] = useState<number | null>(null);
  const lastRef = useRef(Date.now());

  const resetActivity = useCallback(() => {
    lastRef.current = Date.now();
    setWarnMin(null);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    const EVENTS = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    EVENTS.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));

    const interval = setInterval(() => {
      const remaining = TIMEOUT_MS - (Date.now() - lastRef.current);

      if (remaining <= 0) {
        signOut({ callbackUrl: `/${locale}/` });
        return;
      }

      const mins = Math.ceil(remaining / 60_000);

      if (remaining <= 1 * 60_000)      setWarnMin(mins); // 1 dk → kırmızı
      else if (remaining <= 5 * 60_000) setWarnMin(mins); // 5 dk → turuncu
      else if (remaining <= 10 * 60_000) setWarnMin(mins); // 10 dk → yeşil
      else setWarnMin(null);
    }, CHECK_MS);

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetActivity));
      clearInterval(interval);
    };
  }, [status, resetActivity, locale]);

  if (warnMin === null || status !== "authenticated") return null;

  const level = warnMin <= 1 ? "critical" : warnMin <= 5 ? "warning" : "info";

  return (
    <div className={`inactivity-banner inactivity-banner--${level}`}>
      <span className="inactivity-banner__text">
        ⏱ {t("warning", { minutes: warnMin })}
      </span>
      <button className="inactivity-banner__btn" onClick={resetActivity}>
        {t("stayBtn")}
      </button>
    </div>
  );
}
