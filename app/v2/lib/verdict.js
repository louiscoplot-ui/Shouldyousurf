// v2 verdict + score breakdown + level matrix — ported from export-v2/v2-main.jsx + mock.js
// Pure functions; no window globals, no React, safe in both server + client.

export const SCORE_SCALE = [
  { key: "pumping", min: 75, max: 100, color: "#1d6a5b", label: "Pumping", sub: "Prime, memorable conditions" },
  { key: "great",   min: 55, max: 74,  color: "#2d9178", label: "Great",   sub: "Clean, well-shaped" },
  { key: "good",    min: 45, max: 54,  color: "#62a06a", label: "Good",    sub: "Solid session" },
  { key: "fun",     min: 35, max: 44,  color: "#a4a558", label: "Fun",     sub: "Surfable but unremarkable" },
  { key: "junky",   min: 15, max: 34,  color: "#d47559", label: "Junky",   sub: "Waves but messy — pick and choose" },
  { key: "skip",    min: 0,  max: 14,  color: "#b54c3f", label: "Skip",    sub: "Not worth paddling" },
];

export function getLevel(s) {
  return SCORE_SCALE.find((x) => s >= x.min && s <= x.max) || SCORE_SCALE[5];
}

// Coherent verdict: label derived from BOTH score and conditions.
// "Flat" is reserved for "no swell at all — good for a swim" (swellHeight
// < 0.4 m AND score low). If there IS swell but wind is trashing it, the
// label reads "Blown out" (or "Junky" for marginal cases) — users were
// getting confused by "Flat" on a big windy day.
export function coherentVerdict(h) {
  const face = (h.faceFtLow + h.faceFtHigh) / 2;
  const windType = (h.windType || "").toLowerCase();
  const cross = windType.includes("cross");
  const on    = windType.includes("onshore");
  const off   = windType.includes("offshore");
  const kmh   = h.windKmh || 0;
  const score = h.score || 0;
  const swellH = h.swellHeight || 0;

  // Truly no waves — swell height negligible. Only place the "Flat" label
  // fires. Short sub copy explicitly says "no waves" so users don't think
  // the app is calling good-size windy days "Flat".
  if (swellH < 0.4 && face < 1) {
    return { key: "flat", label: "Flat", color: "#94a3a0",
             sub: "No waves — good for a swim, not for a surf." };
  }

  // Blown out: there ARE waves but wind has trashed them. Fires whenever
  // the score is low AND there's enough swell to matter, OR the wind is
  // genuinely heavy even if the score is borderline.
  const heavyWind = (on && kmh >= 22) || (cross && kmh >= 30) || (off && kmh >= 55) || kmh >= 38;
  if (swellH >= 0.4 && heavyWind && score < 55) {
    return { key: "blown", label: "Blown out", color: "#b54c3f",
             sub: "Waves are there, wind is killing the shape. Not worth paddling." };
  }

  // Tiny but clean — shown as "Small" rather than "Junky" so users don't
  // think small clean days are bad, they're just not scoring sessions.
  if (face < 1.5 && !heavyWind) {
    return { key: "small", label: "Small", color: "#d47559",
             sub: "Tiny waves — longboard practice or whitewash only." };
  }

  const s = getLevel(score);
  const labelMap = { pumping: "Pumping", great: "Great", good: "Good", fun: "Fun", junky: "Junky", skip: "Skip" };
  const subMap = {
    pumping: "Everything aligned — go now.",
    great:   "Clean, well-organised waves. Worth rearranging your morning.",
    good:    "Solid fun session. Not memorable but you'll enjoy it.",
    fun:     "Surfable but unremarkable. Worth a paddle if nothing better.",
    junky:   "There are waves but they're messy — pick your sets carefully.",
    skip:    "Not worth paddling today.",
  };
  return { key: s.key, label: labelMap[s.key] || s.label, color: s.color, sub: subMap[s.key] || s.sub };
}

// Score breakdown: explains the 0-100 score with weighted factors
export function scoreBreakdown(h) {
  const face = (h.faceFtLow + h.faceFtHigh) / 2;
  const period = h.swellPeriod;
  const wind = h.windKmh;
  const dir = h.swellDir;
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

  let dirPts = 0, dirNote = "";
  const ideal = ["SW", "WSW", "S", "SSW"];
  if (ideal.includes(dir)) { dirPts = 20; dirNote = `${dir} — ideal angle`; }
  else if (["W", "SE"].includes(dir)) { dirPts = 14; dirNote = `${dir} — workable angle`; }
  else { dirPts = 8; dirNote = `${dir} — off-axis`; }

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
      { key: "dir",    label: "Swell direction", value: dir,                                  pts: dirPts,  max: 20, note: dirNote  },
      { key: "wind",   label: "Wind",            value: `${Math.round(wind)} km/h ${type || ""}`.trim(), pts: windPts, max: 25, note: windNote },
    ],
  };
}

export function drivingChipsFor(h) {
  const chips = [];
  if (h.swellPeriod < 9) chips.push({ t: "Short-period swell", k: "neg" });
  else if (h.swellPeriod >= 12) chips.push({ t: "Long-period groundswell", k: "pos" });
  if (h.swellHeight >= 0.9 && h.swellHeight <= 2.0) chips.push({ t: "Good size", k: "pos" });
  else if (h.swellHeight < 0.6) chips.push({ t: "Small swell", k: "neg" });
  if (["SW", "WSW", "W", "SSW"].includes(h.swellDir)) chips.push({ t: "Ideal swell direction", k: "pos" });
  if (h.windKmh >= 25) chips.push({ t: "Strong cross-shore", k: "neg" });
  else if (h.windKmh <= 10) chips.push({ t: "Light winds", k: "pos" });
  else if ((h.windType || "").toLowerCase().includes("off")) chips.push({ t: "Offshore wind", k: "pos" });
  chips.push({ t: "Tide in the sweet spot", k: "pos" });
  return chips;
}

// Short plain-English reason per level, derived from the same
// classifyConditions / verdict logic the main score uses. Keeps the
// "Can you surf?" block consistent with the top-of-screen number.
function shortReason(userLevel, cls, foamie, period) {
  const { size, wind, reefTooMuch, currentHazard, faceFt } = cls;
  if (currentHazard === "dangerous") return "Dangerous rip — stay out";
  if (reefTooMuch) return "Reef / heavy spot — too risky";
  if (foamie && (size === "too_big" || size === "upper" || wind === "blown") && faceFt <= 10 && faceFt >= 0.3) {
    return "Foamie inside only — ride the reform";
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

  if (!fns || !fns.classifyConditions || !fns.getPersonalVerdict || !fns.isFoamieFriendly || !spot) {
    const face = (hour.faceFtLow + hour.faceFtHigh) / 2;
    return rows.map((r) => ({
      ...r,
      verdict: face < 1 ? "no" : face > 10 ? "no" : "ok",
      reason: face < 1 ? "Flat" : face > 10 ? "Huge" : "Surfable",
    }));
  }

  const { classifyConditions, getPersonalVerdict, isFoamieFriendly } = fns;
  const hDeg = { ...hour, swellDir: hour.swellDirDeg ?? hour.swellDir, windDir: hour.windDirDeg ?? hour.windDir };
  return rows.map((r) => {
    const cls = classifyConditions(r.level, hDeg, spot);
    const verdict = getPersonalVerdict(r.level, hDeg, spot);
    const foamie = isFoamieFriendly(r.level, spot);
    const reason = shortReason(r.level, cls, foamie, hDeg.swellPeriod || 0);
    return { ...r, verdict, reason };
  });
}

export const LEVEL_TO_MATRIX_IDX = {
  first_timer: 0, beginner: 0, early_int: 1, intermediate: 1, advanced: 2, expert: 3,
};
