"use client";

// v2 metric-related components — MetricCard (expandable), WindRose, SwellDirTag, DrivingChips.
// Ported from export-v2/v2-parts.jsx.

import { drivingChipsFor } from "../lib/verdict";

export function SwellDirTag({ dir }) {
  const deg = ({ N: 0, NE: 45, E: 90, SE: 135, S: 180, SSW: 202, SW: 225, WSW: 247, W: 270, NW: 315 })[dir] ?? 225;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, color: "var(--text)" }}>
      <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: `rotate(${deg}deg)`, transition: "transform 0.5s cubic-bezier(.3,.8,.3,1)" }}>
        <path d="M6 1 L6 11 M3 4 L6 1 L9 4" fill="none" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {dir}
    </span>
  );
}

export function MetricCard({ icon, label, val, unit, sub, expanded, onToggle, children }) {
  return (
    <div className="m-card-expandable" onClick={onToggle}>
      <div className="m-lbl">{icon}{label}</div>
      <div className="m-val">{val}{unit && <span className="unit">{unit}</span>}</div>
      <div className="m-sub">{sub}</div>
      <div className={`m-expand ${expanded ? "open" : ""}`}>
        <div className="m-expand-inner">{children}</div>
      </div>
    </div>
  );
}

export function WindRose({ deg }) {
  const rad = ((deg - 90) * Math.PI) / 180;
  const r = 26;
  const x = 40 + Math.cos(rad) * r;
  const y = 40 + Math.sin(rad) * r;
  return (
    <svg className="wind-rose" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="32"/>
      <circle cx="40" cy="40" r="18"/>
      <text x="40" y="9" textAnchor="middle">N</text>
      <text x="74" y="43" textAnchor="middle">E</text>
      <text x="40" y="78" textAnchor="middle">S</text>
      <text x="7" y="43" textAnchor="middle">W</text>
      <line className="arrow" x1="40" y1="40" x2={x} y2={y}/>
      <circle cx={x} cy={y} r="3" fill="var(--accent)" stroke="none"/>
    </svg>
  );
}

export function DrivingChips({ hour }) {
  const chips = drivingChipsFor(hour);
  return (
    <div className="drv">
      <div className="drv-h">What's driving the score</div>
      <div className="drv-chips">
        {chips.map((c, i) => (
          <span key={i} className={`chip ${c.k}`}>{c.t}</span>
        ))}
      </div>
    </div>
  );
}
