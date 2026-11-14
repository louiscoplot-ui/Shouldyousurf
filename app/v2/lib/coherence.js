// Display coherence checks: does what the screen says agree with itself?
//
// Deterministic on purpose. These are yes/no rules on values the engine
// already computes; an AI model would be slower, cost money on every hour
// and could disagree with itself. Run:
//   - in CI on every push (tests/coherence.test.mjs sweeps thousands of
//     synthetic hours over every level, sand and reef, and fails on any hit);
//   - by hand on any spot/hour: `node scripts/coherence-check.mjs`.
//
// Rules:
//   tip_tone      a MAYBE or SKIP shown with a tip that says "go" (the
//                 Thomas Beach case of 14/11: WORTH IT + "go score some waves")
//   label_band    a score label more flattering than the verdict allows
//                 (SKIP must read Poor or below, MAYBE Good or below)

import { getPersonalVerdict, getPersonalAdviceKey, scoreForLevel } from "./prodScoring";
import { getLevel } from "./verdict";

// Tips whose English text tells the user to go (checked against app/i18n.js:
// "go have a proper session", "go for it", "go score some waves", "get on it",
// "go send it", "a proper day for you", "all yours", "full-commitment day").
export const GO_TONE_TIPS = new Set([
  "tip_beginner_sweet_clean",
  "tip_beginner_upper_clean",
  "tip_early_int_sweet_clean",
  "tip_intermediate_sweet_clean",
  "tip_advanced_sweet_clean",
  "tip_advanced_upper_clean",
  "tip_expert_sweet_clean",
  "tip_expert_upper_clean",
]);

const MAX_SCORE_FOR = { no: 29, ok: 59 };

export function checkHour(level, h, spot) {
  const issues = [];
  const verdict = getPersonalVerdict(level, h, spot);
  const tip = getPersonalAdviceKey(level, h, spot, verdict);
  if (verdict !== "yes" && GO_TONE_TIPS.has(tip)) {
    issues.push({ rule: "tip_tone", verdict, tip });
  }
  const { score } = scoreForLevel(h, spot, level);
  const cap = MAX_SCORE_FOR[verdict];
  if (cap != null && score > cap) {
    issues.push({ rule: "label_band", verdict, score, label: getLevel(score).key });
  }
  return { verdict, tip, score, issues };
}

// A deterministic grid of synthetic hours: every level x sand / reef / heavy
// reef x size x period x wind speed x wind direction x current. Used by the
// CI test and the CLI. Directions are relative to the spot (offshore, cross,
// onshore), so the grid means the same thing on any coast.
export const SWEEP = {
  levels: ["first_timer", "beginner", "early_int", "intermediate", "advanced", "expert"],
  bottoms: [{ type: "beach" }, { type: "reef" }, { type: "reef", heavy: true }],
  swellM: [0.2, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.4, 1.6, 1.9, 2.2, 2.6, 3.0, 4.0],
  periodS: [5, 6.5, 7.5, 9, 11, 14],
  windKmh: [3, 8, 11, 13, 16, 19, 21, 24, 27, 32, 40, 55],
  windRel: [0, 90, 180], // 0 = offshore, 90 = cross, 180 = onshore
  currentMs: [0, 0.32, 0.45, 0.6],
};

export function* sweepCases(grid = SWEEP) {
  const base = { id: "sweep", lat: 0, lng: 0, idealSwellDir: 270, offshoreWindDir: 90 };
  for (const bottom of grid.bottoms) {
    const spot = { ...base, ...bottom };
    for (const swellHeight of grid.swellM) for (const swellPeriod of grid.periodS)
    for (const kmh of grid.windKmh) for (const rel of grid.windRel) for (const currentVel of grid.currentMs) {
      const h = {
        time: "2026-11-14T08:00", hour: 8,
        swellHeight, swellPeriod, swellDir: 270,
        windSpeedKn: kmh / 1.852, windGustKn: (kmh * 1.4) / 1.852,
        windDir: (90 + rel) % 360,
        windWaveHeight: 0.1, windWavePeriod: 3, windWaveDir: (90 + rel) % 360,
        tideM: 0.5, currentVel,
      };
      for (const level of grid.levels) yield { level, h, spot };
    }
  }
}
