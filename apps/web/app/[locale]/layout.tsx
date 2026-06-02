import type { Metadata } from "next";
import { Oswald, Lexend, Fira_Code } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Providers from "../providers";
import { ThemeProvider } from "../components/ThemeProvider";
import "../global.css";

const oswald   = Oswald({ subsets: ["latin"], variable: "--font-oswald", display: "swap" });
const lexend   = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira", display: "swap" });

export const metadata: Metadata = {
  title: "DraftCoach — AI Sports Coach",
  description: "Connect your Strava and get instant AI-powered coaching after every activity. Personalized insights on performance, recovery, nutrition and training.",
  keywords: ["sports coach", "strava", "AI coach", "fitness analytics", "training"],
  openGraph: {
    title: "DraftCoach — AI Sports Coach",
    description: "Connect your Strava and get instant AI-powered coaching after every activity.",
    type: "website",
    url: "https://draft-coach.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "DraftCoach — AI Sports Coach",
    description: "Connect your Strava and get instant AI-powered coaching after every activity.",
  },
};

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
            <Providers>{children}</Providers>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
