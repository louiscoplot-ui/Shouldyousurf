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
