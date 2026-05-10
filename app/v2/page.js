"use client";

// v2 preview route entry.
// Lives at /v2 alongside the prod app at "/". Fetches live Open-Meteo data.
// Owns the theme state (5 palettes, persisted to localStorage) so the
// data-theme attribute can cascade to all child components via CSS vars.

import { useEffect, useState } from "react";
import MainScreen from "./components/MainScreen";

const THEME_KEY = "sys-theme-v1";

export default function V2Page() {
  const [theme, setTheme] = useState("terracotta");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) setTheme(saved);
    } catch {}
  }, []);
  // Mirror data-theme onto <html> so portaled UI (ScoreSheet) that lives
  // outside .v2-stage still inherits the right CSS theme vars. Without this,
  // the sheet falls back to :root defaults and reads invisible on non-default
  // themes. Same logic as app/page.js.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const pickTheme = (next) => {
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };
  return (
    <div className="v2-stage" data-theme={theme}>
      <MainScreen theme={theme} setTheme={pickTheme}/>
    </div>
  );
}
