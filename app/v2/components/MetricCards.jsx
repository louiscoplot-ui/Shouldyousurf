"use client";

import { drivingChipsFor } from "../lib/verdict";

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
