"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, mounted, toggle } = useTheme();

  if (!mounted) return <div style={{ width: 36, height: 36, flexShrink: 0 }} />;

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
