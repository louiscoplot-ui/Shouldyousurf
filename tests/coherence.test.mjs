// Display coherence, checked on every push (CI runs `npm test`).
// See app/v2/lib/coherence.js for the rules and why they are deterministic.
import { describe, it, expect } from "vitest";
import { sweepCases, checkHour, GO_TONE_TIPS } from "../app/v2/lib/coherence.js";
import { getT } from "../app/i18n.js";

describe("coherence: no screen contradicts itself", () => {
  it("sweep over every level, sand / reef / heavy reef: zero issues", () => {
    const hits = [];
    let n = 0;
    for (const { level, h, spot } of sweepCases()) {
      n++;
      const r = checkHour(level, h, spot);
      if (r.issues.length && hits.length < 10) hits.push({ level, type: spot.type, heavy: !!spot.heavy, h, issues: r.issues });
    }
    expect(n).toBeGreaterThan(200000);
    expect(hits).toEqual([]);
  });

  it("Thomas Beach 14/11 (searched spot, Bali): WORTH IT no longer says 'go score some waves'", () => {
    // early_int, 1.2 m @ 11 s, clean ESE offshore, modelled current 1.8 km/h (0.5 m/s)
    const spot = { id: "custom-thomas", lat: -8.81, lng: 115.09, idealSwellDir: 210, offshoreWindDir: 120, type: "beach" };
    const h = { time: "2026-11-15T12:00", hour: 12, swellHeight: 1.2, swellPeriod: 11, swellDir: 202,
      windSpeedKn: 9 / 1.852, windGustKn: 13 / 1.852, windDir: 115, windWaveHeight: 0.1, windWavePeriod: 3,
      windWaveDir: 115, tideM: 0.8, currentVel: 0.5 };
    const r = checkHour("early_int", h, spot);
    expect(r.verdict).toBe("ok");
    expect(r.tip).toBe("tip_early_int_current_caution");
    expect(r.issues).toEqual([]);
  });

  it("every GO-tone tip key exists in English (the rule checks real tips)", () => {
    const t = getT("en");
    for (const k of GO_TONE_TIPS) expect(t(k)).not.toBe(k);
    expect(t("tip_early_int_current_caution")).not.toBe("tip_early_int_current_caution");
    expect(getT("fr")("tip_early_int_current_caution")).not.toBe(getT("en")("tip_early_int_current_caution"));
  });
});
