"use client";

// v2 preview route entry.
// Lives at /v2 alongside the prod app at "/". Fetches live Open-Meteo data.
// Owns the theme state (5 palettes, persisted to localStorage) so the
// data-theme attribute can cascade to all child components via CSS vars.
//
// Also syncs <meta name="theme-color"> on every theme change so iOS
// Safari paints its status-bar area to match the active theme (otherwise
// the top of the screen stays a fixed paper colour even in dark mode).

import { useEffect, useState } from "react";
import MainScreen from "./components/MainScreen";

const THEME_KEY = "sys-theme-v1";

// Match --bg from each theme block in v2.css
const THEME_COLORS = {
  terracotta: "#f5ede1",
  burgundy:   "#ecdcb8",
  nocturnal:  "#10161a",
  oceanic:    "#dce6ef",
  forest:     "#e8e5cf",
};

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

  // Sync iOS status-bar + PWA status-bar chrome to the current theme.
  // Also flip apple-mobile-web-app-status-bar-style between "default"
  // (dark text on light bg) and "black-translucent" for the dark theme
  // so the clock/battery glyphs stay readable in standalone mode.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const bg = THEME_COLORS[theme] || THEME_COLORS.terracotta;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", bg);

    const isDark = theme === "nocturnal";
    let statusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!statusMeta) {
      statusMeta = document.createElement("meta");
      statusMeta.setAttribute("name", "apple-mobile-web-app-status-bar-style");
      document.head.appendChild(statusMeta);
    }
    statusMeta.setAttribute("content", isDark ? "black-translucent" : "default");
  }, [theme]);

  return (
    <div className="v2-stage" data-theme={theme}>
      <MainScreen theme={theme} setTheme={pickTheme}/>
    </div>
  );
}
