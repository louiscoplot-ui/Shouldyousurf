// v2 verdict + score breakdown + level matrix — ported from export-v2/v2-main.jsx + mock.js
// Pure functions; no window globals, no React, safe in both server + client.

import { scoreV2, scoreForLevel, lookupBaseSize, levelPeakBaseSize, degToCompass, faceFtOf, getDominant, spotAttenuation } from "./prodScoring";

// Bandes recalibrées post-multiplicatif. Distribution analysée sur 4800
// combinaisons (10 swellH × 5 periods × 4 winds × 4 dir × 6 levels) :
// l'ancienne échelle additive collait mal, Good (45-54) ne ramassait
// que 4.6% des cas et Fair (35-44) 12.7%. Nouvelle répartition :
//   Skip 0-14 (~44% — reflète la diversité levels × conditions)
//   Poor 15-29  (était 15-34, resserré)
//   Fair 30-44  (était 35-44, élargi vers le bas → 16.5%)
//   Good 45-59  (était 45-54, élargi vers le haut → 6.4%)
//   Excellent 60-74 (était 55-74, resserré)
//   Unreal 75-100 (inchangé)
export const SCORE_SCALE = [
  { key: "unreal",    min: 75, max: 100, color: "#1d6a5b", label: "Unreal",    sub: "Prime, memorable conditions — rearrange your day." },
  { key: "excellent", min: 60, max: 74,  color: "#2d9178", label: "Excellent", sub: "Clean, well-shaped, worth going out of your way." },
  { key: "good",      min: 45, max: 59,  color: "#62a06a", label: "Good",      sub: "Solid session — you'll enjoy it." },
  { key: "fair",      min: 30, max: 44,  color: "#a4a558", label: "Fair",      sub: "Surfable but unremarkable." },
  { key: "poor",      min: 15, max: 29,  color: "#d47559", label: "Poor",      sub: "Marginal — longboard or wait for better." },
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

// Score breakdown — décomposition multiplicative qui matche exactement
// scoreV2 : baseSize(swellH_m, level) × periodMult × windMult × dirMult
// × tideMult, finalMult clamp [0.40, 1.35]. ScoreSheet rend baseSize en
// barre principale + 4 lignes de multiplicateurs (×ratio) au lieu des
// 4 bullets additifs sommant à 100 qui ne reflétaient plus le vrai calcul
// depuis le passage au multiplicatif (PR2).
//
// Reçoit `tideCtx` du jour pour que le tideMult exposé soit le VRAI ×1.06
// / ×0.92 utilisé par le score affiché (sans, le sheet montrait
// constamment "Tide ×1.00" même quand la marée bonifiait/pénalisait
// le score réel). Appelle `scoreForLevel` (pas scoreV2 direct) pour
// que `total` consomme aussi le verdict ceiling — sinon le sheet
// affichait 67 quand le hero affichait 38 (audit CALCUL #4).
export function scoreBreakdown(h, spot, userLevel, tideCtx) {
  const level = userLevel || "intermediate";
  const hDeg = { ...h, swellDir: h.swellDirDeg ?? h.swellDir, windDir: h.windDirDeg ?? h.windDir };
  // scoreForLevel délègue à scoreV2 + applique le verdict ceiling.
  // Sa signature retourne aussi baseSize/multipliers depuis PR2.
  const v2 = scoreForLevel(hDeg, spot, level, tideCtx);

  // Partition DOMINANTE (cachée sur hour.dom par realFetch) — le sheet
  // décrit la houle que le score note, plus jamais la primaire quand une
  // secondaire porte le jour (audit : "1.3 ft face" sur un jour scoré 51).
  const dom = getDominant(hDeg, spot);
  const period = dom.periodKnown ? dom.swellPeriod : 0;
  const windKmh = typeof h.windKmh === "number" ? h.windKmh : 0;
  const dirCardinal = dom.swellDir != null ? degToCompass(dom.swellDir) : (typeof h.swellDir === "string" ? h.swellDir : "—");
  const windType = (h.windType || "").toLowerCase();
  const swellH = dom.swellHeight;

  let sizeNote;
  if (swellH < 0.3) sizeNote = "Almost flat";
  else if (swellH < 0.6) sizeNote = "Small / whitewash territory";
  else if (swellH < 1.0) sizeNote = "Knee–waist";
  else if (swellH < 1.8) sizeNote = "Solid groundswell range";
  else if (swellH < 3.0) sizeNote = "Big — for confident surfers";
  else sizeNote = "Heavy big-wave territory";

  let perNote;
  if (period < 8)       perNote = "Short period — windswell";
  else if (period < 11) perNote = "Mixed swell";
  else if (period < 14) perNote = "Decent groundswell";
  else                  perNote = "Long-period groundswell";

  let dirNote = `${dirCardinal} — `;
  if (spot && spot.idealSwellDir != null && dom.swellDir != null) {
    const delta = Math.abs(((dom.swellDir - spot.idealSwellDir + 540) % 360) - 180);
    if (delta <= 20) dirNote += "ideal angle";
    else if (delta <= 40) dirNote += "good angle";
    else if (delta <= 60) dirNote += "workable angle";
    else if (delta <= 100) dirNote += "off-axis";
    else dirNote += "wrong direction";
  } else dirNote += "angle vs spot";

  let windNote;
  if (windType.includes("offshore") && windKmh < 12) windNote = "Light offshore — glassy";
  else if (windType.includes("offshore") && windKmh < 30) windNote = "Offshore — well shaped";
  else if (windType.includes("offshore")) windNote = "Strong offshore — getting picked off";
  else if (windKmh < 10) windNote = "Light winds";
  else if (windType.includes("cross") && windKmh < 20) windNote = "Cross-shore, manageable";
  else if (windType.includes("cross")) windNote = "Strong cross-shore";
  else if (windKmh < 18) windNote = "Light onshore";
  else if (windKmh < 35) windNote = "Onshore — blown out";
  else windNote = "Onshore gale — junk";

  const tideNote = v2.multipliers.tide >= 1.05 ? "Sweet tide for this spot"
                 : v2.multipliers.tide >= 1.01 ? "OK tide"
                 : v2.multipliers.tide <= 0.95 ? "Wrong tide phase"
                 : "Neutral / no tide preference set";

  const sizeFt = faceFtOf(hDeg, spot);
  return {
    total: v2.score,
    baseSize: v2.baseSize,
    levelPeak: levelPeakBaseSize(level),
    multipliers: v2.multipliers,
    factors: [
      { key: "size",   label: "Wave size for level",  value: `${sizeFt.toFixed(1)} ft face · ${swellH.toFixed(1)} m swell`, pts: v2.baseSize, max: 100, note: sizeNote },
      { key: "period", label: "Swell period",         value: `${period.toFixed(0)}s`,                                       mult: v2.multipliers.period, note: perNote },
      { key: "dir",    label: "Swell direction",      value: dirCardinal,                                                   mult: v2.multipliers.dir,    note: dirNote },
      { key: "wind",   label: "Wind",                 value: `${Math.round(windKmh)} km/h ${windType || ""}`.trim(),         mult: v2.multipliers.wind,   note: windNote },
      { key: "tide",   label: "Tide",                 value: spot && spot.idealTide && spot.idealTide !== "any" ? spot.idealTide : "any", mult: v2.multipliers.tide, note: tideNote },
    ],
  };
}

export function drivingChipsFor(h, spot, userLevel) {
  const chips = [];
  // Toutes les chips houle lisent la partition DOMINANTE (+ atténuation
  // du spot pour la taille) — mêmes entrées que le score qu'elles
  // prétendent expliquer.
  const dom = getDominant(h, spot);
  if (dom.periodKnown) {
    if (dom.swellPeriod < 9) chips.push({ t: "Short-period swell", k: "neg" });
    else if (dom.swellPeriod >= 12) chips.push({ t: "Long-period groundswell", k: "pos" });
  }
  // Size chip lit la grille baseSize du niveau au lieu d'un seuil
  // 0.9-2.0m hardcodé. Pre-FIX 5, un beginner sur 0.85m voyait "Small
  // swell" en rouge alors que son score était au peak — confusion
  // visuelle "pourquoi le score est élevé si swell small ?". Maintenant
  // chip pos quand la taille est dans la sweet zone du niveau, neg
  // seulement quand vraiment under-sized pour ce niveau.
  const effH = dom.swellHeight * spotAttenuation(spot);
  if (Number.isFinite(effH) && userLevel) {
    const bs = lookupBaseSize(effH, userLevel);
    if (bs >= 60) chips.push({ t: "Good size for level", k: "pos" });
    else if (bs <= 18) chips.push({ t: "Too small for level", k: "neg" });
  } else {
    if (effH >= 0.9 && effH <= 2.0) chips.push({ t: "Good size", k: "pos" });
    else if (effH < 0.6) chips.push({ t: "Small swell", k: "neg" });
  }
  // Spot-aware direction. Uses idealSwellDir when available (so Bondi
  // gets credit for SE swell and Hossegor for W swell). Falls back to
  // the legacy WA-only list if no spot is given — shouldn't happen in
  // practice now that drivingChipsFor is always called with the spot.
  if (spot && spot.idealSwellDir != null && dom.swellDir != null) {
    const delta = Math.abs(((dom.swellDir - spot.idealSwellDir + 540) % 360) - 180);
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

// Index du niveau de l'utilisateur dans les 5 lignes retournées par
// levelMatrixFor : [beginner, early_int, intermediate, advanced, expert].
// (first_timer partage la ligne beginner.) L'ancien mapping datait d'un
// design 4 lignes et surlignait la ligne du niveau EN DESSOUS pour
// intermediate / advanced / expert.
export const LEVEL_TO_MATRIX_IDX = {
  first_timer: 0, beginner: 0, early_int: 1, intermediate: 2, advanced: 3, expert: 4,
};
