"use client";

import { SessionProvider } from "next-auth/react";
import InactivityGuard from "./components/InactivityGuard";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <InactivityGuard />
    </SessionProvider>
  );
}
