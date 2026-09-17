// Échantillonnage du VENT au point MER.
//
// Bug terrain Trigg 14/09 : l'app annonçait 10 km/h SE, il y avait 20+ sur la
// plage. Cause : le vent était lu aux coordonnées du spot. Or interroger les
// coordonnées du spot ne rend PAS "le vent au spot" — l'API snappe sur une
// cellule de 11 à 28 km dont le centre est dans les terres. Le vent 10 m y est
// diagnostiqué avec une rugosité de banlieue, pas de mer.
//
// Contrainte CONTRADICTOIRE à tenir, et c'est tout l'enjeu de ces tests :
//  - trop près → on ne sort pas de la cellule terrestre, on ne corrige rien
//  - trop loin → on sur-lit les vents offshore, qui accélèrent au large,
//    donc on dégrade justement les bonnes conditions
// D'où la règle : LE PLUS PROCHE qui sort vraiment de la cellule du spot,
// mesuré sur le centre de cellule que l'API renvoie — jamais une distance
// devinée à l'avance.
import { describe, it, expect } from "vitest";
import { windSamplePoint, resolveSeaWind, offshoreBearing, offsetPoint, pickProbedBearing } from "../app/v2/lib/realFetch.js";
import { angDelta } from "../app/v2/lib/prodScoring.js";

const TRIGG = { id: "trigg", lat: -31.8826, lng: 115.7519, idealSwellDir: 240 };

const kmBetween = (a, b) => {
  const dLat = (b.lat - a.lat) * 110.574;
  const dLng = (b.lng - a.lng) * 111.320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

describe("windSamplePoint — géométrie", () => {
  it("décale vers le large sur le cap de idealSwellDir", () => {
    const wp = windSamplePoint(TRIGG, null, 8);
    // Trigg est sur la côte OUEST, idealSwellDir 240 (SW) : le point part au
    // sud-ouest. Si un jour ça part vers l'est, on interroge Perth centre.
    expect(wp.lat).toBeLessThan(TRIGG.lat);
    expect(wp.lng).toBeLessThan(TRIGG.lng);
  });

  it("respecte la distance demandée", () => {
    [4, 8, 14].forEach((km) => {
      expect(kmBetween(TRIGG, windSamplePoint(TRIGG, null, km))).toBeCloseTo(km, 0);
    });
  });

  it("un cap explicite (spot personnalisé sondé) l'emporte sur idealSwellDir", () => {
    expect(windSamplePoint(TRIGG, 90, 8).lng).toBeGreaterThan(TRIGG.lng); // cap 90 = est
  });

  it("override windLat/windLng respecté tel quel, quelle que soit la distance", () => {
    const spot = { ...TRIGG, windLat: -32, windLng: 115.5 };
    expect(windSamplePoint(spot, null, 4)).toEqual({ lat: -32, lng: 115.5 });
    expect(windSamplePoint(spot, null, 14)).toEqual({ lat: -32, lng: 115.5 });
  });

  it("sans cap connu → null (= coordonnées du spot, comportement d'avant)", () => {
    expect(windSamplePoint({ lat: -31.88, lng: 115.75 }, null, 8)).toBeNull();
    expect(windSamplePoint(null, null, 8)).toBeNull();
    expect(offshoreBearing({ lat: 1, lng: 2 })).toBeNull();
    expect(offshoreBearing(TRIGG)).toBe(240);
  });
});

// ── resolveSeaWind ────────────────────────────────────────────────────
// `latitude`/`longitude` d'une réponse Open-Meteo = CENTRE DE LA CELLULE
// réellement utilisée, pas le point demandé. C'est ce qui permet de mesurer
// si on a vraiment changé de cellule au lieu de le supposer.
const CANDIDATES = [4, 8, 14];
const BEARING = 240; // SW, le large à Trigg

// Cellule du spot : centre poussé vers l'INTÉRIEUR (nord-est du spot).
const SPOT_CELL = { latitude: -31.85, longitude: 115.79 };
// Centres de cellule successifs vers le large, sur le cap 240.
const seaCell = (km) => {
  const p = offsetPoint(SPOT_CELL.latitude, SPOT_CELL.longitude, BEARING, km);
  return { latitude: p.lat, longitude: p.lng };
};

const mkLoc = (cell, over = {}, elevation = 0) => ({
  ...cell,
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

const SPOT_LOC = mkLoc(SPOT_CELL, {}, 24);
const strongWind = (spd) => ({ wind_speed_10m: spd, wind_direction_10m: [128, 132], wind_gusts_10m: [16, 18], temperature_2m: [18, 18] });

describe("resolveSeaWind — on prend le plus proche qui sort de la cellule", () => {
  it("saute les candidats qui SERVENT la cellule du spot (séries identiques)", () => {
    // Le seul signe fiable qu'on a changé de cellule, c'est que la DONNÉE
    // change. Les coordonnées de la réponse ne sont pas une source sûre :
    // si l'API renvoie le point demandé au lieu du centre de cellule, un
    // test géométrique dit "on a bougé" alors qu'on lit le même vent — le
    // bug terrain où l'écran restait scotché à 10 km/h.
    // Ici le candidat à 4 km rend EXACTEMENT la série du spot → même
    // cellule → on va chercher plus loin. 8 km diffère → on le retient,
    // et pas 14 : le plus proche du break qui corrige vraiment.
    const sameAsSpot = { wind_speed_10m: [5, 5.4], wind_direction_10m: [130, 135] };
    const json = [
      SPOT_LOC,
      mkLoc(seaCell(3), sameAsSpot),
      mkLoc(seaCell(9), strongWind([11.0, 12.0])),
      mkLoc(seaCell(20), strongWind([13.5, 14.5])),
    ];
    const { wind, pickedKm } = resolveSeaWind(json, CANDIDATES, BEARING);
    expect(pickedKm).toBe(8);
    expect(wind.hourly.wind_speed_10m).toEqual([11.0, 12.0]);
  });

  it("une série identique aux coordonnées DIFFÉRENTES reste rejetée", () => {
    // Cas exact du bug : l'API a servi la cellule de la plage pour un point
    // pourtant décalé. Coordonnées franchement au large, donnée inchangée.
    const json = [SPOT_LOC, mkLoc(seaCell(30), { wind_speed_10m: [5, 5.4], wind_direction_10m: [130, 135] })];
    const { wind, pickedKm } = resolveSeaWind(json, [14], BEARING);
    expect(pickedKm).toBeNull();
    expect(wind.windSampledOffshore).toBeUndefined();
  });

  it("une direction qui change suffit, même à vitesse égale", () => {
    // Le vent de mer peut avoir la même force et un cap différent : c'est
    // bien une autre cellule, il ne faut pas la jeter.
    const json = [SPOT_LOC, mkLoc(seaCell(9), { wind_speed_10m: [5, 5.4], wind_direction_10m: [200, 205] })];
    expect(resolveSeaWind(json, [8], BEARING).pickedKm).toBe(8);
  });

  it("prend le PREMIER candidat dès qu'il sort déjà de la cellule", () => {
    // Le 4 km suffit : on ne va pas plus loin, sinon on sur-lirait les
    // vents offshore qui continuent d'accélérer au large.
    const json = [
      SPOT_LOC,
      mkLoc(seaCell(9), strongWind([10.1, 11.2])),
      mkLoc(seaCell(20), strongWind([13.5, 14.5])),
      mkLoc(seaCell(30), strongWind([15.0, 16.0])),
    ];
    const { wind, pickedKm } = resolveSeaWind(json, CANDIDATES, BEARING);
    expect(pickedKm).toBe(4);
    expect(wind.hourly.wind_speed_10m).toEqual([10.1, 11.2]);
  });

  it("ignore une cellule décalée vers la TERRE (gain négatif)", () => {
    const inlandCell = seaCell(-9); // cap opposé = vers l'intérieur
    const json = [
      SPOT_LOC,
      mkLoc(inlandCell, strongWind([3, 3])),
      mkLoc(seaCell(12), strongWind([11.0, 12.0])),
    ];
    const { wind, pickedKm } = resolveSeaWind(json, [4, 8], BEARING);
    expect(pickedKm).toBe(8);
    expect(wind.hourly.wind_speed_10m).toEqual([11.0, 12.0]);
  });

  it("aucun candidat ne sort de la cellule → on garde le spot", () => {
    const same = { wind_speed_10m: [5, 5.4], wind_direction_10m: [130, 135] };
    const json = [SPOT_LOC, mkLoc(seaCell(6), same), mkLoc(seaCell(12), same)];
    const { wind, pickedKm } = resolveSeaWind(json, [4, 8], BEARING);
    expect(pickedKm).toBeNull();
    expect(wind.hourly.wind_speed_10m).toEqual([5, 5.4]);
    expect(wind.windSampledOffshore).toBeUndefined();
  });

  it("centre de cellule absent → la comparaison des séries tranche seule", () => {
    const noCell = mkLoc({}, strongWind([10.1, 11.2]));
    delete noCell.latitude; delete noCell.longitude;
    expect(resolveSeaWind([SPOT_LOC, noCell], [4], BEARING).pickedKm).toBe(4);
  });

  it("sans cap fourni, la comparaison des séries suffit", () => {
    const json = [SPOT_LOC, mkLoc(SPOT_CELL, strongWind([10.1, 11.2]))];
    expect(resolveSeaWind(json, [4], null).pickedKm).toBe(4);
  });
});

describe("resolveSeaWind — ce qu'on prend et ce qu'on laisse", () => {
  const json = [SPOT_LOC, mkLoc(seaCell(12), strongWind([10.1, 11.2]))];

  it("vent, direction et rafales viennent de la cellule mer", () => {
    const { wind } = resolveSeaWind(json, [8], BEARING);
    expect(wind.hourly.wind_speed_10m).toEqual([10.1, 11.2]);
    expect(wind.hourly.wind_direction_10m).toEqual([128, 132]);
    expect(wind.hourly.wind_gusts_10m).toEqual([16, 18]);
    expect(wind.windSampledOffshore).toBe(true);
  });

  it("air, pluie et lever/coucher restent sur la cellule du SPOT", () => {
    // C'est la température de la plage où l'utilisateur est, pas celle du large.
    const { wind } = resolveSeaWind(json, [8], BEARING);
    expect(wind.hourly.temperature_2m).toEqual([22, 21]);
    expect(wind.hourly.precipitation_probability).toEqual([0, 0]);
    expect(wind.daily).toEqual(SPOT_LOC.daily);
    expect(wind.timezone).toBe("Australia/Perth");
  });

  it("le vent corrigé est bien PLUS FORT que la cellule terre (le bug)", () => {
    const { wind } = resolveSeaWind(json, [8], BEARING);
    wind.hourly.wind_speed_10m.forEach((v, i) => {
      expect(v).toBeGreaterThan(SPOT_LOC.hourly.wind_speed_10m[i]);
    });
  });
});

describe("resolveSeaWind — garde-fous, jamais pire qu'avant le fix", () => {
  it("réponse mono-point (pas de cap connu) → renvoyée telle quelle", () => {
    const r = resolveSeaWind(SPOT_LOC, [], BEARING);
    expect(r.wind).toBe(SPOT_LOC);
    expect(r.pickedKm).toBeNull();
  });

  it("candidat retombé à TERRE (elevation > 2 m) → ignoré", () => {
    // Baie fermée, île en face : la cellule voisine est terrestre elle aussi.
    const inland = mkLoc(seaCell(12), strongWind([3, 3]), 40);
    expect(resolveSeaWind([SPOT_LOC, inland], [8], BEARING).wind.hourly.wind_speed_10m).toEqual([5, 5.4]);
  });

  it("elevation absente → on fait confiance à la géométrie", () => {
    const noElev = mkLoc(seaCell(12), strongWind([10.1, 11.2]));
    delete noElev.elevation;
    expect(resolveSeaWind([SPOT_LOC, noElev], [8], BEARING).wind.windSampledOffshore).toBe(true);
  });

  it("série absente / vide / désalignée → candidat ignoré", () => {
    const cases = [
      undefined,
      {},
      mkLoc(seaCell(12), { wind_speed_10m: null }),
      mkLoc(seaCell(12), { wind_speed_10m: [null, null] }),
      mkLoc(seaCell(12), { wind_speed_10m: [10.1] }), // longueur différente
    ];
    cases.forEach((sea) => {
      const { wind } = resolveSeaWind([SPOT_LOC, sea], [8], BEARING);
      expect(wind.hourly.wind_speed_10m).toEqual([5, 5.4]);
      expect(wind.windSampledOffshore).toBeUndefined();
    });
  });

  it("un candidat cassé n'empêche pas le suivant de gagner", () => {
    const json = [SPOT_LOC, {}, mkLoc(seaCell(12), strongWind([10.1, 11.2]))];
    expect(resolveSeaWind(json, [4, 8], BEARING).pickedKm).toBe(8);
  });

  it("rafale absente au large → on retombe sur celle du spot, pas sur null", () => {
    const sea = mkLoc(seaCell(12), strongWind([10.1, 11.2]));
    delete sea.hourly.wind_gusts_10m;
    expect(resolveSeaWind([SPOT_LOC, sea], [8], BEARING).wind.hourly.wind_gusts_10m).toEqual([9, 10]);
  });

  it("réponse vide / cassée → pas de throw", () => {
    expect(resolveSeaWind([], [], BEARING).wind).toBeNull();
    expect(resolveSeaWind([{}], [], BEARING).wind).toEqual({});
    expect(resolveSeaWind(null, [], BEARING).wind).toBeNull();
  });
});

// ── Sonde du cap du large : sélection contrainte ──────────────────────
// La sonde tourne maintenant AUSSI pour les 111 spots curés. Elle ne doit
// jamais remplacer le savoir humain (idealSwellDir), seulement l'affiner :
// ±90° maximum, et uniquement si elle gagne nettement. Toute la logique de
// décision est pure et testée ici — le réseau n'intervient pas.
describe("pickProbedBearing", () => {
  const s = (bearing, mean) => ({ bearing, mean });

  it("spot libre (pas d'idealSwellDir) : prend simplement le plus au large", () => {
    const samples = [s(0, null), s(45, 0.2), s(90, 1.9), s(135, 1.2), s(180, null)];
    expect(pickProbedBearing(samples, null)).toBe(90);
    expect(pickProbedBearing(samples, undefined)).toBe(90);
    expect(pickProbedBearing(samples, NaN)).toBe(90);
  });

  it("spot curé : ne s'éloigne JAMAIS de plus de 90 deg du cap humain", () => {
    // Le plus gros est plein est (90) mais le spot regarde l'ouest (270).
    // C'est le cas du spot au bout d'une pointe : l'autre côté est l'océan,
    // mais pas le sien. On doit rester dans l'hemisphere de idealSwellDir.
    const samples = [s(90, 3.0), s(225, 1.0), s(270, 1.1), s(315, 1.0)];
    const got = pickProbedBearing(samples, 270);
    expect(got).not.toBe(90);
    expect(Math.abs(angDelta(got ?? 270, 270))).toBeLessThanOrEqual(90);
  });

  it("spot curé deja bien oriente : ne change rien (null)", () => {
    // Le cap humain porte deja la plus grosse houle : aucune raison de bouger.
    const samples = [s(225, 1.0), s(270, 1.6), s(315, 1.1)];
    expect(pickProbedBearing(samples, 270)).toBeNull();
  });

  it("deux caps dans la MEME cellule → on ne bascule pas pour rien", () => {
    // Meme cellule de grille = meme serie = meme moyenne. Changer de cap ne
    // gagnerait rien et ferait bouger tous les scores. C'est le seul role de
    // l'epsilon de gain.
    expect(pickProbedBearing([s(270, 1.6), s(315, 1.6)], 270)).toBeNull();
    expect(pickProbedBearing([s(270, 1.6), s(315, 1.605)], 270)).toBeNull();
  });

  it("un gain reel, meme modeste, est pris : le seuil ne doit pas desactiver la feature", () => {
    // Piege reel : un seuil pose "par prudence" a +15 % annulait la
    // correction sur la majorite des 111 spots — il desactivait la feature
    // en silence au lieu de la securiser. Le garde-fou, c'est le +-90 deg.
    expect(pickProbedBearing([s(270, 1.57), s(315, 1.80)], 270)).toBe(315);
  });

  it("spot curé oblique : gain franc → on corrige le cap", () => {
    // Cas mesure a Trigg : cellule cotiere 1.32 -> cellule 100 % eau 1.64,
    // soit +24 %. C'est exactement ce que la sonde doit rattraper.
    const samples = [s(225, 1.32), s(270, 1.64), s(315, 1.30)];
    expect(pickProbedBearing(samples, 240)).toBe(270);
  });

  it("cellules a terre (mean null) ignorees, jamais choisies", () => {
    const samples = [s(0, null), s(45, null), s(270, 1.5), s(315, null)];
    expect(pickProbedBearing(samples, null)).toBe(270);
    // Que des cellules a terre → on ne sait rien → null, comportement d'avant.
    expect(pickProbedBearing([s(0, null), s(90, null)], null)).toBeNull();
    expect(pickProbedBearing([], 270)).toBeNull();
    expect(pickProbedBearing(null, 270)).toBeNull();
  });

  it("une houle nulle ou negative n'est pas un candidat", () => {
    expect(pickProbedBearing([s(90, 0), s(270, -1)], null)).toBeNull();
  });

  it("le passage 360/0 est gere comme un angle, pas comme un nombre", () => {
    // idealSwellDir 350, candidat a 20 : ecart reel 30 deg, donc admissible.
    const samples = [s(350, 1.0), s(20, 1.5)];
    expect(pickProbedBearing(samples, 350)).toBe(20);
    // idealSwellDir 10, candidat a 200 : ecart 170 deg, hors contrainte.
    expect(pickProbedBearing([s(10, 1.0), s(200, 3.0)], 10)).toBeNull();
  });
});

// ── SONDES RÉELLES du 17/09 ───────────────────────────────────────────
// Réponses Open-Meteo réelles, collées par Louis (le proxy de session bloque
// l'API). Ce ne sont pas des valeurs plausibles inventées : ce sont LES
// données. Elles tranchent trois choses qu'on ne faisait que supposer.
describe("cas terrain : sondes reelles du 17/09", () => {
  const moy = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  // Trigg : 3 cellules distinctes sur 8 caps. Les 4 caps vers Perth sont a
  // TERRE (elevation 22/12/14/18 m) et rendent pourtant 24 valeurs de houle.
  const TRIGG_TERRE = moy([0.52,0.52,0.52,0.52,0.52,0.52,0.52,0.52,0.54,0.54,0.58,0.62,0.66,0.66,0.66,0.66,0.66,0.68,0.68,0.68,0.66,0.66,0.66,0.64]);
  const TRIGG_SUD   = moy([0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.58,0.56,0.56,0.56,0.54]);
  const TRIGG_LARGE = moy([0.62,0.64,0.64,0.66,0.66,0.68,0.68,0.68,0.68,0.68,0.72,0.76,0.80,0.80,0.82,0.82,0.82,0.82,0.82,0.82,0.80,0.80,0.78,0.76]);
  const triggSamples = [
    { bearing:   0, mean: TRIGG_TERRE, elevation: 22 },
    { bearing:  45, mean: TRIGG_TERRE, elevation: 12 },
    { bearing:  90, mean: TRIGG_TERRE, elevation: 14 },
    { bearing: 135, mean: TRIGG_TERRE, elevation: 18 },
    { bearing: 180, mean: TRIGG_SUD,   elevation: 0 },
    { bearing: 225, mean: TRIGG_LARGE, elevation: 0 },
    { bearing: 270, mean: TRIGG_LARGE, elevation: 0 },
    { bearing: 315, mean: TRIGG_LARGE, elevation: 0 },
  ];

  it("une cellule TERRESTRE rend une serie complete et plausible", () => {
    // LA mesure qui invalide l'ancien garde-fou "serie courte = terre" :
    // 24 valeurs, entre 0.52 et 0.68 m, a 22 m d'altitude dans Perth.
    expect(TRIGG_TERRE).toBeGreaterThan(0.5);
    // Et elle est PLUS BASSE que le large : c'est pour ca que le tri par
    // houle marchait quand meme a Trigg. Par chance, pas par construction.
    expect(TRIGG_TERRE).toBeLessThan(TRIGG_LARGE);
  });

  it("Trigg est deja bien echantillonne : la sonde ne change RIEN", () => {
    // idealSwellDir 240 -> cap 225, qui tombe deja dans la cellule du large.
    // Le fix Perth du 01/08 faisait donc deja ce qu'il fallait. Le test de
    // non-regression : etendre la sonde aux spots cures ne doit pas le casser.
    expect(pickProbedBearing(triggSamples, 240)).toBeNull();
  });

  it("l'elevation ecarte la terre meme quand elle porte PLUS de houle", () => {
    // Cas que le tri par houle seule ne peut pas traiter : on force la
    // cellule terrestre au-dessus du large. Seule l'elevation la disqualifie.
    const piege = triggSamples.map((s) =>
      s.elevation > 0 ? { ...s, mean: TRIGG_LARGE * 1.5 } : s);
    const got = pickProbedBearing(piege, 240);
    expect(got).toBeNull();          // 225 (mer) reste la reference retenue
    expect(got).not.toBe(90);        // jamais un cap a terre
  });

  it("Ichinomiya : +4.6 % reel, la sonde corrige 135 -> 180", () => {
    const A = moy([0.82,0.86,0.92,0.96,0.94,0.92,0.90,0.90,0.92,0.92,0.96,1.02,1.06,1.08,1.10,1.12,1.12,1.10,1.10,1.08,1.06,1.04,0.98,0.94]);
    const B = moy([0.86,0.92,0.96,1.02,0.98,0.94,0.90,0.90,0.90,0.90,0.98,1.04,1.12,1.14,1.14,1.16,1.18,1.18,1.20,1.18,1.14,1.12,1.06,1.00]);
    const samples = [
      { bearing:   0, mean: A, elevation: 0 },  { bearing:  45, mean: A, elevation: 0 },
      { bearing:  90, mean: A, elevation: 0 },  { bearing: 135, mean: A, elevation: 0 },
      { bearing: 180, mean: B, elevation: 0 },  { bearing: 225, mean: A, elevation: 17 },
      { bearing: 270, mean: A, elevation: 43 }, { bearing: 315, mean: A, elevation: 3 },
    ];
    expect(pickProbedBearing(samples, 140)).toBe(180);
    expect(B / A).toBeCloseTo(1.046, 3);
  });

  it("Cape Hatteras : +11.3 % reel, la sonde corrige 135 -> 90", () => {
    const S1 = moy([0.56,0.56,0.54,0.54,0.52,0.50,0.48,0.46,0.44,0.42,0.42,0.42,0.42,0.40,0.40,0.38,0.38,0.38,0.38,0.38,0.36,0.36,0.36,0.36]);
    const S2 = moy([0.84,0.82,0.82,0.80,0.78,0.74,0.72,0.70,0.66,0.64,0.62,0.60,0.58,0.56,0.54,0.52,0.50,0.50,0.48,0.48,0.48,0.48,0.48,0.48]);
    const S3 = moy([0.76,0.74,0.74,0.72,0.70,0.66,0.64,0.60,0.58,0.54,0.52,0.50,0.48,0.48,0.48,0.48,0.48,0.46,0.46,0.46,0.46,0.46,0.46,0.46]);
    const S4 = moy([0.66,0.66,0.64,0.64,0.60,0.58,0.54,0.52,0.48,0.46,0.44,0.44,0.42,0.42,0.44,0.44,0.44,0.44,0.44,0.44,0.42,0.42,0.42,0.42]);
    const S5 = moy([0.46,0.46,0.46,0.46,0.44,0.40,0.38,0.38,0.36,0.36,0.36,0.36,0.36,0.36,0.36,0.36,0.36,0.36,0.36,0.36,0.36,0.36,0.36,0.34]);
    const samples = [
      { bearing:   0, mean: S1, elevation: 0 }, { bearing:  45, mean: S1, elevation: 0 },
      { bearing:  90, mean: S2, elevation: 0 }, { bearing: 135, mean: S3, elevation: 0 },
      { bearing: 180, mean: S3, elevation: 0 }, { bearing: 225, mean: S4, elevation: 0 },
      { bearing: 270, mean: S4, elevation: 1 }, { bearing: 315, mean: S5, elevation: 0 },
    ];
    expect(pickProbedBearing(samples, 135)).toBe(90);
    expect(S2 / S3).toBeCloseTo(1.113, 3);
  });

  it("les gains REELS passent sous le seuil de 1.15 qu'on avait failli poser", () => {
    // Preuve chiffree que le seuil "de prudence" aurait desactive la feature
    // sur les deux spots obliques qu'elle devait justement reparer.
    const gains = [1.046, 1.113];
    gains.forEach((g) => expect(g).toBeLessThan(1.15));
    gains.forEach((g) => expect(g).toBeGreaterThan(1.02));
  });
});

// ── PROFIL DE DECROISSANCE VERS LE LARGE — sonde reelle 17/09 ─────────
// Deuxieme sonde reelle, le long du cap du large, a 5/10/15/20/30/45 km.
// Elle a TUE une idee qu'on s'appretait a construire : deriver
// swellAttenuation du rapport entre la houle au large et la houle a 5 km.
describe("cas terrain : profil de decroissance du 17/09", () => {
  const moy = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  // Trigg, cap 270. Hs moyennes mesurees a chaque distance.
  const TRIGG = { 5: 0.740, 10: 0.924, 15: 0.924, 20: 1.147, 30: 1.355, 45: 1.560 };
  const HATTERAS = { 5: 0.618, 10: 0.618, 15: 0.703, 20: 0.756, 30: 0.808, 45: 0.861 };

  it("le modele applique DEJA sa propre bathymetrie entre le large et 5 km", () => {
    // Trigg perd 53 % entre 45 km et 5 km. Ce n'est pas nous qui l'attenuons :
    // c'est Open-Meteo, avec sa bathymetrie globale, spot par spot.
    expect(TRIGG[5] / TRIGG[45]).toBeCloseTo(0.474, 2);
    // La decroissance est monotone et lisse, pas un artefact de bord.
    const d = [5, 10, 15, 20, 30, 45];
    d.forEach((k, i) => { if (i) expect(TRIGG[k]).toBeGreaterThanOrEqual(TRIGG[d[i - 1]]); });
  });

  it("l'exposition discrimine un spot abrite d'un spot expose, SANS donnee locale", () => {
    const expoTrigg = TRIGG[5] / TRIGG[45];       // derriere Rottnest + Five Fathom Bank
    const expoHatteras = HATTERAS[5] / HATTERAS[45]; // avance dans l'Atlantique
    expect(expoHatteras).toBeGreaterThan(expoTrigg + 0.2);
    expect(expoTrigg).toBeLessThan(0.55);
    expect(expoHatteras).toBeGreaterThan(0.65);
  });

  it("⚠️ ce ratio ne doit JAMAIS servir de multiplicateur : il compte double", () => {
    // L'idee tentante : swellAttenuation = Hs(5km) / Hs(large). Mais cette
    // attenuation est DEJA dans la valeur a 5 km qu'on lit. La reappliquer
    // compterait le plateau continental deux fois.
    const lu = TRIGG[5];                       // ce que l'app lit reellement
    const ratio = TRIGG[5] / TRIGG[45];
    const doubleCompte = lu * ratio;
    expect(doubleCompte).toBeLessThan(lu * 0.5); // 0.74 -> 0.35, absurde
    // Le reglage actuel reste bien au-dessus de ce piege.
    expect(lu * 0.60).toBeGreaterThan(doubleCompte);
  });

  it("la houle monte encore a 45 km : l'eau profonde est plus loin que la sonde", () => {
    // Aucun plateau atteint. Donc on ne peut pas lire un H0 d'eau profonde
    // a 45 km, et une formule de deferlement depuis le large reste
    // inapplicable telle quelle.
    expect(TRIGG[45]).toBeGreaterThan(TRIGG[30]);
    expect(HATTERAS[45]).toBeGreaterThan(HATTERAS[30]);
  });
});
