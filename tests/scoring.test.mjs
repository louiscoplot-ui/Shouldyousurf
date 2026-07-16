// Invariants du moteur de scoring — verrouille les "décisions à ne pas
// défaire" de CLAUDE.md et les fixes de l'audit 2026-07. Toute recalibration
// future doit passer ici AVANT push.
import { describe, it, expect } from "vitest";
import {
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
} from "../app/v2/lib/prodScoring.js";
import { BREAKS } from "../app/breaks.js";
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
  it("rewards the target window, penalizes the opposite phase", () => {
    expect(lookupTideMult(ctx, "mid-high", 0.7)).toBe(1.06);
    expect(lookupTideMult(ctx, "mid-high", 0.5)).toBe(1.02);
    expect(lookupTideMult(ctx, "mid-high", 0.05)).toBe(0.92);
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
