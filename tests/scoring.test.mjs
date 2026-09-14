// Invariants du moteur de scoring — verrouille les "décisions à ne pas
// défaire" de CLAUDE.md et les fixes de l'audit 2026-07. Toute recalibration
// future doit passer ici AVANT push.
import { describe, it, expect, afterEach } from "vitest";
import {
  currentVelToMs,
  estimateFaceHeight,
  spotAttenuation,
  pickDominantSwell,
  faceFtOf,
  getBoardRec,
  scoreV2,
  scoreForLevel,
  getPersonalVerdict,
  classifyConditions,
  lookupBaseSize,
  lookupTideMult,
  windClass,
  tideNotes,
  adaptForecastToLevel,
  USER_LEVELS,
  mToFt,
  LEARNER_WIND_CAP,
  feltWindKmh,
} from "../app/v2/lib/prodScoring.js";
import { BREAKS } from "../app/breaks.js";
import { marineSamplePoint, offsetPoint, probeOffshoreBearing } from "../app/v2/lib/realFetch.js";
import { levelMatrixFor, LEVEL_TO_MATRIX_IDX, getLevel, SCORE_SCALE, scoreBreakdown, drivingChipsFor } from "../app/v2/lib/verdict.js";

const spot = { idealSwellDir: 240, offshoreWindDir: 90, idealTide: "mid-high", type: "beach" };
const reef = { idealSwellDir: 240, offshoreWindDir: 90, idealTide: "mid", type: "reef", heavy: true };
const mk = (o) => ({ swellHeight: 1.2, swellPeriod: 12, swellDir: 240, windSpeedKn: 5, windDir: 90, tideM: null, ...o });

describe("estimateFaceHeight", () => {
  it("has no cliff around 0.5m (1cm of swell must not change the face by >10%)", () => {
    for (let h = 0.3; h < 1.0; h += 0.01) {
      const a = estimateFaceHeight(h, 14);
      const b = estimateFaceHeight(h + 0.01, 14);
      expect(b / a).toBeLessThan(1.10);
    }
  });
  it("keeps tiny swells honest (no period boost below 0.4m)", () => {
    expect(estimateFaceHeight(0.3, 15)).toBeCloseTo(0.3, 5);
  });
  it("applies the full period boost from 0.8m", () => {
    expect(estimateFaceHeight(1.0, 15)).toBeCloseTo(1.5, 5);
    expect(estimateFaceHeight(1.0, 7)).toBeCloseTo(0.7, 5);
  });
});

describe("swellAttenuation", () => {
  it("default (absent or 1.0) is a bit-for-bit non-regression", () => {
    const spotNoField = { idealSwellDir: 240, offshoreWindDir: 90, idealTide: "mid-high", type: "beach" };
    const spotOne = { ...spotNoField, swellAttenuation: 1.0 };
    for (const h of [0, 0.4, 1, 3, 8]) {
      for (const p of [4, 8, 12, 18]) {
        for (const w of [0, 15, 40]) {
          const hr = mk({ swellHeight: h, swellPeriod: p, windSpeedKn: w });
          expect(scoreV2(hr, spotOne, "advanced").score).toBe(scoreV2(hr, spotNoField, "advanced").score);
          expect(estimateFaceHeight(h, p, 1)).toBe(estimateFaceHeight(h, p));
        }
      }
    }
  });
  it("is applied exactly once (face at full boost scales linearly with attenuation)", () => {
    // at 3m even attenuated to 1.5m both sides sit above the 0.8m ramp →
    // pure linear scaling proves single application (0.5² would betray double)
    expect(estimateFaceHeight(3, 14, 0.5)).toBeCloseTo(0.5 * estimateFaceHeight(3, 14, 1), 10);
  });
  it("face is monotonic in attenuation", () => {
    let prev = -1;
    for (let a = 0.3; a <= 1.0; a += 0.05) {
      const f = estimateFaceHeight(2.5, 16, a);
      expect(f).toBeGreaterThan(prev);
      prev = f;
    }
  });
  it("Trigg 2.5m @ 16s reads 6-9 ft face (sheltered corridor), exposed spot unchanged", () => {
    const trigg = BREAKS.find((b) => b.id === "trigg");
    const margs = BREAKS.find((b) => b.id === "margaret");
    const h = mk({ swellHeight: 2.5, swellPeriod: 16 });
    const faceTrigg = classifyConditions("advanced", h, trigg).faceFt;
    const faceMargs = classifyConditions("advanced", h, margs).faceFt;
    expect(faceTrigg).toBeGreaterThanOrEqual(6);
    expect(faceTrigg).toBeLessThanOrEqual(9);
    expect(faceMargs).toBeCloseTo(mToFt(estimateFaceHeight(2.5, 16)), 5);
  });
  it("spotAttenuation clamps and defaults", () => {
    expect(spotAttenuation(null)).toBe(1);
    expect(spotAttenuation({})).toBe(1);
    expect(spotAttenuation({ swellAttenuation: 1.4 })).toBe(1);
    expect(spotAttenuation({ swellAttenuation: -0.2 })).toBe(0);
    expect(spotAttenuation({ swellAttenuation: 0.6 })).toBe(0.6);
  });
});

describe("scoreV2 surface factors", () => {
  it("penalizes heavy gusts over the same mean wind", () => {
    const calm = scoreV2(mk({}), spot, "intermediate").score;
    const gusty = scoreV2(mk({ windGustKn: 30 }), spot, "intermediate").score;
    expect(gusty).toBeLessThan(calm);
  });
  it("penalizes short-period windswell chop", () => {
    const clean = scoreV2(mk({ swellPeriod: 9 }), spot, "intermediate").score;
    const choppy = scoreV2(mk({ swellPeriod: 9, windWaveHeight: 1.1 }), spot, "intermediate").score;
    expect(choppy).toBeLessThan(clean);
  });
  it("stays within [0, 100]", () => {
    for (const h of [0, 0.4, 1, 3, 8]) {
      for (const p of [4, 8, 12, 18]) {
        for (const w of [0, 15, 40]) {
          const s = scoreV2(mk({ swellHeight: h, swellPeriod: p, windSpeedKn: w }), spot, "advanced").score;
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe("continuity — no cliffs anywhere in scoreV2", () => {
  const maxJump = (lo, hi, step, fn) => {
    let worst = 0, prev = fn(lo);
    for (let x = lo + step; x <= hi + 1e-9; x += step) {
      const v = fn(x);
      worst = Math.max(worst, Math.abs(v - prev));
      prev = v;
    }
    return worst;
  };
  const JUMP_LIMIT = 3; // points de score par pas fin

  it("period 4→20s (0.1s steps)", () => {
    expect(maxJump(4, 20, 0.1, (x) => scoreV2(mk({ swellPeriod: x }), spot, "intermediate").score)).toBeLessThan(JUMP_LIMIT);
  });
  it("wind speed 0→60 km/h (0.25 km/h steps) in all three regimes", () => {
    for (const windDir of [90, 190, 270]) { // offshore / cross / onshore vs offshoreWindDir 90
      expect(maxJump(0, 60, 0.25, (kmh) => scoreV2(mk({ windSpeedKn: kmh / 1.852, windDir }), spot, "intermediate").score)).toBeLessThan(JUMP_LIMIT);
    }
  });
  it("wind direction 0→360° (1° steps) at moderate and strong wind", () => {
    for (const kn of [12, 28]) {
      expect(maxJump(0, 360, 1, (d) => scoreV2(mk({ windSpeedKn: kn, windDir: d }), spot, "intermediate").score)).toBeLessThan(JUMP_LIMIT);
    }
  });
  it("swell direction 0→360° (1° steps)", () => {
    expect(maxJump(0, 360, 1, (d) => scoreV2(mk({ swellDir: d }), spot, "intermediate").score)).toBeLessThan(JUMP_LIMIT);
  });
  it("swell height 0→4m (1cm steps)", () => {
    expect(maxJump(0, 4, 0.01, (x) => scoreV2(mk({ swellHeight: x }), spot, "intermediate").score)).toBeLessThan(JUMP_LIMIT);
  });
  it("secondary swell height 0→2m (1cm steps) over an off-axis primary", () => {
    expect(maxJump(0, 2, 0.01, (x) => scoreV2(mk({ swellHeight: 0.5, swellDir: 100, secSwellH: x, secSwellP: 14, secSwellDir: 240 }), spot, "intermediate").score)).toBeLessThan(JUMP_LIMIT);
  });
  it("gusts 0→40kn (0.1kn steps) and windswell 0→2m (1cm steps)", () => {
    expect(maxJump(5, 40, 0.1, (g) => scoreV2(mk({ windGustKn: g }), spot, "intermediate").score)).toBeLessThan(JUMP_LIMIT);
    expect(maxJump(0, 2, 0.01, (w) => scoreV2(mk({ swellPeriod: 9, windWaveHeight: w }), spot, "intermediate").score)).toBeLessThan(JUMP_LIMIT);
  });
  it("missing period is a strictly neutral multiplier (×1.00)", () => {
    const r = scoreV2(mk({ swellPeriod: null }), spot, "intermediate");
    expect(r.multipliers.period).toBe(1.00);
  });
});

describe("secondary swell as dominant partition", () => {
  const h = mk({ swellHeight: 0.4, swellDir: 100, secSwellH: 1.5, secSwellP: 15, secSwellDir: 240 });
  it("picks the ideal-direction groundswell over off-axis primary chop", () => {
    const dom = pickDominantSwell(h, spot);
    expect(dom.isSecondary).toBe(true);
    expect(dom.swellHeight).toBe(1.5);
  });
  it("scores the day as surfable instead of flat", () => {
    const withSec = scoreV2(h, spot, "intermediate").score;
    const without = scoreV2(mk({ swellHeight: 0.4, swellDir: 100 }), spot, "intermediate").score;
    expect(withSec).toBeGreaterThan(40);
    expect(without).toBeLessThanOrEqual(12); // micro-swell cap
  });
  it("keeps verdict coherent with the scored partition", () => {
    // 1.5m @ 15s ≈ 7ft face → sweet/upper for advanced, not "too_small"
    const cls = classifyConditions("advanced", h, spot);
    expect(cls.size).not.toBe("too_small");
  });
});

describe("dominant partition propagated to every reader", () => {
  // Jour à secondaire dominante : primaire 0.4m @ 6s off-axis, secondaire
  // 1.5m @ 15s plein axe (probe E de l'audit).
  const hSec = mk({ swellHeight: 0.4, swellPeriod: 6, swellDir: 100, secSwellH: 1.5, secSwellP: 15, secSwellDir: 240, windKmh: 9, windType: "offshore" });

  it("getDominant prefers the cached hour.dom without recomputing", async () => {
    const cached = { swellHeight: 9.9, swellPeriod: 20, swellDir: 240, isSecondary: true, periodKnown: true };
    const { getDominant } = await import("../app/v2/lib/prodScoring.js");
    expect(getDominant({ ...hSec, dom: cached }, spot)).toBe(cached);
  });
  it("faceFtOf reads the cached hour.faceFt", () => {
    expect(faceFtOf({ ...hSec, faceFt: 4.2 }, spot)).toBe(4.2);
  });
  it("board rec face matches the scored (secondary) wave, not the primary chop", () => {
    const face = faceFtOf(hSec, spot);
    expect(face).toBeGreaterThan(6); // ~7.4 ft — plus jamais 1.3 ft
    const board = getBoardRec("advanced", face, 15, spot);
    expect(board.short).not.toMatch(/Longboard/);
  });
  it("ScoreSheet wave-size line describes the dominant swell", () => {
    const bd = scoreBreakdown(hSec, spot, "advanced", null);
    expect(bd.factors[0].value).toContain("1.5 m");
    expect(parseFloat(bd.factors[0].value)).toBeGreaterThan(6); // ft face
  });
  it("driving chips read the dominant swell (long-period pos, no small-swell neg)", () => {
    const chips = drivingChipsFor(hSec, spot, "advanced");
    const texts = chips.map((c) => c.t);
    expect(texts).toContain("Long-period groundswell");
    expect(texts).toContain("Ideal swell direction");
    expect(texts).not.toContain("Too small for level");
    expect(texts).not.toContain("Short-period swell");
  });
});

describe("verdict ceilings (label ↔ score coherence)", () => {
  it("verdict no → score ≤ 38, verdict ok → score ≤ 70", () => {
    for (const level of USER_LEVELS) {
      for (const sh of [0.2, 0.6, 1.0, 1.8, 3.0]) {
        for (const wKn of [4, 12, 22]) {
          const h = mk({ swellHeight: sh, windSpeedKn: wKn, windDir: 270 });
          const v = getPersonalVerdict(level, h, spot);
          const s = scoreForLevel(h, spot, level).score;
          if (v === "no") expect(s).toBeLessThanOrEqual(38);
          if (v === "ok") expect(s).toBeLessThanOrEqual(70);
        }
      }
    }
  });
});

describe("safety holes closed (audit bloc 4)", () => {
  it("13 ft glassy long-period → hard no for early_int and intermediate", () => {
    const big = mk({ swellHeight: 2.5, swellPeriod: 16, windSpeedKn: 5 }); // ~13 ft exposed
    expect(getPersonalVerdict("early_int", big, spot)).toBe("no");
    expect(getPersonalVerdict("intermediate", big, spot)).toBe("no");
    // advanced garde son jugement (MAYBE, pas d'interdiction)
    expect(getPersonalVerdict("advanced", big, spot)).toBe("ok");
  });
  it("upperMax +25% (≈7.5 ft) clean stays MAYBE for intermediate", () => {
    const edge = mk({ swellHeight: 1.6, swellPeriod: 14 }); // face ~7.4 ft
    expect(classifyConditions("intermediate", edge, spot).size).toBe("too_big");
    expect(getPersonalVerdict("intermediate", edge, spot)).toBe("ok");
  });
  it("dangerous rip → hard no for early_int; strong rip → never GO", () => {
    const ripDanger = mk({ swellHeight: 0.9, currentVel: 0.6 });
    expect(getPersonalVerdict("early_int", ripDanger, spot)).toBe("no");
    const ripStrong = mk({ swellHeight: 0.9, currentVel: 0.4 });
    expect(getPersonalVerdict("early_int", ripStrong, spot)).not.toBe("yes");
    expect(classifyConditions("early_int", ripStrong, spot).currentHazard).toBe("strong");
  });
  it("strong (not dangerous) current → early_int MAYBE, not SKIP cliff", () => {
    // Repro du bug terrain : clean sweet-size day, le courant passe juste le
    // palier bas "strong". early_int doit rester MAYBE (pas de SKIP rouge
    // 100→38). first_timer/beginner gardent leur SKIP dur (foamie).
    const clean = { swellHeight: 0.9, swellPeriod: 12, swellDir: 240, windSpeedKn: 4, windDir: 90, tideM: null, currentVel: 0.4 };
    expect(classifyConditions("early_int", clean, spot).currentHazard).toBe("strong");
    expect(getPersonalVerdict("early_int", clean, spot)).toBe("ok");
    // le score ne s'effondre plus dans la bande SKIP (≤38) — reste MAYBE (≥45)
    expect(scoreForLevel(clean, spot, "early_int").score).toBeGreaterThan(45);
    // vrais foamie : SKIP dur préservé
    expect(getPersonalVerdict("first_timer", clean, spot)).toBe("no");
    expect(getPersonalVerdict("beginner", clean, spot)).toBe("no");
    // le palier haut "dangerous" reste un SKIP dur pour early_int
    const danger = { ...clean, currentVel: 0.6 };
    expect(getPersonalVerdict("early_int", danger, spot)).toBe("no");
  });
  it("currents remain invisible for advanced+ (their call)", () => {
    expect(classifyConditions("advanced", mk({ currentVel: 0.7 }), spot).currentHazard).toBe("none");
  });
  it("skill case D: 2.0m/14s clean ≈9.2ft face → hard no for early_int & intermediate", () => {
    const h = mk({ swellHeight: 2.0, swellPeriod: 14, windSpeedKn: 5 });
    expect(mToFt(estimateFaceHeight(2.0, 14))).toBeGreaterThan(9);
    expect(getPersonalVerdict("early_int", h, spot)).toBe("no");
    expect(getPersonalVerdict("intermediate", h, spot)).toBe("no");
    expect(getPersonalVerdict("advanced", h, spot)).toBe("yes"); // adv 82-92 per skill
  });
});

describe("currentVelToMs — unité normalisée d'après hourly_units", () => {
  it("converts km/h (Marine API default), keeps m/s untouched", () => {
    expect(currentVelToMs(1.08, "km/h")).toBeCloseTo(0.3, 5);
    expect(currentVelToMs(0.3, "m/s")).toBe(0.3);
    expect(currentVelToMs(0.3, "ms")).toBe(0.3);
  });
  it("handles knots and mph", () => {
    expect(currentVelToMs(1, "kn")).toBeCloseTo(0.514444, 5);
    expect(currentVelToMs(1, "mph")).toBeCloseTo(0.44704, 5);
  });
  it("unknown / missing unit or value → passthrough / null (non-régression)", () => {
    expect(currentVelToMs(0.3, undefined)).toBe(0.3);
    expect(currentVelToMs(0.3, "")).toBe(0.3);
    expect(currentVelToMs(null, "km/h")).toBe(null);
    expect(currentVelToMs(NaN, "km/h")).toBe(null);
  });
  it("a 1.1 km/h current no longer reads as a strong rip once normalized", () => {
    // Repro bug terrain : l'app affichait "1.1 km/h" (raw 0.306 traité en
    // m/s → strong). Si le raw ÉTAIT en km/h, normalisé = 0.085 m/s → none.
    const norm = currentVelToMs(0.306, "km/h");
    expect(classifyConditions("early_int", mk({ currentVel: norm }), spot).currentHazard).toBe("none");
  });
});

describe("score/verdict précis PAR NIVEAU (pas de bon surf raté, pas de danger masqué)", () => {
  it("first_timer perfect day (0.3m clean whitewash) scores GOOD, not 12 red", () => {
    // L'ancien cap micro-swell universel écrasait le peak first_timer à 12 :
    // GO vert + hero "Skip 12" rouge → il restait chez lui son jour idéal.
    const h = mk({ swellHeight: 0.3, swellPeriod: 10, windSpeedKn: 5 });
    expect(getPersonalVerdict("first_timer", h, spot)).toBe("yes");
    expect(scoreForLevel(h, spot, "first_timer").score).toBeGreaterThanOrEqual(45);
  });
  it("beginner rising zone (0.55m clean) scores like the sweet day it is", () => {
    const h = mk({ swellHeight: 0.55, swellPeriod: 10, windSpeedKn: 5 });
    expect(getPersonalVerdict("beginner", h, spot)).toBe("yes");
    expect(scoreForLevel(h, spot, "beginner").score).toBeGreaterThanOrEqual(60);
  });
  it("micro-cap unchanged for intermediate+ (0.4m stays honest)", () => {
    const h = mk({ swellHeight: 0.4, swellPeriod: 12 });
    expect(scoreV2(h, spot, "intermediate").score).toBeLessThanOrEqual(17);
    expect(scoreV2(h, spot, "advanced").score).toBeLessThanOrEqual(17);
  });
  it("flat ocean still scores ~nothing for first_timer (cap keeps its job)", () => {
    const h = mk({ swellHeight: 0.1, swellPeriod: 8 });
    expect(scoreV2(h, spot, "first_timer").score).toBeLessThanOrEqual(12);
  });
  it("9ft day → hard no for first_timer AND beginner (no 'inside rescue' MAYBE)", () => {
    // L'ancien plafond reform ≤10ft universel promettait un MAYBE inside à
    // un first_timer sur du 9ft — le bord n'est pas un refuge à cette taille.
    const h = mk({ swellHeight: 2.0, swellPeriod: 14, windSpeedKn: 5 });
    expect(getPersonalVerdict("first_timer", h, spot)).toBe("no");
    expect(getPersonalVerdict("beginner", h, spot)).toBe("no");
  });
  it("reform rescue bornée par la ZONE du niveau, pas par un plafond en pieds", () => {
    // Ce cas verrouillait l'inverse : beginner "ok" sur ~6.9 ft et
    // first_timer "ok" sur ~5.1 ft, au nom de REFORM_MAX_FT (8 / 6 ft).
    // Or l'upperMax d'une beginner est 3 ft : la rescue lui promettait
    // "reste au bord sur un foamie" jusqu'à 2.7× son maximum, sans bandeau
    // danger (qui exige un verdict "no"). Incident réel : beginner envoyée
    // à l'eau sur une houle très au-dessus de sa tête. Le plafond suit
    // maintenant upperMax × 1.3, comme early_int l'avait déjà.
    // Sous le plafond : la rescue existe toujours.
    expect(getPersonalVerdict("beginner", mk({ swellHeight: 0.8, swellPeriod: 14, windSpeedKn: 5 }), spot)).toBe("ok");   // 3.67 ft < 3.9
    expect(getPersonalVerdict("first_timer", mk({ swellHeight: 0.65, swellPeriod: 14, windSpeedKn: 5 }), spot)).toBe("ok"); // 2.72 ft < 2.86
    // Au-dessus : "no" franc, plus de faux MAYBE "inside rescue".
    expect(getPersonalVerdict("beginner", mk({ swellHeight: 0.85, swellPeriod: 14, windSpeedKn: 5 }), spot)).toBe("no");  // 3.90 ft
    expect(getPersonalVerdict("beginner", mk({ swellHeight: 1.5, swellPeriod: 14, windSpeedKn: 5 }), spot)).toBe("no");   // 6.89 ft
    expect(getPersonalVerdict("first_timer", mk({ swellHeight: 1.1, swellPeriod: 14, windSpeedKn: 5 }), spot)).toBe("no"); // 5.05 ft
  });

  it("un verdict ne peut jamais être contredit par le libellé du score", () => {
    // Bug qui a envoyé une beginner à l'eau : son écran affichait
    // « Excellent 62 » (bande ok plafonnée à 70, or "excellent" démarre à
    // 60) pendant que le conseil dessous disait « the main break isn't for
    // you today — too big ». Les plafonds sont désormais calés sur les
    // bornes de SCORE_SCALE : MAYBE ≤ 59 (haut de "Good"), SKIP ≤ 29
    // (haut de "Poor"). Un MAYBE ne peut plus lire "Excellent", ni un
    // SKIP lire "Fair — surfable".
    for (const lvl of USER_LEVELS) {
      for (let sw = 0.2; sw <= 4.0001; sw += 0.05) {
        for (const p of [7, 10, 13, 16]) {
          for (const wk of [3, 12, 22, 32]) {
            const h = mk({ swellHeight: +sw.toFixed(2), swellPeriod: p, windSpeedKn: wk / 1.852 });
            const v = getPersonalVerdict(lvl, h, spot);
            const s = scoreForLevel(h, spot, lvl).score;
            if (v === "ok") expect(s).toBeLessThanOrEqual(59);
            if (v === "no") expect(s).toBeLessThanOrEqual(29);
          }
        }
      }
    }
  });
});

describe("frontières de bande continues (plafond verdict sans falaise)", () => {
  it("courant qui monte à travers 0.28 : le score glisse, ne saute pas (early_int)", () => {
    // Bug d'origine : GO 100 → MAYBE 70 sec quand le courant franchit le
    // palier. Le score doit avoir rejoint le mapping MAYBE AVANT la bascule.
    let prev = null;
    for (let cur = 0.15; cur <= 0.40001; cur += 0.005) {
      const s = scoreForLevel(mk({ swellHeight: 1.0, swellPeriod: 10, currentVel: cur }), spot, "early_int").score;
      if (prev != null) expect(Math.abs(s - prev)).toBeLessThanOrEqual(4);
      prev = s;
    }
  });
  it("houle qui monte à travers upperMax : plus de 100→70 sec (intermediate)", () => {
    let prev = null;
    for (let sw = 1.5; sw <= 2.1001; sw += 0.01) {
      const s = scoreForLevel(mk({ swellHeight: sw, swellPeriod: 10 }), spot, "intermediate").score;
      if (prev != null) expect(Math.abs(s - prev)).toBeLessThanOrEqual(4);
      prev = s;
    }
  });
  it("vent qui monte à travers le seuil clean : glisse aussi (beginner, cross-shore)", () => {
    let prev = null;
    for (let kmh = 4; kmh <= 14.001; kmh += 0.25) {
      const s = scoreForLevel(mk({ swellHeight: 0.6, swellPeriod: 10, windSpeedKn: kmh / 1.852, windDir: 0 }), spot, "beginner").score;
      if (prev != null) expect(Math.abs(s - prev)).toBeLessThanOrEqual(4);
      prev = s;
    }
  });
  it("loin de toute frontière : le score GO reste le brut exact (pas de compression fantôme)", () => {
    const h = mk({ swellHeight: 1.0, swellPeriod: 10 });
    expect(getPersonalVerdict("early_int", h, spot)).toBe("yes");
    expect(scoreForLevel(h, spot, "early_int").score).toBe(scoreV2(h, spot, "early_int").score);
  });
  it("les plafonds de bande restent inviolés (MAYBE ≤ 70, SKIP ≤ 38)", () => {
    for (let sw = 0.2; sw <= 3.0001; sw += 0.05) {
      for (const cur of [0, 0.3, 0.6]) {
        for (const lvl of USER_LEVELS) {
          const h = mk({ swellHeight: sw, swellPeriod: 11, currentVel: cur });
          const v = getPersonalVerdict(lvl, h, spot);
          const s = scoreForLevel(h, spot, lvl).score;
          if (v === "ok") expect(s).toBeLessThanOrEqual(70);
          if (v === "no") expect(s).toBeLessThanOrEqual(38);
        }
      }
    }
  });
});

// Sprint 2026-07 (audit vent) : la suite continuité ne balayait le vent que
// sur scoreV2 (déjà continu) et, côté scoreForLevel, que 4→14 km/h — donc
// JAMAIS les seuils "blown" (18/20 onshore, 30 cross, 40, 45/55 offshore) où
// vivaient les vraies falaises. Ces cas verrouillent l'axe vent de bout en
// bout et la monotonie taille/vent du verdict.
describe("vent — monotonie et continuité du score affiché", () => {
  const LEVELS_ALL = ["first_timer", "beginner", "early_int", "intermediate", "advanced", "expert"];
  const RANK = { no: 0, ok: 1, yes: 2 };
  const DIRS = [90, 190, 270]; // offshore / cross / onshore vs offshoreWindDir 90

  it("un vent qui EMPIRE ne peut jamais améliorer le verdict", () => {
    // Bug d'origine : la branche `wind === "blown"` court-circuitait le
    // plafond de taille et retombait sur "ok". Un 8.5 ft (au-delà du plafond
    // absolu 7.8 ft d'un intermediate) rendait NO à 29 km/h cross et OK à
    // 30 km/h — le vent qui empire faisait REMONTER le verdict. 54 cas.
    for (const lvl of LEVELS_ALL) {
      for (const windDir of DIRS) {
        for (let sw = 0.3; sw <= 3.2001; sw += 0.1) {
          let prev = null;
          for (let kmh = 0; kmh <= 60; kmh += 0.5) {
            const v = getPersonalVerdict(lvl, mk({ swellHeight: +sw.toFixed(2), windSpeedKn: kmh / 1.852, windDir }), spot);
            if (prev != null) expect(RANK[v]).toBeLessThanOrEqual(RANK[prev]);
            prev = v;
          }
        }
      }
    }
  });

  it("une vague qui GROSSIT au-delà du plafond ne peut pas re-devenir surfable", () => {
    // Corollaire du même bug : once too_big → "no", grossir encore ne doit
    // jamais rendre "ok". 60 cas de récupération mesurés avant fix.
    for (const lvl of ["early_int", "intermediate"]) {
      for (const windDir of DIRS) {
        for (const kmh of [5, 15, 25, 35]) {
          let seenNo = false;
          for (let sw = 1.0; sw <= 4.0001; sw += 0.05) {
            const h = mk({ swellHeight: +sw.toFixed(2), windSpeedKn: kmh / 1.852, windDir });
            const cls = classifyConditions(lvl, h, spot);
            if (cls.size !== "too_big") continue;
            const v = getPersonalVerdict(lvl, h, spot);
            if (v === "no") seenNo = true;
            else if (seenNo) expect(`${lvl} dir${windDir} ${kmh}km/h ${sw.toFixed(2)}m recovered to ${v}`).toBe("no recovery");
          }
        }
      }
    }
  });

  it("le score affiché glisse sur tout l'axe vent 0→60 km/h (pas de falaise)", () => {
    // Falaises mesurées avant fix : 31 pts (offshore @40), 27 (cross @30),
    // 22 (onshore @20) pour 0.25 km/h. scoreV2 brut, lui, était continu :
    // la discontinuité venait du label vent catégoriel remontant dans
    // flipProximity. Limite à 8 pts = marge sur les rampes légitimes.
    for (const lvl of LEVELS_ALL) {
      for (const windDir of DIRS) {
        for (const sw of [0.5, 1.1, 1.8, 2.6]) {
          let prev = null;
          for (let kmh = 0; kmh <= 60; kmh += 0.25) {
            const s = scoreForLevel(mk({ swellHeight: sw, windSpeedKn: kmh / 1.852, windDir }), spot, lvl).score;
            if (prev != null) expect(Math.abs(s - prev)).toBeLessThanOrEqual(8);
            prev = s;
          }
        }
      }
    }
  });

  it("le seuil offshore 'blown' par niveau est réellement atteignable", () => {
    // `kmh >= 40` en OU non gardé préemptait la branche offshore : elle était
    // morte, tout offshore passait blown à 40 quel que soit le niveau.
    // Offshore = windDir aligné sur spot.offshoreWindDir (delta 0).
    const off = (kmh, lvl) => classifyConditions(lvl, mk({ swellHeight: 1.5, windSpeedKn: kmh / 1.852, windDir: 90 }), spot).wind;
    expect(off(42, "intermediate")).toBe("bumpy");
    expect(off(50, "intermediate")).toBe("bumpy"); // < 55
    expect(off(56, "intermediate")).toBe("blown"); // ≥ 55
    // Les seuils non-offshore d'intermediate+ restent inchangés.
    const nonOff = (kmh, dir) => classifyConditions("intermediate", mk({ swellHeight: 1.5, windSpeedKn: kmh / 1.852, windDir: dir }), spot).wind;
    expect(nonOff(31, 190)).toBe("blown"); // cross ≥ 30
    expect(nonOff(21, 270)).toBe("blown"); // onshore ≥ 20
  });

  // Les LEARNERS ne suivent plus ces seuils : ils ont LEARNER_WIND_CAP.
  // Bug terrain 14/09 — un beginner en cross-shore restait "WORTH IT"
  // jusqu'à 24 km/h parce que le cross partageait le 30 de tout le monde.
  it("les learners ont leur propre plafond de vent, par niveau ET par direction", () => {
    const w = (kmh, lvl, dir) => classifyConditions(lvl, mk({ swellHeight: 1.5, windSpeedKn: kmh / 1.852, windDir: dir }), spot).wind;
    const CROSS = 190, OFFSHORE = 90;
    Object.entries(LEARNER_WIND_CAP).forEach(([lvl, cap]) => {
      expect(w(cap.other - 1, lvl, CROSS)).not.toBe("blown");
      expect(w(cap.other, lvl, CROSS)).toBe("blown");
      expect(w(cap.offshore - 1, lvl, OFFSHORE)).not.toBe("blown");
      expect(w(cap.offshore, lvl, OFFSHORE)).toBe("blown");
      // Un offshore est toujours au moins aussi toléré qu'un cross.
      expect(cap.offshore).toBeGreaterThanOrEqual(cap.other);
    });
  });

  it("l'échelle des plafonds de vent reste monotone entre niveaux", () => {
    // Un first_timer ne peut JAMAIS être plus tolérant qu'un beginner, ni un
    // beginner qu'un early_int — sinon la LevelMatrix afficherait un GO au
    // niveau du dessous d'un SKIP.
    const order = ["first_timer", "beginner", "early_int"];
    order.slice(1).forEach((lvl, i) => {
      const prev = LEARNER_WIND_CAP[order[i]];
      expect(LEARNER_WIND_CAP[lvl].other).toBeGreaterThanOrEqual(prev.other);
      expect(LEARNER_WIND_CAP[lvl].offshore).toBeGreaterThanOrEqual(prev.offshore);
    });
  });

  it("le verdict d'un learner bascule en SKIP à son plafond, pas 25 km/h en dur", () => {
    Object.entries(LEARNER_WIND_CAP).forEach(([lvl, cap]) => {
      const at = (kmh) => getPersonalVerdict(lvl, mk({ swellHeight: 1.0, windSpeedKn: kmh / 1.852, windDir: 190 }), spot);
      expect(at(cap.other)).toBe("no");
      expect(at(cap.other + 5)).toBe("no");
    });
  });
});

describe("point d'échantillonnage marin (grille 1/12° ≈ 9 km)", () => {
  // Un spot sur le trait de côte tombe dans une cellule à dominante TERRESTRE
  // dont la sortie est un artefact de bord. Mesuré à Trigg le 01/08, même
  // heure : cellule côtière 1.32 m / première cellule 100% eau 1.64 m (+24 %)
  // / au large du Five Fathom Bank 2.02 m (+53 %). Le modèle avait donc déjà
  // atténué ×0.65 avant notre swellAttenuation 0.60 → 0.39 réel.
  const KM = 5;
  const distKm = (a, b) => {
    const dLat = (b.lat - a.lat) * 110.574;
    const dLng = (b.lng - a.lng) * 111.320 * Math.cos((a.lat * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };

  it("décale de 5 km vers le large (direction donnée par idealSwellDir)", () => {
    for (const b of BREAKS) {
      if (!Number.isFinite(b.idealSwellDir)) continue;
      const mp = marineSamplePoint(b);
      expect(distKm(b, mp)).toBeCloseTo(KM, 1);
      // Le décalage doit suivre idealSwellDir : la houle vient de la mer.
      const bearing = (Math.atan2(
        (mp.lng - b.lng) * Math.cos((b.lat * Math.PI) / 180),
        mp.lat - b.lat,
      ) * 180) / Math.PI;
      const delta = Math.abs(((bearing - b.idealSwellDir + 540) % 360) - 180);
      expect(delta).toBeLessThan(2);
    }
  });

  it("Trigg atterrit sur la cellule 100% eau, pas sur celle de bord", () => {
    const trigg = BREAKS.find((x) => x.id === "trigg");
    const mp = marineSamplePoint(trigg);
    // Snap sur la grille observée dans les réponses Open-Meteo (k/12 + 1/24).
    const snap = (v) => Math.round((v - 1 / 24) * 12) / 12 + 1 / 24;
    expect(snap(mp.lng)).toBeCloseTo(115.70836, 3); // et NON 115.79167 (terre)
    expect(snap(mp.lat)).toBeCloseTo(-31.875, 3);
  });

  it("sans idealSwellDir : retombe sur les coordonnées du spot (jamais pire qu'avant)", () => {
    const mp = marineSamplePoint({ lat: -31.9, lng: 115.75 });
    expect(mp).toEqual({ lat: -31.9, lng: 115.75 });
  });

  it("marineLat/marineLng forcent le point quand ils sont fournis", () => {
    const mp = marineSamplePoint({ lat: -31.9, lng: 115.75, idealSwellDir: 240, marineLat: -31.8, marineLng: 115.6 });
    expect(mp).toEqual({ lat: -31.8, lng: 115.6 });
  });

  it("offsetPoint respecte cap et distance", () => {
    const o = offsetPoint(-31.88, 115.75, 270, 5); // plein ouest
    expect(o.lng).toBeLessThan(115.75);
    expect(o.lat).toBeCloseTo(-31.88, 3);
    expect(distKm({ lat: -31.88, lng: 115.75 }, o)).toBeCloseTo(5, 1);
    const n = offsetPoint(-31.88, 115.75, 0, 5); // plein nord
    expect(n.lat).toBeGreaterThan(-31.88);
    expect(n.lng).toBeCloseTo(115.75, 3);
  });

  it("un cap explicite pilote le décalage (cas du spot personnalisé sondé)", () => {
    const custom = { lat: -31.88, lng: 115.75 }; // pas d'idealSwellDir
    expect(marineSamplePoint(custom)).toEqual({ lat: -31.88, lng: 115.75 }); // sans cap : inchangé
    const mp = marineSamplePoint(custom, 240);
    expect(mp.lng).toBeLessThan(115.75); // sondé vers le large → part à l'ouest
    expect(distKm(custom, mp)).toBeCloseTo(5, 1);
  });
});

describe("sonde du large (spots personnalisés) — best-effort strict", () => {
  const custom = { lat: -31.88, lng: 115.75 };
  const origFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = origFetch; });

  it("réseau en échec → null, jamais d'exception (on retombe sur le comportement d'avant)", async () => {
    globalThis.fetch = () => Promise.reject(new Error("Load failed"));
    await expect(probeOffshoreBearing(custom, "best_match", undefined)).resolves.toBeNull();
  });

  it("réponse HTTP non-ok → null", async () => {
    globalThis.fetch = () => Promise.resolve({ ok: false, status: 429, json: async () => ({}) });
    await expect(probeOffshoreBearing(custom, "best_match", undefined)).resolves.toBeNull();
  });

  it("choisit le cap dont la houle moyenne est la plus forte (= le large)", async () => {
    // 8 caps : 0,45,90,135,180,225,270,315. On met la mer plein ouest (270).
    const series = (v) => ({ hourly: { swell_wave_height: Array(24).fill(v) } });
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      json: async () => [
        series(0.1), series(0.1), series(0.1), series(0.1),
        series(0.2), series(0.9), series(1.8), series(0.9),
      ],
    });
    await expect(probeOffshoreBearing(custom, "best_match", undefined)).resolves.toBe(270);
  });

  it("cellules à terre (séries vides ou trop courtes) sont ignorées", async () => {
    const short = { hourly: { swell_wave_height: [null, null, 0.4] } };
    const good = { hourly: { swell_wave_height: Array(24).fill(1.1) } };
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      json: async () => [short, short, short, short, short, short, short, good], // 315 seul valide
    });
    await expect(probeOffshoreBearing(custom, "best_match", undefined)).resolves.toBe(315);
  });

  it("aucune cellule exploitable → null", async () => {
    const dead = { hourly: { swell_wave_height: [] } };
    globalThis.fetch = () => Promise.resolve({ ok: true, json: async () => Array(8).fill(dead) });
    await expect(probeOffshoreBearing(custom, "best_match", undefined)).resolves.toBeNull();
  });
});

describe("windswell — une vague, pas seulement du bruit", () => {
  // `wind_wave_height` n'entrait dans le moteur QUE comme pénalité (chopMult) :
  // il faisait baisser le score, jamais grossir la vague. Les jours où
  // l'essentiel de l'énergie est dans la partition windsea, l'app annonçait
  // "0-2 ft" alors qu'il y avait de quoi surfer (cas terrain Trigg 30/07).
  const wmk = (o) => mk({ swellHeight: 0.4, swellPeriod: 10, ...o });

  it("sans windswell : bit-à-bit identique (non-régression stricte)", () => {
    for (const sw of [0.3, 0.8, 1.5, 2.5]) {
      for (const lvl of USER_LEVELS) {
        const a = scoreForLevel(mk({ swellHeight: sw }), spot, lvl).score;
        const b = scoreForLevel(mk({ swellHeight: sw, windWaveHeight: null }), spot, lvl).score;
        expect(a).toBe(b);
      }
    }
  });

  it("un windswell qui porte plus d'énergie devient la partition dominante", () => {
    const petit = wmk({ windWaveHeight: 0.25, windWavePeriod: 6, windWaveDir: 240 });
    expect(pickDominantSwell(petit, spot).isWind).toBeFalsy(); // porte 0.2-0.4 m
    const gros = wmk({ windWaveHeight: 1.2, windWavePeriod: 8, windWaveDir: 240 });
    expect(pickDominantSwell(gros, spot).isWind).toBe(true);
    // …et la vague grossit réellement au lieu de rester à la houle seule
    expect(faceFtOf(gros, spot)).toBeGreaterThan(faceFtOf(petit, spot));
  });

  it("sa période courte le pénalise — il ne vaut jamais une houle longue à taille égale", () => {
    const houle = mk({ swellHeight: 1.2, swellPeriod: 15 });
    const windsea = mk({ swellHeight: 0.2, windWaveHeight: 1.2, windWavePeriod: 6, windWaveDir: 240 });
    expect(scoreV2(windsea, spot, "intermediate").score)
      .toBeLessThan(scoreV2(houle, spot, "intermediate").score);
  });

  it("pas de double pénalité : le chop ne s'applique pas au windswell contre lui-même", () => {
    // Quand la partition notée EST le windsea, le ratio windWave/hEff vaut
    // ~1/atténuation → pénalité maximale d'une vague contre elle-même.
    const h = mk({ swellHeight: 0.2, windWaveHeight: 1.0, windWavePeriod: 8, windWaveDir: 240 });
    expect(scoreV2(h, spot, "intermediate").multipliers.chop).toBe(1);
  });

  it("aucune falaise sur l'axe windswell 0→2.5 m (score ET face)", () => {
    for (const lvl of USER_LEVELS) {
      for (const sw of [0.3, 1.5]) {
        for (const wp of [5, 9]) {
          let ps = null, pf = null;
          for (let wh = 0; wh <= 2.5001; wh += 0.01) {
            const h = mk({ swellHeight: sw, windWaveHeight: +wh.toFixed(2), windWavePeriod: wp, windWaveDir: 240 });
            const s = scoreForLevel(h, spot, lvl).score;
            const f = faceFtOf(h, spot);
            if (ps != null) expect(Math.abs(s - ps)).toBeLessThanOrEqual(8);
            if (pf != null) expect(Math.abs(f - pf)).toBeLessThanOrEqual(0.5);
            ps = s; pf = f;
          }
        }
      }
    }
  });
});

describe("CLAUDE.md safety invariants", () => {
  it("reef/heavy spot → hard no for first_timer and beginner", () => {
    const h = mk({ swellHeight: 1.0 });
    expect(getPersonalVerdict("first_timer", h, reef)).toBe("no");
    expect(getPersonalVerdict("beginner", h, reef)).toBe("no");
  });
  it("strong current → never GO for a learner", () => {
    const h = mk({ swellHeight: 0.7, currentVel: 0.4 });
    for (const lvl of ["first_timer", "beginner"]) {
      expect(getPersonalVerdict(lvl, h, spot)).not.toBe("yes");
    }
  });
  it("dangerous current → hard no for learners", () => {
    const h = mk({ swellHeight: 0.7, currentVel: 0.6 });
    expect(getPersonalVerdict("first_timer", h, spot)).toBe("no");
  });
  it("gale onshore kills every level", () => {
    const h = mk({ windSpeedKn: 25, windDir: 270 }); // ~46 km/h onshore
    for (const lvl of USER_LEVELS) {
      expect(getPersonalVerdict(lvl, h, spot)).toBe("no");
    }
  });
});

describe("LevelMatrix highlight mapping", () => {
  it("maps every level to the row that carries it", () => {
    const rows = levelMatrixFor(
      { ...mk({}), faceFtLow: 2, faceFtHigh: 3 },
      spot,
      { classifyConditions, getPersonalVerdict, hasInsideReform: () => false },
    );
    // first_timer shares the beginner row; every other level must land on
    // a row whose `level` field matches exactly.
    for (const lvl of USER_LEVELS) {
      const idx = LEVEL_TO_MATRIX_IDX[lvl];
      const rowLevel = rows[idx].level;
      if (lvl === "first_timer") expect(rowLevel).toBe("beginner");
      else expect(rowLevel).toBe(lvl);
    }
  });
});

describe("score scale", () => {
  it("covers 0-100 with no gaps or overlaps", () => {
    for (let s = 0; s <= 100; s++) {
      const bands = SCORE_SCALE.filter((b) => s >= b.min && s <= b.max);
      expect(bands.length).toBe(1);
      expect(getLevel(s).key).toBe(bands[0].key);
    }
  });
});

describe("baseSize grids", () => {
  it("are defined and bounded for every level across the swell range", () => {
    for (const lvl of USER_LEVELS) {
      for (let h = 0; h <= 10; h += 0.1) {
        const v = lookupBaseSize(h, lvl);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("windClass — single source for wind direction classification", () => {
  it("matches the historical 45°/135° bands over the full grid", () => {
    for (let d = 0; d <= 180; d++) {
      const expected = d <= 45 ? "offshore" : d >= 135 ? "onshore" : "cross";
      expect(windClass(d)).toBe(expected);
    }
  });
  it("returns null on unknown delta instead of a silent NaN fallthrough", () => {
    expect(windClass(NaN)).toBe(null);
    expect(windClass(undefined)).toBe(null);
  });
});

describe("tideNotes — minimal notes generator (ex-scoreSurf)", () => {
  const tSpot = { idealTide: "mid-high" };
  const ctx = { min: 0, max: 1 };
  it("snapshot over 10 representative cases", () => {
    const cases = [
      [{ tideM: 0.7 }, tSpot, ctx, ["n_tide_prime"]],   // pile sur target 0.7
      [{ tideM: 0.75 }, tSpot, ctx, ["n_tide_prime"]],
      [{ tideM: 0.5 }, tSpot, ctx, ["n_tide_ok"]],
      [{ tideM: 0.95 }, tSpot, ctx, ["n_tide_ok"]],
      [{ tideM: 0.05 }, tSpot, ctx, ["n_tide_wrong"]],  // delta 0.65 > 0.6
      [{ tideM: 0.35 }, tSpot, ctx, []],                 // delta 0.35 : zone neutre
      [{ tideM: null }, tSpot, ctx, []],
      [{ tideM: 0.7 }, { idealTide: "any" }, ctx, []],
      [{ tideM: 0.7 }, tSpot, { min: 0, max: 0.1 }, []], // range ≤ 0.15
      [{ tideM: 0.7 }, tSpot, null, []],
    ];
    for (const [h, sp, c, expected] of cases) {
      expect(tideNotes(h, sp, c)).toEqual(expected);
    }
  });
  it("feeds the tide chip exactly as before", () => {
    const prime = { ...mk({ tideM: 0.7 }), notes: ["n_tide_prime"] };
    const wrong = { ...mk({ tideM: 0.05 }), notes: ["n_tide_wrong"] };
    expect(drivingChipsFor(prime, spot, "intermediate").map((c) => c.t)).toContain("Tide in the sweet spot");
    expect(drivingChipsFor(wrong, spot, "intermediate").map((c) => c.t)).toContain("Wrong tide for this spot");
  });
});

describe("lookupTideMult", () => {
  const ctx = { min: 0, max: 1 };
  it("neutral without ctx / idealTide any / tideM null / flat range", () => {
    expect(lookupTideMult(null, "mid", 0.5)).toBe(1.0);
    expect(lookupTideMult(ctx, "any", 0.5)).toBe(1.0);
    expect(lookupTideMult(ctx, "mid", null)).toBe(1.0);
    expect(lookupTideMult({ min: 0, max: 0.1 }, "mid", 0.05)).toBe(1.0);
  });
  it("rewards the target window, penalizes the opposite phase (band-center anchors)", () => {
    // Ancres aux centres des anciennes bandes (rampe continue, mêmes valeurs)
    expect(lookupTideMult(ctx, "mid-high", 0.7)).toBe(1.06);    // delta 0 (plateau ≤0.075)
    expect(lookupTideMult(ctx, "mid-high", 0.475)).toBeCloseTo(1.02, 5); // delta 0.225
    expect(lookupTideMult(ctx, "mid-high", -0.05)).toBe(0.92);  // delta 0.75 (plateau ≥0.75)
  });
  it("is continuous — no cliff bigger than 0.5% per cm of tide", () => {
    let prev = null;
    for (let m = -0.2; m <= 1.2001; m += 0.01) {
      const v = lookupTideMult(ctx, "mid-high", m);
      if (prev != null) expect(Math.abs(v - prev)).toBeLessThan(0.005);
      prev = v;
    }
  });
  it("tideM outside the day's ctx does not explode", () => {
    const v = lookupTideMult({ min: -0.12, max: 0.12 }, "mid-high", 0.5);
    expect(v).toBeGreaterThanOrEqual(0.92);
    expect(v).toBeLessThanOrEqual(1.06);
  });
});

describe("adaptForecastToLevel", () => {
  const mkDay = (hours) => ({ hours, tideCtx: null });
  const shaped = (o) => ({ ...mk(o), swellDirDeg: 240, windDirDeg: 90, score: 50 });
  it("recomputes scores per level and bestHour from the adapted set", () => {
    const payload = { days: [mkDay([shaped({ swellHeight: 0.6 }), shaped({ swellHeight: 1.6 })])] };
    const ft = adaptForecastToLevel(payload, "first_timer", spot);
    const exp = adaptForecastToLevel(payload, "expert", spot);
    expect(ft.days[0].hours[0].score).not.toBe(exp.days[0].hours[0].score);
    const best = ft.days[0].bestHour;
    expect(best.score).toBe(Math.max(...ft.days[0].hours.map((h) => h.score)));
  });
  it("survives a day with no hours", () => {
    const payload = { days: [mkDay([])] };
    const out = adaptForecastToLevel(payload, "intermediate", spot);
    expect(out.days[0].bestHour).toBe(null);
  });
});

describe("spot without configuration (failed inference)", () => {
  const bare = { type: "beach" };
  it("scores finite with neutral multipliers and an explicit wind class", () => {
    const r = scoreV2(mk({}), bare, "intermediate");
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.multipliers.wind).toBe(1.0);
    expect(r.multipliers.dir).toBe(1.0);
    const cls = classifyConditions("beginner", mk({}), bare);
    expect(["clean", "bumpy", "blown"]).toContain(cls.wind);
  });
});

describe("multi-swell tie", () => {
  it("perfectly equal partitions → primary wins deterministically", () => {
    const tie = mk({ secSwellH: 1.2, secSwellP: 12, secSwellDir: 240 });
    expect(pickDominantSwell(tie, spot).isSecondary).toBe(false);
  });
});

describe("NaN guards", () => {
  it("scoreV2 survives missing fields with neutral multipliers", () => {
    const r = scoreV2({ swellHeight: null, swellPeriod: null, windSpeedKn: null, swellDir: null, windDir: null }, spot, "intermediate");
    expect(Number.isFinite(r.score)).toBe(true);
  });
  it("faceFt stays finite for classifyConditions on partial data", () => {
    const cls = classifyConditions("beginner", { swellHeight: 0.8, swellPeriod: null, windSpeedKn: 5, windDir: 90 }, spot);
    expect(Number.isFinite(cls.faceFt)).toBe(true);
    expect(Number.isFinite(mToFt(1))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// CAS TERRAIN — sessions réellement vécues par Louis à Trigg.
//
// Ce ne sont pas des cas inventés : ce sont deux journées qu'il a faites,
// avec son verdict à lui. Elles encadrent le moteur par les DEUX bouts, et
// c'est ça qui compte — resserrer pour éviter un trajet inutile ne doit
// jamais faire rater une bonne session, et l'inverse non plus.
//
// Si un de ces deux tests casse un jour, ce n'est pas le test qu'il faut
// ajuster : c'est que le moteur s'est remis à mentir sur une journée dont
// on connaît la réponse.
// ─────────────────────────────────────────────────────────────────────
describe("cas terrain Trigg", () => {
  const TRIGG_REEL = {
    id: "trigg", lat: -31.8826, lng: 115.7519, idealSwellDir: 240,
    offshoreWindDir: 90, idealTide: "mid-high", swellAttenuation: 0.60, type: "beach",
  };
  const hour = (over) => ({
    time: "2026-09-10T15:00", hour: 15,
    swellPeriod: 11, swellDir: 250,
    windWaveHeight: 0.15, windWavePeriod: 4, windWaveDir: 220,
    tideM: 0.4, seaTemp: 18, airTemp: 24, rainProb: 0, currentVel: 0.08,
    ...over,
  });

  // JEUDI APRÈS-MIDI — "5-7 km/h de vent, 1-3 ft, c'était super top".
  // Le contre-exemple qui interdit de sur-resserrer : les après-midi sans
  // vent existent, et il ne faut pas les enterrer sous un plafond trop bas.
  it("jeudi aprem sans vent, 1-3 ft : GO franc pour un beginner", () => {
    const h = hour({ swellHeight: 0.8, windSpeedKn: 6 / 1.852, windGustKn: 8 / 1.852, windDir: 120 });
    expect(faceFtOf(h, TRIGG_REEL)).toBeGreaterThan(1);
    expect(faceFtOf(h, TRIGG_REEL)).toBeLessThan(3);
    expect(classifyConditions("beginner", h, TRIGG_REEL).wind).toBe("clean");
    expect(getPersonalVerdict("beginner", h, TRIGG_REEL)).toBe("yes");
    // Et le libellé doit suivre : un GO sur une session "super top" ne peut
    // pas s'afficher en Poor.
    expect(scoreForLevel(h, TRIGG_REEL, "beginner").score).toBeGreaterThanOrEqual(60);
  });

  it("jeudi reste GO sur toute la plage de vent qu'il a pu y avoir (5-7 km/h)", () => {
    [5, 6, 7].forEach((kmh) => {
      const h = hour({ swellHeight: 0.8, windSpeedKn: kmh / 1.852, windGustKn: (kmh * 1.4) / 1.852, windDir: 120 });
      expect(getPersonalVerdict("beginner", h, TRIGG_REEL)).toBe("yes");
    });
  });

  // RELEVÉ RÉEL Open-Meteo, Trigg, 14/09 18h15 : moyenne 10.3 km/h,
  // rafales 22.3, direction 125 (offshore à Trigg). L'app affichait
  // "10 km/h · clean" ; sur place ça soufflait visiblement plus.
  // C'est la rafale, pas le point de mesure, qui portait l'information.
  it("relevé réel 10.3/22.3 : la rafale sort le vent de 'clean'", () => {
    const h = hour({
      time: "2026-09-14T18:00", swellHeight: 1.3, swellDir: 270,
      windSpeedKn: 10.3 / 1.852, windGustKn: 22.3 / 1.852, windDir: 125,
    });
    // Le vent ressenti est à mi-chemin entre moyenne et rafale.
    expect(feltWindKmh(h)).toBeCloseTo(16.3, 1);
    // Avant : "clean" pour un beginner. La moyenne seule ne pouvait pas
    // voir un facteur de rafale de 2.17.
    expect(classifyConditions("beginner", h, TRIGG_REEL).wind).not.toBe("clean");
    // Aucun learner ne reçoit un GO franc sur un vent qui double par
    // bourrasques. Volontairement PAS "no" en dur : ce relevé tombe à
    // 16.3 de vent ressenti pour un plafond first_timer offshore de 17,
    // soit 0.7 km/h sous la bascule. Figer "no" ici reviendrait à graver
    // un résultat que le moteur ne tient que par accident.
    // early_int n'est PAS dans la liste : sur un offshore à 2-4 ft, un
    // mid-length encaisse des rafales à 22. Le moteur lui rend "yes" et
    // c'est défendable — c'est le foamie qu'elles déséquilibrent.
    ["first_timer", "beginner"].forEach((lvl) => {
      expect(getPersonalVerdict(lvl, h, TRIGG_REEL)).not.toBe("yes");
    });
  });

  it("pas de rafale servie → on ne fabrique rien, la moyenne fait foi", () => {
    const base = { swellHeight: 1.3, swellDir: 270, windSpeedKn: 12 / 1.852, windDir: 125 };
    expect(feltWindKmh(hour(base))).toBeCloseTo(12, 1);
    // Rafale aberrante (sous la moyenne) : ignorée, pas de valeur négative.
    expect(feltWindKmh(hour({ ...base, windGustKn: 5 / 1.852 }))).toBeCloseTo(12, 1);
  });

  // LUNDI 14/09 17h — l'app affichait "Good 49 · WORTH IT", il a conduit,
  // c'était très venteux et pas surfable. Valeurs exactes de son écran.
  // Le vent affiché (10 km/h) était lui-même sous-lu : le vrai était 20+.
  it("lundi 14/09 venteux, 2-4 ft : SKIP pour un beginner dès 15 km/h", () => {
    [15, 18, 20, 25].forEach((kmh) => {
      const h = hour({
        time: "2026-09-14T17:00", swellHeight: 1.3, swellDir: 270,
        windWaveHeight: 0.4, windWaveDir: 200, tideM: 0.1, currentVel: 0.6 / 3.6,
        windSpeedKn: kmh / 1.852, windGustKn: (kmh * 1.5) / 1.852, windDir: 145, // SE cross-shore
      });
      expect(getPersonalVerdict("beginner", h, TRIGG_REEL)).toBe("no");
    });
  });

  it("lundi : le libellé du score ne peut pas flatter un SKIP", () => {
    const h = hour({
      time: "2026-09-14T17:00", swellHeight: 1.3, swellDir: 270,
      windWaveHeight: 0.4, windWaveDir: 200, tideM: 0.1, currentVel: 0.6 / 3.6,
      windSpeedKn: 20 / 1.852, windGustKn: 30 / 1.852, windDir: 145,
    });
    // SKIP plafonne à 29 = haut de "Poor" (cf. BAND_MAPS). Jamais "Good".
    expect(scoreForLevel(h, TRIGG_REEL, "beginner").score).toBeLessThanOrEqual(29);
  });
});
