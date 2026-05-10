"use client";

// v2 TideCurve — draggable tide scrubber. Reads real h.tideM (sea_level_height_msl
// from Open-Meteo Marine API) and falls back to a synthetic sin curve only when
// all hours have null tideM (mock data, or API miss). Without the real wiring
// the curve and H/L peaks were a sin function of the hour — totally decoupled
// from actual water height.

import { useRef } from "react";
import { fmtHour } from "../lib/hooks";

// Locale-aware short hour for axis labels (4am / 12pm / 8pm). Falls back to
// the manual am/pm strings if Intl breaks for any reason.
function fmtAxisHour(hr, tz) {
  try {
    const dt = new Date();
    dt.setHours(hr, 0, 0, 0);
    return dt
      .toLocaleTimeString(undefined, { hour: "numeric", hour12: true, timeZone: tz })
      .toLowerCase()
      .replace(/\s/g, "");
  } catch {
    return hr === 0 ? "12am" : hr < 12 ? `${hr}am` : hr === 12 ? "12pm" : `${hr - 12}pm`;
  }
}

export default function TideCurve({ hours, selectedIdx, onSelect, tz }) {
  const W = 340, H = 110, pad = 14;
  if (!hours || !hours.length) return null;

  const base = hours[0].hour;
  const span = hours[hours.length - 1].hour - base || 1;
  const xs = (hr) => pad + ((hr - base) / span) * (W - pad * 2);

  // Real tide — pull tideM from each hour. Decide which path we're on:
  // - "real": at least 2 hours have a real tideM → use those, normalize on
  //   the day's min/max so the curve fills the chart regardless of the
  //   absolute meters number (a 0.4–0.6m day still draws a full curve).
  // - "mock": fallback to a sin so the demo + offline mode still look like
  //   something. Marked visually with a subtle "(estimated)" sub.
  const realValues = hours.map((h) => (typeof h?.tideM === "number" ? h.tideM : null));
  const realCount = realValues.filter((v) => v != null).length;
  const useReal = realCount >= 2;

  let normalized;
  let isMock = false;
  if (useReal) {
    const valid = realValues.filter((v) => v != null);
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    normalized = realValues.map((v, i) => {
      // Linear interp across gaps so a single-hour null doesn't break the line.
      if (v != null) return (v - min) / range;
      // Find nearest non-null neighbours on either side.
      let lo = i - 1, hi = i + 1;
      while (lo >= 0 && realValues[lo] == null) lo--;
      while (hi < realValues.length && realValues[hi] == null) hi++;
      const loV = lo >= 0 ? realValues[lo] : (hi < realValues.length ? realValues[hi] : min);
      const hiV = hi < realValues.length ? realValues[hi] : loV;
      const t = lo === hi ? 0 : (i - lo) / (hi - lo);
      const interp = loV + (hiV - loV) * t;
      return (interp - min) / range;
    });
  } else {
    isMock = true;
    normalized = hours.map((h) => 0.5 + 0.45 * Math.sin(((h.hour - 5) / 24) * Math.PI * 2));
  }

  const ys = (v) => H - 20 - v * (H - 36);
  const pts = hours.map((h, i) => [xs(h.hour), ys(normalized[i])]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = d + ` L ${pts[pts.length - 1][0]},${H - 16} L ${pts[0][0]},${H - 16} Z`;
  const sel = pts[selectedIdx] || pts[0];

  // Peak detection — adjacent comparison on the normalized curve. Same shape
  // detector for both real and mock paths.
  const peaks = [];
  for (let i = 1; i < hours.length - 1; i++) {
    const v0 = normalized[i - 1];
    const v1 = normalized[i];
    const v2 = normalized[i + 1];
    if ((v1 > v0 && v1 >= v2) || (v1 < v0 && v1 <= v2)) {
      peaks.push({ idx: i, hi: v1 > v0 });
    }
  }

  const svgRef = useRef(null);
  const handleDrag = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const px = (cx / rect.width) * W;
    let best = 0, bd = Infinity;
    hours.forEach((h, i) => {
      const d2 = Math.abs(xs(h.hour) - px);
      if (d2 < bd) { bd = d2; best = i; }
    });
    onSelect(best);
  };

  return (
    <div className="tide">
      <div className="tide-h">
        Tide across the day{isMock ? " · estimated" : ""}
      </div>
      <svg
        ref={svgRef}
        className="tide-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseDown={(e) => {
          handleDrag(e);
          const up = () => {
            window.removeEventListener("mousemove", handleDrag);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", handleDrag);
          window.addEventListener("mouseup", up);
        }}
        onTouchStart={handleDrag}
        onTouchMove={handleDrag}
      >
        <path className="tide-fill" d={area}/>
        <path className="tide-path" d={d}/>
        {peaks.map((p, i) => (
          <g key={i}>
            <circle cx={pts[p.idx][0]} cy={pts[p.idx][1]} r="2.5" fill="var(--accent)"/>
            <text className="tide-label peak" x={pts[p.idx][0]} y={pts[p.idx][1] - 8} textAnchor="middle">
              {p.hi ? "H" : "L"} {fmtHour(hours[p.idx].hour).replace(":00", "")}
            </text>
          </g>
        ))}
        <line className="tide-marker" x1={sel[0]} y1="10" x2={sel[0]} y2={H - 16}/>
        <circle className="tide-dot" cx={sel[0]} cy={sel[1]} r="5.5"/>
        <text className="tide-axis" x={pad} y={H - 3} textAnchor="start">
          {fmtAxisHour(hours[0].hour, tz)}
        </text>
        <text className="tide-axis" x={W / 2} y={H - 3} textAnchor="middle">
          {fmtAxisHour(12, tz)}
        </text>
        <text className="tide-axis" x={W - pad} y={H - 3} textAnchor="end">
          {fmtAxisHour(hours[hours.length - 1].hour, tz)}
        </text>
      </svg>
    </div>
  );
}
