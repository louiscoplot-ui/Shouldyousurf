"use client";

// v2 StickyInfoBar — ported from export-v2/v2-parts.jsx.
// Persistent summary that sticks to top on scroll. Crossfades values on swapKey change.

import { levelMatrixFor, LEVEL_TO_MATRIX_IDX } from "../lib/verdict";

export default function StickyInfoBar({ hour, swapKey, reasonText, sentinelRef, stuck, userLevel }) {
  const low = hour.faceFtLow, high = hour.faceFtHigh;
  const midM = hour.swellHeight.toFixed(1);
  const per = Math.round(hour.swellPeriod);
  const descriptors = [
    { max: 1.5, text: "Knee- to waist-high — beginner or longboard." },
    { max: 3,   text: "Waist to chest-high — easy, rolling waves." },
    { max: 5,   text: "Chest to head-high — proper intermediate waves, duck-diving required." },
    { max: 7,   text: "Head to overhead — solid and powerful." },
    { max: 12,  text: "Well overhead — experienced surfers only." },
  ];
  const trans = descriptors.find((d) => high <= d.max)?.text || "Well overhead — experts only.";
  const tideDir = hour.hour < 11 ? "↗" : hour.hour < 17 ? "↘" : "↗";
  const tideNext = hour.hour < 11 ? "↑ 11:00am" : hour.hour < 17 ? "↓ 5:12pm" : "↑ 11:20pm";
  const tideVal = (0.5 + 0.45 * Math.sin(((hour.hour - 5) / 24) * Math.PI * 2)).toFixed(1);

  // Per-level advice hints (for the expanded/stuck state) — kept for parity with prototype.
  const matrix = levelMatrixFor(hour);
  const levelIdx = userLevel ? LEVEL_TO_MATRIX_IDX[userLevel] : -1;
  const myLevel = levelIdx >= 0 ? matrix[levelIdx] : null;

  return (
    <div className={`sib ${stuck ? "stuck" : ""}`}>
      <div key={"sib-r-" + swapKey} className="sib-reason swap-enter">{reasonText}</div>

      <div key={"sib-f-" + swapKey} className="sib-face swap-enter">
        <div className="sib-face-lbl">Expected face height</div>
        <div className="sib-face-val">{low}–{high}<span className="unit">ft</span></div>
        <div className="sib-face-conv">{midM} m · {(hour.swellHeight * 0.9).toFixed(1)}m @ {per}s</div>
        <div className="sib-face-trans">{trans}</div>
      </div>

      <div key={"sib-a-" + swapKey} className="sib-grid sib-grid-2 swap-enter">
        <div className="sib-m">
          <div className="sib-m-lbl">Swell</div>
          <div className="sib-m-val">{hour.swellHeight.toFixed(1)}<span className="unit">m</span></div>
          <div className="sib-m-sub">from {hour.swellDir} · {per}s</div>
        </div>
        <div className="sib-m">
          <div className="sib-m-lbl">Wind</div>
          <div className="sib-m-val">{Math.round(hour.windKmh)}<span className="unit">km/h</span></div>
          <div className="sib-m-sub">{hour.windDir} · {hour.windType} · 0% rain</div>
        </div>
      </div>

      <div key={"sib-b-" + swapKey} className="sib-grid sib-grid-4 swap-enter">
        <div className="sib-m sib-m-sm">
          <div className="sib-m-lbl">Air</div>
          <div className="sib-m-val sm">{hour.airTemp || 18}<span className="unit">°C</span></div>
        </div>
        <div className="sib-m sib-m-sm">
          <div className="sib-m-lbl">Water</div>
          <div className="sib-m-val sm">{hour.seaTemp || 22}<span className="unit">°C</span></div>
        </div>
        <div className="sib-m sib-m-sm">
          <div className="sib-m-lbl">Tide</div>
          <div className="sib-m-val sm">{tideDir} {tideVal}<span className="unit">m</span></div>
          <div className="sib-m-sub mono">{tideNext}</div>
        </div>
        <div className="sib-m sib-m-sm">
          <div className="sib-m-lbl">Daylight</div>
          <div className="sib-m-val sm sib-daylight">
            <span>↑6:41am</span>
            <span>↓5:50pm</span>
          </div>
        </div>
      </div>

      <div ref={sentinelRef} className="sib-sentinel" aria-hidden="true"/>
    </div>
  );
}
