"use client";

// v2 HourlyList — horizontal scrollable cards.
// Each card = one hour. Color band by verdict, score number, condition
// label. Current hour is auto-centered on mount. Selected card has an
// active state (lifted, ring). Snap-scrolling with momentum on touch.

import { useEffect, useRef } from "react";
import { coherentVerdict } from "../lib/verdict";
import { fmtHour } from "../lib/hooks";

export default function HourlyList({ hours, selectedIdx, onSelect, currentHour }) {
  const scrollerRef = useRef(null);
  const cardRefs = useRef([]);

  // Auto-centre the current hour (or the selected hour if user picked one)
  // on mount and whenever the selection changes.
  useEffect(() => {
    const idx = selectedIdx >= 0 ? selectedIdx : hours.findIndex((h) => h.hour === currentHour);
    if (idx < 0) return;
    const el = cardRefs.current[idx];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedIdx, currentHour, hours.length]);

  return (
    <div className="hly">
      <div className="hly-h">
        <span className="t">Hourly</span>
        <span className="i">ⓘ</span>
      </div>
      <div className="hly-cards" ref={scrollerRef}>
        {hours.map((h, i) => {
          const v = coherentVerdict(h);
          const past = h.hour < currentHour;
          const selected = selectedIdx === i;
          // Map the verdict to a card background tone — distinct enough
          // that a glance at the strip tells you the day shape.
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
    </div>
  );
}
