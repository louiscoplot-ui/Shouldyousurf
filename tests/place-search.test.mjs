import { describe, it, expect } from "vitest";
import { photonRank, mergePlaceResults } from "../app/v2/lib/placeSearch.js";

// Formes RÉELLES de réponses Photon (photon.komoot.io, 29/09), réduites aux
// champs utilisés. Le cas "Canggu" : un cours de bijouterie (tourism=attraction)
// sortait avant le village ; "Kuta Beach" : bars et hôtels homonymes.
const f = (name, key, value, lat, lng, cc = "ID") => ({ properties: { name, osm_key: key, osm_value: value, countrycode: cc }, geometry: { coordinates: [lng, lat] } });

describe("recherche de lieux (Photon + Open-Meteo)", () => {
  it("les plages et reefs passent devant les localités, les attractions en dernier, bars et hôtels écartés", () => {
    expect(photonRank({ osm_key: "natural", osm_value: "beach" })).toBeGreaterThan(photonRank({ osm_key: "place", osm_value: "village" }));
    expect(photonRank({ osm_key: "place", osm_value: "village" })).toBeGreaterThan(photonRank({ osm_key: "tourism", osm_value: "attraction" }));
    expect(photonRank({ osm_key: "amenity", osm_value: "pub" })).toBe(0);
    expect(photonRank({ osm_key: "tourism", osm_value: "hotel" })).toBe(0);
  });

  it("Canggu : le village avant le cours de bijouterie ; Kuta Beach : la plage, pas le bar", () => {
    const out = mergePlaceResults({ photonAll: [
      f("Canggu jewelry classes", "tourism", "attraction", -8.647, 115.140),
      f("Canggu", "place", "village", -8.640, 115.144),
      f("Kuta Beach", "amenity", "pub", 45.734, 10.789, "IT"),
      f("Kuta Beach", "natural", "beach", -8.718, 115.169),
    ] });
    expect(out.map((x) => x.name)).toEqual(["Kuta Beach", "Canggu", "Canggu jewelry classes"]);
    expect(out[0].country).toBe("ID");
  });

  it("dédoublonne la même plage vue par Photon filtré ET non filtré, garde Open-Meteo en secours", () => {
    const beach = f("Arugam Bay", "natural", "beach", 6.862, 81.837, "LK");
    const out = mergePlaceResults({
      photonFiltered: [beach], photonAll: [beach],
      openMeteo: [{ name: "Weligama", latitude: 5.975, longitude: 80.430, country_code: "LK", admin1: "Southern" }],
    });
    expect(out.filter((x) => x.name === "Arugam Bay")).toHaveLength(1);
    expect(out.map((x) => x.name)).toContain("Weligama");
  });
});
