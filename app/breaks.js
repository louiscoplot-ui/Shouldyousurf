// Curated Australian surf breaks with coordinates and break-specific parameters.
// `idealSwellDir` is the sweet spot (degrees). `offshoreWindDir` is the ideal
// wind direction for that break. These let the scoring adapt per location.

export const BREAKS = [
  // ─── Western Australia ───────────────────────────────────────────────
  { id: "trigg",        name: "Trigg Beach",        region: "Perth, WA",    lat: -31.8826, lng: 115.7519, idealSwellDir: 240, offshoreWindDir: 90,  notes: "Five Fathom Bank absorbs swell. Needs long period." },
  { id: "scarborough",  name: "Scarborough",        region: "Perth, WA",    lat: -31.8939, lng: 115.7553, idealSwellDir: 240, offshoreWindDir: 90 },
  { id: "cottesloe",    name: "Cottesloe",          region: "Perth, WA",    lat: -31.9950, lng: 115.7520, idealSwellDir: 240, offshoreWindDir: 90 },
  { id: "leighton",     name: "Leighton",           region: "Perth, WA",    lat: -32.0283, lng: 115.7461, idealSwellDir: 240, offshoreWindDir: 90 },
  { id: "margaret",     name: "Margaret River Main",region: "Margaret River, WA", lat: -33.9717, lng: 114.9896, idealSwellDir: 225, offshoreWindDir: 90 },
  { id: "yallingup",    name: "Yallingup",          region: "Margaret River, WA", lat: -33.6406, lng: 114.9908, idealSwellDir: 225, offshoreWindDir: 135 },
  { id: "gnaraloo",     name: "Gnaraloo (Tombstones)", region: "Coral Coast, WA", lat: -23.8489, lng: 113.5350, idealSwellDir: 225, offshoreWindDir: 90 },

  // ─── New South Wales ─────────────────────────────────────────────────
  { id: "bondi",        name: "Bondi Beach",        region: "Sydney, NSW",  lat: -33.8915, lng: 151.2767, idealSwellDir: 140, offshoreWindDir: 270 },
  { id: "manly",        name: "Manly",              region: "Sydney, NSW",  lat: -33.7969, lng: 151.2880, idealSwellDir: 140, offshoreWindDir: 270 },
  { id: "north-narra",  name: "North Narrabeen",    region: "Sydney, NSW",  lat: -33.7050, lng: 151.2994, idealSwellDir: 150, offshoreWindDir: 270 },
  { id: "byron",        name: "The Pass (Byron)",   region: "Byron Bay, NSW", lat: -28.6346, lng: 153.6311, idealSwellDir: 120, offshoreWindDir: 225 },
  { id: "lennox",       name: "Lennox Head",        region: "Northern NSW", lat: -28.7940, lng: 153.5942, idealSwellDir: 150, offshoreWindDir: 270 },
  { id: "crescent",     name: "Crescent Head",      region: "Mid North Coast, NSW", lat: -31.1889, lng: 152.9825, idealSwellDir: 140, offshoreWindDir: 270 },
  { id: "angourie",     name: "Angourie",           region: "Northern NSW", lat: -29.4830, lng: 153.3630, idealSwellDir: 135, offshoreWindDir: 270 },

  // ─── Queensland ──────────────────────────────────────────────────────
  { id: "snapper",      name: "Snapper Rocks",      region: "Gold Coast, QLD", lat: -28.1627, lng: 153.5522, idealSwellDir: 135, offshoreWindDir: 225 },
  { id: "kirra",        name: "Kirra",              region: "Gold Coast, QLD", lat: -28.1694, lng: 153.5333, idealSwellDir: 135, offshoreWindDir: 225 },
  { id: "burleigh",     name: "Burleigh Heads",     region: "Gold Coast, QLD", lat: -28.1006, lng: 153.4500, idealSwellDir: 135, offshoreWindDir: 225 },
  { id: "dbah",         name: "Duranbah (D'Bah)",   region: "Gold Coast, QLD", lat: -28.1681, lng: 153.5522, idealSwellDir: 135, offshoreWindDir: 270 },
  { id: "noosa",        name: "Noosa (First Point)",region: "Sunshine Coast, QLD", lat: -26.3833, lng: 153.0900, idealSwellDir: 100, offshoreWindDir: 180 },
  { id: "alexandra",    name: "Alexandra Headland", region: "Sunshine Coast, QLD", lat: -26.6717, lng: 153.1031, idealSwellDir: 120, offshoreWindDir: 225 },

  // ─── Victoria ────────────────────────────────────────────────────────
  { id: "bells",        name: "Bells Beach",        region: "Torquay, VIC", lat: -38.3706, lng: 144.2839, idealSwellDir: 210, offshoreWindDir: 360 },
  { id: "winkipop",     name: "Winkipop",           region: "Torquay, VIC", lat: -38.3733, lng: 144.2872, idealSwellDir: 210, offshoreWindDir: 360 },
  { id: "jan-juc",      name: "Jan Juc",            region: "Torquay, VIC", lat: -38.3533, lng: 144.2917, idealSwellDir: 210, offshoreWindDir: 360 },

  // ─── South Australia ─────────────────────────────────────────────────
  { id: "middleton",    name: "Middleton",          region: "Fleurieu, SA", lat: -35.5078, lng: 138.6930, idealSwellDir: 210, offshoreWindDir: 360 },
  { id: "waits",        name: "Waitpinga",          region: "Fleurieu, SA", lat: -35.6467, lng: 138.5644, idealSwellDir: 225, offshoreWindDir: 360 },

  // ─── Tasmania ────────────────────────────────────────────────────────
  { id: "shipstern",    name: "Shipstern Bluff",    region: "Tasmania",     lat: -43.1889, lng: 147.7500, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", heavy: true },
  { id: "clifton",      name: "Clifton Beach",      region: "Hobart, TAS",  lat: -42.9817, lng: 147.5217, idealSwellDir: 135, offshoreWindDir: 315 },

  // ─── Indonesia ───────────────────────────────────────────────────────
  { id: "uluwatu",      name: "Uluwatu",            region: "Bali, Indonesia",     lat: -8.8152, lng: 115.0883, idealSwellDir: 225, offshoreWindDir: 90,  type: "reef", heavy: true },
  { id: "padang",       name: "Padang Padang",      region: "Bali, Indonesia",     lat: -8.8067, lng: 115.1000, idealSwellDir: 225, offshoreWindDir: 90,  type: "reef", heavy: true },
  { id: "keramas",      name: "Keramas",            region: "Bali, Indonesia",     lat: -8.5850, lng: 115.3383, idealSwellDir: 135, offshoreWindDir: 270, type: "reef" },
  { id: "balangan",     name: "Balangan",           region: "Bali, Indonesia",     lat: -8.7917, lng: 115.1233, idealSwellDir: 225, offshoreWindDir: 90,  type: "reef" },
  { id: "medewi",       name: "Medewi",             region: "Bali, Indonesia",     lat: -8.4100, lng: 114.8050, idealSwellDir: 225, offshoreWindDir: 90 },
  { id: "lakey-peak",   name: "Lakey Peak",         region: "Sumbawa, Indonesia",  lat: -8.8750, lng: 118.4333, idealSwellDir: 225, offshoreWindDir: 45,  type: "reef" },
  { id: "gland",        name: "G-Land",             region: "Java, Indonesia",     lat: -8.6667, lng: 114.3500, idealSwellDir: 200, offshoreWindDir: 45,  type: "reef", heavy: true },

  // ─── France ──────────────────────────────────────────────────────────
  { id: "hossegor",     name: "La Gravière",        region: "Hossegor, France",    lat: 43.6667, lng: -1.4333, idealSwellDir: 295, offshoreWindDir: 90 },
  { id: "biarritz",     name: "Grande Plage",       region: "Biarritz, France",    lat: 43.4832, lng: -1.5586, idealSwellDir: 295, offshoreWindDir: 135 },
  { id: "lacanau",      name: "Lacanau",            region: "Gironde, France",     lat: 45.0000, lng: -1.2000, idealSwellDir: 280, offshoreWindDir: 90 },

  // ─── Portugal / Spain ────────────────────────────────────────────────
  { id: "nazare",       name: "Nazaré (Praia do Norte)", region: "Nazaré, Portugal", lat: 39.6083, lng: -9.0783, idealSwellDir: 290, offshoreWindDir: 90, heavy: true },
  { id: "ericeira",     name: "Ribeira d'Ilhas",    region: "Ericeira, Portugal",  lat: 38.9800, lng: -9.4167, idealSwellDir: 290, offshoreWindDir: 90,  type: "reef" },
  { id: "peniche",      name: "Supertubos",         region: "Peniche, Portugal",   lat: 39.3500, lng: -9.3667, idealSwellDir: 290, offshoreWindDir: 45 },
  { id: "mundaka",      name: "Mundaka",            region: "Basque Country, Spain", lat: 43.4060, lng: -2.7006, idealSwellDir: 315, offshoreWindDir: 180 },

  // ─── USA ─────────────────────────────────────────────────────────────
  { id: "pipeline",     name: "Pipeline",           region: "Oahu, Hawaii",        lat: 21.6611, lng: -158.0528, idealSwellDir: 315, offshoreWindDir: 135, type: "reef", heavy: true },
  { id: "waikiki",      name: "Waikiki",            region: "Oahu, Hawaii",        lat: 21.2760, lng: -157.8330, idealSwellDir: 180, offshoreWindDir: 45 },
  { id: "malibu",       name: "Malibu (First Point)", region: "California, USA",   lat: 34.0381, lng: -118.6775, idealSwellDir: 225, offshoreWindDir: 45 },
  { id: "rincon",       name: "Rincon",             region: "California, USA",     lat: 34.3733, lng: -119.4797, idealSwellDir: 270, offshoreWindDir: 45 },
  { id: "trestles",     name: "Lower Trestles",     region: "California, USA",     lat: 33.3869, lng: -117.5894, idealSwellDir: 225, offshoreWindDir: 45 },
  { id: "ocean-beach",  name: "Ocean Beach SF",     region: "California, USA",     lat: 37.7593, lng: -122.5107, idealSwellDir: 270, offshoreWindDir: 90 },

  // ─── Mexico / Central America ────────────────────────────────────────
  { id: "puerto",       name: "Puerto Escondido (Zicatela)", region: "Oaxaca, Mexico", lat: 15.8597, lng: -97.0522, idealSwellDir: 225, offshoreWindDir: 0, heavy: true },
  { id: "pavones",      name: "Pavones",            region: "Costa Rica",          lat: 8.3789, lng: -83.1411, idealSwellDir: 225, offshoreWindDir: 45 },

  // ─── Brazil ──────────────────────────────────────────────────────────
  { id: "itacare",      name: "Itacaré",            region: "Bahia, Brazil",       lat: -14.2781, lng: -38.9967, idealSwellDir: 150, offshoreWindDir: 270 },
  { id: "saquarema",    name: "Saquarema (Itaúna)", region: "Rio, Brazil",         lat: -22.9300, lng: -42.5000, idealSwellDir: 180, offshoreWindDir: 0 },
  { id: "floripa",      name: "Praia Mole",         region: "Florianópolis, Brazil", lat: -27.6036, lng: -48.4250, idealSwellDir: 180, offshoreWindDir: 270 },

  // ─── New Zealand / Pacific ───────────────────────────────────────────
  { id: "raglan",       name: "Raglan (Manu Bay)",  region: "Waikato, NZ",         lat: -37.8133, lng: 174.8208, idealSwellDir: 225, offshoreWindDir: 90 },
  { id: "piha",         name: "Piha",               region: "Auckland, NZ",        lat: -36.9550, lng: 174.4672, idealSwellDir: 225, offshoreWindDir: 90 },
  { id: "teahupoo",     name: "Teahupo'o",          region: "Tahiti",              lat: -17.8522, lng: -149.2672, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", heavy: true },

  // ─── South Africa / Morocco ──────────────────────────────────────────
  { id: "jbay",         name: "Jeffreys Bay (Supertubes)", region: "Eastern Cape, South Africa", lat: -34.0500, lng: 24.9167, idealSwellDir: 225, offshoreWindDir: 315 },
  { id: "taghazout",    name: "Anchor Point",       region: "Taghazout, Morocco",  lat: 30.5422, lng: -9.7125, idealSwellDir: 300, offshoreWindDir: 90, type: "reef" },
];

export function findBreak(id) {
  return BREAKS.find(b => b.id === id) || BREAKS[0];
}
