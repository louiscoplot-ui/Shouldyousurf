"use client";

// v2 HourlyList — two view modes: Cards (horizontal scroll, one-glance)
// and List (v1-style dense rows, each expandable for full details).
// Pill toggle in the section header switches between them. Selection
// is always shared with the StickyInfoBar above via onSelect.

import { useEffect, useRef, useState } from "react";
import { coherentVerdict } from "../lib/verdict";
import { degToCompass } from "../lib/prodScoring";
import { fmtHour } from "../lib/hooks";

const WaveIcon = () => (
  <svg width="11" height="8" viewBox="0 0 22 14" fill="none" aria-hidden="true">
    <path d="M1 9C3.5 9 3.5 5 6 5C8.5 5 8.5 9 11 9C13.5 9 13.5 5 16 5C18.5 5 18.5 9 21 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M1 3C3 3 4 1 6 1C8 1 9 3 11 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".4"/>
  </svg>
);
const WindIcon = () => (
  <svg width="11" height="9" viewBox="0 0 22 16" fill="none" aria-hidden="true">
    <path d="M2 6H14C16.2 6 17 4.4 17 3.5C17 2.1 15.9 1 14.5 1C13.1 1 12 2.1 12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 10H17C19.2 10 20 11.6 20 12.5C20 13.9 18.9 15 17.5 15C16.1 15 15 13.9 15 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

function fmtTimeShort(iso, tz) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz || "Australia/Perth" })
      .toLowerCase().replace(" ", "");
  } catch { return ""; }
}

export default function HourlyList({ hours, selectedIdx, onSelect, currentHour, sunByDay, tz, reasonText }) {
  const [viewMode, setViewMode] = useState("cards");
  const [openIdx, setOpenIdx] = useState(null);
  const scrollerRef = useRef(null);
  const cardRefs = useRef([]);

  // Toggle .wrap.hly-cardmode-active so the sticky info bar (.C) + driving
  // chips (.drv) + best-window (.best) collapse — in cards mode the details
  // live in a dedicated panel below the cards instead. In list mode the
  // existing .hly--list-mode rule already handles it.
  useEffect(() => {
    const wrap = document.querySelector(".wrap");
    if (!wrap) return;
    wrap.classList.toggle("hly-cardmode-active", viewMode === "cards");
    return () => { wrap.classList.remove("hly-cardmode-active"); };
  }, [viewMode]);

  // Auto-centre the current hour when the cards view mounts or the
  // selection changes.
  useEffect(() => {
    if (viewMode !== "cards") return;
    const idx = selectedIdx >= 0 ? selectedIdx : hours.findIndex((h) => h.hour === currentHour);
    if (idx < 0) return;
    const el = cardRefs.current[idx];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [viewMode, selectedIdx, currentHour, hours.length]);

  const handleRowClick = (i) => {
    onSelect(i);
    setOpenIdx((o) => (o === i ? null : i));
  };

  return (
    <div className={`hly ${viewMode === "list" ? "hly--list-mode" : ""}`}>
      <div className="hly-h">
        <div className="hly-h-left">
          <span className="t">Hourly</span>
          <span className="i">ⓘ</span>
        </div>
        {/* Pill toggle: CARDS ↔ LIST */}
        <div className="hly-pill">
          <div
            className="hly-pill-cursor"
            style={{ transform: viewMode === "list" ? "translateX(100%)" : "translateX(0%)" }}
          />
          <button
            className={`hly-pill-opt ${viewMode === "cards" ? "on" : ""}`}
            onClick={() => setViewMode("cards")}
          >Cards</button>
          <button
            className={`hly-pill-opt ${viewMode === "list" ? "on" : ""}`}
            onClick={() => setViewMode("list")}
          >List</button>
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="hly-cards" ref={scrollerRef}>
          {hours.map((h, i) => {
            const v = coherentVerdict(h);
            const past = h.hour < currentHour;
            const selected = selectedIdx === i;
            const tone =
              v.key === "pumping" || v.key === "great" ? "good"
              : v.key === "good" || v.key === "fun"   ? "ok"
              : "bad";
            return (
              <button
                key={i}
                ref={(el) => (cardRefs.current[i] = el)}
                className={`hly-card hly-card--${tone} ${selected ? "selected" : ""} ${past ? "past" : ""}`}
                onClick={() => onSelect(i)}
                aria-pressed={selected}
                style={{ "--card-color": v.color }}
              >
                <div className="hly-card-time">{fmtHour(h.hour)}</div>
                <div className="hly-card-score">{h.score}</div>
                <div className="hly-card-label">{v.label.toUpperCase()}</div>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Card panel — rendered BELOW the cards in Cards mode. Replaces the
          StickyInfoBar (.C) which is hidden via .wrap.hly-cardmode-active.
          Always reflects the currently selected hour. */}
      {viewMode === "cards" && hours[selectedIdx] && (() => {
        const h = hours[selectedIdx];
        const v = coherentVerdict(h);
        const swellDir = typeof h.swellDir === "string" ? h.swellDir : degToCompass(h.swellDir);
        const windDir  = typeof h.windDir  === "string" ? h.windDir  : degToCompass(h.windDir);
        const curKmh   = h.currentVel != null ? h.currentVel * 3.6 : null;
        const dayKey   = h.time?.split("T")?.[0];
        const sun      = sunByDay ? sunByDay[dayKey] : null;
        const rise     = fmtTimeShort(sun?.sunrise, tz);
        const set      = fmtTimeShort(sun?.sunset, tz);
        return (
          <div className="hly-cpanel" style={{ "--hly-cp-color": v.color }}>
            {reasonText && (
              <div className="hly-cp-reason">
                <div className="hly-cp-reason-main">{reasonText}</div>
              </div>
            )}
            <div className="hly-cp-face">
              <span className="hly-cp-face-val">{h.faceFtLow}–{h.faceFtHigh}<span className="hly-cp-face-unit"> ft</span></span>
              <span className="hly-cp-face-conv">{h.swellHeight.toFixed(1)} m · {Math.round(h.swellPeriod)}s</span>
            </div>
            <div className="hly-cp-hint">{v.sub}</div>
            <div className="hly-cp-grid">
              {/* Row 1 */}
              <div className="hly-cp-cell">
                <div className="hly-cp-cell-lbl">Swell</div>
                <div className="hly-cp-cell-val">{h.swellHeight.toFixed(1)}<span className="hly-cp-cell-unit">m</span></div>
                <div className="hly-cp-cell-sub">{swellDir} · {Math.round(h.swellPeriod)}s</div>
              </div>
              <div className="hly-cp-cell">
                <div className="hly-cp-cell-lbl">Wind</div>
                <div className="hly-cp-cell-val">{Math.round(h.windKmh)}<span className="hly-cp-cell-unit">km/h</span></div>
                <div className="hly-cp-cell-sub">{windDir} · {h.windType}</div>
              </div>
              <div className={`hly-cp-cell ${h.tideM == null ? "hly-cp-cell--no-data" : ""}`}>
                <div className="hly-cp-cell-lbl">Tide</div>
                <div className="hly-cp-cell-val">{h.tideM != null ? <>{h.tideM.toFixed(1)}<span className="hly-cp-cell-unit">m</span></> : <span style={{ opacity: 0.35 }}>—</span>}</div>
                <div className="hly-cp-cell-sub">&nbsp;</div>
              </div>
              {/* Row 2 */}
              <div className={`hly-cp-cell ${h.airTemp == null ? "hly-cp-cell--no-data" : ""}`}>
                <div className="hly-cp-cell-lbl">Air</div>
                <div className="hly-cp-cell-val">{h.airTemp != null ? <>{Math.round(h.airTemp)}<span className="hly-cp-cell-unit">°C</span></> : <span style={{ opacity: 0.35 }}>—</span>}</div>
                <div className="hly-cp-cell-sub">&nbsp;</div>
              </div>
              <div className={`hly-cp-cell ${h.seaTemp == null ? "hly-cp-cell--no-data" : ""}`}>
                <div className="hly-cp-cell-lbl">Water</div>
                <div className="hly-cp-cell-val">{h.seaTemp != null ? <>{Math.round(h.seaTemp)}<span className="hly-cp-cell-unit">°C</span></> : <span style={{ opacity: 0.35 }}>—</span>}</div>
                <div className="hly-cp-cell-sub">&nbsp;</div>
              </div>
              <div className={`hly-cp-cell hly-cp-cell--current ${curKmh == null || curKmh < 0.18 ? "hly-cp-cell--no-data" : ""}`}>
                <div className="hly-cp-cell-lbl">Current</div>
                <div className="hly-cp-cell-val">{curKmh != null && curKmh >= 0.18 ? <>{curKmh.toFixed(1)}<span className="hly-cp-cell-unit">km/h</span></> : <span style={{ opacity: 0.35 }}>—</span>}</div>
                <div className="hly-cp-cell-sub">{(curKmh != null && curKmh >= 0.18 && h.currentDir != null) ? (typeof h.currentDir === "string" ? h.currentDir : degToCompass(h.currentDir)) : " "}</div>
              </div>
              {/* Row 3 — Daylight full-width */}
              {(rise || set) && (
                <div className="hly-cp-cell hly-cp-cell--daylight">
                  <div className="hly-cp-cell-lbl">Daylight</div>
                  <div className="hly-cp-cell-val">
                    <span>↑{rise}</span>
                    <span className="hly-cp-day-sep"> · </span>
                    <span>↓{set}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {viewMode === "list" && (
        <div className="hly-list">
          {hours.map((h, i) => {
            const v = coherentVerdict(h);
            const past = h.hour < currentHour;
            const selected = selectedIdx === i;
            const isOpen = openIdx === i;
            const rowOpacity = Math.min(0.9, Math.max(0.15, h.score / 110));
            const swellDir = typeof h.swellDir === "string" ? h.swellDir : degToCompass(h.swellDir);
            const windDir  = typeof h.windDir  === "string" ? h.windDir  : degToCompass(h.windDir);
            return (
              <div key={i} className={`hly-lwrap ${isOpen ? "open" : ""}`}>
                <div
                  className={`hly-lrow ${past ? "past" : ""} ${selected || isOpen ? "sel" : ""}`}
                  onClick={() => handleRowClick(i)}
                  style={{ "--row-color": v.color, "--row-opacity": rowOpacity }}
                >
                  <div className="hly-ltime">{fmtHour(h.hour)}</div>
                  <div className="hly-lbar">
                    <div className="hly-lbar-fill" style={{ width: `${Math.max(4, h.score)}%`, background: v.color }}/>
                  </div>
                  <div className="hly-lscoreverdict">
                    <span className="hly-lscore" style={{ color: v.color }}>{h.score}</span>
                    <span className="hly-lverd"  style={{ color: v.color }}>{v.label.toUpperCase()}</span>
                  </div>
                  <div className="hly-lstats">
                    <span className="hly-lstat"><WaveIcon/>{h.faceFtLow}–{h.faceFtHigh}ft</span>
                    <span className="hly-lstat-sep">·</span>
                    <span className="hly-lstat"><WindIcon/>{Math.round(h.windKmh)}km/h</span>
                  </div>
                </div>
                <div className={`hly-lexpand ${isOpen ? "open" : ""}`}>
                  {isOpen && (
                    <div className="hly-lexpand-inner">
                      <div className="hly-xface">
                        <span className="hly-xface-val" style={{ color: v.color }}>
                          {h.faceFtLow}–{h.faceFtHigh}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 3, opacity: 0.7 }}>ft</span>
                        </span>
                        <span className="hly-xface-sub">{h.swellHeight.toFixed(1)} m · {Math.round(h.swellPeriod)}s</span>
                      </div>
                      <div className="hly-xhint">{v.sub}</div>
                      {(() => {
                        const dayKey = h.time?.split("T")?.[0];
                        const sun = sunByDay ? sunByDay[dayKey] : null;
                        const rise = fmtTimeShort(sun?.sunrise, tz);
                        const set  = fmtTimeShort(sun?.sunset, tz);
                        const curKmh = h.currentVel != null ? (h.currentVel * 3.6) : null;
                        return (
                          <div className="hly-xgrid">
                            {/* Row 1 — Swell · Wind · Tide */}
                            <div className="hly-xcell">
                              <div className="hly-xsub-top">Swell</div>
                              <div className="hly-xval" style={{ color: v.color }}>{h.swellHeight.toFixed(1)}<span className="hly-xunit">m</span></div>
                              <div className="hly-xsub">{swellDir} · {Math.round(h.swellPeriod)}s</div>
                            </div>
                            <div className="hly-xcell">
                              <div className="hly-xsub-top">Wind</div>
                              <div className="hly-xval" style={{ color: v.color }}>{Math.round(h.windKmh)}<span className="hly-xunit">km/h</span></div>
                              <div className="hly-xsub">{windDir} · {h.windType}</div>
                            </div>
                            <div className={`hly-xcell ${h.tideM == null ? "hly-xcell--no-data" : ""}`}>
                              <div className="hly-xsub-top">Tide</div>
                              <div className="hly-xval" style={{ color: v.color }}>
                                {h.tideM != null ? <>{h.tideM.toFixed(1)}<span className="hly-xunit">m</span></> : <span style={{ opacity: 0.35 }}>—</span>}
                              </div>
                              <div className="hly-xsub">&nbsp;</div>
                            </div>
                            {/* Row 2 — Air · Water · Current (with "—" fallback) */}
                            <div className={`hly-xcell ${h.airTemp == null ? "hly-xcell--no-data" : ""}`}>
                              <div className="hly-xsub-top">Air</div>
                              <div className="hly-xval" style={{ color: v.color }}>
                                {h.airTemp != null ? <>{Math.round(h.airTemp)}<span className="hly-xunit">°C</span></> : <span style={{ opacity: 0.35 }}>—</span>}
                              </div>
                              <div className="hly-xsub">&nbsp;</div>
                            </div>
                            <div className={`hly-xcell ${h.seaTemp == null ? "hly-xcell--no-data" : ""}`}>
                              <div className="hly-xsub-top">Water</div>
                              <div className="hly-xval" style={{ color: v.color }}>
                                {h.seaTemp != null ? <>{Math.round(h.seaTemp)}<span className="hly-xunit">°C</span></> : <span style={{ opacity: 0.35 }}>—</span>}
                              </div>
                              <div className="hly-xsub">&nbsp;</div>
                            </div>
                            <div className={`hly-xcell hly-xcell--current ${curKmh == null || curKmh < 0.18 ? "hly-xcell--no-data" : ""}`}>
                              <div className="hly-xsub-top">Current</div>
                              <div className="hly-xval" style={{ color: v.color }}>
                                {curKmh != null && curKmh >= 0.18 ? <>{curKmh.toFixed(1)}<span className="hly-xunit">km/h</span></> : <span style={{ opacity: 0.35 }}>—</span>}
                              </div>
                              <div className="hly-xsub">{(curKmh != null && curKmh >= 0.18 && h.currentDir != null) ? (typeof h.currentDir === "string" ? h.currentDir : degToCompass(h.currentDir)) : " "}</div>
                            </div>
                            {/* Row 3 — Daylight full-width */}
                            {(rise || set) && (
                              <div className="hly-xcell hly-xcell--daylight">
                                <div className="hly-xsub-top">Daylight</div>
                                <div className="hly-xval hly-xdaylight">
                                  <span>↑{rise}</span>
                                  <span className="hly-xdaylight-sep">·</span>
                                  <span>↓{set}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
