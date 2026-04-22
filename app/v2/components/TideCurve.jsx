"use client";

// v2 TideCurve — draggable tide scrubber. Ported from export-v2/v2-parts.jsx.

import { useRef } from "react";
import { fmtHour } from "../lib/hooks";

export default function TideCurve({ hours, selectedIdx, onSelect }) {
  const W = 340, H = 110, pad = 14;
  const base = hours[0].hour;
  const xs = (hr) => pad + ((hr - base) / (hours[hours.length - 1].hour - base)) * (W - pad * 2);
  const tideVal = (hr) => {
    const t = ((hr - 5) / 24) * Math.PI * 2;
    return 0.5 + 0.45 * Math.sin(t);
  };
  const ys = (v) => H - 20 - v * (H - 36);
  const pts = hours.map((h) => [xs(h.hour), ys(tideVal(h.hour))]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = d + ` L ${pts[pts.length - 1][0]},${H - 16} L ${pts[0][0]},${H - 16} Z`;
  const sel = pts[selectedIdx] || pts[0];
  const peaks = [];
  for (let i = 1; i < hours.length - 1; i++) {
    const v0 = tideVal(hours[i - 1].hour),
          v1 = tideVal(hours[i].hour),
          v2 = tideVal(hours[i + 1].hour);
    if ((v1 > v0 && v1 > v2) || (v1 < v0 && v1 < v2)) peaks.push({ idx: i, hi: v1 > v0 });
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
      <div className="tide-h">Tide across the day</div>
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
          {hours[0].hour >= 12 ? (hours[0].hour - 12) + "pm" : hours[0].hour + "am"}
        </text>
        <text className="tide-axis" x={W / 2} y={H - 3} textAnchor="middle">12pm</text>
        <text className="tide-axis" x={W - pad} y={H - 3} textAnchor="end">
          {hours[hours.length - 1].hour >= 12 ? (hours[hours.length - 1].hour - 12) + "pm" : hours[hours.length - 1].hour + "am"}
        </text>
      </svg>
    </div>
  );
}
