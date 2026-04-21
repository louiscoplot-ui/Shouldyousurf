// v2/lib/prodScoring.js — mirrors the production scoring engine in app/page.js.
// Kept isolated so the v2 preview can evolve the visual design without diverging
// from the canonical surf logic. Any update to the scoring rules must land in
// both files (or be extracted to a third shared module) — for now we copy.

export const TZ_DEFAULT = "Australia/Perth";
export const mToFt = m => m * 3.281;
export const knToKmh = kn => kn * 1.852;

export function estimateFaceHeight(swellHeight, swellPeriod) {
  const periodFactor = Math.min(1.8, Math.max(0.7, swellPeriod / 10));
  return swellHeight * periodFactor;
}

export const TIDE_TARGETS = { "low": 0.1, "mid-low": 0.3, "mid": 0.5, "mid-high": 0.7, "high": 0.9 };

export function scoreSurf(h, spot, tideCtx) {
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

export function surfabilityByLevel(h, spot) {
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

export function getDayTip(levelMatrix, h, spot) {
  if (!levelMatrix) return null;
  const v = levelMatrix.map(l => l.verdict);
  const [beg, int, adv, exp] = v;
  const faceFt = mToFt(estimateFaceHeight(h.swellHeight, h.swellPeriod));
  const yesCount = v.filter(x => x === "yes").length;
  const noCount = v.filter(x => x === "no").length;
  if (noCount >= 3) return "tip_skip_all";
  if (yesCount === 4) return "tip_all_levels";
  if (beg === "no" && (adv === "yes" || exp === "yes")) {
    return faceFt >= 4 ? "tip_advanced" : "tip_int_adv";
  }
  if (beg === "ok" && (int === "yes" || adv === "yes")) return "tip_inside_split";
  if (beg === "yes" && int !== "yes" && adv !== "yes") return "tip_beginner";
  if (int === "yes" && beg !== "yes") return "tip_int_adv";
  if (beg === "yes" && (int === "yes" || int === "ok")) return "tip_all_levels";
  return "tip_marginal";
}

export function findNextTideEvent(hours, fromTime) {
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

export function dayTideCtx(dayHours) {
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

export function tideTrend(hours, sel) {
  if (!hours || !sel) return null;
  const idx = hours.findIndex(h => h.time === sel.time);
  if (idx < 1 || sel.tideM == null) return null;
  const prev = hours[idx - 1]?.tideM;
  if (prev == null) return null;
  const diff = sel.tideM - prev;
  if (Math.abs(diff) < 0.05) return "steady";
  return diff > 0 ? "rising" : "falling";
}

// v1 getWindTypeKey — returns translation key ("offshore"/"onshore"/"cross_shore")
// so the wind sub can read "S · cross-shore" in 12 languages.
export function getWindTypeKey(sel, spot) {
  const d = Math.abs(((sel.windDir - spot.offshoreWindDir + 540) % 360) - 180);
  if (d <= 45) return "offshore";
  if (d >= 135) return "onshore";
  return "cross_shore";
}

export function getLevel(s, h, spot) {
  if (h && spot) {
    const faceFt = mToFt(estimateFaceHeight(h.swellHeight, h.swellPeriod));
    const kmh = knToKmh(h.windSpeedKn);
    const windDelta = Math.abs(((h.windDir - spot.offshoreWindDir + 540) % 360) - 180);
    const isOffshore = windDelta <= 45;

    if (faceFt < 1) {
      return { labelKey: "score_flat", subKey: "score_flat_sub", color: "#dc2626" };
    }
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

export function degToCompass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function fmtHour(iso, tz) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).toLowerCase().replace(" ", "");
}

export function fmtLongDay(isoDate, tz, t) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dayDate = new Date(Date.UTC(y, mo - 1, d, 12));
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const diffDays = Math.round((dayDate.getTime() - new Date(todayStr + "T12:00:00Z").getTime()) / (1000*60*60*24));
  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("tomorrow");
  if (diffDays === -1) return t("yesterday");
  return dayDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function offsetDate(isoDate, n) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function unifiedTabLabel(isoDate, tz, t) {
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

// ── Per-user-level advice ──────────────────────────────────────────────
export const USER_LEVELS = ["first_timer", "beginner", "early_int", "intermediate", "advanced", "expert"];
export const USER_LEVEL_TO_MATRIX = { first_timer: 0, beginner: 0, early_int: 1, intermediate: 1, advanced: 2, expert: 3 };
export const USER_LEVEL_BIAS = { first_timer: "down", early_int: "down" };

export const USER_LEVEL_ZONES = {
  first_timer:  { min: 0.3, sweetLo: 0.6, sweetHi: 1.5, upperMax: 2.2 },
  beginner:     { min: 0.3, sweetLo: 1,   sweetHi: 2,   upperMax: 3 },
  early_int:    { min: 1.2, sweetLo: 1.8, sweetHi: 3,   upperMax: 4 },
  intermediate: { min: 1.5, sweetLo: 2.5, sweetHi: 4.5, upperMax: 6 },
  advanced:     { min: 2,   sweetLo: 3,   sweetHi: 7,   upperMax: 10 },
  expert:       { min: 2.5, sweetLo: 4,   sweetHi: 10,  upperMax: 16 },
};

export function classifyConditions(userLevel, h, spot) {
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
  if ((isOffshore && kmh < 30) || kmh < 10) wind = "clean";
  else if ((!isOffshore && kmh >= 25) || kmh >= 40) wind = "blown";
  else wind = "bumpy";

  const reefTooMuch = (spot.heavy || spot.type === "reef") && (userLevel === "first_timer" || userLevel === "beginner");
  return { size, wind, reefTooMuch, faceFt };
}

export function isFoamieFriendly(userLevel, spot) {
  return (userLevel === "first_timer" || userLevel === "beginner")
    && spot.type !== "reef" && !spot.heavy;
}

export function hasInsideReform(userLevel, faceFt, spot) {
  return isFoamieFriendly(userLevel, spot) && faceFt <= 10;
}

export function getPersonalAdviceKey(userLevel, h, spot) {
  const { size, wind, reefTooMuch, faceFt } = classifyConditions(userLevel, h, spot);
  if (reefTooMuch) return "tip_" + userLevel + "_reef";
  const foamie = hasInsideReform(userLevel, faceFt, spot);
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

export function getPersonalModifier(userLevel, h, spot) {
  const { size, wind, reefTooMuch } = classifyConditions(userLevel, h, spot);
  if (reefTooMuch) return null;
  if (size === "too_small" || size === "too_big") return null;
  if (wind === "blown") return null;

  const period = h.swellPeriod || 0;
  const dirDelta = Math.abs(((h.swellDir - spot.idealSwellDir + 540) % 360) - 180);
  const isLearner = userLevel === "first_timer" || userLevel === "beginner" || userLevel === "early_int";

  if (period >= 14 && (size === "sweet" || size === "upper")) return "tip_mod_long_period";
  if (period > 0 && period < 8 && isLearner && (size === "sweet" || size === "small")) return "tip_mod_short_period";
  if (dirDelta > 75) return "tip_mod_off_angle";
  if (wind === "clean" && knToKmh(h.windSpeedKn) < 8) return "tip_mod_glassy";
  return null;
}

export function getTideModifier(sel, hours) {
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

export function getPersonalVerdict(userLevel, h, spot) {
  const { size, wind, reefTooMuch, faceFt } = classifyConditions(userLevel, h, spot);
  if (reefTooMuch) return "no";
  if (isFoamieFriendly(userLevel, spot)) {
    if (faceFt < 0.3) return "no";
    if (faceFt > 10) return "no";
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

export function inferSpotProfile(allHours) {
  if (!allHours || allHours.length < 5) return null;
  const dirs = allHours.map(h => h.swellDir).filter(d => d != null && d >= 0);
  if (dirs.length < 5) return null;
  let sumX = 0, sumY = 0;
  for (const d of dirs) {
    sumX += Math.cos(d * Math.PI / 180);
    sumY += Math.sin(d * Math.PI / 180);
  }
  const avg = (Math.atan2(sumY, sumX) * 180 / Math.PI + 360) % 360;
  return { idealSwellDir: avg, offshoreWindDir: (avg + 180) % 360 };
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
