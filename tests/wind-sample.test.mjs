// Échantillonnage du VENT au point MER.
//
// Bug terrain Trigg 14/09 : l'app annonçait 10 km/h SE, il y avait 20+ sur la
// plage. Cause : le vent était lu aux coordonnées du spot, donc sur une
// cellule atmosphérique à dominante TERRE (le modèle global snappe, le centre
// de cellule tombe en banlieue de Perth). Le vent 10 m y est diagnostiqué avec
// une rugosité de banlieue → sous-lecture systématique, amplifiée pour un vent
// offshore qui accélère dès qu'il passe sur l'eau.
//
// Ces tests verrouillent les deux moitiés du fix :
//  1. la géométrie du point mer (windSamplePoint)
//  2. le recollage best-effort de la réponse multi-points (mergeSeaWind) —
//     c'est lui qui garantit qu'un échec ne rend JAMAIS le résultat pire
//     qu'avant le fix.
import { describe, it, expect } from "vitest";
import { windSamplePoint, mergeSeaWind, offsetPoint } from "../app/v2/lib/realFetch.js";

const TRIGG = { id: "trigg", lat: -31.8826, lng: 115.7519, idealSwellDir: 240 };

const kmBetween = (a, b) => {
  const dLat = (b.lat - a.lat) * 110.574;
  const dLng = (b.lng - a.lng) * 111.320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

describe("windSamplePoint — géométrie", () => {
  it("décale vers le large sur le cap de idealSwellDir", () => {
    const wp = windSamplePoint(TRIGG);
    expect(wp).not.toBeNull();
    // Trigg est sur la côte OUEST, idealSwellDir 240 (SW) : le point part
    // vers le sud-ouest, donc latitude plus au sud ET longitude plus à
    // l'ouest. Si un jour ça part vers l'est, on interroge Perth centre.
    expect(wp.lat).toBeLessThan(TRIGG.lat);
    expect(wp.lng).toBeLessThan(TRIGG.lng);
  });

  it("décale de 12 km — assez pour sortir d'une cellule ~0.1-0.2°", () => {
    const wp = windSamplePoint(TRIGG);
    expect(kmBetween(TRIGG, wp)).toBeGreaterThan(11);
    expect(kmBetween(TRIGG, wp)).toBeLessThan(13);
  });

  it("décale PLUS LOIN que le point marin — la grille atmo est plus grossière", () => {
    const marine = offsetPoint(TRIGG.lat, TRIGG.lng, TRIGG.idealSwellDir, 5);
    expect(kmBetween(TRIGG, windSamplePoint(TRIGG))).toBeGreaterThan(kmBetween(TRIGG, marine));
  });

  it("un cap explicite (spot personnalisé sondé) l'emporte sur idealSwellDir", () => {
    const wp = windSamplePoint({ ...TRIGG, idealSwellDir: 240 }, 90);
    expect(wp.lng).toBeGreaterThan(TRIGG.lng); // cap 90 = est
  });

  it("override windLat/windLng respecté tel quel", () => {
    const wp = windSamplePoint({ ...TRIGG, windLat: -32, windLng: 115.5 });
    expect(wp).toEqual({ lat: -32, lng: 115.5 });
  });

  it("sans cap connu → null (= coordonnées du spot, comportement d'avant)", () => {
    expect(windSamplePoint({ lat: -31.88, lng: 115.75 })).toBeNull();
    expect(windSamplePoint(null)).toBeNull();
  });
});

// ── mergeSeaWind ──────────────────────────────────────────────────────
const mkLoc = (over, elevation = 0) => ({
  latitude: -31.9,
  longitude: 115.6,
  elevation,
  timezone: "Australia/Perth",
  hourly: {
    time: ["2026-09-14T16:00", "2026-09-14T17:00"],
    wind_speed_10m: [5, 5.4],
    wind_direction_10m: [130, 135],
    wind_gusts_10m: [9, 10],
    temperature_2m: [22, 21],
    precipitation_probability: [0, 0],
    ...over,
  },
  daily: { time: ["2026-09-14"], sunrise: ["2026-09-14T06:17"], sunset: ["2026-09-14T18:08"] },
});

// [0] = cellule du spot (terre, vent sous-lu), [1] = cellule mer.
const SPOT_LOC = mkLoc({}, 24);
const SEA_LOC = mkLoc(
  {
    wind_speed_10m: [10.1, 11.2],
    wind_direction_10m: [128, 132],
    wind_gusts_10m: [16, 18],
    temperature_2m: [18, 18], // air du large : NE doit PAS remonter
  },
  0,
);

describe("mergeSeaWind — recollage", () => {
  it("prend le vent sur la cellule mer", () => {
    const m = mergeSeaWind([SPOT_LOC, SEA_LOC]);
    expect(m.hourly.wind_speed_10m).toEqual([10.1, 11.2]);
    expect(m.hourly.wind_direction_10m).toEqual([128, 132]);
    expect(m.hourly.wind_gusts_10m).toEqual([16, 18]);
    expect(m.windSampledOffshore).toBe(true);
  });

  it("garde air / pluie / lever-coucher sur la cellule du SPOT", () => {
    const m = mergeSeaWind([SPOT_LOC, SEA_LOC]);
    // La température affichée est celle de la plage où l'utilisateur est,
    // pas celle 12 km au large.
    expect(m.hourly.temperature_2m).toEqual([22, 21]);
    expect(m.hourly.precipitation_probability).toEqual([0, 0]);
    expect(m.daily).toEqual(SPOT_LOC.daily);
    expect(m.timezone).toBe("Australia/Perth");
  });

  it("le vent corrigé est bien PLUS FORT que la cellule terre (le bug)", () => {
    const m = mergeSeaWind([SPOT_LOC, SEA_LOC]);
    m.hourly.wind_speed_10m.forEach((v, i) => {
      expect(v).toBeGreaterThan(SPOT_LOC.hourly.wind_speed_10m[i]);
    });
  });

  // ── Garde-fous : jamais pire qu'avant le fix ────────────────────────
  it("réponse mono-point (pas de cap connu) → renvoyée telle quelle", () => {
    expect(mergeSeaWind(SPOT_LOC)).toBe(SPOT_LOC);
  });

  it("point mer retombé à TERRE (elevation > 2 m) → on garde le spot", () => {
    // Baie fermée, île en face : la 2e cellule est terrestre elle aussi,
    // aucun gain à en attendre.
    const inland = mkLoc({ wind_speed_10m: [3, 3] }, 40);
    expect(mergeSeaWind([SPOT_LOC, inland]).hourly.wind_speed_10m).toEqual([5, 5.4]);
  });

  it("elevation absente → on fait confiance à la géométrie", () => {
    const noElev = mkLoc({ wind_speed_10m: [10.1, 11.2] });
    delete noElev.elevation;
    expect(mergeSeaWind([SPOT_LOC, noElev]).windSampledOffshore).toBe(true);
  });

  it("série mer absente / vide / désalignée → on garde le spot", () => {
    const cases = [
      undefined,
      {},
      mkLoc({ wind_speed_10m: null }),
      mkLoc({ wind_speed_10m: [null, null] }),
      mkLoc({ wind_speed_10m: [10.1] }), // longueur différente
    ];
    cases.forEach((sea) => {
      const m = mergeSeaWind([SPOT_LOC, sea]);
      expect(m.hourly.wind_speed_10m).toEqual([5, 5.4]);
      expect(m.windSampledOffshore).toBeUndefined();
    });
  });

  it("rafale absente au large → on retombe sur celle du spot, pas sur null", () => {
    const sea = mkLoc({ wind_speed_10m: [10.1, 11.2], wind_gusts_10m: undefined }, 0);
    delete sea.hourly.wind_gusts_10m;
    expect(mergeSeaWind([SPOT_LOC, sea]).hourly.wind_gusts_10m).toEqual([9, 10]);
  });

  it("réponse vide / cassée → null, jamais un throw", () => {
    expect(mergeSeaWind([])).toBeNull();
    expect(mergeSeaWind([{}])).toEqual({});
    expect(mergeSeaWind(null)).toBeNull();
  });
});
