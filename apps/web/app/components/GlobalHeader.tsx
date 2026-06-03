"use client";

import { useLocale } from "next-intl";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";

export default function GlobalHeader() {
  const locale = useLocale();

  return (
    <header className="global-header">
      <a href={`/${locale}`} className="header-logo">
        <span>⊕</span> DraftCoach
      </a>
      <div className="header-actions">
        <ThemeToggle />
        <LanguageToggle />
      </div>
    </header>
  );
}
