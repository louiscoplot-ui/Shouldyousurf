"use client";

// v2 StickyInfoBar — VARIANT C "Two-tier hero".
// Two blocks: .C-hero (reason + face height) on top, .C-grid (6 metrics) below.
// Rest → compact transition is purely linear-soft (no bounce, no spring, no
// scale on the whole bar). The toggle comes from MainScreen (scrollTop with
// hysteresis) so the bar's own resize can't feed back into the detection.

export default function StickyInfoBar({ hour, swapKey, reasonText, stuck }) {
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

  // Tide placeholder until we wire real MSL per hour into this component.
  const tideDir = hour.hour < 11 ? "↗" : hour.hour < 17 ? "↘" : "↗";
  const tideVal = (0.5 + 0.45 * Math.sin(((hour.hour - 5) / 24) * Math.PI * 2)).toFixed(1);

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
        <div key={"C-t-" + swapKey} className="C-trans swap-enter">{trans}</div>
      </div>

      <div key={"C-g-" + swapKey} className="C-grid swap-enter">
        <div className="C-m">
          <div className="C-m-lbl">Swell</div>
          <div className="C-m-val">{hour.swellHeight.toFixed(1)}<span className="C-unit">m</span></div>
          <div className="C-m-sub">from {hour.swellDir} · {per}s</div>
        </div>
        <div className="C-m">
          <div className="C-m-lbl">Wind</div>
          <div className="C-m-val">{Math.round(hour.windKmh)}<span className="C-unit">km/h</span></div>
          <div className="C-m-sub">{hour.windDir} · {hour.windType}</div>
        </div>
        <div className="C-m">
          <div className="C-m-lbl">Tide</div>
          <div className="C-m-val">{tideDir} {tideVal}<span className="C-unit">m</span></div>
          <div className="C-m-sub mono">{hour.hour < 11 ? "↑ 11:00am" : hour.hour < 17 ? "↓ 5:12pm" : "↑ 11:20pm"}</div>
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
          <div className="C-m-val C-m-daylight"><span>↑6:41am</span><span>↓5:50pm</span></div>
          <div className="C-m-sub mono">11h 09m</div>
        </div>
      </div>
    </div>
  );
}
