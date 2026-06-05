import type { Metadata, Viewport } from "next";
import { Oswald, Lexend, Fira_Code } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Providers from "../providers";
import { ThemeProvider } from "../components/ThemeProvider";
import GlobalHeader from "../components/GlobalHeader";
import "../global.css";

const oswald   = Oswald({ subsets: ["latin"], variable: "--font-oswald", display: "swap" });
const lexend   = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira", display: "swap" });

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://draft-coach-mu.vercel.app";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F5FC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title");
  const description = t("description");
  const ogImage = "/screenshots/landing-dark.png";

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords: ["sports coach", "strava", "AI coach", "fitness analytics", "running", "cycling", "training"],
    authors: [{ name: "Ceren Gültekin" }],
    alternates: {
      canonical: `/${locale}`,
      languages: { tr: "/tr", en: "/en" },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/${locale}`,
      siteName: "DraftCoach",
      locale: locale === "tr" ? "tr_TR" : "en_US",
      images: [{ url: ogImage, width: 1440, height: 900, alt: "DraftCoach" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      {/* Runs before React hydration — prevents flash of wrong theme */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', t);
          })();
        `}} />
      </head>
      <body className={`${oswald.variable} ${lexend.variable} ${firaCode.variable}`}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <Providers>
              <GlobalHeader />
              {children}
            </Providers>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
