"use client";

// v2 StickyInfoBar — ONE-TO-ONE port of v1's <div className="sticky-info">
// from app/page.js (lines 1743-1864). Same blocks, same order, same
// conditional rendering, same i18n keys, same formatting. Only the visual
// CSS is swapped to the v2 warm-paper palette (class names prefixed .C-).
//
// If something differs from v1 production, fix it here — do NOT diverge.

import {
  degToCompass,
  estimateFaceHeight,
  knToKmh,
  mToFt,
  tideTrend as computeTideTrend,
  findNextTideEvent,
  getWindTypeKey,
} from "../lib/prodScoring";

// Maps face-height ft → v1 i18n key (fh_1 … fh_7) for the hint line.
function describeFaceHeightKey(ft) {
  if (ft < 2)  return "fh_1";
  if (ft < 3)  return "fh_2";
  if (ft < 4)  return "fh_3";
  if (ft < 6)  return "fh_4";
  if (ft < 8)  return "fh_5";
  if (ft < 12) return "fh_6";
  return "fh_7";
}

export default function StickyInfoBar({
  hour: sel,        // the currently-selected hour
  dayHours,          // hours for the current day
  allHours,          // flat list of ALL hours (past + future) — used for tide lookups
  effectiveSpot,     // spot enriched with inferred idealSwellDir / offshoreWindDir
  sunByDay,          // { "YYYY-MM-DD": { sunrise, sunset } }
  tz,                // IANA tz string
  t,                 // i18n translator
  reasonText,        // the React node composed in MainScreen (level + verdict + tip + mods)
  swapKey,
  stuck,
}) {
  // Rebuild the degree view for scoring helpers — shaped hours carry the
  // cardinal strings on `swellDir`/`windDir` for display.
  const sel2 = {
    ...sel,
    swellDir: sel.swellDirDeg ?? sel.swellDir,
    windDir:  sel.windDirDeg  ?? sel.windDir,
  };

  // Face height — same math as v1
  const faceM = estimateFaceHeight(sel.swellHeight, sel.swellPeriod);
  const faceFtLow  = Math.max(1, Math.floor(mToFt(faceM) - 0.5));
  const faceFtHigh = Math.ceil(mToFt(faceM) + 0.5);

  // Wind kmh + trend arrow (same logic as v1 Loaded section)
  const windKmh = Math.round(knToKmh(sel.windSpeedKn));
  const selIdxInDay = dayHours.indexOf(sel);
  const nextHour = selIdxInDay >= 0 ? dayHours[selIdxInDay + 1] : null;
  const windTrend = (() => {
    if (!nextHour) return null;
    const next = Math.round(knToKmh(nextHour.windSpeedKn));
    const diff = next - windKmh;
    if (Math.abs(diff) < 3) return null;
    return diff > 0 ? "up" : "down";
  })();

  // Wind type key (translation key for offshore / onshore / cross_shore)
  const windTypeKey = getWindTypeKey(sel2, effectiveSpot);

  // Tide — trend + next event (mirror v1)
  const tTrend = allHours ? computeTideTrend(allHours, sel) : null;
  const nextTide = allHours && sel.tideM != null ? findNextTideEvent(allHours, sel.time) : null;
  const tideArrow = tTrend === "rising" ? "↗" : tTrend === "falling" ? "↘" : "";

  // Sun — same lookup as v1
  const dayKey = sel.time.split("T")[0];
  const sun = sunByDay ? sunByDay[dayKey] : null;
  const fmtTime = (iso) => iso
    ? new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz || "Australia/Perth" })
        .toLowerCase().replace(" ", "")
    : null;
  const sunrise = sun ? fmtTime(sun.sunrise) : null;
  const sunset  = sun ? fmtTime(sun.sunset)  : null;

  // Temps + current
  const airTemp = sel.airTemp != null ? Math.round(sel.airTemp) : null;
  const seaTemp = dayHours.find(h => h.seaTemp != null)?.seaTemp ?? null;
  const curVel  = sel.currentVel;

  // Translator fallback — if parent forgot to pass `t`, return the key.
  const tt = typeof t === "function" ? t : ((k) => k);

  return (
    <div className={`C ${stuck ? "stuck" : ""}`}>
      {/* ── Reason card (v1 .sticky-tip) ─────────────────────────────── */}
      <div key={"C-r-" + swapKey} className="C-reason swap-enter">{reasonText}</div>

      {/* ── Face height (v1 .face-height — CENTERED stack) ───────────── */}
      <div key={"C-f-" + swapKey} className="C-face swap-enter">
        <div className="C-face-lbl mono">{tt("expected_face")}</div>
        <div className="C-face-val serif">{faceFtLow}–{faceFtHigh} ft</div>
        <div className="C-face-conv mono">
          {faceM.toFixed(1)} m · {sel.swellHeight?.toFixed(1)}m @ {sel.swellPeriod?.toFixed(0)}s
        </div>
        <div className="C-face-hint">{tt(describeFaceHeightKey(faceFtHigh))}</div>
      </div>

      {/* ── Row 2: Swell / Wind (v1 .metrics) ────────────────────────── */}
      <div key={"C-m2-" + swapKey} className="C-row-2 swap-enter">
        <div className="C-m" data-cell="swell">
          <div className="C-m-lbl mono">{tt("swell")}</div>
          <div className="C-m-val">{sel.swellHeight?.toFixed(1)}<span className="C-unit">m</span></div>
          <div className="C-m-sub mono">
            {tt("from")} {degToCompass(sel2.swellDir)} · {sel.swellPeriod?.toFixed(0)}s
          </div>
        </div>
        <div className="C-m" data-cell="wind">
          <div className="C-m-lbl mono">{tt("wind")}</div>
          <div className="C-m-val">
            {windKmh}<span className="C-unit">km/h</span>
            {windTrend && (
              <span className="C-trend" aria-label={windTrend === "up" ? "rising" : "dropping"}>
                {windTrend === "up" ? "↗" : "↘"}
              </span>
            )}
          </div>
          <div className="C-m-sub mono">
            {degToCompass(sel2.windDir)} · {tt(windTypeKey)}
            {sel.windGustKn != null && Math.round(knToKmh(sel.windGustKn)) >= windKmh + 8 && (
              <> · {tt("gusts")} {Math.round(knToKmh(sel.windGustKn))}</>
            )}
            {sel.rainProb != null ? ` · ${Math.round(sel.rainProb)}% ${tt("rain").toLowerCase()}` : ""}
          </div>
        </div>
      </div>

      {/* ── Row temp: Air / Water / Tide / Daylight / Current (v1 .temp-strip) ── */}
      {(airTemp != null || seaTemp != null || sunrise || sel.tideM != null || (curVel != null && curVel > 0.05)) && (
        <div key={"C-t-" + swapKey} className="C-row-temp swap-enter">
          {airTemp != null && (
            <div className="C-m" data-cell="air">
              <div className="C-m-lbl mono">{tt("air_temp")}</div>
              <div className="C-m-val">{airTemp}<span className="C-unit">°C</span></div>
            </div>
          )}
          {seaTemp != null && (
            <div className="C-m" data-cell="water">
              <div className="C-m-lbl mono">{tt("water_temp")}</div>
              <div className="C-m-val">{Math.round(seaTemp)}<span className="C-unit">°C</span></div>
            </div>
          )}
          {sel.tideM != null && (
            <div className="C-m" data-cell="tide">
              <div className="C-m-lbl mono">{tt("tide")}</div>
              <div className="C-m-val">
                {tideArrow && <span className="C-tide-arrow">{tideArrow}</span>}
                {sel.tideM.toFixed(1)}<span className="C-unit">m</span>
              </div>
              {nextTide && (
                <div className="C-m-sub mono">
                  {nextTide.kind === "high" ? "↑" : "↓"} {fmtTime(nextTide.time)}
                </div>
              )}
            </div>
          )}
          {sunrise && sunset && (
            <div className="C-m" data-cell="daylight">
              <div className="C-m-lbl mono">
                <span className="C-lbl-full">{tt("daylight")}</span>
                <span className="C-lbl-short">{tt("light") || "LIGHT"}</span>
              </div>
              <div className="C-m-val C-m-daylight mono">
                <span>↑{sunrise}</span>
                <span>↓{sunset}</span>
              </div>
            </div>
          )}
          {curVel != null && curVel > 0.05 && (
            <div className="C-m" data-cell="current">
              <div className="C-m-lbl mono">{tt("current")}</div>
              <div className="C-m-val">{(curVel * 3.6).toFixed(1)}<span className="C-unit">km/h</span></div>
              <div className="C-m-sub mono">{degToCompass(sel.currentDir)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
