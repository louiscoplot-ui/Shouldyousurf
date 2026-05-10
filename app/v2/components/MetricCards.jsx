"use client";

import { useMemo } from "react";
import { drivingChipsFor } from "../lib/verdict";

export function DrivingChips({ hour, spot, userLevel }) {
  // Memoised — re-render parent (scroll, ago tick) ne doit pas relancer
  // le calcul des chips à chaque tick (audit PERF #5).
  const chips = useMemo(() => drivingChipsFor(hour, spot, userLevel), [hour, spot, userLevel]);
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
