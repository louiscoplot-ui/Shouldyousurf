// Every number in the video comes from HERE, computed at render time by the
// app's real scoring engine (imported straight from app/v2/lib, not copied,
// so the video can never drift from what shouldyousurf.com would say).
//
// To change the conditions: edit src/scenario.js.
// To change the words on screen: edit COPY below.
import {
  scoreForLevel, getPersonalVerdict, faceFtOf, dayTideCtx,
  classifyConditions, hasInsideReform, mToFt,
} from "../../app/v2/lib/prodScoring.js";
import { getLevel, levelMatrixFor } from "../../app/v2/lib/verdict.js";
import { SPOT, SWELL, WIND_BY_HOUR, rawHour, SUNRISE } from "./scenario.js";

export const COPY = {
  hook: ["Is", "it", "worth", "paddling", "out?"],
  hookSub: `${SPOT.name} · 5:40am`,
  scoreKicker: "Intermediate · right now",
  sameWave: "Same wave.",
  differentAnswer: "Different answer.",
  timelineTitle: "Today, hour by hour",
  wavePayoff: ["Know before", "you go."],
  url: "shouldyousurf.com",
  // layout.js says "90+ breaks worldwide"; breaks.js actually holds 111.
  breaks: "Trigg + 90 breaks worldwide",
  appCaption: "The real app",
};

const DATE = "2026-09-26";
export const HERO_LEVEL = "intermediate";
export const HERO_HOUR = 6;

const dayHours = Array.from({ length: 24 }, (_, h) => rawHour(DATE, h));
const tideCtx = dayTideCtx(dayHours);
const fns = { classifyConditions, getPersonalVerdict, hasInsideReform };

// Same labels as the app (i18n.js: go / maybe / skip).
export const VERDICT_UI = {
  yes: { label: "GO", color: "#16a34a" },
  ok: { label: "WORTH IT", color: "#ea580c" },
  no: { label: "SKIP", color: "#dc2626" },
};

const hero = dayHours[HERO_HOUR];
const heroScore = scoreForLevel(hero, SPOT, HERO_LEVEL, tideCtx).score;
const faceFt = faceFtOf(hero, SPOT);
const [windKmh] = WIND_BY_HOUR[HERO_HOUR];

export const HERO = {
  score: heroScore,
  band: getLevel(heroScore), // { label: "Excellent", color: "#2d9178", ... }
  faceLow: Math.max(0, Math.floor(faceFt - 0.5)),
  faceHigh: Math.max(1, Math.ceil(faceFt + 0.5)),
  swell: `${SWELL.height} m · ${SWELL.period} s`,
  wind: `${windKmh} km/h offshore`,
};

// Per-level rows, exactly as LevelMatrix.jsx builds them.
export const LEVELS = levelMatrixFor(hero, SPOT, fns).map((r) => ({
  name: r.name,
  reason: r.reason,
  verdict: r.verdict,
  score: scoreForLevel(hero, SPOT, r.level, tideCtx).score,
}));
export const BEGINNER = LEVELS.find((r) => r.name === "Beginner");
export const INTERMEDIATE = LEVELS.find((r) => r.name === "Intermediate");

// Timeline: first light -> early afternoon, hero level.
const FIRST = parseInt(SUNRISE, 10) + 1; // sunrise 5:54 -> first full hour 6am
export const TIMELINE = Array.from({ length: 9 }, (_, i) => {
  const h = dayHours[FIRST + i];
  const score = scoreForLevel(h, SPOT, HERO_LEVEL, tideCtx).score;
  return { hour: h.hour, score, color: getLevel(score).color };
});
const best = Math.max(...TIMELINE.map((t) => t.score));
const bestIdx = TIMELINE.map((t, i) => (t.score === best ? i : -1)).filter((i) => i >= 0);
export const BEST = {
  from: bestIdx[0],
  to: bestIdx[bestIdx.length - 1],
  label: `${fmt(TIMELINE[bestIdx[0]].hour)}–${fmt(TIMELINE[bestIdx[bestIdx.length - 1]].hour + 1)}`,
};
export function fmt(h) {
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${h < 12 ? "am" : "pm"}`;
}
export { mToFt };
