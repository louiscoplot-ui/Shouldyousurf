// v2 verdict + score breakdown + level matrix — ported from export-v2/v2-main.jsx + mock.js
// Pure functions; no window globals, no React, safe in both server + client.

export const SCORE_SCALE = [
  { key: "pumping", min: 75, max: 100, color: "#1d6a5b", label: "Pumping", sub: "Prime, memorable conditions" },
  { key: "great",   min: 55, max: 74,  color: "#2d9178", label: "Great",   sub: "Clean, well-shaped" },
  { key: "good",    min: 45, max: 54,  color: "#62a06a", label: "Good",    sub: "Solid session" },
  { key: "fun",     min: 35, max: 44,  color: "#a4a558", label: "Fun",     sub: "Surfable but unremarkable" },
  { key: "small",   min: 15, max: 34,  color: "#d47559", label: "Small",   sub: "Longboard or skip" },
  { key: "flat",    min: 0,  max: 14,  color: "#b54c3f", label: "Flat",    sub: "Nothing to surf" },
];

export function getLevel(s) {
  return SCORE_SCALE.find((x) => s >= x.min && s <= x.max) || SCORE_SCALE[5];
}

// Coherent verdict: label derived from BOTH score and conditions
export function coherentVerdict(h) {
  const face = (h.faceFtLow + h.faceFtHigh) / 2;
  const cross = (h.windType || "").toLowerCase().includes("cross");
  const on    = (h.windType || "").toLowerCase().includes("onshore");
  const hardWind = h.windKmh >= 25;
  const isWrecked = (cross || on) && hardWind;

  if (isWrecked && face >= 1.5) {
    return { key: "blown", label: "Blown out", color: "#b54c3f",
             sub: "There are waves, but wind makes it unsurfable." };
  }
  if (face < 1.5) {
    return { key: "small", label: "Small", color: "#d47559",
             sub: "Tiny waves — groms or longboard only." };
  }
  if (h.swellHeight < 0.4) {
    return { key: "flat", label: "Flat", color: "#b54c3f",
             sub: "Nothing to surf." };
  }
  const s = getLevel(h.score);
  const labelMap = { pumping: "Pumping", great: "Great", good: "Good", fun: "Fun", small: "Small", flat: "Flat" };
  const subMap = {
    pumping: "Everything aligned — go now.",
    great:   "Clean, well-organized waves. Worth rearranging your morning.",
    good:    "Solid fun session. Not memorable but you'll enjoy it.",
    fun:     "Surfable but unremarkable. Worth a paddle if you have nothing better.",
    small:   "Little wave energy — longboard only.",
    flat:    "Nothing to surf.",
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

export function levelMatrixFor(h) {
  const face = (h.faceFtLow + h.faceFtHigh) / 2;
  const wind = h.windKmh;
  const period = h.swellPeriod;
  const type = (h.windType || "").toLowerCase();
  const clean = type === "offshore" || wind < 12;
  const choppy = type.includes("onshore") || wind >= 25;
  const cross = type.includes("cross");
  const longP = period >= 11;

  const rows = [];
  rows.push((() => {
    const tooBig = face > 3.5;
    const tooMess = choppy && face > 2;
    const ok = face >= 1 && face <= 3 && clean;
    if (tooBig) return { key: "beginner", name: "Beginner", verdict: "no", reason: face > 6 ? "Way overhead — dangerous" : "Too big, stay out" };
    if (tooMess) return { key: "beginner", name: "Beginner", verdict: "no", reason: "Choppy + too big — wait" };
    if (face < 0.8) return { key: "beginner", name: "Beginner", verdict: "no", reason: "Flat — nothing to catch" };
    if (ok) return { key: "beginner", name: "Beginner", verdict: "yes", reason: "Small clean waves — learn now" };
    return { key: "beginner", name: "Beginner", verdict: "ok", reason: clean ? "Fun little peelers" : "Workable if you paddle inside" };
  })());

  rows.push((() => {
    if (face < 1.2) return { key: "eint", name: "Early Int.", verdict: "no", reason: "Too small — mushy" };
    if (face > 5 && choppy) return { key: "eint", name: "Early Int.", verdict: "no", reason: "Overhead + windy — too much" };
    if (face > 6) return { key: "eint", name: "Early Int.", verdict: "no", reason: "Way beyond comfort zone" };
    if (face >= 1.5 && face <= 4 && clean) return { key: "eint", name: "Early Int.", verdict: "yes", reason: longP ? "Clean groundswell, good size" : "Clean, rideable" };
    if (face >= 2 && face <= 4) return { key: "eint", name: "Early Int.", verdict: "ok", reason: choppy ? "Bumpy but ridable" : "Workable side-wind" };
    return { key: "eint", name: "Early Int.", verdict: "ok", reason: face < 2 ? "Small but clean" : "A bit messy, still doable" };
  })());

  rows.push((() => {
    if (face < 1.5) return { key: "int", name: "Intermediate", verdict: "no", reason: "Too small and slow" };
    if (face > 8 && !clean) return { key: "int", name: "Intermediate", verdict: "no", reason: "Big + blown out — wait" };
    if (face >= 2 && face <= 6 && clean) return { key: "int", name: "Intermediate", verdict: "yes", reason: longP ? "Prime groundswell — go" : "Clean, well-sized" };
    if (face >= 2 && face <= 6) return { key: "int", name: "Intermediate", verdict: "ok", reason: choppy ? "Workable onshore texture" : "Ridable cross-shore" };
    return { key: "int", name: "Intermediate", verdict: "ok", reason: face > 6 ? "Stepping up in size" : "Small but clean" };
  })());

  rows.push((() => {
    if (face < 2) return { key: "adv", name: "Advanced", verdict: "no", reason: "Too small to enjoy" };
    if (face >= 3 && face <= 10 && clean) return { key: "adv", name: "Advanced", verdict: "yes", reason: longP ? "Powerful groundswell — go now" : "Proper size, clean wind" };
    if (face >= 3 && face <= 10) return { key: "adv", name: "Advanced", verdict: "ok", reason: choppy ? "Solid but blown-out" : "Ridable, bumpy face" };
    if (face > 10 && clean) return { key: "adv", name: "Advanced", verdict: "ok", reason: "Big — paddle with care" };
    return { key: "adv", name: "Advanced", verdict: "ok", reason: "Below your threshold but fun" };
  })());

  rows.push((() => {
    if (face < 2.5) return { key: "exp", name: "Expert", verdict: "no", reason: "Nothing to charge" };
    if (face >= 5 && clean && longP) return { key: "exp", name: "Expert", verdict: "yes", reason: "Prime conditions — this is why you wake up" };
    if (face >= 5 && clean) return { key: "exp", name: "Expert", verdict: "yes", reason: "Proper size, clean — go" };
    if (face >= 5) return { key: "exp", name: "Expert", verdict: "ok", reason: choppy ? "Big + messy — doable" : "Cross-shore chop, workable" };
    return { key: "exp", name: "Expert", verdict: "ok", reason: "Fun but below threshold" };
  })());

  return rows;
}

export const LEVEL_TO_MATRIX_IDX = {
  first_timer: 0, beginner: 0, early_int: 1, intermediate: 1, advanced: 2, expert: 3,
};
