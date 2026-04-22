"use client";

// v2 BestWindow — ported from export-v2/v2-parts.jsx.

import { fmtHour } from "../lib/hooks";

export default function BestWindow({ day }) {
  const best = day.bestHour;
  return (
    <div className="best">
      <div className="best-lbl">Best window</div>
      <div className="best-val">
        Around {fmtHour(best.hour)} · <span className="score">{best.score} score</span>
      </div>
      <div className="best-sub">
        {best.swellHeight.toFixed(1)}m @ {Math.round(best.swellPeriod)}s · {Math.round(best.windKmh)}km/h {best.windDir}
      </div>
    </div>
  );
}
