"use client";

// v2 ThemeSwitcher — palette popover injected into the header in place of
// the old ★ favourites button. Ported from Prototype.html's inline script.

import { useEffect, useRef, useState } from "react";

const THEMES = [
  { key: "terracotta", name: "Terracotta & Jade", tag: "Default · Coastal",     dots: ["#2d7a6e", "#d47559", "#f5ede1"] },
  { key: "burgundy",   name: "Burgundy & Rye",    tag: "Warm · Analog",         dots: ["#7a2a2b", "#c88a3c", "#ecdcb8"] },
  { key: "nocturnal",  name: "Nocturnal",         tag: "Dark · Dawn patrol",    dots: ["#9ad5c1", "#e9c77d", "#10161a"] },
  { key: "oceanic",    name: "Oceanic",           tag: "Cool · Cyanotype",      dots: ["#2a5a94", "#4a7ca8", "#e8eff6"] },
  { key: "forest",     name: "Forest",            tag: "Mossy · Topographic",   dots: ["#3d5a2f", "#c39641", "#edebd4"] },
];

export default function ThemeSwitcher({ theme, setTheme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = THEMES.find((t) => t.key === theme) || THEMES[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="ibtn palette"
        aria-label="Change palette"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        <span className="ibtn-dots">
          <span style={{ background: cur.dots[0] }}/>
          <span style={{ background: cur.dots[1] }}/>
          <span style={{ background: cur.dots[2] }}/>
          <span style={{ background: "var(--text-dim)" }}/>
        </span>
      </button>
      {open && (
        <div className="theme-switcher" onClick={(e) => e.stopPropagation()}>
          <div className="ts-title">Palette</div>
          {THEMES.map((t) => (
            <button
              key={t.key}
              className={`ts-row ${theme === t.key ? "active" : ""}`}
              onClick={() => { setTheme(t.key); setTimeout(() => setOpen(false), 180); }}
            >
              <div className="ts-dots">
                {t.dots.map((c, i) => <span key={i} style={{ background: c }}/>)}
              </div>
              <div className="ts-body">
                <div className="ts-name">{t.name}</div>
                <div className="ts-tag">{t.tag}</div>
              </div>
              <div className="ts-check"/>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
