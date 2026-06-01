import type { Metadata } from "next";
import { Oswald, Lexend, Fira_Code } from "next/font/google";
import Providers from "./providers";
import "./global.css";

const oswald   = Oswald({ subsets: ["latin"], variable: "--font-oswald", display: "swap" });
const lexend   = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira", display: "swap" });

export const metadata: Metadata = {
  title: "DraftCoach — AI Cycling Coach",
  description: "Connect your Strava and get instant AI-powered coaching after every ride. Personalized insights on performance, recovery, nutrition and training.",
  keywords: ["cycling coach", "strava", "AI coach", "cycling analytics", "GPX analysis", "bike training"],
  openGraph: {
    title: "DraftCoach — AI Cycling Coach",
    description: "Connect your Strava and get instant AI-powered coaching after every ride.",
    type: "website",
    url: "https://draft-coach.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "DraftCoach — AI Cycling Coach",
    description: "Connect your Strava and get instant AI-powered coaching after every ride.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${oswald.variable} ${lexend.variable} ${firaCode.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}