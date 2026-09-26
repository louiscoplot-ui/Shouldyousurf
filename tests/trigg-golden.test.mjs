// TRIGG GOLDEN TEST: Trigg's full app output must never change by accident.
//
// Runs the app's real pipeline (realFetch.fetchRealForecast -> shapeHour ->
// adaptForecastToLevel, the same calls MainScreen makes) for Trigg on a FIXED
// input (fixtures/trigg-openmeteo.json, served in place of Open-Meteo) at a
// FIXED instant (05:17 Perth, 27/09/2026). It then compares, byte for byte,
// everything a user sees over the next 72 h against the committed snapshot
// fixtures/trigg-golden.json:
//   per level (6): score, band label, verdict, face range of every hour,
//                  and the best window of each day.
//
// Why: Trigg is the break with the most field-verified sessions (see the
// "cas terrain Trigg" tests). Config or engine work elsewhere must not move
// it without anyone noticing.
//
// If this test fails:
//   - You did NOT mean to change Trigg: find what leaked (a shared default,
//     a table, an engine constant). Don't touch the snapshot.
//   - You DID mean to change the engine: regenerate on purpose, commit the
//     snapshot diff with the reason, and review it line by line:
//       UPDATE_TRIGG_GOLDEN=1 npx vitest run tests/trigg-golden.test.mjs
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { BREAKS } from "../app/breaks.js";
import { fetchRealForecast } from "../app/v2/lib/realFetch.js";
import { adaptForecastToLevel, getPersonalVerdict, USER_LEVELS } from "../app/v2/lib/prodScoring.js";
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
          return {
            time: h.time,
            score: h.score,
            band: getLevel(h.score).label,
            verdict: getPersonalVerdict(level, hDeg, spot),
            face: `${h.faceFtLow}-${h.faceFtHigh}`,
          };
        }),
      }));
  }
  return JSON.stringify(out, null, 1) + "\n";
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

  it("scores, bands, verdicts, face and best window for all 6 levels over 72 h are byte-identical", async () => {
    const actual = await triggOutput();
    if (process.env.UPDATE_TRIGG_GOLDEN === "1") {
      writeFileSync(GOLDEN_URL, actual);
      return;
    }
    const expected = readFileSync(GOLDEN_URL, "utf8");
    expect(actual).toBe(expected);
  });

  it("the fixture really exercises the engine (not a flat day)", async () => {
    const out = JSON.parse(await triggOutput());
    const verdicts = new Set(Object.values(out.levels).flatMap((days) => days.flatMap((d) => d.hours.map((h) => h.verdict))));
    expect([...verdicts].sort()).toEqual(["no", "ok", "yes"]);
    expect(out.levels.intermediate.flatMap((d) => d.hours).length).toBeGreaterThanOrEqual(45);
  });
});
