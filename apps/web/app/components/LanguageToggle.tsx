"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/navigation";

export default function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="lang-toggle">
      <button
        className={`lang-toggle__btn${locale === "tr" ? " active" : ""}`}
        onClick={() => router.replace(pathname, { locale: "tr" })}
      >
        TR
      </button>
      <button
        className={`lang-toggle__btn${locale === "en" ? " active" : ""}`}
        onClick={() => router.replace(pathname, { locale: "en" })}
      >
        EN
      </button>
    </div>
  );
}
