// TRIGG GOLDEN TEST: Trigg's full app output must never change by accident.
//
// Runs the app's real pipeline (realFetch.fetchRealForecast -> shapeHour ->
// adaptForecastToLevel, the same calls MainScreen makes) for Trigg on a FIXED
// input (fixtures/trigg-openmeteo.json, served in place of Open-Meteo) at a
// FIXED instant (05:17 Perth, 27/09/2026). It then compares, byte for byte,
// everything a user sees over the next 72 h against the committed snapshot
// fixtures/trigg-golden.json:
//   per level (6): score, band label, verdict, advice key, modifier, face
//                  range of every hour, and the best window of each day.
// Plus an engine-level SWEEP (1,008 synthetic hours: swell x period x wind
// x direction x current) scored directly with Trigg's config, for the
// combinations a 72 h window never shows.
//
// Why: Trigg is the break with the most field-verified sessions (see the
// "cas terrain Trigg" tests). Config or engine work elsewhere must not move
// it without anyone noticing.
//
// If this test fails:
//   - You did NOT mean to change Trigg: find what leaked (a shared default,
//     a table, an engine constant). Don't touch the snapshot.
//   - You DID mean to change the engine: regenerate on purpose, commit the
//     snapshot diff with the reason, and review it line by line. Regenerate
//     ONLY the levels you meant to change; the others must stay identical:
//       UPDATE_TRIGG_GOLDEN=intermediate,advanced,expert npx vitest run tests/trigg-golden.test.mjs
//       UPDATE_TRIGG_GOLDEN=1   (all levels)
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { BREAKS } from "../app/breaks.js";
import { fetchRealForecast } from "../app/v2/lib/realFetch.js";
import {
  adaptForecastToLevel, getPersonalVerdict, getPersonalAdviceKey, getPersonalModifier,
  scoreForLevel, classifyConditions, USER_LEVELS,
} from "../app/v2/lib/prodScoring.js";
import { getLevel } from "../app/v2/lib/verdict.js";

const NOW = new Date("2026-09-26T21:17:00Z"); // 05:17 AWST, 27/09
const HORIZON_MS = 72 * 3600e3;
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/trigg-openmeteo.json", import.meta.url), "utf8"));
const GOLDEN_URL = new URL("./fixtures/trigg-golden.json", import.meta.url);

// Serves the fixture for the date window each request asks for, in the
// same shape as Open-Meteo (hourly arrays, + daily for the forecast API).
function fakeOpenMeteo(input) {
  const url = new URL(typeof input === "string" ? input : input.url);
  const q = url.searchParams;
  if ((q.get("latitude") || "").includes(",")) return new Response("", { status: 503 }); // multi-point probe: not used here
  const perthToday = NOW.toLocaleDateString("en-CA", { timeZone: FIXTURE.timezone });
  const addDays = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const start = q.get("start_date") || perthToday;
  const end = q.get("end_date") || addDays(perthToday, +(q.get("forecast_days") || 5) - 1);
  const idx = FIXTURE.hourly.time.map((t, i) => [t.slice(0, 10), i]).filter(([d]) => d >= start && d <= end).map(([, i]) => i);
  const pick = (keys) => Object.fromEntries(keys.map((k) => [k, idx.map((i) => FIXTURE.hourly[k][i])]));
  const isMarine = url.hostname.includes("marine");
  const keys = (q.get("hourly") || "").split(",").filter((k) => k in FIXTURE.hourly);
  const body = {
    latitude: +q.get("latitude"), longitude: +q.get("longitude"), elevation: 0, timezone: FIXTURE.timezone,
    ...(isMarine ? { hourly_units: { ocean_current_velocity: "m/s" } } : {}),
    hourly: { time: idx.map((i) => FIXTURE.hourly.time[i]), ...pick(keys) },
  };
  if (!isMarine && q.get("daily")) {
    const di = FIXTURE.daily.time.map((d, i) => [d, i]).filter(([d]) => d >= start && d <= end).map(([, i]) => i);
    body.daily = { time: di.map((i) => FIXTURE.daily.time[i]), sunrise: di.map((i) => FIXTURE.daily.sunrise[i]), sunset: di.map((i) => FIXTURE.daily.sunset[i]) };
  }
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

async function triggOutput() {
  const trigg = BREAKS.find((b) => b.id === "trigg");
  const payload = await fetchRealForecast(trigg);
  const spot = payload.effectiveSpot;
  const inWindow = (h) => {
    const t = new Date(`${h.time}:00+08:00`).getTime(); // Trigg is AWST, no daylight saving
    return t >= NOW.getTime() && t < NOW.getTime() + HORIZON_MS;
  };
  const out = { now: NOW.toISOString(), spot: { id: spot.id, timezone: spot.timezone }, levels: {} };
  for (const level of USER_LEVELS) {
    const adapted = adaptForecastToLevel(payload, level, spot);
    out.levels[level] = adapted.days
      .filter((d) => d.hours.some(inWindow))
      .map((d) => ({
        date: d.dateStr,
        best: d.bestHour && { time: d.bestHour.time, score: d.bestHour.score, band: getLevel(d.bestHour.score).label },
        hours: d.hours.filter(inWindow).map((h) => {
          const hDeg = { ...h, swellDir: h.swellDirDeg ?? h.swellDir, windDir: h.windDirDeg ?? h.windDir };
          const verdict = getPersonalVerdict(level, hDeg, spot);
          return {
            time: h.time,
            score: h.score,
            band: getLevel(h.score).label,
            verdict,
            advice: getPersonalAdviceKey(level, hDeg, spot, verdict),
            modifier: getPersonalModifier(level, hDeg, spot),
            face: `${h.faceFtLow}-${h.faceFtHigh}`,
          };
        }),
      }));
  }
  out.sweep = sweepOutput(BREAKS.find((b) => b.id === "trigg"));
  return out;
}

// Engine-level sweep on Trigg's config: one compact line per hour and level
// ("score|verdict|advice|modifier|size|wind|current").
function sweepOutput(trigg) {
  const out = {};
  for (const swellHeight of [0.3, 0.6, 0.9, 1.2, 1.6, 2.0, 2.5])
    for (const swellPeriod of [8, 11, 14])
      for (const kmh of [0, 6, 10, 14, 18, 22, 28, 36])
        for (const windDir of [90, 180, 270]) // offshore, cross, onshore at Trigg (offshoreWindDir 90)
          for (const currentVel of [0, 0.35]) {
            const h = { hour: 9, swellHeight, swellPeriod, swellDir: 240, windSpeedKn: kmh / 1.852, windDir, currentVel, tideM: 0 };
            const id = `h${swellHeight} p${swellPeriod} w${kmh}@${windDir} c${currentVel}`;
            out[id] = Object.fromEntries(USER_LEVELS.map((level) => {
              const verdict = getPersonalVerdict(level, h, trigg);
              const c = classifyConditions(level, h, trigg);
              return [level, [scoreForLevel(h, trigg, level).score, verdict, getPersonalAdviceKey(level, h, trigg, verdict),
                getPersonalModifier(level, h, trigg), c.size, c.wind, c.currentHazard].join("|")];
            }));
          }
  return out;
}

// Serialises the snapshot: pipeline part pretty-printed as before, sweep one
// line per hour so a diff points at the exact case.
function serialise(out) {
  const { sweep, ...pipeline } = out;
  const sweepLines = Object.entries(sweep).map(([id, v]) => `  ${JSON.stringify(id)}: ${JSON.stringify(v)}`);
  return JSON.stringify(pipeline, null, 1).replace(/\n\}$/, `,\n "sweep": {\n${sweepLines.join(",\n")}\n }\n}`) + "\n";
}

// Keeps the committed values for every level not named in UPDATE_TRIGG_GOLDEN.
function mergeLevels(actual, committed, levels) {
  const out = structuredClone(actual);
  for (const level of USER_LEVELS) {
    if (levels.includes(level)) continue;
    out.levels[level] = committed.levels[level];
    for (const id of Object.keys(out.sweep)) out.sweep[id][level] = committed.sweep[id]?.[level];
  }
  return out;
}

describe("Trigg golden output (must not change by accident)", () => {
  let savedLocalStorage;
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.stubGlobal("fetch", async (input) => fakeOpenMeteo(input));
    // No device cache: behave like a first load (no probed bearing).
    savedLocalStorage = globalThis.localStorage;
    delete globalThis.localStorage;
  });
  afterAll(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (savedLocalStorage) globalThis.localStorage = savedLocalStorage;
  });

  it("scores, bands, verdicts, advice, face, best window and the sweep, for all 6 levels, are byte-identical", async () => {
    const actual = await triggOutput();
    const update = process.env.UPDATE_TRIGG_GOLDEN;
    if (update) {
      const levels = update === "1" ? USER_LEVELS : update.split(",");
      const next = update === "1" ? actual : mergeLevels(actual, JSON.parse(readFileSync(GOLDEN_URL, "utf8")), levels);
      writeFileSync(GOLDEN_URL, serialise(next));
      return;
    }
    const expected = readFileSync(GOLDEN_URL, "utf8");
    expect(serialise(actual)).toBe(expected);
  });

  it("the fixture really exercises the engine (not a flat day)", async () => {
    const out = await triggOutput();
    const verdicts = new Set(Object.values(out.levels).flatMap((days) => days.flatMap((d) => d.hours.map((h) => h.verdict))));
    expect([...verdicts].sort()).toEqual(["no", "ok", "yes"]);
    expect(out.levels.intermediate.flatMap((d) => d.hours).length).toBeGreaterThanOrEqual(45);
  });
});
