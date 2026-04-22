"use client";

// v2 HourlyList — two view modes: Cards (horizontal scroll, one-glance)
// and List (v1-style dense rows, each expandable for full details).
// Pill toggle in the section header switches between them. Selection
// is always shared with the StickyInfoBar above via onSelect.

import { useEffect, useRef, useState } from "react";
import { coherentVerdict } from "../lib/verdict";
import { degToCompass } from "../lib/prodScoring";
import { fmtHour } from "../lib/hooks";

const WaveIcon = () => (
  <svg width="11" height="8" viewBox="0 0 22 14" fill="none" aria-hidden="true">
    <path d="M1 9C3.5 9 3.5 5 6 5C8.5 5 8.5 9 11 9C13.5 9 13.5 5 16 5C18.5 5 18.5 9 21 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M1 3C3 3 4 1 6 1C8 1 9 3 11 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".4"/>
  </svg>
);
const WindIcon = () => (
  <svg width="11" height="9" viewBox="0 0 22 16" fill="none" aria-hidden="true">
    <path d="M2 6H14C16.2 6 17 4.4 17 3.5C17 2.1 15.9 1 14.5 1C13.1 1 12 2.1 12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 10H17C19.2 10 20 11.6 20 12.5C20 13.9 18.9 15 17.5 15C16.1 15 15 13.9 15 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export default function HourlyList({ hours, selectedIdx, onSelect, currentHour }) {
  const [viewMode, setViewMode] = useState("cards");
  const [openIdx, setOpenIdx] = useState(null);
  const scrollerRef = useRef(null);
  const cardRefs = useRef([]);

  // Auto-centre the current hour when the cards view mounts or the
  // selection changes.
  useEffect(() => {
    if (viewMode !== "cards") return;
    const idx = selectedIdx >= 0 ? selectedIdx : hours.findIndex((h) => h.hour === currentHour);
    if (idx < 0) return;
    const el = cardRefs.current[idx];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [viewMode, selectedIdx, currentHour, hours.length]);

  const handleRowClick = (i) => {
    onSelect(i);
    setOpenIdx((o) => (o === i ? null : i));
  };

  return (
    <div className={`hly ${viewMode === "list" ? "hly--list-mode" : ""}`}>
      <div className="hly-h">
        <div className="hly-h-left">
          <span className="t">Hourly</span>
          <span className="i">ⓘ</span>
        </div>
        {/* Pill toggle: CARDS ↔ LIST */}
        <div className="hly-pill">
          <div
            className="hly-pill-cursor"
            style={{ transform: viewMode === "list" ? "translateX(100%)" : "translateX(0%)" }}
          />
          <button
            className={`hly-pill-opt ${viewMode === "cards" ? "on" : ""}`}
            onClick={() => setViewMode("cards")}
          >Cards</button>
          <button
            className={`hly-pill-opt ${viewMode === "list" ? "on" : ""}`}
            onClick={() => setViewMode("list")}
          >List</button>
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="hly-cards" ref={scrollerRef}>
          {hours.map((h, i) => {
            const v = coherentVerdict(h);
            const past = h.hour < currentHour;
            const selected = selectedIdx === i;
            const tone =
              v.key === "pumping" || v.key === "great" ? "good"
              : v.key === "good" || v.key === "fun"   ? "ok"
              : "bad";
            return (
              <button
                key={i}
                ref={(el) => (cardRefs.current[i] = el)}
                className={`hly-card hly-card--${tone} ${selected ? "selected" : ""} ${past ? "past" : ""}`}
                onClick={() => onSelect(i)}
                aria-pressed={selected}
                style={{ "--card-color": v.color }}
              >
                <div className="hly-card-time">{fmtHour(h.hour)}</div>
                <div className="hly-card-score">{h.score}</div>
                <div className="hly-card-label">{v.label.toUpperCase()}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="hly-list">
          {hours.map((h, i) => {
            const v = coherentVerdict(h);
            const past = h.hour < currentHour;
            const selected = selectedIdx === i;
            const isOpen = openIdx === i;
            const rowOpacity = Math.min(0.9, Math.max(0.15, h.score / 110));
            const swellDir = typeof h.swellDir === "string" ? h.swellDir : degToCompass(h.swellDir);
            const windDir  = typeof h.windDir  === "string" ? h.windDir  : degToCompass(h.windDir);
            return (
              <div key={i} className={`hly-lwrap ${isOpen ? "open" : ""}`}>
                <div
                  className={`hly-lrow ${past ? "past" : ""} ${selected || isOpen ? "sel" : ""}`}
                  onClick={() => handleRowClick(i)}
                  style={{ "--row-color": v.color, "--row-opacity": rowOpacity }}
                >
                  <div className="hly-ltime">{fmtHour(h.hour)}</div>
                  <div className="hly-lbar">
                    <div className="hly-lbar-fill" style={{ width: `${Math.max(4, h.score)}%`, background: v.color }}/>
                  </div>
                  <div className="hly-lscoreverdict">
                    <span className="hly-lscore" style={{ color: v.color }}>{h.score}</span>
                    <span className="hly-lverd"  style={{ color: v.color }}>{v.label.toUpperCase()}</span>
                  </div>
                  <div className="hly-lstats">
                    <span className="hly-lstat"><WaveIcon/>{h.faceFtLow}–{h.faceFtHigh}ft</span>
                    <span className="hly-lstat-sep">·</span>
                    <span className="hly-lstat"><WindIcon/>{Math.round(h.windKmh)}km/h</span>
                  </div>
                </div>
                <div className={`hly-lexpand ${isOpen ? "open" : ""}`}>
                  {isOpen && (
                    <div className="hly-lexpand-inner">
                      <div className="hly-xface">
                        <span className="hly-xface-val" style={{ color: v.color }}>
                          {h.faceFtLow}–{h.faceFtHigh}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 3, opacity: 0.7 }}>ft</span>
                        </span>
                        <span className="hly-xface-sub">{h.swellHeight.toFixed(1)} m · {Math.round(h.swellPeriod)}s</span>
                      </div>
                      <div className="hly-xhint">{v.sub}</div>
                      <div className="hly-xgrid">
                        <div className="hly-xcell">
                          <div className="hly-xval" style={{ color: v.color }}>{h.swellHeight.toFixed(1)}<span className="hly-xunit">m</span></div>
                          <div className="hly-xsub">Swell · {swellDir} · {Math.round(h.swellPeriod)}s</div>
                        </div>
                        <div className="hly-xcell">
                          <div className="hly-xval" style={{ color: v.color }}>{Math.round(h.windKmh)}<span className="hly-xunit">km/h</span></div>
                          <div className="hly-xsub">Wind · {windDir} · {h.windType}</div>
                        </div>
                        {h.tideM != null && (
                          <div className="hly-xcell">
                            <div className="hly-xval" style={{ color: v.color }}>{h.tideM.toFixed(1)}<span className="hly-xunit">m</span></div>
                            <div className="hly-xsub">Tide</div>
                          </div>
                        )}
                        {h.airTemp != null && (
                          <div className="hly-xcell">
                            <div className="hly-xval" style={{ color: v.color }}>{Math.round(h.airTemp)}<span className="hly-xunit">°C</span></div>
                            <div className="hly-xsub">Air</div>
                          </div>
                        )}
                        {h.seaTemp != null && (
                          <div className="hly-xcell">
                            <div className="hly-xval" style={{ color: v.color }}>{Math.round(h.seaTemp)}<span className="hly-xunit">°C</span></div>
                            <div className="hly-xsub">Water</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
