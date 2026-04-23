"use client";

// v2 design is now the default at "/". The old v1 SurfApp lives at /v1-legacy
// (if kept) and the standalone preview at /v2. Theme is owned here so the
// data-theme attribute cascades to every child via CSS vars.
// Also syncs <meta name="theme-color"> on every theme change so iOS Safari
// paints its status-bar area to match the active theme (otherwise the top
// of the screen stays a fixed paper colour even in dark mode).

import { useEffect, useState } from "react";
import "./v2/v2.css";
import MainScreen from "./v2/components/MainScreen";

const THEME_KEY = "sys-theme-v1";

// Mirrors --bg from each .v2-stage[data-theme="..."] block in v2.css
const THEME_COLORS = {
  terracotta: "#f5ede1",
  burgundy:   "#ecdcb8",
  nocturnal:  "#10161a",
  oceanic:    "#dce6ef",
  forest:     "#e8e5cf",
};

export default function Home() {
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

  // Keep iOS Safari status-bar + PWA chrome in sync with the active theme.
  // Crucial detail: wait for the #__preload splash to be gone before we
  // flip theme-color — otherwise iOS paints the top strip with the theme
  // bg (paper for terracotta) while #__preload below is still dark, and
  // the user sees a pale strip above the dark splash.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const bg = THEME_COLORS[theme] || THEME_COLORS.terracotta;
    const isDark = theme === "nocturnal";

    const applyThemeColor = () => {
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", bg);
    };

    // html/body/color-scheme can be set immediately — those only affect
    // the area behind the splash once it's gone, they don't leak during.
    document.documentElement.style.setProperty("--bg", bg);
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";

    // status-bar-style: "black-translucent" lets the page bg show through
    // — one value works for every theme. iOS caches this at PWA launch
    // so mid-session flips are ignored anyway.
    let statusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!statusMeta) {
      statusMeta = document.createElement("meta");
      statusMeta.setAttribute("name", "apple-mobile-web-app-status-bar-style");
      document.head.appendChild(statusMeta);
    }
    statusMeta.setAttribute("content", "black-translucent");

    // Defer the theme-color flip until the splash is gone from the DOM.
    // While #__preload is visible, the meta stays at the dark splash
    // colour set statically in layout.js viewport config.
    const preload = document.getElementById("__preload");
    if (!preload) { applyThemeColor(); return; }

    const obs = new MutationObserver(() => {
      if (!document.getElementById("__preload")) {
        obs.disconnect();
        applyThemeColor();
      }
    });
    obs.observe(document.body, { childList: true });
    return () => obs.disconnect();
  }, [theme]);

  return (
    <div className="v2-stage" data-theme={theme}>
      <MainScreen theme={theme} setTheme={pickTheme}/>
    </div>
  );
}
