// v2 verdict + score breakdown + level matrix — ported from export-v2/v2-main.jsx + mock.js
// Pure functions; no window globals, no React, safe in both server + client.

export const SCORE_SCALE = [
  { key: "unreal",    min: 75, max: 100, color: "#1d6a5b", label: "Unreal",    sub: "Prime, memorable conditions — rearrange your day." },
  { key: "excellent", min: 55, max: 74,  color: "#2d9178", label: "Excellent", sub: "Clean, well-shaped, worth going out of your way." },
  { key: "good",      min: 45, max: 54,  color: "#62a06a", label: "Good",      sub: "Solid session — you'll enjoy it." },
  { key: "fair",      min: 35, max: 44,  color: "#a4a558", label: "Fair",      sub: "Surfable but unremarkable." },
  { key: "poor",      min: 15, max: 34,  color: "#d47559", label: "Poor",      sub: "Marginal — longboard or wait for better." },
  { key: "skip",      min: 0,  max: 14,  color: "#b54c3f", label: "Skip",      sub: "Not worth paddling today." },
];

export function getLevel(s) {
  return SCORE_SCALE.find((x) => s >= x.min && s <= x.max) || SCORE_SCALE[5];
}

// Coherent verdict: label + colour + sub derived purely from the numeric
// score. No contextual overrides — the label is the same for a flat day
// and a blown-out day at score 5, because the surf value is the same
// ("Skip"). The *why* shows up in the personal tip + ScoreSheet
// breakdown, not in the top-line label.
export function coherentVerdict(h) {
  const score = h.score || 0;
  const s = getLevel(score);
  return { key: s.key, label: s.label, color: s.color, sub: s.sub };
}

// Score breakdown: explains the 0-100 score with weighted factors.
// Takes the spot in argument so the swell-direction bullet can be computed
// against THIS spot's idealSwellDir instead of a hardcoded SW list — that
// list was correct for WA but wrong for Bondi (SE), Pipeline (NW), Hossegor
// (WNW), etc. The modal "How this score is built" now reads the same axis
// scoreSurf uses, so it can no longer say "off-axis 8/20" on a 80+ score day.
export function scoreBreakdown(h, spot) {
  const face = (h.faceFtLow + h.faceFtHigh) / 2;
  const period = typeof h.swellPeriod === "number" ? h.swellPeriod : 0;
  const wind = typeof h.windKmh === "number" ? h.windKmh : 0;
  const dirCardinal = typeof h.swellDir === "string" ? h.swellDir : "—";
  const dirDeg = h.swellDirDeg != null ? h.swellDirDeg : (typeof h.swellDir === "number" ? h.swellDir : null);
  const type = (h.windType || "").toLowerCase();

  let sizePts = 0, sizeNote = "";
  if (face < 1) { sizePts = 4;  sizeNote = "Almost flat"; }
  else if (face < 2) { sizePts = 12; sizeNote = "Small"; }
  else if (face < 3) { sizePts = 22; sizeNote = "Knee–waist, learn-friendly"; }
  else if (face <= 6) { sizePts = 30; sizeNote = "Sweet spot"; }
  else if (face <= 9) { sizePts = 24; sizeNote = "Overhead — for confident surfers"; }
  else { sizePts = 14; sizeNote = "Big — limits the crowd"; }

  let perPts = 0, perNote = "";
  if (period < 8)       { perPts = 6;  perNote = "Short period — windswell"; }
  else if (period < 11) { perPts = 14; perNote = "Mixed swell"; }
  else if (period < 14) { perPts = 22; perNote = "Decent groundswell"; }
  else                  { perPts = 25; perNote = "Long-period groundswell"; }

  // Direction score — same equation as scoreSurf's swellDelta. ≤30° from
  // the spot's ideal angle = ideal, ≤60° = workable, beyond = off-axis.
  // Falls back to the old hardcoded WA list if the spot has no
  // idealSwellDir at all (very early, pre-inferSpotProfile path).
  let dirPts = 0, dirNote = "";
  if (spot && spot.idealSwellDir != null && dirDeg != null) {
    const delta = Math.abs(((dirDeg - spot.idealSwellDir + 540) % 360) - 180);
    if (delta <= 30) { dirPts = 20; dirNote = `${dirCardinal} — ideal angle`; }
    else if (delta <= 60) { dirPts = 14; dirNote = `${dirCardinal} — workable angle`; }
    else { dirPts = 8; dirNote = `${dirCardinal} — off-axis`; }
  } else {
    const ideal = ["SW", "WSW", "S", "SSW"];
    if (ideal.includes(dirCardinal)) { dirPts = 20; dirNote = `${dirCardinal} — ideal angle`; }
    else if (["W", "SE"].includes(dirCardinal)) { dirPts = 14; dirNote = `${dirCardinal} — workable angle`; }
    else { dirPts = 8; dirNote = `${dirCardinal} — off-axis`; }
  }

  let windPts = 0, windNote = "";
  if (type.includes("offshore") && wind < 12) { windPts = 25; windNote = "Light offshore — glassy"; }
  else if (type.includes("offshore"))         { windPts = 22; windNote = "Offshore"; }
  else if (wind < 10)                          { windPts = 20; windNote = "Light winds"; }
  else if (type.includes("cross") && wind < 20){ windPts = 14; windNote = "Cross-shore, manageable"; }
  else if (type.includes("cross"))             { windPts = 8;  windNote = "Strong cross-shore"; }
  else if (wind < 18)                          { windPts = 10; windNote = "Light onshore"; }
  else                                         { windPts = 3;  windNote = "Onshore — blown out"; }

  const total = sizePts + perPts + dirPts + windPts;
  return {
    total,
    factors: [
      { key: "size",   label: "Wave size",       value: `${h.faceFtLow}–${h.faceFtHigh} ft`, pts: sizePts, max: 30, note: sizeNote },
      { key: "period", label: "Swell period",    value: `${period.toFixed(0)}s`,              pts: perPts,  max: 25, note: perNote  },
      { key: "dir",    label: "Swell direction", value: dirCardinal,                          pts: dirPts,  max: 20, note: dirNote  },
      { key: "wind",   label: "Wind",            value: `${Math.round(wind)} km/h ${type || ""}`.trim(), pts: windPts, max: 25, note: windNote },
    ],
  };
}

export function drivingChipsFor(h, spot) {
  const chips = [];
  if (h.swellPeriod < 9) chips.push({ t: "Short-period swell", k: "neg" });
  else if (h.swellPeriod >= 12) chips.push({ t: "Long-period groundswell", k: "pos" });
  if (h.swellHeight >= 0.9 && h.swellHeight <= 2.0) chips.push({ t: "Good size", k: "pos" });
  else if (h.swellHeight < 0.6) chips.push({ t: "Small swell", k: "neg" });
  // Spot-aware direction. Uses idealSwellDir when available (so Bondi
  // gets credit for SE swell and Hossegor for W swell). Falls back to
  // the legacy WA-only list if no spot is given — shouldn't happen in
  // practice now that drivingChipsFor is always called with the spot.
  const dirDeg = h.swellDirDeg != null ? h.swellDirDeg : (typeof h.swellDir === "number" ? h.swellDir : null);
  if (spot && spot.idealSwellDir != null && dirDeg != null) {
    const delta = Math.abs(((dirDeg - spot.idealSwellDir + 540) % 360) - 180);
    if (delta <= 30) chips.push({ t: "Ideal swell direction", k: "pos" });
  } else if (typeof h.swellDir === "string" && ["SW", "WSW", "W", "SSW"].includes(h.swellDir)) {
    chips.push({ t: "Ideal swell direction", k: "pos" });
  }
  if (h.windKmh >= 25) chips.push({ t: "Strong cross-shore", k: "neg" });
  else if (h.windKmh <= 10) chips.push({ t: "Light winds", k: "pos" });
  else if ((h.windType || "").toLowerCase().includes("off")) chips.push({ t: "Offshore wind", k: "pos" });
  // Tide chip — only emitted if the score notes actually contain a positive
  // tide signal. The previous unconditional "Tide in the sweet spot" lied
  // half the time (n_tide_wrong / n_tide_ok / nothing in notes → still a
  // green chip). Now reads h.notes which scoreSurf populates with the
  // tide tag for the day's tide vs the spot's idealTide.
  if (Array.isArray(h.notes)) {
    if (h.notes.includes("n_tide_prime")) chips.push({ t: "Tide in the sweet spot", k: "pos" });
    else if (h.notes.includes("n_tide_wrong")) chips.push({ t: "Wrong tide for this spot", k: "neg" });
  }
  return chips;
}

// Short plain-English reason per level, derived from the same
// classifyConditions / verdict logic the main score uses. Keeps the
// "Can you surf?" block consistent with the top-of-screen number.
function shortReason(userLevel, cls, foamie, period, verdict) {
  const { size, wind, reefTooMuch, currentHazard, faceFt } = cls;
  if (currentHazard === "dangerous") return "Dangerous rip — stay out";
  if (reefTooMuch) return "Reef / heavy spot — too risky";
  // Inside-reform rescue only applies when the verdict actually came back
  // as something other than "no". If getPersonalVerdict decided the wind
  // is beyond reform (e.g. 30+ km/h onshore), we say so honestly instead
  // of suggesting the reform they can't actually ride.
  if (verdict !== "no" && foamie && (size === "too_big" || size === "upper" || wind === "blown") && faceFt <= 10 && faceFt >= 0.3) {
    if (userLevel === "first_timer" || userLevel === "beginner") {
      return "Foamie inside — ride the reform";
    }
    return "Bail the peak — take the inside reform";
  }
  if (size === "too_small") return "Too small — not enough push";
  if (size === "too_big") return faceFt > 12 ? "Way over your head" : "Too big for this level";
  if (wind === "blown") return "Blown out — wind trashing the shape";
  if (size === "sweet" && wind === "clean") {
    return period >= 12 ? "Prime groundswell — right in your zone" : "Clean + in your zone — go";
  }
  if (size === "sweet") return "Right size, a bit of texture on the face";
  if (size === "upper") return wind === "clean" ? "On the big side but clean" : "Big and bumpy — pick sets carefully";
  if (size === "small") return wind === "clean" ? "Small + clean — good practice session" : "Small + wind texture — fun only";
  return "";
}

// Build the per-level matrix using the same classifyConditions + verdict
// logic as the main score. Takes the raw hour + spot + the prodScoring
// function refs (injected to avoid a circular import) so reasons reflect
// the real ideal-direction / offshore-wind / spot-type / heavy flags.
// Falls back to a face-only heuristic if fns/spot aren't provided.
export function levelMatrixFor(hour, spot, fns) {
  const rows = [
    { key: "beginner", name: "Beginner",     level: "beginner" },
    { key: "eint",     name: "Early Int.",   level: "early_int" },
    { key: "int",      name: "Intermediate", level: "intermediate" },
    { key: "adv",      name: "Advanced",     level: "advanced" },
    { key: "exp",      name: "Expert",       level: "expert" },
  ];

  if (!fns || !fns.classifyConditions || !fns.getPersonalVerdict || !fns.hasInsideReform || !spot) {
    const face = (hour.faceFtLow + hour.faceFtHigh) / 2;
    return rows.map((r) => ({
      ...r,
      verdict: face < 1 ? "no" : face > 10 ? "no" : "ok",
      reason: face < 1 ? "Flat" : face > 10 ? "Huge" : "Surfable",
    }));
  }

  const { classifyConditions, getPersonalVerdict, hasInsideReform } = fns;
  const hDeg = { ...hour, swellDir: hour.swellDirDeg ?? hour.swellDir, windDir: hour.windDirDeg ?? hour.windDir };
  return rows.map((r) => {
    const cls = classifyConditions(r.level, hDeg, spot);
    const verdict = getPersonalVerdict(r.level, hDeg, spot);
    // Pass hasInsideReform as the "foamie" flag — shortReason treats it
    // as "can use the inside-reform rescue", which covers first_timer,
    // beginner AND early_int (not just the foamie-eligible subset).
    const foamie = hasInsideReform(r.level, cls.faceFt, spot);
    const reason = shortReason(r.level, cls, foamie, hDeg.swellPeriod || 0, verdict);
    return { ...r, verdict, reason };
  });
}

export const LEVEL_TO_MATRIX_IDX = {
  first_timer: 0, beginner: 0, early_int: 1, intermediate: 1, advanced: 2, expert: 3,
};
