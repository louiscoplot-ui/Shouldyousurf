"use client";

// v2 StickyInfoBar — DOM mirrors v1 production sticky-info 1:1
// (same blocks, same order, same conditional rendering), wrapped in v2
// typography + colours. Compact state on scroll collapses cells to
// label+value and hides the subs.

import { degToCompass, mToFt, estimateFaceHeight, knToKmh } from "../lib/prodScoring";

export default function StickyInfoBar({
  hour, swapKey, reasonText, faceHint, stuck,
  allHours, sunByDay, tz, t, effectiveSpot,
}) {
  const faceM = estimateFaceHeight(hour.swellHeight, hour.swellPeriod);
  const faceFtLow  = Math.max(1, Math.floor(mToFt(faceM) - 0.5));
  const faceFtHigh = Math.ceil(mToFt(faceM) + 0.5);
  const windKmh = Math.round(hour.windKmh ?? knToKmh(hour.windSpeedKn ?? 0));
  const per = Math.round(hour.swellPeriod);

  const windDirStr = typeof hour.windDir === "string"
    ? hour.windDir
    : degToCompass(hour.windDir);
  const swellDirStr = typeof hour.swellDir === "string"
    ? hour.swellDir
    : degToCompass(hour.swellDir);

  const windTypeStr = hour.windType || "—";
  const gustKmh = hour.windGustKn != null ? Math.round(knToKmh(hour.windGustKn)) : null;
  const showGusts = gustKmh != null && gustKmh >= windKmh + 8;

  // Sun + tide lookups (mirror v1 page.js)
  const dayKey = hour.time ? hour.time.split("T")[0] : null;
  const sun = dayKey && sunByDay ? sunByDay[dayKey] : null;
  const fmtTime = (iso) => iso
    ? new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz || "Australia/Perth" })
        .toLowerCase().replace(" ", "")
    : null;
  const sunrise = sun ? fmtTime(sun.sunrise) : null;
  const sunset  = sun ? fmtTime(sun.sunset)  : null;

  // Tide trend + next event (walk the flat list of all hours)
  let tideTrend = null, nextTide = null;
  if (allHours && hour.tideM != null) {
    const idx = allHours.findIndex((h) => h.time === hour.time);
    if (idx >= 1) {
      const prev = allHours[idx - 1]?.tideM;
      if (prev != null) {
        const d = hour.tideM - prev;
        tideTrend = Math.abs(d) < 0.05 ? "steady" : d > 0 ? "rising" : "falling";
      }
    }
    for (let i = Math.max(1, idx); i < allHours.length - 1; i++) {
      const a = allHours[i - 1]?.tideM;
      const b = allHours[i].tideM;
      const c = allHours[i + 1]?.tideM;
      if (a == null || b == null || c == null) continue;
      if (b > a && b >= c) { nextTide = { kind: "high", time: allHours[i].time, m: b }; break; }
      if (b < a && b <= c) { nextTide = { kind: "low",  time: allHours[i].time, m: b }; break; }
    }
  }
  const tideArrow = tideTrend === "rising" ? "↗" : tideTrend === "falling" ? "↘" : "";
  const airTemp = hour.airTemp != null ? Math.round(hour.airTemp) : null;
  const seaTemp = hour.seaTemp != null ? Math.round(hour.seaTemp) : null;
  const curVel = hour.currentVel;

  const tt = t || ((k) => k); // optional i18n

  return (
    <div className={`C ${stuck ? "stuck" : ""}`}>
      {/* ── Reason card (matches v1 .sticky-tip) ─────────────────────── */}
      <div key={"C-r-" + swapKey} className="C-reason swap-enter">{reasonText}</div>

      {/* ── Face height — CENTERED block (label/val/conv/hint) ───────── */}
      <div key={"C-f-" + swapKey} className="C-face swap-enter">
        <div className="C-face-lbl">{tt("expected_face") || "EXPECTED FACE HEIGHT"}</div>
        <div className="C-face-val">{faceFtLow}–{faceFtHigh}<span className="C-unit"> ft</span></div>
        <div className="C-face-conv">{faceM.toFixed(1)} m · {hour.swellHeight.toFixed(1)}m @ {per}s</div>
        {faceHint && <div className="C-face-hint">{faceHint}</div>}
      </div>

      {/* ── Row 2: Swell / Wind (v1 .metrics 2-col) ──────────────────── */}
      <div key={"C-m2-" + swapKey} className="C-row-2 swap-enter">
        <div className="C-m">
          <div className="C-m-lbl">{tt("swell") || "SWELL"}</div>
          <div className="C-m-val">{hour.swellHeight.toFixed(1)}<span className="C-unit"> m</span></div>
          <div className="C-m-sub mono">{tt("from") || "from"} {swellDirStr} · {per}s</div>
        </div>
        <div className="C-m">
          <div className="C-m-lbl">{tt("wind") || "WIND"}</div>
          <div className="C-m-val">{windKmh}<span className="C-unit"> km/h</span></div>
          <div className="C-m-sub mono">
            {windDirStr} · {windTypeStr}
            {showGusts ? ` · ${tt("gusts") || "gusts"} ${gustKmh}` : ""}
            {hour.rainProb != null ? ` · ${Math.round(hour.rainProb)}% ${(tt("rain") || "rain").toLowerCase()}` : ""}
          </div>
        </div>
      </div>

      {/* ── Temp strip: Air / Water / Tide / Daylight / Current ──────── */}
      <div key={"C-t-" + swapKey} className="C-row-temp swap-enter">
        {airTemp != null && (
          <div className="C-m C-m-sm">
            <div className="C-m-lbl">{tt("air_temp") || "AIR"}</div>
            <div className="C-m-val">{airTemp}<span className="C-unit"> °C</span></div>
          </div>
        )}
        {seaTemp != null && (
          <div className="C-m C-m-sm">
            <div className="C-m-lbl">{tt("water_temp") || "WATER"}</div>
            <div className="C-m-val">{seaTemp}<span className="C-unit"> °C</span></div>
          </div>
        )}
        {hour.tideM != null && (
          <div className="C-m C-m-sm">
            <div className="C-m-lbl">{tt("tide") || "TIDE"}</div>
            <div className="C-m-val">
              {tideArrow && <span className="C-tide-arrow">{tideArrow} </span>}
              {hour.tideM.toFixed(1)}<span className="C-unit"> m</span>
            </div>
            {nextTide && (
              <div className="C-m-sub mono">
                {nextTide.kind === "high" ? "↑" : "↓"} {fmtTime(nextTide.time)}
              </div>
            )}
          </div>
        )}
        {sunrise && sunset && (
          <div className="C-m C-m-sm">
            <div className="C-m-lbl">{tt("daylight") || "DAYLIGHT"}</div>
            <div className="C-m-val C-m-daylight">
              <span>↑{sunrise}</span>
              <span>↓{sunset}</span>
            </div>
          </div>
        )}
        {curVel != null && curVel > 0.05 && (
          <div className="C-m C-m-sm">
            <div className="C-m-lbl">{tt("current") || "CURRENT"}</div>
            <div className="C-m-val">{(curVel * 3.6).toFixed(1)}<span className="C-unit"> km/h</span></div>
            <div className="C-m-sub mono">{degToCompass(hour.currentDir)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
