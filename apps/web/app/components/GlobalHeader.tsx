"use client";

import { useSession, signOut } from "next-auth/react";
import { useLocale } from "next-intl";
import Image from "next/image";
import { LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";

export default function GlobalHeader() {
  const locale = useLocale();
  const { data: session, status } = useSession();
  const isAuth = status === "authenticated" && session?.user;

  return (
    <header className="global-header">
      <a href={`/${locale}`} className="header-logo">
        <span>⊕</span> DraftCoach
      </a>
      <div className="header-actions">
        <ThemeToggle />
        <LanguageToggle />
        {isAuth && (
          <div className="header-user">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt=""
                width={30}
                height={30}
                className="header-user__avatar"
              />
            )}
            <span className="header-user__name">{session.user.name}</span>
            <button
              className="header-user__logout"
              onClick={() => signOut({ callbackUrl: `/${locale}/` })}
              title="Çıkış yap"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
