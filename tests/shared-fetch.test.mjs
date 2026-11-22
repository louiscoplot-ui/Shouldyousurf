import { describe, it, expect } from "vitest";
import { cacheBucket } from "../app/v2/lib/sharedFetch.js";
const F = "https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2&forecast_days=5";
describe("clé de cache partagée", () => {
  it("change d'un jour à l'autre pour la même URL de prévision", () => {
    const d1 = Date.UTC(2026, 10, 17, 3), d2 = Date.UTC(2026, 10, 22, 3);
    expect(cacheBucket(F, d1)).not.toBe(cacheBucket(F, d2));
  });
  it("stable dans une tranche de 30 min, change à la suivante", () => {
    const t = Date.UTC(2026, 10, 22, 3, 0);
    expect(cacheBucket(F, t)).toBe(cacheBucket(F, t + 29 * 60000));
    expect(cacheBucket(F, t)).not.toBe(cacheBucket(F, t + 31 * 60000));
  });
  it("altitude : jamais de tranche", () => {
    expect(cacheBucket("https://api.open-meteo.com/v1/elevation?latitude=1", 123456789)).toBe(0);
  });
});
