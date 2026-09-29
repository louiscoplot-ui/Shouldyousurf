// Recherche de lieux pour le BreakPicker : n'importe quelle plage du monde.
//
// Avant (29/09), la recherche passait UNIQUEMENT par le géocodage Open-Meteo,
// qui ne connaît que des localités. Testé sur de vrais noms de spots :
//   "Kuta Beach", "Batu Bolong", "Snapper Rocks" → aucun résultat
//   "Canggu"      → un village de Java à 300 km de Bali
//   "Hiriketiya"  → un village homonyme dans les terres
// Photon (moteur OpenStreetMap conçu pour l'autocomplétion, photon.komoot.io)
// connaît les PLAGES, reefs, baies et caps : "Pantai Batu Bolong" (beach),
// "Snapper Rocks Beach", "Arugam Bay" (beach), "Pantai Selong Belanak",
// "Weligama Beach". On l'interroge deux fois en parallèle (filtré sur les
// types utiles + non filtré, trié) et on garde Open-Meteo en secours : une
// panne Photon ne casse jamais la recherche d'aujourd'hui.
//
// Données © OpenStreetMap contributors (ODbL) : l'attribution est affichée
// sous les résultats.

const PHOTON = "https://photon.komoot.io/api/";
const PHOTON_TAGS = [
  "natural:beach", "natural:bay", "natural:cape", "natural:reef", "natural:peninsula",
  "place", "sport:surfing", "leisure:beach_resort",
];
const PHOTON_LANGS = new Set(["en", "de", "fr", "it"]);

// Rang d'un résultat : les lieux de surf d'abord, les localités ensuite, les
// attractions en dernier (un "Canggu jewelry classes" ne passe plus devant
// le village de Canggu). 0 = écarté (bars, hôtels, routes, boutiques…).
export function photonRank(p) {
  if (!p) return 0;
  const k = p.osm_key, v = p.osm_value;
  if ((k === "sport" && v === "surfing") || p.sport === "surfing") return 5;
  if (k === "natural" && ["beach", "reef", "bay", "cape", "bare_rock", "rock", "peninsula", "sand", "shoal"].includes(v)) return 4;
  if (k === "leisure" && v === "beach_resort") return 3;
  if (k === "place" && ["town", "village", "suburb", "neighbourhood", "locality", "hamlet", "island", "islet", "city", "quarter"].includes(v)) return 2;
  if (k === "tourism" && ["attraction", "viewpoint"].includes(v)) return 1;
  return 0;
}

// Fusion Photon (filtré + non filtré) + Open-Meteo, dédoublonnée par nom et
// proximité (~2 km), triée par rang puis par ordre de pertinence d'origine.
export function mergePlaceResults({ photonFiltered = [], photonAll = [], openMeteo = [] }, limit = 10) {
  const items = [];
  const push = (it) => { if (Number.isFinite(it.lat) && Number.isFinite(it.lng) && it.name) items.push(it); };
  [...photonFiltered, ...photonAll].forEach((f, i) => {
    const p = f?.properties; const c = f?.geometry?.coordinates;
    const rank = photonRank(p);
    if (!rank || !Array.isArray(c)) return;
    push({
      name: p.name, lat: c[1], lng: c[0], rank, order: i,
      kind: p.osm_value,
      country: (p.countrycode || "").toUpperCase(),
      region: [p.city || p.county, p.state].filter(Boolean).join(" · "),
      source: "osm",
    });
  });
  openMeteo.forEach((r, i) => push({
    name: r.name, lat: r.latitude, lng: r.longitude, rank: 2, order: 100 + i,
    kind: "place",
    country: (r.country_code || "").toUpperCase(),
    region: [r.admin1, r.admin2].filter(Boolean).join(" · "),
    source: "open-meteo",
  }));
  items.sort((a, b) => b.rank - a.rank || a.order - b.order);
  const out = [];
  for (const it of items) {
    const dup = out.some((o) => o.name.toLowerCase() === it.name.toLowerCase()
      && Math.abs(o.lat - it.lat) < 0.02 && Math.abs(o.lng - it.lng) < 0.02);
    if (!dup) out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

export async function searchPlaces(term, { lang = "en", signal } = {}) {
  const q = encodeURIComponent(term);
  const l = PHOTON_LANGS.has(lang) ? `&lang=${lang}` : "";
  const tags = PHOTON_TAGS.map((t) => `&osm_tag=${encodeURIComponent(t)}`).join("");
  const get = async (url, pick) => {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return pick(await res.json());
  };
  const [pf, pa, om] = await Promise.allSettled([
    get(`${PHOTON}?q=${q}&limit=10${l}${tags}`, (j) => j.features || []),
    get(`${PHOTON}?q=${q}&limit=15${l}`, (j) => j.features || []),
    get(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=10&language=en&format=json`, (j) => j.results || []),
  ]);
  const val = (r) => (r.status === "fulfilled" ? r.value : []);
  if ([pf, pa, om].every((r) => r.status === "rejected")) throw new Error("Search unavailable — check your connection");
  return mergePlaceResults({ photonFiltered: val(pf), photonAll: val(pa), openMeteo: val(om) });
}
