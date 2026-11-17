// Backup wind source (MET Norway) used when Open-Meteo refuses the wind call.
import { describe, it, expect } from "vitest";
import { metnoToOpenMeteo, sunTimesUtc } from "../app/v2/lib/metnoWind.js";

const entry = (iso, speed, dir, extra = {}) => ({ time: iso, data: { instant: { details: { wind_speed: speed, wind_from_direction: dir, air_temperature: 28, ...extra } } } });

describe("metnoToOpenMeteo", () => {
  // Bali, UTC+8: local 08:00 = 00:00Z
  const json = { properties: { timeseries: [
    entry("2026-11-17T00:00:00Z", 5, 350, { wind_speed_of_gust: 8 }),
    entry("2026-11-17T01:00:00Z", 7, 10),
    entry("2026-11-17T06:00:00Z", 10, 90),
    entry("2026-11-17T12:00:00Z", 4, 180),
  ] } };
  const times = ["2026-11-17T07:00", "2026-11-17T08:00", "2026-11-17T09:00", "2026-11-17T11:00", "2026-11-17T23:00"];
  const out = metnoToOpenMeteo(json, times, 8 * 3600, -8.8, 115.1, "Asia/Makassar");

  it("keeps only hours the backup covers, in local time, wind in knots", () => {
    expect(out.hourly.time).toEqual(["2026-11-17T08:00", "2026-11-17T09:00", "2026-11-17T11:00"]);
    expect(out.hourly.wind_speed_10m[0]).toBeCloseTo(5 * 1.943844, 2);
    expect(out.hourly.wind_gusts_10m[0]).toBeCloseTo(8 * 1.943844, 2);
  });
  it("interpolates direction across north as a vector, not through south", () => {
    // 08:30 would sit between 350 and 10; 11:00 local = 03:00Z, between 10 (01Z) and 90 (06Z)
    const d = out.hourly.wind_direction_10m[2];
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(90);
  });
  it("adds sunrise / sunset in local time for each day", () => {
    expect(out.daily.time).toEqual(["2026-11-17"]);
    const rise = out.daily.sunrise[0], set = out.daily.sunset[0];
    expect(rise.startsWith("2026-11-17T05:") || rise.startsWith("2026-11-17T06:")).toBe(true);
    expect(set.startsWith("2026-11-17T18:")).toBe(true);
  });
  it("returns null on an empty or broken response", () => {
    expect(metnoToOpenMeteo({}, times, 0, 0, 0, null)).toBeNull();
    expect(metnoToOpenMeteo({ properties: { timeseries: [] } }, times, 0, 0, 0, null)).toBeNull();
  });
});

describe("sunTimesUtc", () => {
  it("Perth, 21 June: sunrise ~07:15, sunset ~17:20 local (UTC+8)", () => {
    const s = sunTimesUtc("2026-06-21", -31.95, 115.86);
    const local = (ms) => new Date(ms + 8 * 3600000).toISOString().slice(11, 16);
    expect(local(s.rise) >= "07:05" && local(s.rise) <= "07:25").toBe(true);
    expect(local(s.set) >= "17:10" && local(s.set) <= "17:30").toBe(true);
  });
});
