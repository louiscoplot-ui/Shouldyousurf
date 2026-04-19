"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { BREAKS, COUNTRIES, findBreak } from "./breaks";
import { LANGUAGES, getT, EN_TEMPLATE } from "./i18n";

const TZ = "Australia/Perth";

// ── Conversions ────────────────────────────────────────────────────────
const mToFt = m => m * 3.281;
const knToKmh = kn => kn * 1.852;

function estimateFaceHeight(swellHeight, swellPeriod) {
  const periodFactor = Math.min(1.8, Math.max(0.7, swellPeriod / 10));
  return swellHeight * periodFactor;
}

// ── Scoring — returns translation keys for notes ───────────────────────
// idealTide string → normalized 0..1 (0 = low, 1 = high)
const TIDE_TARGETS = { "low": 0.1, "mid-low": 0.3, "mid": 0.5, "mid-high": 0.7, "high": 0.9 };

function scoreSurf(h, spot, tideCtx) {
  const { swellHeight, swellPeriod, swellDir, windSpeedKn, windDir } = h;
  let s = 0;
  const notes = [];

  if (swellPeriod >= 14) { s += 35; notes.push("n_long"); }
  else if (swellPeriod >= 11) { s += 22; notes.push("n_decent"); }
  else if (swellPeriod >= 8) { s += 10; notes.push("n_short"); }
  else notes.push("n_weak");

  if (swellHeight >= 1.8) { s += 30; notes.push("n_solid"); }
  else if (swellHeight >= 1.0) { s += 20; notes.push("n_good"); }
  else if (swellHeight >= 0.5) { s += 10; notes.push("n_small"); }
  else notes.push("n_flat");

  const swellDelta = Math.abs(((swellDir - spot.idealSwellDir + 540) % 360) - 180);
  if (swellDelta <= 30) { s += 20; notes.push("n_ideal_dir"); }
  else if (swellDelta <= 60) { s += 8; notes.push("n_ok_dir"); }
  else { s -= 5; notes.push("n_wrong_dir"); }

  if (h.secSwellH != null && h.secSwellDir != null && h.secSwellH >= 0.5 && swellDelta > 60) {
    const secDelta = Math.abs(((h.secSwellDir - spot.idealSwellDir + 540) % 360) - 180);
    if (secDelta <= 30) { s += 10; notes.push("n_sec_helps"); }
    else if (secDelta <= 60) { s += 4; notes.push("n_sec_helps"); }
  }

  const windDelta = Math.abs(((windDir - spot.offshoreWindDir + 540) % 360) - 180);
  const isOffshore = windDelta <= 45;
  const isOnshore = windDelta >= 135;
  const kmh = knToKmh(windSpeedKn);

  if (isOffshore) {
    if (kmh < 10) { s += 18; notes.push("n_light_off"); }
    else if (kmh < 25) { s += 15; notes.push("n_off"); }
    else if (kmh < 40) { s += 5; notes.push("n_strong_off"); }
    else { s -= 5; notes.push("n_gale_off"); }
  } else if (isOnshore) {
    if (kmh < 10) { s -= 2; notes.push("n_light_on"); }
    else if (kmh < 20) { s -= 10; notes.push("n_on_bumpy"); }
    else if (kmh < 35) { s -= 20; notes.push("n_on_blown"); }
    else { s -= 30; notes.push("n_heavy_on"); }
  } else {
    if (kmh < 10) { s += 5; notes.push("n_light_x"); }
    else if (kmh < 25) { s -= 3; notes.push("n_x_texture"); }
    else { s -= 12; notes.push("n_strong_x"); }
  }

  // Tide match: reward being close to the spot's preferred tide window, penalise
  // when we're on the opposite side. Needs a tide context (day min/max) to know
  // what counts as "high" today.
  if (tideCtx && spot.idealTide && spot.idealTide !== "any" && h.tideM != null) {
    const range = tideCtx.max - tideCtx.min;
    if (range > 0.15) {
      const norm = (h.tideM - tideCtx.min) / range;
      const target = TIDE_TARGETS[spot.idealTide];
      if (target != null) {
        const delta = Math.abs(norm - target);
        if (delta < 0.15) { s += 6; notes.push("n_tide_prime"); }
        else if (delta < 0.3) { s += 2; notes.push("n_tide_ok"); }
        else if (delta > 0.6) { s -= 6; notes.push("n_tide_wrong"); }
      }
    }
  }

  return { score: Math.max(0, Math.min(100, s)), notes };
}

// ── Surfability — returns translation keys for reasons ─────────────────
function surfabilityByLevel(h, spot) {
  const face = estimateFaceHeight(h.swellHeight, h.swellPeriod);
  const faceFt = mToFt(face);
  const kmh = knToKmh(h.windSpeedKn);
  const windDelta = Math.abs(((h.windDir - spot.offshoreWindDir + 540) % 360) - 180);
  const isOffshore = windDelta <= 45;
  const isOnshore = windDelta >= 90;
  const windIsClean = (isOffshore && kmh < 25) || kmh < 10;

  const levels = [
    { nameKey: "beginner" },
    { nameKey: "intermediate" },
    { nameKey: "advanced" },
    { nameKey: "expert" },
  ];

  if (faceFt < 1) { levels[0].verdict = "no"; levels[0].reasonKey = "r_too_flat"; }
  else if (faceFt > 6) { levels[0].verdict = "no"; levels[0].reasonKey = "r_too_big"; }
  else if (faceFt > 4 && spot.type !== "reef" && !spot.heavy) { levels[0].verdict = "ok"; levels[0].reasonKey = "r_beg_inside"; }
  else if (faceFt > 4) { levels[0].verdict = "no"; levels[0].reasonKey = "r_too_big"; }
  else if (isOnshore && kmh > 20) { levels[0].verdict = "no"; levels[0].reasonKey = "r_on_strong"; }
  else if (spot.heavy || spot.type === "reef") { levels[0].verdict = "no"; levels[0].reasonKey = "r_reef_beg"; }
  else if (faceFt >= 1 && faceFt <= 2.5 && windIsClean) { levels[0].verdict = "yes"; levels[0].reasonKey = "r_small_clean"; }
  else if (faceFt >= 1 && faceFt <= 2.5) { levels[0].verdict = "ok"; levels[0].reasonKey = "r_small_windy"; }
  else { levels[0].verdict = "ok"; levels[0].reasonKey = "r_manageable"; }

  if (faceFt < 1.5) { levels[1].verdict = "no"; levels[1].reasonKey = "r_too_small"; }
  else if (faceFt > 6) { levels[1].verdict = "no"; levels[1].reasonKey = "r_too_big_i"; }
  else if (isOnshore && kmh > 30) { levels[1].verdict = "no"; levels[1].reasonKey = "r_blown"; }
  else if (faceFt >= 2 && faceFt <= 4 && windIsClean) { levels[1].verdict = "yes"; levels[1].reasonKey = "r_great"; }
  else if (faceFt >= 1.5 && faceFt <= 5) { levels[1].verdict = "ok"; levels[1].reasonKey = isOnshore && kmh > 20 ? "r_bumpy" : "r_workable"; }
  else { levels[1].verdict = "ok"; levels[1].reasonKey = "r_bigger"; }

  if (faceFt < 2) { levels[2].verdict = "no"; levels[2].reasonKey = "r_tiny_adv"; }
  else if (faceFt > 10) { levels[2].verdict = "ok"; levels[2].reasonKey = "r_gun"; }
  else if (isOnshore && kmh > 40) { levels[2].verdict = "no"; levels[2].reasonKey = "r_unride"; }
  else if (faceFt >= 3 && faceFt <= 8 && windIsClean) { levels[2].verdict = "yes"; levels[2].reasonKey = "r_proper"; }
  else { levels[2].verdict = "ok"; levels[2].reasonKey = isOnshore ? "r_messy" : "r_solid_s"; }

  if (faceFt < 2.5) { levels[3].verdict = "no"; levels[3].reasonKey = "r_nothing"; }
  else if (faceFt >= 4 && windIsClean) { levels[3].verdict = "yes"; levels[3].reasonKey = "r_prime"; }
  else if (faceFt >= 4) { levels[3].verdict = "ok"; levels[3].reasonKey = isOnshore ? "r_big_messy" : "r_size_wind"; }
  else { levels[3].verdict = "ok"; levels[3].reasonKey = "r_fun_below"; }

  return levels;
}

function getDayTip(levelMatrix, h, spot) {
  if (!levelMatrix) return null;
  const v = levelMatrix.map(l => l.verdict);
  const [beg, int, adv, exp] = v;
  const faceFt = mToFt(estimateFaceHeight(h.swellHeight, h.swellPeriod));
  const yesCount = v.filter(x => x === "yes").length;
  const noCount = v.filter(x => x === "no").length;

  // Nothing rideable for anyone
  if (noCount >= 3) return "tip_skip_all";
  // Every level scores
  if (yesCount === 4) return "tip_all_levels";
  // Beginners locked out but advanced/expert can score → genuinely big
  if (beg === "no" && (adv === "yes" || exp === "yes")) {
    return faceFt >= 4 ? "tip_advanced" : "tip_int_adv";
  }
  // Big at the peak but inside reform works for beginners
  if (beg === "ok" && (int === "yes" || adv === "yes")) return "tip_inside_split";
  // Only beginners thrive — small clean day
  if (beg === "yes" && int !== "yes" && adv !== "yes") return "tip_beginner";
  // Intermediate+ pumping but beginners shouldn't bother
  if (int === "yes" && beg !== "yes") return "tip_int_adv";
  // Beginners can go, intermediate+ also fine
  if (beg === "yes" && (int === "yes" || int === "ok")) return "tip_all_levels";
  // Everyone just "worth it" — workable but unremarkable
  return "tip_marginal";
}

// Given the flat list of hours for the whole data window, find the next high
// or low tide after the selected time. Returns { kind: "high"|"low", time, m }.
function findNextTideEvent(hours, fromTime) {
  if (!hours || hours.length < 3) return null;
  const fromIdx = hours.findIndex(h => h.time === fromTime);
  const start = fromIdx >= 0 ? fromIdx : 0;
  for (let i = Math.max(1, start); i < hours.length - 1; i++) {
    const prev = hours[i - 1]?.tideM;
    const cur  = hours[i].tideM;
    const next = hours[i + 1]?.tideM;
    if (prev == null || cur == null || next == null) continue;
    if (cur > prev && cur >= next) return { kind: "high", time: hours[i].time, m: cur };
    if (cur < prev && cur <= next) return { kind: "low",  time: hours[i].time, m: cur };
  }
  return null;
}

function dayTideCtx(dayHours) {
  if (!dayHours || !dayHours.length) return null;
  let min = Infinity, max = -Infinity, count = 0;
  for (const h of dayHours) {
    if (h.tideM == null) continue;
    if (h.tideM < min) min = h.tideM;
    if (h.tideM > max) max = h.tideM;
    count++;
  }
  if (count < 2) return null;
  return { min, max };
}

function TideCurve({ dayHours, selHour, tz, t }) {
  const tides = dayHours.filter(h => h.tideM != null);
  if (tides.length < 3) return null;
  const min = Math.min(...tides.map(t2 => t2.tideM));
  const max = Math.max(...tides.map(t2 => t2.tideM));
  const range = max - min || 0.1;
  const W = 300, H = 70, padY = 10;
  const pts = tides.map((t2, i) => {
    const x = (i / (tides.length - 1)) * W;
    const y = H - padY - ((t2.tideM - min) / range) * (H - padY * 2);
    return [x, y, t2];
  });
  const polyline = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaPath = `M 0 ${H} L ${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ")} L ${W} ${H} Z`;
  const selIdx = tides.findIndex(t2 => t2.time === selHour?.time);
  const sel = selIdx >= 0 ? pts[selIdx] : null;
  const fmtShort = (iso) => new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", hour12: true, timeZone: tz }).toLowerCase().replace(" ", "");

  // Find each local high / low on the day to annotate
  const extremes = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1][2].tideM;
    const cur  = pts[i][2].tideM;
    const next = pts[i + 1][2].tideM;
    if (cur > prev && cur >= next) extremes.push({ kind: "H", p: pts[i] });
    else if (cur < prev && cur <= next) extremes.push({ kind: "L", p: pts[i] });
  }

  // Bottom-axis time markers: 6am / 12pm / 6pm if we have hours that close
  const markerHours = [6, 12, 18];
  const axisMarks = markerHours.map(target => {
    const idx = pts.findIndex(p => {
      const hour = parseInt(new Date(p[2].time).toLocaleTimeString("en-AU", { hour: "2-digit", hour12: false, timeZone: tz }), 10);
      return hour === target;
    });
    if (idx < 0) return null;
    return { x: pts[idx][0], label: fmtShort(pts[idx][2].time) };
  }).filter(Boolean);

  return (
    <div className="tide-curve-wrap">
      <div className="tide-curve-label mono">{t("tide_today")}</div>
      <svg viewBox={`0 0 ${W} ${H + 14}`} preserveAspectRatio="none" style={{ width: "100%", height: 72, display: "block", overflow: "visible" }}>
        <path d={areaPath} fill="rgba(14,165,233,0.12)"/>
        <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
        {extremes.map((e, i) => (
          <g key={i}>
            <circle cx={e.p[0]} cy={e.p[1]} r="2.5" fill="var(--accent)" opacity="0.55"/>
            <text x={e.p[0]} y={e.p[1] + (e.kind === "H" ? -6 : 10)} textAnchor="middle"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fill: "var(--text-mu)" }}>
              {e.kind} {fmtShort(e.p[2].time)}
            </text>
          </g>
        ))}
        {sel && (
          <g>
            <line x1={sel[0]} x2={sel[0]} y1={0} y2={H} stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity="0.5"/>
            <circle cx={sel[0]} cy={sel[1]} r="4" fill="var(--accent)"/>
          </g>
        )}
        {axisMarks.map((m, i) => (
          <text key={i} x={m.x} y={H + 12} textAnchor="middle"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: "var(--text-dim)" }}>
            {m.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function tideTrend(hours, sel) {
  if (!hours || !sel) return null;
  const idx = hours.findIndex(h => h.time === sel.time);
  if (idx < 1 || sel.tideM == null) return null;
  const prev = hours[idx - 1]?.tideM;
  if (prev == null) return null;
  const diff = sel.tideM - prev;
  if (Math.abs(diff) < 0.05) return "steady";
  return diff > 0 ? "rising" : "falling";
}

function getWindTypeKey(sel, spot) {
  const d = Math.abs(((sel.windDir - spot.offshoreWindDir + 540) % 360) - 180);
  if (d <= 45) return "offshore";
  if (d >= 135) return "onshore";
  return "cross_shore";
}

function getLevel(s, h, spot) {
  // Wind / wave overrides — applied even when the raw score sits mid-range,
  // because a great swell ruined by strong side/onshore wind still scores OK.
  if (h && spot) {
    const faceFt = mToFt(estimateFaceHeight(h.swellHeight, h.swellPeriod));
    const kmh = knToKmh(h.windSpeedKn);
    const windDelta = Math.abs(((h.windDir - spot.offshoreWindDir + 540) % 360) - 180);
    const isOffshore = windDelta <= 45;

    if (faceFt < 1) {
      return { labelKey: "score_flat", subKey: "score_flat_sub", color: "#dc2626" };
    }

    // Wind ruins the wave: non-offshore ≥25 km/h, or any direction ≥40 km/h.
    // Offshore stays surfable until it gets truly gale-force.
    const blownOut = (!isOffshore && kmh >= 25) || kmh >= 40 || (isOffshore && kmh >= 55);
    if (blownOut && s < 75) {
      return { labelKey: "score_blown", subKey: "score_blown_sub", color: "#dc2626" };
    }
  }

  if (s >= 75) return { labelKey: "score_75_100", subKey: "score_75_100_sub", color: "#0b6e2e" };
  if (s >= 65) return { labelKey: "score_65_74",  subKey: "score_65_74_sub",  color: "#15803d" };
  if (s >= 55) return { labelKey: "score_55_64",  subKey: "score_55_64_sub",  color: "#16a34a" };
  if (s >= 45) return { labelKey: "score_35_54",  subKey: "score_35_54_sub",  color: "#65a30d" };
  if (s >= 35) return { labelKey: "score_35_44",  subKey: "score_35_44_sub",  color: "#84cc16" };
  if (s >= 15) return { labelKey: "score_15_34",  subKey: "score_15_34_sub",  color: "#ea580c" };
  return       { labelKey: "score_0_14",   subKey: "score_0_14_sub",   color: "#dc2626" };
}

function degToCompass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function fmtHour(iso, tz) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).toLowerCase().replace(" ", "");
}

function fmtLongDay(isoDate, tz, t) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dayDate = new Date(Date.UTC(y, mo - 1, d, 12));
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const diffDays = Math.round((dayDate.getTime() - new Date(todayStr + "T12:00:00Z").getTime()) / (1000*60*60*24));
  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("tomorrow");
  if (diffDays === -1) return t("yesterday");
  return dayDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function describeFaceHeightKey(ft) {
  if (ft < 2)  return "fh_1";
  if (ft < 3)  return "fh_2";
  if (ft < 4)  return "fh_3";
  if (ft < 6)  return "fh_4";
  if (ft < 8)  return "fh_5";
  if (ft < 12) return "fh_6";
  return "fh_7";
}

function isDawn(iso, tz) {
  const h = parseInt(new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", hour12: false, timeZone: tz }));
  return h >= 5 && h <= 9;
}

// ── Date helpers ───────────────────────────────────────────────────────
function offsetDate(isoDate, n) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function unifiedTabLabel(isoDate, tz, t) {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dayDate = new Date(Date.UTC(y, mo - 1, d, 12));
  const diffDays = Math.round((dayDate.getTime() - new Date(todayStr + "T12:00:00Z").getTime()) / (1000*60*60*24));
  const dateStr = `${d}/${mo}`;
  if (diffDays <= -3) return { label: `-${Math.abs(diffDays)}d`, date: dateStr };
  if (diffDays === -2) return { label: "-2d", date: dateStr };
  if (diffDays === -1) return { label: t("yest"), date: dateStr };
  if (diffDays === 0)  return { label: t("today"), date: dateStr };
  if (diffDays === 1)  return { label: t("tmrw"), date: dateStr };
  const dayName = dayDate.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
  return { label: dayName, date: dateStr };
}

// ── Custom Language Modal ──────────────────────────────────────────────
function CustomLangModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [flag, setFlag] = useState("");
  const [json, setJson] = useState(() => JSON.stringify(EN_TEMPLATE, null, 2));
  const [err, setErr] = useState("");

  function handleSave() {
    if (!name.trim() || !code.trim()) { setErr("Name and code are required."); return; }
    try {
      const translations = JSON.parse(json);
      onSave({ code: code.trim().toLowerCase(), name: name.trim(), flag: flag.trim() || "🌐", translations });
    } catch {
      setErr("Invalid JSON — check your syntax.");
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        <div className="sheet-body">
          <div className="sheet-header">
            <div className="sheet-title">Add Language</div>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-mu)", marginBottom: 14, lineHeight: 1.5 }}>
            Edit the JSON values (right side) to add your translations. Keep all keys unchanged.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px", gap: 8, marginBottom: 12 }}>
            <input className="search-input" value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Arabic)" />
            <input className="search-input" value={code} onChange={e => setCode(e.target.value)} placeholder="Code (e.g. ar)" />
            <input className="search-input" value={flag} onChange={e => setFlag(e.target.value)} placeholder="🌐" style={{ textAlign: "center" }} />
          </div>
          <textarea
            className="search-input"
            value={json}
            onChange={e => { setJson(e.target.value); setErr(""); }}
            style={{ width: "100%", height: 260, resize: "vertical", fontFamily: "JetBrains Mono, monospace", fontSize: 10, lineHeight: 1.6 }}
            spellCheck={false}
          />
          {err && <div style={{ color: "var(--bad)", fontSize: 11, marginTop: 6, fontFamily: "JetBrains Mono, monospace" }}>{err}</div>}
          <button className="primary-btn" style={{ marginTop: 14 }} onClick={handleSave}>Save Language</button>
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── PWA Install Prompt ─────────────────────────────────────────────────
function PwaInstallPrompt({ onDismiss, t }) {
  const [isIos, setIsIos] = useState(false);
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsIos(/iPhone|iPad|iPod/.test(ua));
    setInApp(/Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|MicroMessenger|KAKAOTALK|TikTok|musical_ly|Snapchat|LinkedInApp|Twitter|Pinterest/i.test(ua));
  }, []);
  const title = inApp ? t("pwa_inapp_title") : t("pwa_title");
  const instructions = inApp ? t("pwa_inapp") : (isIos ? t("pwa_ios") : t("pwa_android"));
  return (
    <div className="pwa-banner">
      <div className="pwa-icon">{inApp ? "🔗" : "🏄"}</div>
      <div className="pwa-content">
        <div className="pwa-title">{title}</div>
        <div className="pwa-instructions">{instructions}</div>
      </div>
      <button className="pwa-close" onClick={onDismiss}>✕</button>
    </div>
  );
}

// ── FAQ Sheet ──────────────────────────────────────────────────────────
const FAQ_KEYS = [
  { q: "faq_q1", a: "faq_a1" },
  { q: "faq_q2", a: "faq_a2" },
  { q: "faq_q3", a: "faq_a3" },
  { q: "faq_q4", a: null, parts: ["faq_a4_ios", "faq_a4_android"] },
  { q: "faq_q5", a: "faq_a5" },
  { q: "faq_q6", a: "faq_a6" },
  { q: "faq_q7", a: "faq_a7" },
  { q: "faq_q8", a: "faq_a8" },
  { q: "faq_q9", a: "faq_a9" },
];

function FaqSheet({ onClose, t }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        <div className="sheet-body">
          <div className="sheet-header">
            <div className="sheet-title">{t("faq_title")}</div>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          {FAQ_KEYS.map((item, i) => (
            <div key={i} className="faq-item">
              <button className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
                <span>{t(item.q)}</span>
                <span className="faq-chev">{open === i ? "▴" : "▾"}</span>
              </button>
              {open === i && (
                <div className="faq-a">
                  {item.a ? t(item.a) : item.parts.map((p, j) => (
                    <div key={j} style={{ marginTop: j > 0 ? 6 : 0 }}>
                      <span style={{ color: "var(--accent)", marginRight: 6 }}>{j === 0 ? "iOS:" : "Android:"}</span>{t(p)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Language picker ────────────────────────────────────────────────────
const USER_LEVELS = ["first_timer", "beginner", "early_int", "intermediate", "advanced", "expert"];
const USER_LEVEL_TO_MATRIX = { first_timer: 0, beginner: 0, early_int: 1, intermediate: 1, advanced: 2, expert: 3 };
const USER_LEVEL_BIAS = { first_timer: "down", early_int: "down" };
// Size comfort zones per user level, in feet of face height.
const USER_LEVEL_ZONES = {
  first_timer:  { min: 0.3, sweetLo: 0.6, sweetHi: 1.5, upperMax: 2.2 },
  beginner:     { min: 0.3, sweetLo: 1,   sweetHi: 2,   upperMax: 3 },
  early_int:    { min: 1.2, sweetLo: 1.8, sweetHi: 3,   upperMax: 4 },
  intermediate: { min: 1.5, sweetLo: 2.5, sweetHi: 4.5, upperMax: 6 },
  advanced:     { min: 2,   sweetLo: 3,   sweetHi: 7,   upperMax: 10 },
  expert:       { min: 2.5, sweetLo: 4,   sweetHi: 10,  upperMax: 16 },
};

function classifyConditions(userLevel, h, spot) {
  const faceFt = mToFt(estimateFaceHeight(h.swellHeight, h.swellPeriod));
  const kmh = knToKmh(h.windSpeedKn);
  const windDelta = Math.abs(((h.windDir - spot.offshoreWindDir + 540) % 360) - 180);
  const isOffshore = windDelta <= 45;
  const isOnshore = windDelta >= 90;

  const z = USER_LEVEL_ZONES[userLevel] || USER_LEVEL_ZONES.intermediate;
  let size;
  if (faceFt < z.min) size = "too_small";
  else if (faceFt < z.sweetLo) size = "small";
  else if (faceFt <= z.sweetHi) size = "sweet";
  else if (faceFt <= z.upperMax) size = "upper";
  else size = "too_big";

  let wind;
  // Mirrors the "blown out" rule used for the hour label so a hour can't read
  // "BLOWN OUT" overall while the personal tip still treats it as just bumpy.
  if ((isOffshore && kmh < 30) || kmh < 10) wind = "clean";
  else if ((!isOffshore && kmh >= 25) || kmh >= 40) wind = "blown";
  else wind = "bumpy";

  const reefTooMuch = (spot.heavy || spot.type === "reef") && (userLevel === "first_timer" || userLevel === "beginner");

  return { size, wind, reefTooMuch, faceFt };
}

// Foamie-friendly: beginner/first-timer on a beach break can usually find
// something to surf on the inside reform — whitewash close to shore — almost
// any day there's any swell at all. Only ruled out if the spot is heavy/reef
// or the shore pound is genuinely dangerous.
function isFoamieFriendly(userLevel, spot) {
  // Anything that isn't explicitly flagged as reef/heavy is treated as a beach
  // break — that's the default when curated breaks don't set a type.
  return (userLevel === "first_timer" || userLevel === "beginner")
    && spot.type !== "reef" && !spot.heavy;
}
function hasInsideReform(userLevel, faceFt, spot) {
  return isFoamieFriendly(userLevel, spot) && faceFt <= 10;
}

function getPersonalAdviceKey(userLevel, h, spot) {
  const { size, wind, reefTooMuch, faceFt } = classifyConditions(userLevel, h, spot);
  if (reefTooMuch) return "tip_" + userLevel + "_reef";
  const foamie = hasInsideReform(userLevel, faceFt, spot);
  // Foamie mode: whenever the peak itself is out of range (too big, blown, or
  // in the upper part of their comfort zone) send them inside instead.
  if (foamie) {
    if (faceFt < 0.3) return "tip_" + userLevel + "_too_small";
    if (size === "too_big")               return "tip_" + userLevel + "_inside";
    if (wind === "blown")                 return "tip_" + userLevel + "_inside";
    if (size === "upper")                 return "tip_" + userLevel + "_inside";
  }
  if (size === "too_small") return "tip_" + userLevel + "_too_small";
  if (size === "too_big")   return "tip_" + userLevel + "_too_big";
  if (wind === "blown")     return "tip_" + userLevel + "_blown_" + size;
  return "tip_" + userLevel + "_" + size + "_" + wind;
}

// Expert-level context added after the main tip — highlights the factor most
// likely to surprise the surfer (period = real power, direction = closeouts).
function getPersonalModifier(userLevel, h, spot) {
  const { size, wind, reefTooMuch } = classifyConditions(userLevel, h, spot);
  if (reefTooMuch) return null;
  if (size === "too_small" || size === "too_big") return null;
  if (wind === "blown") return null;

  const period = h.swellPeriod || 0;
  const dirDelta = Math.abs(((h.swellDir - spot.idealSwellDir + 540) % 360) - 180);
  const isLearner = userLevel === "first_timer" || userLevel === "beginner" || userLevel === "early_int";

  // Long-period swell carries much more punch than the size suggests.
  if (period >= 14 && (size === "sweet" || size === "upper")) return "tip_mod_long_period";
  // Short-period mushy swell is forgiving — good to reassure learners.
  if (period > 0 && period < 8 && isLearner && (size === "sweet" || size === "small")) return "tip_mod_short_period";
  // Off-angle swell usually closes out — worth flagging at any level.
  if (dirDelta > 75) return "tip_mod_off_angle";
  // Glassy condition — call it out when truly calm
  if (wind === "clean" && knToKmh(h.windSpeedKn) < 8) return "tip_mod_glassy";
  return null;
}

// Given the selected hour + the full hour list, compute any extra tide-based
// context for the tip (e.g. "tide is about to turn high", "dead low").
function getTideModifier(sel, hours) {
  if (!sel || sel.tideM == null || !hours) return null;
  const trend = tideTrend(hours, sel);
  const next = findNextTideEvent(hours, sel.time);
  if (!next) return null;
  const hoursUntil = (new Date(next.time) - new Date(sel.time)) / 3600000;
  if (hoursUntil >= 0 && hoursUntil <= 2) {
    return next.kind === "high" ? "tip_mod_tide_high_soon" : "tip_mod_tide_low_soon";
  }
  if (trend === "rising") return "tip_mod_tide_rising";
  if (trend === "falling") return "tip_mod_tide_falling";
  return null;
}

function getPersonalVerdict(userLevel, h, spot) {
  const { size, wind, reefTooMuch, faceFt } = classifyConditions(userLevel, h, spot);
  // SKIP is reserved for genuinely unsurfable or unsafe situations.
  // Anything borderline defaults to WORTH IT — let the surfer judge at the beach.

  if (reefTooMuch) return "no";

  // Foamie mode: beginner/first-timer on a beach break can almost always find
  // something inside. Only ruled out if truly flat or shore pound is huge.
  if (isFoamieFriendly(userLevel, spot)) {
    if (faceFt < 0.3) return "no";   // nothing at all to catch
    if (faceFt > 10) return "no";    // dangerous shore pound
    if (size === "sweet" && wind === "clean") return "yes";
    return "ok";
  }

  if (wind === "blown") {
    if (size === "upper") return "no";
    if (size === "too_small") return "no";
    return "ok";
  }

  if (size === "too_small") {
    if (userLevel === "first_timer" || userLevel === "beginner") return "no";
    return "ok";
  }
  if (size === "too_big") {
    if (userLevel === "first_timer" || userLevel === "beginner" || userLevel === "early_int") return "no";
    return "ok";
  }

  if (size === "sweet") return wind === "clean" ? "yes" : "ok";
  if (size === "upper") return wind === "clean" ? "yes" : "ok";
  return "ok";
}

function OnboardingModal({ onPick, onSkip, t }) {
  return (
    <div className="overlay" onClick={onSkip}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        <div className="sheet-body">
          <div style={{ textAlign: "center", paddingTop: 10, paddingBottom: 6 }}>
            <div className="serif" style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #0c2a5e 0%, #1558b5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {t("onboarding_title")}
            </div>
            <p style={{ fontSize: 14, color: "var(--text-mu)", margin: "8px 0 18px", lineHeight: 1.45 }}>{t("onboarding_sub")}</p>
          </div>
          {USER_LEVELS.map(lvl => (
            <button key={lvl} className="level-item" onClick={() => onPick(lvl)}>
              <div style={{ flex: 1 }}>
                <div className="level-item-title">{t("lvl_" + lvl)}</div>
                <div className="level-item-sub">{t("lvl_" + lvl + "_sub")}</div>
              </div>
            </button>
          ))}
          <button className="level-item level-item-clear" onClick={onSkip}>
            <div className="level-item-title">{t("onboarding_skip")}</div>
          </button>
        </div>
      </div>
    </div>
  );
}

function LevelPicker({ userLevel, onPick, onClose, t }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        <div className="sheet-body">
          <div className="sheet-header">
            <div className="sheet-title">{t("level_picker_title")}</div>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <p className="level-picker-sub">{t("level_picker_sub")}</p>
          {USER_LEVELS.map(lvl => (
            <button key={lvl} className={`level-item ${userLevel === lvl ? "active" : ""}`}
              onClick={() => { onPick(lvl); onClose(); }}>
              <div style={{ flex: 1 }}>
                <div className="level-item-title">{t("lvl_" + lvl)}</div>
                <div className="level-item-sub">{t("lvl_" + lvl + "_sub")}</div>
              </div>
              {userLevel === lvl && <span className="level-item-check">✓</span>}
            </button>
          ))}
          {userLevel && (
            <button className="level-item level-item-clear" onClick={() => { onPick(null); onClose(); }}>
              <div className="level-item-title">{t("level_clear")}</div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LangPicker({ lang, setLang, onClose, customLangs, onDeleteCustom, onAddLang }) {
  const allLangs = [...LANGUAGES, ...customLangs.map(c => ({ code: c.code, name: c.name, flag: c.flag, isCustom: true }))];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        <div className="sheet-body">
          <div className="sheet-header">
            <div className="sheet-title">Language</div>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <button
            onClick={() => { onClose(); onAddLang(); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "1px dashed var(--border-str)", borderRadius: 8, padding: "12px 16px", cursor: "pointer", color: "var(--accent)", fontSize: 13, fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>
            + Add Language
          </button>
          {allLangs.map(l => (
            <div key={l.code} style={{ display: "flex", alignItems: "center" }}>
              <button className={`lang-row ${lang === l.code ? "active" : ""}`}
                style={{ flex: 1 }}
                onClick={() => { setLang(l.code); try { localStorage.setItem("surf-lang", l.code); } catch {} onClose(); }}>
                <span className="lang-flag">{l.flag}</span>
                <span className="lang-name">{l.name}</span>
                {l.isCustom && <span style={{ fontSize: 8, fontFamily: "JetBrains Mono, monospace", color: "var(--accent)", background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: 3, padding: "1px 5px", marginLeft: 4 }}>custom</span>}
                {lang === l.code && <span className="lang-check">✓</span>}
              </button>
              {l.isCustom && (
                <button onClick={() => onDeleteCustom(l.code)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", fontSize: 11, padding: "0 4px", marginLeft: 4 }}>✕</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Break picker ───────────────────────────────────────────────────────
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestBreak(lat, lng) {
  let best = null, bestD = Infinity;
  for (const b of BREAKS) {
    const d = distanceKm(lat, lng, b.lat, b.lng);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best ? { spot: best, distanceKm: bestD } : null;
}

function BreakPicker({ onSelect, onClose, favorites, toggleFav, currentId, t, country, setCountry }) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) { alert(t("gps_unsupported")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        const r = nearestBreak(pos.coords.latitude, pos.coords.longitude);
        if (r) onSelect(r.spot);
      },
      () => { setLocating(false); alert(t("gps_denied")); },
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  const countryBreaks = useMemo(() => BREAKS.filter(b => b.country === country), [country]);

  const grouped = useMemo(() => {
    const filtered = query.trim()
      ? countryBreaks.filter(b => (b.name + " " + b.region).toLowerCase().includes(query.toLowerCase()))
      : countryBreaks;
    const out = {};
    const order = [];
    filtered.forEach(b => {
      const r = b.region.split(",").slice(-1)[0].trim();
      if (!out[r]) { out[r] = []; order.push(r); }
      out[r].push(b);
    });
    return { out, order };
  }, [query, countryBreaks]);

  async function geoSearch(q) {
    const term = (q ?? query).trim();
    if (!term) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=10&language=en&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {} finally { setSearching(false); }
  }

  const currentCountry = COUNTRIES.find(c => c.code === country) || COUNTRIES[0];

  // Debounced auto-search as the user types — covers beaches worldwide.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => { geoSearch(term); }, 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return BREAKS.filter(b => (b.name + " " + b.region).toLowerCase().includes(q));
  }, [query]);

  const isSearching = query.trim().length >= 2;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        <div className="sheet-body">
          <div className="sheet-header">
            <div className="sheet-title">{t("choose_break")}</div>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <button className="country-btn" onClick={() => setCountryOpen(v => !v)}>
            <span>{currentCountry.flag} {currentCountry.name}</span>
            <span style={{ color: "var(--text-mu)" }}>▾</span>
          </button>
          <button className="locate-btn" onClick={useMyLocation} disabled={locating}>
            {locating ? t("locating") : <>📍 {t("nearest_spot")}</>}
          </button>
          {countryOpen && (
            <div className="country-list">
              {COUNTRIES.map(c => (
                <button key={c.code}
                  className={`country-row ${c.code === country ? "active" : ""}`}
                  onClick={() => { setCountry(c.code); setCountryOpen(false); setQuery(""); setSearchResults([]); }}>
                  <span>{c.flag} {c.name}</span>
                  {c.code === country && <span style={{ color: "var(--accent)" }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input className="search-input" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && geoSearch()}
              placeholder={t("search_placeholder")}/>
            <button className="search-btn" onClick={() => geoSearch()}>{searching ? "…" : "🔍"}</button>
          </div>

          {isSearching && (
            <>
              {localMatches.length > 0 && (
                <>
                  <div className="region-header">{t("known_breaks")}</div>
                  {localMatches.map(b => (
                    <BreakRow key={b.id} b={b} onSelect={onSelect} toggleFav={toggleFav} isFav={favorites.includes(b.id)} current={currentId===b.id} t={t}/>
                  ))}
                </>
              )}

              <div className="region-header">
                {searching ? t("searching") : t("search_results")}
              </div>
              {searchResults.map((r, i) => {
                const country = r.country_code ? `${r.country_code}` : "";
                const regionLabel = [r.admin1, r.admin2].filter(Boolean).join(" · ");
                return (
                  <div key={i} className="break-row">
                    <button className="break-row-main" onClick={() => onSelect({
                      id: `custom-${r.latitude.toFixed(4)}-${r.longitude.toFixed(4)}`,
                      name: r.name,
                      region: [regionLabel, country].filter(Boolean).join(", ") || r.name,
                      lat: r.latitude, lng: r.longitude,
                      idealSwellDir: 225, offshoreWindDir: 90, type: "beach",
                    })}>
                      <div className="break-row-title">{r.name} <span className="break-row-flag">{country}</span></div>
                      <div className="break-row-sub">{regionLabel || "—"}</div>
                    </button>
                  </div>
                );
              })}
              {!searching && searchResults.length === 0 && localMatches.length === 0 && (
                <div className="break-empty mono">{t("search_none")}</div>
              )}
            </>
          )}

          {favorites.length > 0 && (
            <>
              <div className="region-header">{t("favourites")}</div>
              {favorites.map(id => {
                const b = BREAKS.find(x => x.id === id);
                if (!b) return null;
                return <BreakRow key={b.id} b={b} onSelect={onSelect} toggleFav={toggleFav} isFav={true} current={currentId===b.id} t={t}/>;
              })}
            </>
          )}

          {!isSearching && grouped.order.map(region => (
            <div key={region}>
              <div className="region-header">{region}</div>
              {grouped.out[region].map(b => (
                <BreakRow key={b.id} b={b} onSelect={onSelect} toggleFav={toggleFav} isFav={favorites.includes(b.id)} current={currentId===b.id} t={t}/>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BreakRow({ b, onSelect, toggleFav, isFav, current, t }) {
  return (
    <div className={`break-row ${current ? "current" : ""}`}>
      <button className="break-row-main" onClick={() => onSelect(b)}>
        <div className="break-row-title">{b.name}</div>
        <div className="break-row-sub">{b.region} · {t(b.type || "beach")}{b.heavy ? ` · ${t("heavy")}` : ""}</div>
      </button>
      <button className={`break-row-fav ${isFav ? "active" : ""}`}
        onClick={e => { e.stopPropagation(); toggleFav(b.id); }}>
        {isFav ? "★" : "☆"}
      </button>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────
export default function SurfApp() {
  const [spot, setSpot] = useState(BREAKS[0]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetail, setErrorDetail] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeDay, setActiveDay] = useState(3);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [scoreExplainer, setScoreExplainer] = useState(false);
  const [expandedHours, setExpandedHours] = useState(new Set());
  const [lang, setLang] = useState("en");
  const [customLangs, setCustomLangs] = useState([]);
  const [showAddLang, setShowAddLang] = useState(false);
  const [hoursGuide, setHoursGuide] = useState(false);
  const [showPwa, setShowPwa] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [pinnedHour, setPinnedHour] = useState(null);
  const [userLevel, setUserLevel] = useState(null);
  const [levelPickerOpen, setLevelPickerOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [notifOptIn, setNotifOptIn] = useState(false);
  const [country, setCountry] = useState("AU");
  const [sharedDay, setSharedDay] = useState(null);
  const tabsRef = useRef(null);
  const tz = spot.timezone || TZ;
  const customLangDict = customLangs.find(c => c.code === lang)?.translations;
  const t = getT(lang, customLangDict);

  useEffect(() => {
    try {
      const savedId = localStorage.getItem("surf-last-break");
      const savedCustom = localStorage.getItem("surf-last-break-custom");
      if (savedCustom) setSpot(JSON.parse(savedCustom));
      else if (savedId) setSpot(findBreak(savedId));
      const favs = localStorage.getItem("surf-favorites");
      if (favs) setFavorites(JSON.parse(favs));
      const savedLang = localStorage.getItem("surf-lang");
      if (savedLang) setLang(savedLang);
      const savedCustomLangs = localStorage.getItem("surf-custom-langs");
      if (savedCustomLangs) setCustomLangs(JSON.parse(savedCustomLangs));
      const savedPin = localStorage.getItem("surf-pinned-hour");
      if (savedPin !== null) setPinnedHour(parseInt(savedPin, 10));
      const savedLvl = localStorage.getItem("surf-user-level");
      if (savedLvl) setUserLevel(savedLvl);
      const onboarded = localStorage.getItem("surf-onboarded");
      if (!onboarded && !savedLvl) setOnboardingOpen(true);
      const notifOpt = localStorage.getItem("surf-notif-opt-in");
      if (notifOpt && typeof Notification !== "undefined" && Notification.permission === "granted") {
        setNotifOptIn(true);
      }
      const savedCountry = localStorage.getItem("surf-country");
      if (savedCountry) setCountry(savedCountry);
      // Shared URL params — override the saved state so a shared link opens
      // on the exact spot/day/hour that was sent.
      const params = new URLSearchParams(window.location.search);
      const sharedSpot = params.get("spot");
      if (sharedSpot) {
        const b = findBreak(sharedSpot);
        if (b) setSpot(b);
      }
      const sharedHour = params.get("hour");
      if (sharedHour !== null) setPinnedHour(parseInt(sharedHour, 10));
      const sharedDayParam = params.get("day");
      if (sharedDayParam) setSharedDay(sharedDayParam);
    } catch {}
  }, []);

  useEffect(() => {
    const isStandalone = typeof window !== "undefined" &&
      (window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches);
    if (isStandalone) return;
    const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
    if (!isMobile) return;
    try { if (localStorage.getItem("surf-pwa-shown")) return; } catch {}
    setShowPwa(true);
  }, []);

  // Register service worker — future push support + offline shell
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);


  function saveCustomLang(cl) {
    setCustomLangs(prev => {
      const next = prev.filter(c => c.code !== cl.code).concat(cl);
      try { localStorage.setItem("surf-custom-langs", JSON.stringify(next)); } catch {}
      return next;
    });
    setLang(cl.code);
    try { localStorage.setItem("surf-lang", cl.code); } catch {}
    setShowAddLang(false);
  }

  function deleteCustomLang(code) {
    setCustomLangs(prev => {
      const next = prev.filter(c => c.code !== code);
      try { localStorage.setItem("surf-custom-langs", JSON.stringify(next)); } catch {}
      return next;
    });
    if (lang === code) setLang("en");
  }

  function saveCountry(code) {
    setCountry(code);
    try { localStorage.setItem("surf-country", code); } catch {}
  }

  function findUpcomingGoodWindow(hours) {
    if (!hours || !hours.length) return null;
    const now = Date.now();
    let best = null;
    for (const h of hours) {
      const t = new Date(h.time).getTime();
      if (t < now) continue;
      const hourOfDay = new Date(h.time).toLocaleTimeString("en-AU", { hour: "numeric", hour12: false, timeZone: tz });
      const hr = parseInt(hourOfDay, 10);
      if (hr < 6 || hr > 19) continue;
      const { score } = scoreSurf(h, spot, null);
      if (score >= 65 && (!best || score > best.score)) {
        best = { hour: h, score };
      }
    }
    return best;
  }

  async function toggleNotifications() {
    if (typeof Notification === "undefined") {
      alert(t("notif_unsupported"));
      return;
    }
    // Already on → turn off
    if (notifOptIn) {
      try { localStorage.removeItem("surf-notif-opt-in"); } catch {}
      setNotifOptIn(false);
      return;
    }
    // Turning on → ask permission if needed
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }
    if (perm !== "granted") {
      alert(t("notif_denied"));
      return;
    }
    try { localStorage.setItem("surf-notif-opt-in", "1"); } catch {}
    setNotifOptIn(true);
    const best = findUpcomingGoodWindow(data.hours);
    if (best) {
      const when = `${fmtLongDay(best.hour.time.split("T")[0], tz, t)} ${fmtHour(best.hour.time, tz)}`;
      new Notification(`🌊 ${spot.name}`, {
        body: `${t("notif_best_window")}: ${when} · ${best.score}/100`,
        icon: "/icon-192.png",
      });
    } else {
      new Notification(`${spot.name}`, {
        body: t("notif_none_upcoming"),
        icon: "/icon-192.png",
      });
    }
  }

  function saveUserLevel(lvl) {
    setUserLevel(lvl);
    try {
      if (lvl) localStorage.setItem("surf-user-level", lvl);
      else localStorage.removeItem("surf-user-level");
    } catch {}
  }

  function finishOnboarding(lvl) {
    if (lvl) saveUserLevel(lvl);
    setOnboardingOpen(false);
    try { localStorage.setItem("surf-onboarded", "1"); } catch {}
  }

  function dismissPwa() {
    setShowPwa(false);
    try { localStorage.setItem("surf-pwa-shown", "1"); } catch {}
  }

  useEffect(() => {
    try {
      if (spot.id.startsWith("custom-")) {
        localStorage.setItem("surf-last-break-custom", JSON.stringify(spot));
        localStorage.removeItem("surf-last-break");
      } else {
        localStorage.setItem("surf-last-break", spot.id);
        localStorage.removeItem("surf-last-break-custom");
      }
    } catch {}
  }, [spot]);

  useEffect(() => {
    try { localStorage.setItem("surf-favorites", JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  function toggleFav(id) {
    setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  }

  async function fetchAllDays() {
    setLoading(true); setError(null);
    try {
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      const pastStart = offsetDate(todayStr, -3);
      const pastEnd = offsetDate(todayStr, -1);
      const marineFields = "wave_height,swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction,sea_level_height_msl";

      const pastMarineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${marineFields}&start_date=${pastStart}&end_date=${pastEnd}&timezone=${encodeURIComponent(tz)}`;
      const pastWindUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m&wind_speed_unit=kn&start_date=${pastStart}&end_date=${pastEnd}&timezone=${encodeURIComponent(tz)}`;
      const futureMarineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${marineFields}&timezone=${encodeURIComponent(tz)}&forecast_days=5`;
      const futureWindUrl = `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability&daily=sunrise,sunset&timezone=${encodeURIComponent(tz)}&wind_speed_unit=kn&forecast_days=5`;

      const [pastMarineRes, pastWindRes, futureMarineRes, futureWindRes] = await Promise.all([
        fetch(pastMarineUrl).catch(() => null),
        fetch(pastWindUrl).catch(() => null),
        fetch(futureMarineUrl),
        fetch(futureWindUrl),
      ]);

      if (!futureMarineRes.ok) throw new Error(`Marine API: HTTP ${futureMarineRes.status}`);
      if (!futureWindRes.ok) throw new Error(`Wind API: HTTP ${futureWindRes.status}`);
      const futureMarine = await futureMarineRes.json();
      const futureWind = await futureWindRes.json();
      if (!futureMarine.hourly || !futureWind.hourly) throw new Error("Invalid API response");

      const futureHours = futureMarine.hourly.time.map((t, i) => ({
        time: t, isPast: false,
        swellHeight: futureMarine.hourly.swell_wave_height[i],
        swellPeriod: futureMarine.hourly.swell_wave_period[i],
        swellDir: futureMarine.hourly.swell_wave_direction[i],
        waveHeight: futureMarine.hourly.wave_height[i],
        windWaveHeight: futureMarine.hourly.wind_wave_height?.[i],
        windSpeedKn: futureWind.hourly.wind_speed_10m[i],
        windDir: futureWind.hourly.wind_direction_10m[i],
        airTemp: futureWind.hourly.temperature_2m?.[i] ?? null,
        rainProb: futureWind.hourly.precipitation_probability?.[i] ?? null,
        windGustKn: futureWind.hourly.wind_gusts_10m?.[i] ?? null,
        secSwellH: futureMarine.hourly.secondary_swell_wave_height?.[i] ?? null,
        secSwellP: futureMarine.hourly.secondary_swell_wave_period?.[i] ?? null,
        secSwellDir: futureMarine.hourly.secondary_swell_wave_direction?.[i] ?? null,
        tideM: futureMarine.hourly.sea_level_height_msl?.[i] ?? null,
        seaTemp: futureMarine.hourly.sea_surface_temperature?.[i] ?? null,
        currentVel: futureMarine.hourly.ocean_current_velocity?.[i] ?? null,
        currentDir: futureMarine.hourly.ocean_current_direction?.[i] ?? null,
      }));

      let pastHours = [];
      if (pastMarineRes?.ok && pastWindRes?.ok) {
        const pastMarine = await pastMarineRes.json();
        const pastWind = await pastWindRes.json();
        if (pastMarine.hourly && pastWind.hourly) {
          pastHours = pastMarine.hourly.time.map((t, i) => ({
            time: t, isPast: true,
            swellHeight: pastMarine.hourly.swell_wave_height[i],
            swellPeriod: pastMarine.hourly.swell_wave_period[i],
            swellDir: pastMarine.hourly.swell_wave_direction[i],
            waveHeight: pastMarine.hourly.wave_height[i],
            windWaveHeight: pastMarine.hourly.wind_wave_height?.[i],
            windSpeedKn: pastWind.hourly.wind_speed_10m[i],
            windDir: pastWind.hourly.wind_direction_10m[i],
            airTemp: pastWind.hourly.temperature_2m?.[i] ?? null,
            seaTemp: pastMarine.hourly.sea_surface_temperature?.[i] ?? null,
            currentVel: pastMarine.hourly.ocean_current_velocity?.[i] ?? null,
            currentDir: pastMarine.hourly.ocean_current_direction?.[i] ?? null,
          }));
        }
      }

      const allHours = [...pastHours, ...futureHours];
      const daysMap = {};
      allHours.forEach(h => {
        const d = h.time.split("T")[0];
        if (!daysMap[d]) daysMap[d] = [];
        daysMap[d].push(h);
      });

      const orderedDays = [];
      for (let off = -3; off <= 4; off++) {
        const dateStr = offsetDate(todayStr, off);
        if (daysMap[dateStr]) orderedDays.push([dateStr, daysMap[dateStr]]);
      }

      const allHoursFlat = orderedDays.flatMap(([, hrs]) => hrs);
      const todayIdx = orderedDays.findIndex(([d]) => d === todayStr);

      const sunByDay = {};
      if (futureWind.daily?.time) {
        futureWind.daily.time.forEach((d, i) => {
          sunByDay[d] = {
            sunrise: futureWind.daily.sunrise?.[i] ?? null,
            sunset: futureWind.daily.sunset?.[i] ?? null,
          };
        });
      }

      setData({ hours: allHoursFlat, days: orderedDays, sunByDay });
      setSelected(null);
      let tIdx = todayIdx >= 0 ? todayIdx : 0;
      if (sharedDay) {
        const sharedIdx = orderedDays.findIndex(([d]) => d === sharedDay);
        if (sharedIdx >= 0) tIdx = sharedIdx;
        setSharedDay(null);
      }
      setActiveDay(tIdx);
      // Scroll tabs to today after render
      setTimeout(() => {
        if (tabsRef.current) {
          const tabEl = tabsRef.current.children[tIdx];
          if (tabEl) tabEl.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
        }
      }, 50);
    } catch (e) {
      setError(true); setErrorDetail(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelected(null);
    fetchAllDays();
    /* eslint-disable-next-line */
  }, [spot.id]);

  if (loading) return (
    <div
      className="load-wrap"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 20, padding: "0 24px", textAlign: "center",
        background: "linear-gradient(180deg, #eef4f8 0%, #dde7ee 100%)",
        zIndex: 9999,
      }}
    >
      <div
        className="load-brand"
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontWeight: 500, fontSize: 44, lineHeight: 1.1,
          letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #0c2a5e 0%, #1558b5 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text",
          WebkitTextFillColor: "transparent", color: "#0c2a5e",
        }}
      >{t("brand")}</div>
      <div className="load-dots" style={{ display: "flex", gap: 7 }}>
        <div className="load-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }}/>
        <div className="load-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#1558b5" }}/>
        <div className="load-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }}/>
      </div>
      <p
        className="load-text"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 11, color: "#f59e0b",
          letterSpacing: "0.2em", textTransform: "uppercase",
          fontWeight: 500, margin: 0,
        }}
      >{t("loading")}</p>
    </div>
  );

  if (error) return (
    <div className="page">
      <div style={{ maxWidth: 380, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌊</div>
        <h2 className="serif" style={{ fontSize: 24, margin: "0 0 8px" }}>{t("error_title")}</h2>
        <p className="mono" style={{ color: "var(--text-mu)", fontSize: 12, margin: "0 0 4px" }}>{t("error_api")}</p>
        <p className="mono" style={{ color: "var(--text-dim)", fontSize: 10, margin: "0 0 28px" }}>{errorDetail}</p>
        <button onClick={fetchAllDays} className="primary-btn">{t("retry")}</button>
        <button onClick={() => setPickerOpen(true)} className="secondary-btn">{t("change_spot")}</button>
      </div>
      {pickerOpen && <BreakPicker onSelect={b => { setSpot(b); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} favorites={favorites} toggleFav={toggleFav} currentId={spot.id} t={t} country={country} setCountry={saveCountry}/>}
    </div>
  );

  const dayEntries = data.days;
  const currentDay = dayEntries[activeDay];
  const dayHours = currentDay ? currentDay[1] : [];
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const isToday = currentDay && currentDay[0] === todayStr;

  let sel;
  if (selected !== null && data.hours[selected]) {
    sel = data.hours[selected];
  } else if (pinnedHour !== null) {
    const padded = String(pinnedHour).padStart(2, "0") + ":";
    sel = dayHours.find(h => h.time.split("T")[1].startsWith(padded)) || dayHours[0];
  } else if (isToday) {
    const nowStr = new Date().toLocaleString("en-CA", { timeZone: tz, hour12: false }).replace(", ", "T");
    const currentHour = nowStr.split("T")[1].split(":")[0];
    sel = dayHours.find(h => h.time.split("T")[1].startsWith(currentHour + ":")) || dayHours[0];
  } else {
    sel = dayHours.find(h => h.time.split("T")[1].startsWith("08:")) || dayHours[0];
  }

  if (!sel) return null;

  const selDayTideCtx = dayTideCtx(dayHours);
  const { score, notes } = scoreSurf(sel, spot, selDayTideCtx);
  const level = getLevel(score, sel, spot);
  const levelMatrix = surfabilityByLevel(sel, spot);
  const bestOfDay = dayHours.reduce((b, h) => {
    const s = scoreSurf(h, spot, selDayTideCtx).score;
    return s > (b?.score ?? -1) ? { ...h, score: s } : b;
  }, null);
  const isFav = favorites.includes(spot.id);
  const faceM = estimateFaceHeight(sel.swellHeight, sel.swellPeriod);
  const faceFtLow = Math.max(1, Math.floor(mToFt(faceM) - 0.5));
  const faceFtHigh = Math.ceil(mToFt(faceM) + 0.5);
  const windKmh = Math.round(knToKmh(sel.windSpeedKn));
  const selIdx = dayHours.indexOf(sel);
  const nextHour = selIdx >= 0 ? dayHours[selIdx + 1] : null;
  const windTrend = (() => {
    if (!nextHour) return null;
    const next = Math.round(knToKmh(nextHour.windSpeedKn));
    const diff = next - windKmh;
    if (Math.abs(diff) < 3) return null;
    return diff > 0 ? "up" : "down";
  })();

  function toggleExpand(timeKey) {
    setExpandedHours(prev => { const n = new Set(prev); n.has(timeKey) ? n.delete(timeKey) : n.add(timeKey); return n; });
  }

  function handleTabClick(di) {
    setActiveDay(di);
    setSelected(null);
    setExpandedHours(new Set());
    setTimeout(() => {
      if (tabsRef.current) {
        const tabEl = tabsRef.current.children[di];
        if (tabEl) tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }, 10);
  }

  return (
    <div className="page">
      <div className="wrap">
        <div className="header">
          <div className="header-top">
            <div className="brand"><span className="now-dot"></span>{t("brand")}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="faq-btn" onClick={() => setFaqOpen(true)}>?</button>
              <button className="lang-btn" onClick={() => setLangOpen(true)}>
                {(LANGUAGES.find(l => l.code === lang) || customLangs.find(c => c.code === lang))?.flag ?? "🌐"} {lang.toUpperCase()}
              </button>
              <button
                className={`fav-btn ${isFav ? "active" : ""}`}
                onClick={() => toggleFav(spot.id)}
              >{isFav ? "★" : "☆"}</button>
            </div>
          </div>
          <button className="spot-btn" onClick={() => setPickerOpen(true)}>
            <span className="spot-name serif">{spot.name}</span>
            <span className="chev">▾</span>
          </button>
          <div className="spot-region">{spot.region} · {t(spot.type || "beach")}{spot.heavy ? ` · ${t("heavy")}` : ""}</div>
        </div>

        <div className="sticky-tabs">
        <div className="tabs" ref={tabsRef}>
          {dayEntries.map(([day], di) => {
            const { label, date } = unifiedTabLabel(day, tz, t);
            const tabTideCtx = dayTideCtx(dayEntries[di][1]);
            const bestHour = dayEntries[di][1].reduce((b, h) => {
              const s = scoreSurf(h, spot, tabTideCtx).score;
              return s > (b?.score ?? -1) ? { h, score: s } : b;
            }, null);
            const bestScore = bestHour?.score ?? 0;
            const lv = getLevel(bestScore, bestHour?.h, spot);
            const todayIdx = dayEntries.findIndex(([d]) => d === todayStr);
            const isPastTab = di < todayIdx;
            return (
              <button key={day} className={`tab ${activeDay===di?"active":""} ${isPastTab?"past-tab":""}`} onClick={() => handleTabClick(di)}>
                <div className="tab-day">{label}</div>
                <div className="tab-date">{date}</div>
                <div className="tab-dot" style={{ background: lv.color }}></div>
              </button>
            );
          })}
        </div>
        </div>

        <div className="verdict">
          {sel.isPast && (
            <div className="history-badge mono">{t("historical")} · {sel.time.split("T")[0]}</div>
          )}
          <div className="verdict-label mono" style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span>{fmtLongDay(sel.time.split("T")[0], tz, t)}</span>
            <select className="hour-select mono" value={data.hours.indexOf(sel)}
              onChange={e => setSelected(parseInt(e.target.value, 10))}>
              {dayHours.map(h => {
                const idx = data.hours.indexOf(h);
                return <option key={h.time} value={idx}>{fmtHour(h.time, tz)}</option>;
              })}
            </select>
          </div>
          <div className="verdict-row">
            <div className="verdict-main serif" style={{ color: level.color }}>{t(level.labelKey)}</div>
            <button className="verdict-score mono" onClick={() => setScoreExplainer(v => !v)}>
              <strong style={{ color: level.color }}>{score}</strong>/{t("score_lbl")} 100
              <span className="score-chev">{scoreExplainer ? "▲" : "▼"}</span>
            </button>
          </div>
          <div className="verdict-sub">{t(level.subKey)}</div>

          {scoreExplainer && (
            <div className="score-explainer">
              <div className="score-explainer-title mono">{t("how_score")}</div>
              <p className="score-explainer-p">{t("score_desc")}</p>
              <div className="score-scale">
                <div className="scale-row"><span className="scale-dot" style={{background:"#15803d"}}/><span className="scale-range mono">75-100</span><span className="scale-desc"><strong>{t("score_75_100")}</strong> — {t("score_rare")}</span></div>
                <div className="scale-row"><span className="scale-dot" style={{background:"#16a34a"}}/><span className="scale-range mono">55-74</span><span className="scale-desc"><strong>{t("score_55_74")}</strong> — {t("score_solid")}</span></div>
                <div className="scale-row"><span className="scale-dot" style={{background:"#65a30d"}}/><span className="scale-range mono">45-54</span><span className="scale-desc"><strong>{t("score_35_54")}</strong> — {t("score_workable")}</span></div>
                <div className="scale-row"><span className="scale-dot" style={{background:"#84cc16"}}/><span className="scale-range mono">35-44</span><span className="scale-desc"><strong>{t("score_35_44")}</strong> — {t("score_scrappy_desc")}</span></div>
                <div className="scale-row"><span className="scale-dot" style={{background:"#ea580c"}}/><span className="scale-range mono">15-34</span><span className="scale-desc"><strong>{t("score_15_34")}</strong> — {t("score_small_fun")}</span></div>
                <div className="scale-row"><span className="scale-dot" style={{background:"#dc2626"}}/><span className="scale-range mono">0-14</span><span className="scale-desc"><strong>{t("score_0_14")}</strong> — {t("score_flat_desc")}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky-info">
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button className="sticky-level-btn mono" onClick={() => setLevelPickerOpen(true)}>
              {userLevel ? t("lvl_" + userLevel) : t("set_your_level")} ▾
            </button>
            <button
              className={`notif-btn mono${notifOptIn ? " on" : ""}`}
              onClick={toggleNotifications}
              title={notifOptIn ? t("notify_off") : t("notify_me")}
              aria-pressed={notifOptIn}>
              {notifOptIn ? "🔔 " + t("notify_on_short") : "🔕"}
            </button>
          </div>
          {(() => {
            if (userLevel) {
              const verdict = getPersonalVerdict(userLevel, sel, spot);
              const tipKey = getPersonalAdviceKey(userLevel, sel, spot);
              const modKey = getPersonalModifier(userLevel, sel, spot);
              const tideMod = getTideModifier(sel, data.hours);
              const verdictLabel = verdict === "yes" ? t("go") : verdict === "ok" ? t("maybe") : t("skip");
              const verdictColor = verdict === "yes" ? "#16a34a" : verdict === "ok" ? "#ea580c" : "#dc2626";
              return (
                <div className="sticky-tip">
                  <strong>{t("lvl_" + userLevel)}</strong> <span style={{ color: verdictColor, fontWeight: 600 }}>· {verdictLabel}</span> — {t(tipKey)}
                  {modKey && <span style={{ display: "block", marginTop: 6, fontSize: 11, color: "var(--text-mu)", fontStyle: "italic" }}>{t(modKey)}</span>}
                  {tideMod && <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "var(--text-mu)", fontStyle: "italic" }}>{t(tideMod)}</span>}
                </div>
              );
            }
            const tipKey = getDayTip(levelMatrix, sel, spot);
            return tipKey ? <div className="sticky-tip">{t(tipKey)}</div> : null;
          })()}
          <div className="face-height">
            <div className="face-label mono">{t("expected_face")}</div>
            <div className="face-value serif">{faceFtLow}–{faceFtHigh} ft</div>
            <div className="face-sub mono">{faceM.toFixed(1)} m · {sel.swellHeight?.toFixed(1)}m @ {sel.swellPeriod?.toFixed(0)}s</div>
            <div className="face-hint">{t(describeFaceHeightKey(faceFtHigh))}</div>
          </div>

          <div className="metrics">
            <div className="metric">
              <div className="metric-label mono">{t("swell")}</div>
              <div className="metric-value">{sel.swellHeight?.toFixed(1)}<span className="metric-unit">m</span></div>
              <div className="metric-sub mono">{t("from")} {degToCompass(sel.swellDir)} · {sel.swellPeriod?.toFixed(0)}s</div>
            </div>
            <div className="metric">
              <div className="metric-label mono">{t("wind")}</div>
              <div className="metric-value">
                {windKmh}<span className="metric-unit">km/h</span>
                {windTrend && <span className="trend" aria-label={windTrend === "up" ? "rising" : "dropping"}>{windTrend === "up" ? "↗" : "↘"}</span>}
              </div>
              <div className="metric-sub mono">
                {degToCompass(sel.windDir)} · {t(getWindTypeKey(sel, spot))}
                {sel.windGustKn != null && Math.round(knToKmh(sel.windGustKn)) >= windKmh + 8 && (
                  <> · {t("gusts")} {Math.round(knToKmh(sel.windGustKn))}</>
                )}
                {sel.rainProb != null ? ` · ${Math.round(sel.rainProb)}% ${t("rain").toLowerCase()}` : ""}
              </div>
            </div>
          </div>

          {(() => {
            const airTemp = sel.airTemp != null ? Math.round(sel.airTemp) : null;
            const seaTemp = dayHours.find(h => h.seaTemp != null)?.seaTemp ?? null;
            const curVel = sel.currentVel;
            const dayKey = sel.time.split("T")[0];
            const sun = data.sunByDay?.[dayKey];
            const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).toLowerCase().replace(" ", "") : null;
            const sunrise = sun ? fmtTime(sun.sunrise) : null;
            const sunset = sun ? fmtTime(sun.sunset) : null;
            const trend = tideTrend(data.hours, sel);
            const nextTide = sel.tideM != null ? findNextTideEvent(data.hours, sel.time) : null;
            const tideArrow = trend === "rising" ? "↗" : trend === "falling" ? "↘" : "";
            if (airTemp == null && seaTemp == null && !sunrise && sel.tideM == null) return null;
            return (
              <div className="temp-strip">
                {airTemp != null && (
                  <div className="temp-item">
                    <div className="temp-label mono">{t("air_temp")}</div>
                    <div className="metric-value">{airTemp}<span className="metric-unit">°C</span></div>
                  </div>
                )}
                {seaTemp != null && (
                  <div className="temp-item">
                    <div className="temp-label mono">{t("water_temp")}</div>
                    <div className="metric-value">{Math.round(seaTemp)}<span className="metric-unit">°C</span></div>
                  </div>
                )}
                {sel.tideM != null && (
                  <div className="temp-item">
                    <div className="temp-label mono">{t("tide")}</div>
                    <div className="metric-value">
                      {tideArrow && <span style={{ fontSize: 14, color: "var(--text-mu)", marginRight: 2 }}>{tideArrow}</span>}
                      {sel.tideM.toFixed(1)}<span className="metric-unit">m</span>
                    </div>
                    {nextTide && (
                      <div className="metric-sub mono">
                        {nextTide.kind === "high" ? "↑" : "↓"} {fmtTime(nextTide.time)}
                      </div>
                    )}
                  </div>
                )}
                {sunrise && sunset && (
                  <div className="temp-item">
                    <div className="temp-label mono">{t("daylight")}</div>
                    <div className="sun-times mono">
                      <span>↑{sunrise}</span>
                      <span>↓{sunset}</span>
                    </div>
                  </div>
                )}
                {curVel != null && curVel > 0.05 && (
                  <div className="temp-item">
                    <div className="temp-label mono">{t("current")}</div>
                    <div className="metric-value">{(curVel * 3.6).toFixed(1)}<span className="metric-unit">km/h</span></div>
                    <div className="metric-sub mono">{degToCompass(sel.currentDir)}</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {dayHours.some(h => h.tideM != null) && (
          <div className="tide-curve-row">
            <TideCurve dayHours={dayHours} selHour={sel} tz={tz} t={t}/>
          </div>
        )}

        <div className="notes-label mono">{t("what_driving")}</div>
        <div className="notes">{notes.map((n, i) => <span key={i} className="note mono">{t(n)}</span>)}</div>

        {bestOfDay && !["score_0_14","score_flat","score_blown"].includes(getLevel(bestOfDay.score, bestOfDay, spot).labelKey) && (
          <div className="best">
            <div className="best-label mono">{t("best_window")}</div>
            <div className="best-text">{t("around")} {fmtHour(bestOfDay.time, tz)} · {bestOfDay.score} {t("score_lbl")}</div>
            <div className="best-sub mono">{bestOfDay.swellHeight?.toFixed(1)}m @ {bestOfDay.swellPeriod?.toFixed(0)}s · {Math.round(knToKmh(bestOfDay.windSpeedKn))}km/h {degToCompass(bestOfDay.windDir)}</div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "32px 0 4px" }}>
          <div className="section-label mono" style={{ margin: 0 }}>{t("hourly")}</div>
          <button className="info-btn" onClick={() => setHoursGuide(v => !v)}>{hoursGuide ? "✕" : "ⓘ"}</button>
        </div>
        {hoursGuide && (
          <div className="hours-guide">
            <div className="guide-color-row">
              {[["#15803d","Pumping"],["#16a34a","Great"],["#65a30d","Good"],["#84cc16","Fun"],["#ea580c","Small"],["#dc2626","Flat"]].map(([c,l]) => (
                <div key={l} style={{ textAlign:"center" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:c, margin:"0 auto 3px" }}/>
                  <div style={{ fontSize:8, color:c, fontFamily:"JetBrains Mono,monospace", fontWeight:500, letterSpacing:"0.04em" }}>{l}</div>
                </div>
              ))}
            </div>
            <div className="guide-item">
              <div style={{ width:28, height:3, background:"var(--bg-hi)", borderRadius:2, overflow:"hidden", flexShrink:0 }}>
                <div style={{ width:"65%", height:"100%", background:"#65a30d" }}/>
              </div>
              <span>{t("guide_bar")}</span>
            </div>
            <div className="guide-item">
              <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:10, color:"var(--text-mu)", minWidth:28 }}>3–4ft</span>
              <span>{t("guide_face")}</span>
            </div>
            <div className="guide-item">
              <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:10, color:"var(--accent)", fontWeight:600, minWidth:28 }}>65</span>
              <span>Score number = précision exacte (0–100)</span>
            </div>
          </div>
        )}
        <div className="hours">
          {dayHours.map((h, i) => {
            const idx = data.hours.indexOf(h);
            const { score: s } = scoreSurf(h, spot, selDayTideCtx);
            const lv = getLevel(s, h, spot);
            const isSel = selected !== null && data.hours[selected] === h;
            const isPanelHour = sel === h;
            const dawn = isDawn(h.time, tz);
            const face = estimateFaceHeight(h.swellHeight, h.swellPeriod);
            const faceLow = Math.max(1, Math.floor(mToFt(face) - 0.5));
            const faceHigh = Math.ceil(mToFt(face) + 0.5);
            return [
              <button key={h.time}
                className={`hour-btn ${isSel?"sel":""}`}
                onClick={() => setSelected(prev => prev === idx ? null : idx)}>
                <div className={`hour-time mono ${dawn?"dawn":""}`}>{fmtHour(h.time, tz)}</div>
                <div className="hour-bar"><div className="hour-bar-fill" style={{ width:`${s}%`, background:lv.color }}/></div>
                <div className="hour-label mono" style={{ color:lv.color }}>
                  <span className="hour-score">{s}</span> {t(lv.labelKey).toUpperCase()}
                </div>
                <div className="hour-stats mono">
                  {faceLow}–{faceHigh}ft · {Math.round(knToKmh(h.windSpeedKn))}km/h
                </div>
              </button>,
              isSel && (
                <div key={`d-${h.time}`} className="hour-detail">
                  <div className="hd-head">
                    <span className="hd-num serif" style={{color:level.color}}>{score}</span>
                    <span className="hd-lbl" style={{color:level.color}}>{t(level.labelKey)}</span>
                    <span className="hd-sep">·</span>
                    <span className="hd-sub mono">{t(level.subKey)}</span>
                  </div>
                  <div className="hd-notes">
                    {notes.map((n,ni) => <span key={ni} className="note mono">{t(n)}</span>)}
                  </div>
                  <div className="hd-grid">
                    {levelMatrix.map(lvl => (
                      <div key={lvl.nameKey} className="hd-cell">
                        <div className="hd-cell-name mono">{t(lvl.nameKey)}</div>
                        <div className={`level-verdict ${lvl.verdict} mono hd-cell-v`}>
                          {lvl.verdict==="yes"?t("go"):lvl.verdict==="ok"?t("maybe"):t("skip")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ];
          })}
        </div>

        <div className="levels">
          <div className="levels-header">
            <span className="levels-label mono">{userLevel ? t("can_you_surf_others") : t("can_you_surf")}</span>
            <button className="level-pick-btn mono" onClick={() => setLevelPickerOpen(true)}>
              {userLevel ? t("lvl_" + userLevel) : t("set_your_level")} ▾
            </button>
          </div>
          {levelMatrix.map((l, idx) => {
            const isUserRow = userLevel && USER_LEVEL_TO_MATRIX[userLevel] === idx;
            return (
              <div key={l.nameKey} className={`level-row ${isUserRow ? "user-level" : ""}`}>
                <div>
                  <div className="level-name">{t(l.nameKey)}{isUserRow && <span className="you-pill mono">{t("you")}</span>}</div>
                  <div className="level-reason">{t(l.reasonKey)}</div>
                </div>
                <div className={`level-verdict ${l.verdict} mono`}>
                  {l.verdict==="yes" ? t("go") : l.verdict==="ok" ? t("maybe") : t("skip")}
                </div>
              </div>
            );
          })}
        </div>

        <div className="disclaimer">{t("disclaimer")}</div>
        <div className="footer-text mono">{t("footer")}</div>
      </div>

      {pickerOpen && <BreakPicker onSelect={b => { setSpot(b); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} favorites={favorites} toggleFav={toggleFav} currentId={spot.id} t={t} country={country} setCountry={saveCountry}/>}
      {langOpen && <LangPicker lang={lang} setLang={setLang} onClose={() => setLangOpen(false)} customLangs={customLangs} onDeleteCustom={deleteCustomLang} onAddLang={() => setShowAddLang(true)} />}
      {showAddLang && <CustomLangModal onSave={saveCustomLang} onClose={() => setShowAddLang(false)} />}
      {levelPickerOpen && <LevelPicker userLevel={userLevel} onPick={saveUserLevel} onClose={() => setLevelPickerOpen(false)} t={t} />}
      {onboardingOpen && <OnboardingModal onPick={finishOnboarding} onSkip={() => finishOnboarding(null)} t={t} />}
      {faqOpen && <FaqSheet onClose={() => setFaqOpen(false)} t={t} />}
      {showPwa && <PwaInstallPrompt onDismiss={dismissPwa} t={t} />}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }

        :root {
          --bg: #eef4f8; --bg-el: #e1ebf2; --bg-hi: #d5e2eb;
          --border: rgba(30,58,90,0.08); --border-str: rgba(30,58,90,0.16);
          --text: #1e2a35; --text-mu: rgba(30,42,53,0.62); --text-dim: rgba(30,42,53,0.38);
          --accent: #0ea5e9; --warn: #d97706; --bad: #dc2626;
        }

        html, body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; font-feature-settings: 'cv11', 'ss01'; letter-spacing: -0.005em; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: rgba(30,58,90,0.15); }
        button, input { font-family: inherit; color: inherit; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .serif { font-family: 'Fraunces', serif; font-optical-sizing: auto; font-variation-settings: "SOFT" 50; }

        .page { min-height: 100vh; background: var(--bg); background-image: linear-gradient(180deg, #eef4f8 0%, #e6eff5 100%); padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
        .wrap { max-width: 440px; margin: 0 auto; padding: 36px 20px 100px; }

        .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: dotBounce 1.2s infinite ease-in-out; }

        .primary-btn { display: block; width: 100%; background: var(--accent); color: #fff; border: none; border-radius: 10px; padding: 14px; font-weight: 600; font-size: 14px; cursor: pointer; margin-bottom: 10px; }
        .secondary-btn { display: block; width: 100%; background: transparent; color: var(--text-mu); border: 1px solid var(--border-str); border-radius: 10px; padding: 14px; font-weight: 500; font-size: 13px; cursor: pointer; }

        .header { margin-bottom: 24px; animation: rise 0.5s ease both; }
        .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .brand { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.18em; color: var(--text-dim); text-transform: uppercase; }
        .now-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-right: 6px; animation: pulse 2s infinite; vertical-align: middle; }
        .spot-btn { background: none; border: none; text-align: left; cursor: pointer; padding: 0; display: flex; align-items: baseline; gap: 8px; color: var(--text); }
        .spot-name { font-weight: 500; font-size: 40px; line-height: 1; letter-spacing: -0.025em; }
        .chev { color: var(--text-dim); font-size: 14px; transform: translateY(-8px); }
        .spot-region { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.15em; color: var(--text-dim); text-transform: uppercase; margin-top: 8px; }
        .fav-btn { background: none; border: 1px solid var(--border); border-radius: 999px; width: 34px; height: 34px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: var(--text-mu); }
        .fav-btn.active { border-color: var(--warn); color: var(--warn); background: rgba(217,119,6,0.08); }
        .lang-btn { background: var(--bg-el); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-family: 'JetBrains Mono', monospace; font-size: 10px; cursor: pointer; color: var(--text-mu); letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px; transition: all 0.15s; }
        .lang-btn:hover { border-color: var(--border-str); color: var(--text); }

        .history-badge { display: inline-block; font-size: 9px; letter-spacing: 0.15em; color: var(--accent); text-transform: uppercase; background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.2); border-radius: 4px; padding: 3px 8px; margin-bottom: 10px; }

        .sticky-tabs { position: sticky; top: 0; z-index: 21; background: var(--bg); margin: 0 -20px 10px; padding: 4px 20px 6px; }
        .tabs { display: flex; gap: 2px; margin-bottom: 0; background: var(--bg-el); padding: 3px; border-radius: 8px; overflow-x: scroll; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; animation: rise 0.5s 0.1s ease both; }
        .tabs::-webkit-scrollbar { display: none; }
        .tab { flex: 0 0 auto; width: 54px; background: none; border: none; padding: 6px 2px; border-radius: 6px; cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--text-mu); touch-action: manipulation; }
        .tab.active { background: var(--bg-hi); }
        .tab.past-tab { opacity: 0.6; }
        .tab-day { font-size: 10px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 52px; text-align: center; }
        .tab.active .tab-day { color: var(--text); }
        .tab-date { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-dim); letter-spacing: 0.02em; }
        .tab.active .tab-date { color: var(--text-mu); }
        .tab-dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 2px; flex-shrink: 0; }

        .verdict { padding: 20px 0 22px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); animation: rise 0.5s 0.15s ease both; }
        .verdict-label { font-size: 10px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 10px; }
        .verdict-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .verdict-main { font-weight: 500; font-size: 58px; line-height: 1; letter-spacing: -0.03em; font-variation-settings: "SOFT" 100; }
        .verdict-score { background: none; border: none; font-size: 12px; color: var(--text-mu); padding-top: 6px; cursor: pointer; display: flex; align-items: baseline; gap: 6px; }
        .verdict-score strong { color: var(--text); font-weight: 600; font-size: 42px; letter-spacing: -0.03em; line-height: 1; }
        .score-chev { font-size: 8px; color: var(--text-dim); }
        .score-explainer { margin-top: 16px; padding: 14px 16px; background: var(--bg-el); border: 1px solid var(--border); border-radius: 8px; animation: rise 0.25s ease both; }
        .score-explainer-title { font-size: 10px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 10px; }
        .score-explainer-p { font-size: 12px; color: var(--text-mu); line-height: 1.5; margin-bottom: 14px; }
        .score-scale { display: flex; flex-direction: column; gap: 6px; }
        .scale-row { display: grid; grid-template-columns: 10px 48px 1fr; align-items: center; gap: 10px; }
        .scale-dot { width: 8px; height: 8px; border-radius: 50%; }
        .scale-range { font-size: 10px; color: var(--text-mu); }
        .scale-desc { font-size: 12px; color: var(--text-mu); line-height: 1.3; }
        .scale-desc strong { color: var(--text); font-weight: 500; }
        .verdict-sub { font-size: 13px; color: var(--text-mu); margin-top: 6px; }
        .verdict-tip { font-size: 13px; color: var(--text); margin-top: 10px; padding: 10px 12px; background: rgba(14,165,233,0.06); border-left: 2px solid var(--accent); border-radius: 4px; line-height: 1.4; }
        .sticky-tip { font-size: 12px; color: var(--text); padding: 6px 9px; background: rgba(14,165,233,0.06); border-left: 2px solid var(--accent); border-radius: 3px; line-height: 1.3; margin: 2px 0 2px; }
        .sticky-level-btn { display: inline-flex; align-items: center; gap: 4px; background: var(--accent); border: none; color: #fff; font-weight: 600; font-size: 11px; letter-spacing: 0.03em; padding: 5px 11px; border-radius: 14px; cursor: pointer; margin: 2px 0 4px; box-shadow: 0 2px 6px rgba(14,165,233,0.25); }
        .sticky-level-btn:hover { filter: brightness(1.08); }
        .share-btn { display: inline-flex; align-items: center; gap: 4px; background: var(--bg-el); border: 1px solid var(--border); color: var(--text-mu); font-weight: 500; font-size: 11px; letter-spacing: 0.03em; padding: 4px 9px; border-radius: 14px; cursor: pointer; margin: 2px 0 4px; }
        .notif-btn { display: inline-flex; align-items: center; gap: 4px; background: var(--bg-el); border: 1px solid var(--border); color: var(--text-mu); font-weight: 500; font-size: 11px; letter-spacing: 0.03em; padding: 4px 9px; border-radius: 14px; cursor: pointer; margin: 2px 0 4px; transition: all 0.15s; }
        .notif-btn:hover { color: var(--text); }
        .notif-btn.on { background: rgba(14,165,233,0.12); border-color: rgba(14,165,233,0.35); color: var(--accent); }
        .share-btn:hover { color: var(--text); }

        .levels { margin-top: 20px; padding-top: 18px; border-top: 1px dashed var(--border); }
        .levels-label { font-size: 10px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; }
        .levels-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 8px; }
        .level-pick-btn { background: var(--accent); border: 1px solid var(--accent); border-radius: 16px; padding: 6px 12px; font-size: 11px; color: #fff; font-weight: 600; letter-spacing: 0.03em; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(14,165,233,0.25); }
        .level-pick-btn:hover { filter: brightness(1.08); }
        .level-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--border); }
        .level-row.user-level { background: rgba(14,165,233,0.05); margin: 0 -10px; padding-left: 10px; padding-right: 10px; border-left: 2px solid var(--accent); }
        .you-pill { display: inline-block; background: var(--accent); color: #fff; font-size: 8px; letter-spacing: 0.1em; padding: 1px 5px; border-radius: 3px; margin-left: 6px; vertical-align: middle; }
        .level-picker-sub { font-size: 13px; color: var(--text-mu); margin: 0 0 14px; line-height: 1.45; font-family: 'Inter', system-ui, sans-serif; }
        .level-item { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; border-top: 1px solid var(--border); padding: 14px 0; cursor: pointer; color: var(--text); text-align: left; font-family: 'Inter', system-ui, sans-serif; }
        .level-item:last-child { border-bottom: 1px solid var(--border); }
        .level-item.active { background: rgba(14,165,233,0.05); margin: 0 -10px; padding-left: 10px; padding-right: 10px; border-left: 2px solid var(--accent); }
        .level-item-title { font-size: 15px; font-weight: 500; color: var(--text); }
        .level-item-sub { font-size: 13px; color: var(--text-mu); margin-top: 3px; line-height: 1.4; }
        .level-item-check { color: var(--accent); font-size: 16px; font-weight: 600; }
        .level-item-clear .level-item-title { color: var(--text-mu); font-weight: 400; }
        .level-row:last-child { border-bottom: 1px solid var(--border); }
        .level-name { font-size: 13px; font-weight: 500; }
        .level-reason { font-size: 11px; color: var(--text-mu); margin-top: 2px; line-height: 1.3; }
        .level-verdict { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.05em; white-space: nowrap; }
        .level-verdict.yes { background: rgba(22,163,74,0.1); color: #16a34a; border: 1px solid rgba(22,163,74,0.25); }
        .level-verdict.ok { background: rgba(217,119,6,0.12); color: var(--warn); border: 1px solid rgba(217,119,6,0.25); }
        .level-verdict.no { background: rgba(220,38,38,0.1); color: var(--bad); border: 1px solid rgba(220,38,38,0.25); }

        .notes { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px; }
        .notes-label { font-size: 10px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; margin-top: 20px; }
        .note { font-size: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; color: var(--text-mu); }

        .sticky-info { position: sticky; top: 58px; z-index: 20; background: var(--bg); margin: 0 -20px; padding: 0 20px; box-shadow: 0 6px 12px -8px rgba(0,0,0,0.15); }
        .face-height { padding: 7px 0 6px; text-align: center; border-bottom: 1px solid var(--border); animation: rise 0.5s 0.2s ease both; }
        .face-label { font-size: 9px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 3px; }
        .face-value { font-weight: 500; font-size: 28px; line-height: 1; letter-spacing: -0.03em; }
        .face-sub { font-size: 10px; color: var(--text-mu); margin-top: 3px; letter-spacing: 0.03em; }
        .face-hint { font-size: 10px; color: var(--text-mu); margin-top: 4px; line-height: 1.3; max-width: 340px; margin-left: auto; margin-right: auto; font-style: italic; }

        .metrics { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--border); animation: rise 0.5s 0.22s ease both; }
        .metric { padding: 7px 0; }
        .metric:first-child { padding-right: 16px; border-right: 1px solid var(--border); }
        .metric:last-child { padding-left: 16px; }
        .metric-label { font-size: 9px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 6px; }
        .metric-value { font-size: 17px; font-weight: 500; letter-spacing: -0.015em; display: flex; align-items: baseline; gap: 4px; }
        .metric-unit { font-size: 12px; color: var(--text-mu); font-weight: 400; }
        .trend { font-size: 14px; color: var(--text-dim); margin-left: 6px; line-height: 1; }
        .sun-times { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: var(--text); line-height: 1.3; }
        .sun-times span { white-space: nowrap; }
        .metric-sub { font-size: 10px; color: var(--text-mu); margin-top: 4px; }

        .temp-strip { display: flex; border-bottom: 1px solid var(--border); animation: rise 0.5s 0.22s ease both; }
        .temp-item { flex: 1; min-width: 0; padding: 6px 0; border-right: 1px solid var(--border); overflow: hidden; }
        .tide-curve-row { padding: 8px 0 14px; }
        .tide-curve-wrap { padding: 4px 0; }
        .tide-curve-label { font-size: 9px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 6px; text-align: center; }
        .temp-item:last-child { border-right: none; padding-left: 14px; }
        .temp-item:not(:first-child) { padding-left: 14px; }
        .temp-label { font-size: 9px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 6px; }

        .best { margin-top: 20px; padding: 14px 16px; background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.25); border-radius: 8px; animation: rise 0.5s 0.25s ease both; }
        .best-label { font-size: 10px; letter-spacing: 0.2em; color: var(--accent); text-transform: uppercase; margin-bottom: 6px; }
        .best-text { font-size: 15px; font-weight: 500; }
        .best-sub { font-size: 10px; color: var(--text-mu); margin-top: 4px; }

        .section-label { font-size: 10px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; margin: 32px 0 4px; }
        .hours { animation: rise 0.5s 0.3s ease both; }
        .hour-btn { display: grid; grid-template-columns: 52px 1fr 96px 86px; align-items: center; gap: 10px; background: none; border: none; border-top: 1px solid var(--border); padding: 10px 0; cursor: pointer; text-align: left; transition: all 0.15s; width: 100%; color: var(--text); }
        .hour-btn:last-child { border-bottom: 1px solid var(--border); }
        .hour-btn.sel { background: rgba(14,165,233,0.08); margin: 0 -20px; padding-left: 16px; padding-right: 20px; width: calc(100% + 40px); border-left: 3px solid var(--accent); border-top-color: transparent; }
        .hour-btn.sel .hour-time { color: var(--text); font-weight: 600; }
        .hour-time { font-size: 11px; color: var(--text-mu); }
        .hour-bar { height: 3px; background: rgba(255,255,255,0.04); border-radius: 2px; overflow: hidden; }
        .hour-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
        .hour-label { font-size: 9px; text-align: right; letter-spacing: 0.06em; font-weight: 600; white-space: nowrap; }
        .hour-score { font-weight: 700; margin-right: 2px; }
        .hour-stats { font-size: 9px; color: var(--text-dim); text-align: right; line-height: 1.4; }
        .hour-btn.sel .hour-stats { color: var(--text-mu); }
        .hour-btn.hour-sub { border-top: 1px solid rgba(14,165,233,0.15); background: rgba(14,165,233,0.03); }
        .expand-chev { font-size: 7px; color: var(--accent); opacity: 0.5; margin-left: 2px; }

        .hour-detail { border-bottom: 1px solid var(--border); padding: 10px 20px 12px; margin: 0 -20px; background: rgba(14,165,233,0.04); animation: rise 0.2s ease both; }
        .hd-head { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; margin-bottom: 7px; }
        .hd-num { font-size: 24px; font-weight: 500; line-height: 1; letter-spacing: -0.02em; font-variation-settings: "SOFT" 100; }
        .hd-lbl { font-size: 14px; font-weight: 500; letter-spacing: -0.01em; }
        .hd-sep { color: var(--text-dim); font-size: 10px; }
        .hd-sub { font-size: 10px; color: var(--text-mu); }
        .hd-notes { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
        .hd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
        .hd-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .hd-cell-name { font-size: 8px; color: var(--text-dim); letter-spacing: 0.06em; text-transform: uppercase; }
        .hd-cell-v { font-size: 8px !important; padding: 2px 4px !important; }

        .disclaimer { font-size: 10px; color: var(--text-mu); text-align: center; margin-top: 36px; line-height: 1.5; max-width: 360px; margin-left: auto; margin-right: auto; font-style: italic; opacity: 0.75; }
        .footer-text { font-size: 9px; color: var(--text-dim); text-align: center; margin-top: 10px; letter-spacing: 0.05em; }
        .sticky-bar { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(238,244,248,0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--border-str); padding: 8px 16px 12px; display: flex; align-items: center; gap: 10px; z-index: 50; }
        .sb-time { font-size: 10px; color: var(--text-dim); min-width: 34px; }
        .sb-score { font-size: 22px; font-weight: 500; line-height: 1; min-width: 28px; }
        .sb-divider { width: 1px; height: 28px; background: var(--border-str); flex-shrink: 0; }
        .sb-col { display: flex; flex-direction: column; gap: 1px; }
        .sb-lbl { font-size: 8px; color: var(--text-dim); letter-spacing: 0.15em; text-transform: uppercase; }
        .sb-val { font-size: 10px; color: var(--text); font-weight: 500; }

        .faq-btn { background: var(--bg-el); border: 1px solid var(--border); border-radius: 6px; width: 28px; height: 28px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-mu); display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .faq-btn:hover { border-color: var(--border-str); color: var(--text); }
        .faq-item { border-top: 1px solid var(--border); }
        .faq-q { display: flex; justify-content: space-between; align-items: center; width: 100%; background: none; border: none; padding: 14px 0; cursor: pointer; text-align: left; font-size: 13px; font-weight: 500; color: var(--text); gap: 12px; }
        .faq-chev { font-size: 8px; color: var(--text-dim); flex-shrink: 0; }
        .faq-a { font-size: 12px; color: var(--text-mu); line-height: 1.6; padding-bottom: 14px; }

        .info-btn { background: none; border: none; cursor: pointer; color: var(--accent); font-size: 14px; padding: 2px 4px; opacity: 0.7; transition: opacity 0.15s; }
        .pin-btn { background: none; border: none; cursor: pointer; color: var(--accent); font-size: 11px; padding: 0 2px; opacity: 0.6; transition: opacity 0.15s; line-height: 1; }
        .pin-btn:hover { opacity: 1; }
        .hour-select { background: none; border: none; border-bottom: 1px solid var(--border-str); color: var(--text-mu); font-size: 10px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.1em; cursor: pointer; padding: 0 2px; outline: none; -webkit-appearance: auto; }
        .info-btn:hover { opacity: 1; }
        .hours-guide { background: rgba(14,165,233,0.06); border: 1px solid rgba(14,165,233,0.2); border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; animation: rise 0.2s ease both; }
        .guide-color-row { display: flex; justify-content: space-around; padding-bottom: 6px; border-bottom: 1px solid rgba(14,165,233,0.15); margin-bottom: 2px; }
        .guide-item { display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--text-mu); }

        .pwa-banner { position: fixed; bottom: 0; left: 0; right: 0; z-index: 200; background: var(--bg-el); border-top: 1px solid var(--border-str); padding: 14px 20px calc(14px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 12px; animation: slideUp 0.3s ease both; box-shadow: 0 -4px 24px rgba(0,0,0,0.12); }
        .pwa-icon { font-size: 28px; flex-shrink: 0; }
        .pwa-content { flex: 1; min-width: 0; }
        .pwa-title { font-weight: 600; font-size: 13px; color: var(--text); margin-bottom: 3px; }
        .pwa-instructions { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-mu); line-height: 1.4; }
        .pwa-close { background: none; border: 1px solid var(--border); border-radius: 999px; width: 28px; height: 28px; flex-shrink: 0; cursor: pointer; font-size: 11px; color: var(--text-mu); display: flex; align-items: center; justify-content: center; }

        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(8px); z-index: 100; display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.2s; }
        .sheet { width: 100%; max-width: 440px; max-height: 88vh; background: var(--bg-el); border: 1px solid var(--border); border-bottom: none; border-radius: 16px 16px 0 0; overflow-y: auto; -webkit-overflow-scrolling: touch; animation: slideUp 0.3s ease; }
        .handle { width: 34px; height: 3px; background: rgba(30,58,90,0.15); border-radius: 2px; margin: 10px auto 0; }
        .sheet-body { padding: 8px 20px 40px; }
        .sheet-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; }
        .sheet-title { font-family: 'Fraunces', serif; font-weight: 500; font-size: 26px; letter-spacing: -0.02em; }
        .close-btn { background: none; border: 1px solid var(--border); border-radius: 999px; width: 28px; height: 28px; cursor: pointer; font-size: 11px; color: var(--text-mu); }
        .search-input { flex: 1; background: rgba(255,255,255,0.5); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 13px; outline: none; color: var(--text); }
        .search-input::placeholder { color: var(--text-dim); }
        .search-input:focus { border-color: var(--border-str); }
        .search-btn { background: rgba(255,255,255,0.5); border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; cursor: pointer; font-size: 13px; color: var(--text); }
        .region-header { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; margin: 14px 0 4px; }
        .break-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 0; border-top: 1px solid var(--border); }
        .break-row.current { background: rgba(14,165,233,0.08); margin: 0 -20px; padding-left: 20px; padding-right: 20px; }
        .break-row-main { flex: 1; background: none; border: none; text-align: left; padding: 0; cursor: pointer; color: var(--text); }
        .break-row-title { font-size: 14px; font-weight: 500; }
        .break-row-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-mu); margin-top: 2px; }
        .break-row-fav { background: none; border: none; cursor: pointer; font-size: 14px; padding: 6px; color: var(--text-mu); }
        .break-row-fav.active { color: var(--warn); }
        .break-row-flag { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-mu); font-weight: 400; margin-left: 4px; }
        .break-empty { font-size: 11px; color: var(--text-mu); padding: 12px 0; text-align: center; letter-spacing: 0.04em; }
        .country-btn { width: 100%; background: var(--bg-el); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 500; color: var(--text); cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .locate-btn { width: 100%; background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.3); border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 500; color: var(--accent); cursor: pointer; margin-bottom: 8px; }
        .locate-btn:disabled { opacity: 0.6; cursor: default; }
        .country-list { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; max-height: 260px; overflow-y: auto; background: var(--bg); }
        .country-row { width: 100%; background: none; border: none; border-bottom: 1px solid var(--border); padding: 10px 14px; font-size: 13px; color: var(--text); cursor: pointer; display: flex; justify-content: space-between; align-items: center; text-align: left; }
        .country-row:last-child { border-bottom: none; }
        .country-row.active { background: rgba(14,165,233,0.06); }
        .country-row:hover { background: rgba(0,0,0,0.03); }

        .lang-row { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: none; border-top: 1px solid var(--border); padding: 14px 0; cursor: pointer; color: var(--text); text-align: left; }
        .lang-row.active { color: var(--accent); }
        .lang-flag { font-size: 20px; line-height: 1; }
        .lang-name { font-size: 14px; font-weight: 500; flex: 1; }
        .lang-check { font-size: 12px; color: var(--accent); font-weight: 600; }

        @keyframes rise { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes dotBounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
      `}</style>
    </div>
  );
}
