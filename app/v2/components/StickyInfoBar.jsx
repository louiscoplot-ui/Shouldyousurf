"use client";

// v2 StickyInfoBar — VARIANT C "Two-tier hero".
// Content mirrors the v1 production sticky-info (reason + face height + 6
// metrics), wrapped in the new visual shell. Compact state on scroll matches
// the sib-compare Variant C stuck spec (single-line hero + 3x2 label/value
// grid with subs hidden).
//
// reasonText is expected to be a React node — see MainScreen for how it's
// composed (bold level + coloured verdict + tip + modifier + tide mod).

export default function StickyInfoBar({ hour, swapKey, reasonText, faceHint, stuck }) {
  const low = hour.faceFtLow, high = hour.faceFtHigh;
  const midM = hour.swellHeight.toFixed(1);
  const per = Math.round(hour.swellPeriod);

  // Tide placeholders when the raw MSL isn't yet propagated into this
  // component (kept for the mock path). Real data wins via hour.tideM.
  const tideDir = hour.tideM != null
    ? (hour.tideTrend === "rising" ? "↗" : hour.tideTrend === "falling" ? "↘" : "—")
    : (hour.hour < 11 ? "↗" : hour.hour < 17 ? "↘" : "↗");
  const tideVal = hour.tideM != null
    ? hour.tideM.toFixed(1)
    : (0.5 + 0.45 * Math.sin(((hour.hour - 5) / 24) * Math.PI * 2)).toFixed(1);

  return (
    <div className={`C ${stuck ? "stuck" : ""}`}>
      <div className="C-hero">
        <div key={"C-r-" + swapKey} className="C-reason swap-enter">{reasonText}</div>
        <div key={"C-f-" + swapKey} className="C-face swap-enter">
          <div className="C-face-left">
            <div className="C-face-lbl">FACE HEIGHT</div>
            <div className="C-face-val">{low}–{high}<span className="C-unit">ft</span></div>
          </div>
          <div className="C-face-right">
            <div className="C-face-conv-m">{midM} m</div>
            <div className="C-face-conv-sub">{(hour.swellHeight * 0.9).toFixed(1)}m @ {per}s</div>
          </div>
        </div>
        {faceHint && <div key={"C-t-" + swapKey} className="C-trans swap-enter">{faceHint}</div>}
      </div>

      <div key={"C-g-" + swapKey} className="C-grid swap-enter">
        <div className="C-m">
          <div className="C-m-lbl">Swell</div>
          <div className="C-m-val">{hour.swellHeight.toFixed(1)}<span className="C-unit">m</span></div>
          <div className="C-m-sub">{hour.swellDir} · {per}s</div>
        </div>
        <div className="C-m">
          <div className="C-m-lbl">Wind</div>
          <div className="C-m-val">{Math.round(hour.windKmh)}<span className="C-unit">km/h</span></div>
          <div className="C-m-sub">{hour.windDir} · {hour.windType}{hour.rainProb != null ? ` · ${Math.round(hour.rainProb)}% rain` : ""}</div>
        </div>
        <div className="C-m">
          <div className="C-m-lbl">Tide</div>
          <div className="C-m-val">{tideDir} {tideVal}<span className="C-unit">m</span></div>
          <div className="C-m-sub mono">{hour.tideNextLabel || (hour.hour < 11 ? "↑ 11:00am" : hour.hour < 17 ? "↓ 5:12pm" : "↑ 11:20pm")}</div>
        </div>
        <div className="C-m">
          <div className="C-m-lbl">Air</div>
          <div className="C-m-val">{Math.round(hour.airTemp ?? 18)}<span className="C-unit">°C</span></div>
          <div className="C-m-sub">{hour.rainProb != null ? `${Math.round(hour.rainProb)}% rain` : "clear"}</div>
        </div>
        <div className="C-m">
          <div className="C-m-lbl">Water</div>
          <div className="C-m-val">{(hour.seaTemp ?? 22).toFixed(1)}<span className="C-unit">°C</span></div>
          <div className="C-m-sub mono">wetsuit 3/2</div>
        </div>
        <div className="C-m">
          <div className="C-m-lbl">Daylight</div>
          <div className="C-m-val C-m-daylight"><span>{hour.sunriseLabel || "↑6:41am"}</span><span>{hour.sunsetLabel || "↓5:50pm"}</span></div>
          <div className="C-m-sub mono">{hour.daylightLength || "11h 09m"}</div>
        </div>
      </div>
    </div>
  );
}
