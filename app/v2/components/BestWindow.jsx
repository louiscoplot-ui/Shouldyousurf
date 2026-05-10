"use client";

// v2 BestWindow — ported from export-v2/v2-parts.jsx.

import { fmtHour } from "../lib/hooks";

export default function BestWindow({ day }) {
  const best = day.bestHour;
  if (!best) return null;
  const swell = typeof best.swellHeight === "number" ? best.swellHeight.toFixed(1) : "—";
  const period = best.swellPeriod != null ? Math.round(best.swellPeriod) : "—";
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
