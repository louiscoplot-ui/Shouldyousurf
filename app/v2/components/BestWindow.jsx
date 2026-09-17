"use client";

// v2 BestWindow — ported from export-v2/v2-parts.jsx.

import { fmtHour } from "../lib/hooks";

export default function BestWindow({ day }) {
  const best = day.bestHour;
  if (!best) return null;
  // Même règle que HourlyList : on décrit la partition DOMINANTE, celle qui
  // porte le score affiché juste à côté, pas la primaire d'Open-Meteo.
  const dom = best.dom || best;
  const domH = typeof dom.swellHeight === "number" ? dom.swellHeight : best.swellHeight;
  const domP = dom.swellPeriod != null ? dom.swellPeriod : best.swellPeriod;
  const swell = typeof domH === "number" ? domH.toFixed(1) : "—";
  const period = domP != null ? Math.round(domP) : "—";
  const wind = best.windKmh != null ? Math.round(best.windKmh) : "—";
  return (
    <div className="best">
      <div className="best-lbl">Best window</div>
      <div className="best-val">
        Around {fmtHour(best.hour)} · <span className="score">{best.score} score</span>
      </div>
      <div className="best-sub">
        {swell}m @ {period}s · {wind}km/h {best.windDir || ""}
      </div>
    </div>
  );
}
