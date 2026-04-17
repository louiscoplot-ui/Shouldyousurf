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
  { id: "shipstern",    name: "Shipstern Bluff",    region: "Tasmania",     lat: -43.1889, lng: 147.7500, idealSwellDir: 225, offshoreWindDir: 45 },
  { id: "clifton",      name: "Clifton Beach",      region: "Hobart, TAS",  lat: -42.9817, lng: 147.5217, idealSwellDir: 135, offshoreWindDir: 315 },
];

export function findBreak(id) {
  return BREAKS.find(b => b.id === id) || BREAKS[0];
}
