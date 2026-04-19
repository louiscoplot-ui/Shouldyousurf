// Curated surf breaks worldwide with coordinates and break-specific parameters.
// `idealSwellDir` is the sweet spot (degrees). `offshoreWindDir` is the ideal
// wind direction for that break. `country` is the ISO-2 code (for filtering).

export const COUNTRIES = [
  { code: "AU", name: "Australia",        flag: "🇦🇺" },
  { code: "ID", name: "Indonesia",        flag: "🇮🇩" },
  { code: "FR", name: "France",           flag: "🇫🇷" },
  { code: "PT", name: "Portugal",         flag: "🇵🇹" },
  { code: "ES", name: "Spain",            flag: "🇪🇸" },
  { code: "US", name: "United States",    flag: "🇺🇸" },
  { code: "MX", name: "Mexico",           flag: "🇲🇽" },
  { code: "CR", name: "Costa Rica",       flag: "🇨🇷" },
  { code: "BR", name: "Brazil",           flag: "🇧🇷" },
  { code: "NZ", name: "New Zealand",      flag: "🇳🇿" },
  { code: "PF", name: "French Polynesia", flag: "🇵🇫" },
  { code: "ZA", name: "South Africa",     flag: "🇿🇦" },
  { code: "MA", name: "Morocco",          flag: "🇲🇦" },
];

export const BREAKS = [
  // ─── Western Australia ───────────────────────────────────────────────
  { id: "trigg",        country: "AU", name: "Trigg Beach",        region: "Perth, WA",    lat: -31.8826, lng: 115.7519, idealSwellDir: 240, offshoreWindDir: 90,  notes: "Five Fathom Bank absorbs swell. Needs long period." },
  { id: "scarborough",  country: "AU", name: "Scarborough",        region: "Perth, WA",    lat: -31.8939, lng: 115.7553, idealSwellDir: 240, offshoreWindDir: 90 },
  { id: "cottesloe",    country: "AU", name: "Cottesloe",          region: "Perth, WA",    lat: -31.9950, lng: 115.7520, idealSwellDir: 240, offshoreWindDir: 90 },
  { id: "leighton",     country: "AU", name: "Leighton",           region: "Perth, WA",    lat: -32.0283, lng: 115.7461, idealSwellDir: 240, offshoreWindDir: 90 },
  { id: "margaret",     country: "AU", name: "Margaret River Main",region: "Margaret River, WA", lat: -33.9717, lng: 114.9896, idealSwellDir: 225, offshoreWindDir: 90 },
  { id: "yallingup",    country: "AU", name: "Yallingup",          region: "Margaret River, WA", lat: -33.6406, lng: 114.9908, idealSwellDir: 225, offshoreWindDir: 135 },
  { id: "gnaraloo",     country: "AU", name: "Gnaraloo (Tombstones)", region: "Coral Coast, WA", lat: -23.8489, lng: 113.5350, idealSwellDir: 225, offshoreWindDir: 90 },

  // ─── New South Wales ─────────────────────────────────────────────────
  { id: "bondi",        country: "AU", name: "Bondi Beach",        region: "Sydney, NSW",  lat: -33.8915, lng: 151.2767, idealSwellDir: 140, offshoreWindDir: 270 },
  { id: "manly",        country: "AU", name: "Manly",              region: "Sydney, NSW",  lat: -33.7969, lng: 151.2880, idealSwellDir: 140, offshoreWindDir: 270 },
  { id: "north-narra",  country: "AU", name: "North Narrabeen",    region: "Sydney, NSW",  lat: -33.7050, lng: 151.2994, idealSwellDir: 150, offshoreWindDir: 270 },
  { id: "byron",        country: "AU", name: "The Pass (Byron)",   region: "Byron Bay, NSW", lat: -28.6346, lng: 153.6311, idealSwellDir: 120, offshoreWindDir: 225 },
  { id: "lennox",       country: "AU", name: "Lennox Head",        region: "Northern NSW", lat: -28.7940, lng: 153.5942, idealSwellDir: 150, offshoreWindDir: 270 },
  { id: "crescent",     country: "AU", name: "Crescent Head",      region: "Mid North Coast, NSW", lat: -31.1889, lng: 152.9825, idealSwellDir: 140, offshoreWindDir: 270 },
  { id: "angourie",     country: "AU", name: "Angourie",           region: "Northern NSW", lat: -29.4830, lng: 153.3630, idealSwellDir: 135, offshoreWindDir: 270 },

  // ─── Queensland ──────────────────────────────────────────────────────
  { id: "snapper",      country: "AU", name: "Snapper Rocks",      region: "Gold Coast, QLD", lat: -28.1627, lng: 153.5522, idealSwellDir: 135, offshoreWindDir: 225 },
  { id: "kirra",        country: "AU", name: "Kirra",              region: "Gold Coast, QLD", lat: -28.1694, lng: 153.5333, idealSwellDir: 135, offshoreWindDir: 225 },
  { id: "burleigh",     country: "AU", name: "Burleigh Heads",     region: "Gold Coast, QLD", lat: -28.1006, lng: 153.4500, idealSwellDir: 135, offshoreWindDir: 225 },
  { id: "dbah",         country: "AU", name: "Duranbah (D'Bah)",   region: "Gold Coast, QLD", lat: -28.1681, lng: 153.5522, idealSwellDir: 135, offshoreWindDir: 270 },
  { id: "noosa",        country: "AU", name: "Noosa (First Point)",region: "Sunshine Coast, QLD", lat: -26.3833, lng: 153.0900, idealSwellDir: 100, offshoreWindDir: 180 },
  { id: "alexandra",    country: "AU", name: "Alexandra Headland", region: "Sunshine Coast, QLD", lat: -26.6717, lng: 153.1031, idealSwellDir: 120, offshoreWindDir: 225 },

  // ─── Victoria ────────────────────────────────────────────────────────
  { id: "bells",        country: "AU", name: "Bells Beach",        region: "Torquay, VIC", lat: -38.3706, lng: 144.2839, idealSwellDir: 210, offshoreWindDir: 360 },
  { id: "winkipop",     country: "AU", name: "Winkipop",           region: "Torquay, VIC", lat: -38.3733, lng: 144.2872, idealSwellDir: 210, offshoreWindDir: 360 },
  { id: "jan-juc",      country: "AU", name: "Jan Juc",            region: "Torquay, VIC", lat: -38.3533, lng: 144.2917, idealSwellDir: 210, offshoreWindDir: 360 },

  // ─── South Australia ─────────────────────────────────────────────────
  { id: "middleton",    country: "AU", name: "Middleton",          region: "Fleurieu, SA", lat: -35.5078, lng: 138.6930, idealSwellDir: 210, offshoreWindDir: 360 },
  { id: "waits",        country: "AU", name: "Waitpinga",          region: "Fleurieu, SA", lat: -35.6467, lng: 138.5644, idealSwellDir: 225, offshoreWindDir: 360 },

  // ─── Tasmania ────────────────────────────────────────────────────────
  { id: "shipstern",    country: "AU", name: "Shipstern Bluff",    region: "Tasmania",     lat: -43.1889, lng: 147.7500, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", heavy: true },
  { id: "clifton",      country: "AU", name: "Clifton Beach",      region: "Hobart, TAS",  lat: -42.9817, lng: 147.5217, idealSwellDir: 135, offshoreWindDir: 315 },

  // ─── Indonesia ───────────────────────────────────────────────────────
  { id: "uluwatu",      country: "ID", name: "Uluwatu",            region: "Bali",                lat: -8.8152, lng: 115.0883, idealSwellDir: 225, offshoreWindDir: 90,  type: "reef", heavy: true },
  { id: "padang",       country: "ID", name: "Padang Padang",      region: "Bali",                lat: -8.8067, lng: 115.1000, idealSwellDir: 225, offshoreWindDir: 90,  type: "reef", heavy: true },
  { id: "keramas",      country: "ID", name: "Keramas",            region: "Bali",                lat: -8.5850, lng: 115.3383, idealSwellDir: 135, offshoreWindDir: 270, type: "reef" },
  { id: "balangan",     country: "ID", name: "Balangan",           region: "Bali",                lat: -8.7917, lng: 115.1233, idealSwellDir: 225, offshoreWindDir: 90,  type: "reef" },
  { id: "medewi",       country: "ID", name: "Medewi",             region: "Bali",                lat: -8.4100, lng: 114.8050, idealSwellDir: 225, offshoreWindDir: 90 },
  { id: "lakey-peak",   country: "ID", name: "Lakey Peak",         region: "Sumbawa",             lat: -8.8750, lng: 118.4333, idealSwellDir: 225, offshoreWindDir: 45,  type: "reef" },
  { id: "gland",        country: "ID", name: "G-Land",             region: "Java",                lat: -8.6667, lng: 114.3500, idealSwellDir: 200, offshoreWindDir: 45,  type: "reef", heavy: true },

  // ─── France ──────────────────────────────────────────────────────────
  { id: "hossegor",     country: "FR", name: "La Gravière",        region: "Hossegor",            lat: 43.6667, lng: -1.4333, idealSwellDir: 295, offshoreWindDir: 90 },
  { id: "biarritz",     country: "FR", name: "Grande Plage",       region: "Biarritz",            lat: 43.4832, lng: -1.5586, idealSwellDir: 295, offshoreWindDir: 135 },
  { id: "lacanau",      country: "FR", name: "Lacanau",            region: "Gironde",             lat: 45.0000, lng: -1.2000, idealSwellDir: 280, offshoreWindDir: 90 },

  // ─── Portugal ────────────────────────────────────────────────────────
  { id: "nazare",       country: "PT", name: "Nazaré (Praia do Norte)", region: "Nazaré",         lat: 39.6083, lng: -9.0783, idealSwellDir: 290, offshoreWindDir: 90, heavy: true },
  { id: "ericeira",     country: "PT", name: "Ribeira d'Ilhas",    region: "Ericeira",            lat: 38.9800, lng: -9.4167, idealSwellDir: 290, offshoreWindDir: 90,  type: "reef" },
  { id: "peniche",      country: "PT", name: "Supertubos",         region: "Peniche",             lat: 39.3500, lng: -9.3667, idealSwellDir: 290, offshoreWindDir: 45 },

  // ─── Spain ───────────────────────────────────────────────────────────
  { id: "mundaka",      country: "ES", name: "Mundaka",            region: "Basque Country",      lat: 43.4060, lng: -2.7006, idealSwellDir: 315, offshoreWindDir: 180 },

  // ─── USA ─────────────────────────────────────────────────────────────
  { id: "pipeline",     country: "US", name: "Pipeline",           region: "Oahu, Hawaii",        lat: 21.6611, lng: -158.0528, idealSwellDir: 315, offshoreWindDir: 135, type: "reef", heavy: true },
  { id: "waikiki",      country: "US", name: "Waikiki",            region: "Oahu, Hawaii",        lat: 21.2760, lng: -157.8330, idealSwellDir: 180, offshoreWindDir: 45 },
  { id: "malibu",       country: "US", name: "Malibu (First Point)", region: "California",        lat: 34.0381, lng: -118.6775, idealSwellDir: 225, offshoreWindDir: 45 },
  { id: "rincon",       country: "US", name: "Rincon",             region: "California",          lat: 34.3733, lng: -119.4797, idealSwellDir: 270, offshoreWindDir: 45 },
  { id: "trestles",     country: "US", name: "Lower Trestles",     region: "California",          lat: 33.3869, lng: -117.5894, idealSwellDir: 225, offshoreWindDir: 45 },
  { id: "ocean-beach",  country: "US", name: "Ocean Beach SF",     region: "California",          lat: 37.7593, lng: -122.5107, idealSwellDir: 270, offshoreWindDir: 90 },

  // ─── Mexico ──────────────────────────────────────────────────────────
  { id: "puerto",       country: "MX", name: "Puerto Escondido (Zicatela)", region: "Oaxaca",      lat: 15.8597, lng: -97.0522, idealSwellDir: 225, offshoreWindDir: 0, heavy: true },

  // ─── Costa Rica ──────────────────────────────────────────────────────
  { id: "pavones",      country: "CR", name: "Pavones",            region: "South Pacific",       lat: 8.3789, lng: -83.1411, idealSwellDir: 225, offshoreWindDir: 45 },

  // ─── Brazil ──────────────────────────────────────────────────────────
  { id: "itacare",      country: "BR", name: "Itacaré",            region: "Bahia",               lat: -14.2781, lng: -38.9967, idealSwellDir: 150, offshoreWindDir: 270 },
  { id: "saquarema",    country: "BR", name: "Saquarema (Itaúna)", region: "Rio de Janeiro",      lat: -22.9300, lng: -42.5000, idealSwellDir: 180, offshoreWindDir: 0 },
  { id: "floripa",      country: "BR", name: "Praia Mole",         region: "Florianópolis",       lat: -27.6036, lng: -48.4250, idealSwellDir: 180, offshoreWindDir: 270 },

  // ─── New Zealand ─────────────────────────────────────────────────────
  { id: "raglan",       country: "NZ", name: "Raglan (Manu Bay)",  region: "Waikato",             lat: -37.8133, lng: 174.8208, idealSwellDir: 225, offshoreWindDir: 90 },
  { id: "piha",         country: "NZ", name: "Piha",               region: "Auckland",            lat: -36.9550, lng: 174.4672, idealSwellDir: 225, offshoreWindDir: 90 },

  // ─── French Polynesia ────────────────────────────────────────────────
  { id: "teahupoo",     country: "PF", name: "Teahupo'o",          region: "Tahiti",              lat: -17.8522, lng: -149.2672, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", heavy: true },

  // ─── South Africa ────────────────────────────────────────────────────
  { id: "jbay",         country: "ZA", name: "Jeffreys Bay (Supertubes)", region: "Eastern Cape", lat: -34.0500, lng: 24.9167, idealSwellDir: 225, offshoreWindDir: 315 },

  // ─── Morocco ─────────────────────────────────────────────────────────
  { id: "taghazout",    country: "MA", name: "Anchor Point",       region: "Taghazout",           lat: 30.5422, lng: -9.7125, idealSwellDir: 300, offshoreWindDir: 90, type: "reef" },
];

export function findBreak(id) {
  return BREAKS.find(b => b.id === id) || BREAKS[0];
}
