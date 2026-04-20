// Curated surf breaks worldwide with coordinates and break-specific parameters.
// `idealSwellDir` is the sweet spot (degrees). `offshoreWindDir` is the ideal
// wind direction for that break. `country` is the ISO-2 code (for filtering).
// `idealTide` is the tide window where the break works best: "low" | "mid-low"
// | "mid" | "mid-high" | "high" | "any" (default when omitted).

export const COUNTRIES = [
  { code: "AU", name: "Australia",        flag: "🇦🇺" },
  { code: "ID", name: "Indonesia",        flag: "🇮🇩" },
  { code: "LK", name: "Sri Lanka",        flag: "🇱🇰" },
  { code: "MV", name: "Maldives",         flag: "🇲🇻" },
  { code: "FR", name: "France",           flag: "🇫🇷" },
  { code: "PT", name: "Portugal",         flag: "🇵🇹" },
  { code: "ES", name: "Spain",            flag: "🇪🇸" },
  { code: "IE", name: "Ireland",          flag: "🇮🇪" },
  { code: "GB", name: "United Kingdom",   flag: "🇬🇧" },
  { code: "US", name: "United States",    flag: "🇺🇸" },
  { code: "MX", name: "Mexico",           flag: "🇲🇽" },
  { code: "CR", name: "Costa Rica",       flag: "🇨🇷" },
  { code: "NI", name: "Nicaragua",        flag: "🇳🇮" },
  { code: "PE", name: "Peru",             flag: "🇵🇪" },
  { code: "EC", name: "Ecuador",          flag: "🇪🇨" },
  { code: "BR", name: "Brazil",           flag: "🇧🇷" },
  { code: "NZ", name: "New Zealand",      flag: "🇳🇿" },
  { code: "PF", name: "French Polynesia", flag: "🇵🇫" },
  { code: "FJ", name: "Fiji",             flag: "🇫🇯" },
  { code: "ZA", name: "South Africa",     flag: "🇿🇦" },
  { code: "MA", name: "Morocco",          flag: "🇲🇦" },
  { code: "PH", name: "Philippines",      flag: "🇵🇭" },
  { code: "JP", name: "Japan",            flag: "🇯🇵" },
];

export const BREAKS = [
  // ─── Western Australia ───────────────────────────────────────────────
  { id: "trigg",        country: "AU", name: "Trigg Beach",        region: "Perth, WA",    lat: -31.8826, lng: 115.7519, idealSwellDir: 240, offshoreWindDir: 90,  idealTide: "mid-high", notes: "Five Fathom Bank absorbs swell. Needs long period." },
  { id: "scarborough",  country: "AU", name: "Scarborough",        region: "Perth, WA",    lat: -31.8939, lng: 115.7553, idealSwellDir: 240, offshoreWindDir: 90,  idealTide: "mid-high" },
  { id: "cottesloe",    country: "AU", name: "Cottesloe",          region: "Perth, WA",    lat: -31.9950, lng: 115.7520, idealSwellDir: 240, offshoreWindDir: 90,  idealTide: "mid-high" },
  { id: "leighton",     country: "AU", name: "Leighton",           region: "Perth, WA",    lat: -32.0283, lng: 115.7461, idealSwellDir: 240, offshoreWindDir: 90,  idealTide: "mid-high" },
  { id: "margaret",     country: "AU", name: "Margaret River Main",region: "Margaret River, WA", lat: -33.9717, lng: 114.9896, idealSwellDir: 225, offshoreWindDir: 90,  idealTide: "mid" },
  { id: "yallingup",    country: "AU", name: "Yallingup",          region: "Margaret River, WA", lat: -33.6406, lng: 114.9908, idealSwellDir: 225, offshoreWindDir: 135, idealTide: "mid" },
  { id: "gnaraloo",     country: "AU", name: "Gnaraloo (Tombstones)", region: "Coral Coast, WA", lat: -23.8489, lng: 113.5350, idealSwellDir: 225, offshoreWindDir: 90,  idealTide: "mid-low" },

  // ─── New South Wales ─────────────────────────────────────────────────
  { id: "bondi",        country: "AU", name: "Bondi Beach",        region: "Sydney, NSW",  lat: -33.8915, lng: 151.2767, idealSwellDir: 140, offshoreWindDir: 270, idealTide: "mid" },
  { id: "manly",        country: "AU", name: "Manly",              region: "Sydney, NSW",  lat: -33.7969, lng: 151.2880, idealSwellDir: 140, offshoreWindDir: 270, idealTide: "mid" },
  { id: "north-narra",  country: "AU", name: "North Narrabeen",    region: "Sydney, NSW",  lat: -33.7050, lng: 151.2994, idealSwellDir: 150, offshoreWindDir: 270, idealTide: "mid" },
  { id: "byron",        country: "AU", name: "The Pass (Byron)",   region: "Byron Bay, NSW", lat: -28.6346, lng: 153.6311, idealSwellDir: 120, offshoreWindDir: 225, idealTide: "mid" },
  { id: "lennox",       country: "AU", name: "Lennox Head",        region: "Northern NSW", lat: -28.7940, lng: 153.5942, idealSwellDir: 150, offshoreWindDir: 270, idealTide: "mid-low" },
  { id: "crescent",     country: "AU", name: "Crescent Head",      region: "Mid North Coast, NSW", lat: -31.1889, lng: 152.9825, idealSwellDir: 140, offshoreWindDir: 270, idealTide: "mid-low" },
  { id: "angourie",     country: "AU", name: "Angourie",           region: "Northern NSW", lat: -29.4830, lng: 153.3630, idealSwellDir: 135, offshoreWindDir: 270, idealTide: "mid" },

  // ─── Queensland ──────────────────────────────────────────────────────
  { id: "snapper",      country: "AU", name: "Snapper Rocks",      region: "Gold Coast, QLD", lat: -28.1627, lng: 153.5522, idealSwellDir: 135, offshoreWindDir: 225, idealTide: "mid-low" },
  { id: "kirra",        country: "AU", name: "Kirra",              region: "Gold Coast, QLD", lat: -28.1694, lng: 153.5333, idealSwellDir: 135, offshoreWindDir: 225, idealTide: "mid-low" },
  { id: "burleigh",     country: "AU", name: "Burleigh Heads",     region: "Gold Coast, QLD", lat: -28.1006, lng: 153.4500, idealSwellDir: 135, offshoreWindDir: 225, idealTide: "mid-low" },
  { id: "dbah",         country: "AU", name: "Duranbah (D'Bah)",   region: "Gold Coast, QLD", lat: -28.1681, lng: 153.5522, idealSwellDir: 135, offshoreWindDir: 270, idealTide: "mid" },
  { id: "noosa",        country: "AU", name: "Noosa (First Point)",region: "Sunshine Coast, QLD", lat: -26.3833, lng: 153.0900, idealSwellDir: 100, offshoreWindDir: 180, idealTide: "mid" },
  { id: "alexandra",    country: "AU", name: "Alexandra Headland", region: "Sunshine Coast, QLD", lat: -26.6717, lng: 153.1031, idealSwellDir: 120, offshoreWindDir: 225, idealTide: "mid" },

  // ─── Victoria ────────────────────────────────────────────────────────
  { id: "bells",        country: "AU", name: "Bells Beach",        region: "Torquay, VIC", lat: -38.3706, lng: 144.2839, idealSwellDir: 210, offshoreWindDir: 360, idealTide: "mid-high" },
  { id: "winkipop",     country: "AU", name: "Winkipop",           region: "Torquay, VIC", lat: -38.3733, lng: 144.2872, idealSwellDir: 210, offshoreWindDir: 360, idealTide: "mid-high" },
  { id: "jan-juc",      country: "AU", name: "Jan Juc",            region: "Torquay, VIC", lat: -38.3533, lng: 144.2917, idealSwellDir: 210, offshoreWindDir: 360, idealTide: "mid" },

  // ─── South Australia ─────────────────────────────────────────────────
  { id: "middleton",    country: "AU", name: "Middleton",          region: "Fleurieu, SA", lat: -35.5078, lng: 138.6930, idealSwellDir: 210, offshoreWindDir: 360, idealTide: "mid" },
  { id: "waits",        country: "AU", name: "Waitpinga",          region: "Fleurieu, SA", lat: -35.6467, lng: 138.5644, idealSwellDir: 225, offshoreWindDir: 360, idealTide: "mid" },

  // ─── Tasmania ────────────────────────────────────────────────────────
  { id: "shipstern",    country: "AU", name: "Shipstern Bluff",    region: "Tasmania",     lat: -43.1889, lng: 147.7500, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", heavy: true, idealTide: "mid-low" },
  { id: "clifton",      country: "AU", name: "Clifton Beach",      region: "Hobart, TAS",  lat: -42.9817, lng: 147.5217, idealSwellDir: 135, offshoreWindDir: 315, idealTide: "mid" },

  // ─── Indonesia ───────────────────────────────────────────────────────
  { id: "uluwatu",      country: "ID", name: "Uluwatu",            region: "Bali",                lat: -8.8152, lng: 115.0883, idealSwellDir: 225, offshoreWindDir: 90,  type: "reef", heavy: true, idealTide: "mid-high" },
  { id: "padang",       country: "ID", name: "Padang Padang",      region: "Bali",                lat: -8.8067, lng: 115.1000, idealSwellDir: 225, offshoreWindDir: 90,  type: "reef", heavy: true, idealTide: "mid-high" },
  { id: "keramas",      country: "ID", name: "Keramas",            region: "Bali",                lat: -8.5850, lng: 115.3383, idealSwellDir: 135, offshoreWindDir: 270, type: "reef", idealTide: "mid" },
  { id: "balangan",     country: "ID", name: "Balangan",           region: "Bali",                lat: -8.7917, lng: 115.1233, idealSwellDir: 225, offshoreWindDir: 90,  type: "reef", idealTide: "mid-high" },
  { id: "medewi",       country: "ID", name: "Medewi",             region: "Bali",                lat: -8.4100, lng: 114.8050, idealSwellDir: 225, offshoreWindDir: 90,  idealTide: "mid" },
  { id: "lakey-peak",   country: "ID", name: "Lakey Peak",         region: "Sumbawa",             lat: -8.8750, lng: 118.4333, idealSwellDir: 225, offshoreWindDir: 45,  type: "reef", idealTide: "mid" },
  { id: "gland",        country: "ID", name: "G-Land",             region: "Java",                lat: -8.6667, lng: 114.3500, idealSwellDir: 200, offshoreWindDir: 45,  type: "reef", heavy: true, idealTide: "mid-low" },

  // ─── France ──────────────────────────────────────────────────────────
  { id: "hossegor",     country: "FR", name: "La Gravière",        region: "Hossegor",            lat: 43.6667, lng: -1.4333, idealSwellDir: 295, offshoreWindDir: 90,  idealTide: "mid" },
  { id: "biarritz",     country: "FR", name: "Grande Plage",       region: "Biarritz",            lat: 43.4832, lng: -1.5586, idealSwellDir: 295, offshoreWindDir: 135, idealTide: "mid" },
  { id: "lacanau",      country: "FR", name: "Lacanau",            region: "Gironde",             lat: 45.0000, lng: -1.2000, idealSwellDir: 280, offshoreWindDir: 90,  idealTide: "mid" },

  // ─── Portugal ────────────────────────────────────────────────────────
  { id: "nazare",       country: "PT", name: "Nazaré (Praia do Norte)", region: "Nazaré",         lat: 39.6083, lng: -9.0783, idealSwellDir: 290, offshoreWindDir: 90, heavy: true, idealTide: "any" },
  { id: "ericeira",     country: "PT", name: "Ribeira d'Ilhas",    region: "Ericeira",            lat: 38.9800, lng: -9.4167, idealSwellDir: 290, offshoreWindDir: 90,  type: "reef", idealTide: "mid" },
  { id: "peniche",      country: "PT", name: "Supertubos",         region: "Peniche",             lat: 39.3500, lng: -9.3667, idealSwellDir: 290, offshoreWindDir: 45,  idealTide: "mid-low" },

  // ─── Spain ───────────────────────────────────────────────────────────
  { id: "mundaka",      country: "ES", name: "Mundaka",            region: "Basque Country",      lat: 43.4060, lng: -2.7006, idealSwellDir: 315, offshoreWindDir: 180, idealTide: "mid-low" },

  // ─── USA ─────────────────────────────────────────────────────────────
  { id: "pipeline",     country: "US", name: "Pipeline",           region: "Oahu, Hawaii",        lat: 21.6611, lng: -158.0528, idealSwellDir: 315, offshoreWindDir: 135, type: "reef", heavy: true, idealTide: "mid" },
  { id: "waikiki",      country: "US", name: "Waikiki",            region: "Oahu, Hawaii",        lat: 21.2760, lng: -157.8330, idealSwellDir: 180, offshoreWindDir: 45, idealTide: "any" },
  { id: "malibu",       country: "US", name: "Malibu (First Point)", region: "California",        lat: 34.0381, lng: -118.6775, idealSwellDir: 225, offshoreWindDir: 45, idealTide: "mid" },
  { id: "rincon",       country: "US", name: "Rincon",             region: "California",          lat: 34.3733, lng: -119.4797, idealSwellDir: 270, offshoreWindDir: 45, idealTide: "mid" },
  { id: "trestles",     country: "US", name: "Lower Trestles",     region: "California",          lat: 33.3869, lng: -117.5894, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", idealTide: "mid" },
  { id: "ocean-beach",  country: "US", name: "Ocean Beach SF",     region: "California",          lat: 37.7593, lng: -122.5107, idealSwellDir: 270, offshoreWindDir: 90, idealTide: "mid" },

  // ─── Mexico ──────────────────────────────────────────────────────────
  { id: "puerto",       country: "MX", name: "Puerto Escondido (Zicatela)", region: "Oaxaca",      lat: 15.8597, lng: -97.0522, idealSwellDir: 225, offshoreWindDir: 0, heavy: true, idealTide: "any" },

  // ─── Costa Rica ──────────────────────────────────────────────────────
  { id: "pavones",      country: "CR", name: "Pavones",            region: "South Pacific",       lat: 8.3789, lng: -83.1411, idealSwellDir: 225, offshoreWindDir: 45, idealTide: "mid-low" },

  // ─── Brazil ──────────────────────────────────────────────────────────
  { id: "itacare",      country: "BR", name: "Itacaré",            region: "Bahia",               lat: -14.2781, lng: -38.9967, idealSwellDir: 150, offshoreWindDir: 270, idealTide: "mid" },
  { id: "saquarema",    country: "BR", name: "Saquarema (Itaúna)", region: "Rio de Janeiro",      lat: -22.9300, lng: -42.5000, idealSwellDir: 180, offshoreWindDir: 0, idealTide: "mid" },
  { id: "floripa",      country: "BR", name: "Praia Mole",         region: "Florianópolis",       lat: -27.6036, lng: -48.4250, idealSwellDir: 180, offshoreWindDir: 270, idealTide: "mid" },

  // ─── New Zealand ─────────────────────────────────────────────────────
  { id: "raglan",       country: "NZ", name: "Raglan (Manu Bay)",  region: "Waikato",             lat: -37.8133, lng: 174.8208, idealSwellDir: 225, offshoreWindDir: 90, idealTide: "mid" },
  { id: "piha",         country: "NZ", name: "Piha",               region: "Auckland",            lat: -36.9550, lng: 174.4672, idealSwellDir: 225, offshoreWindDir: 90, idealTide: "mid" },

  // ─── French Polynesia ────────────────────────────────────────────────
  { id: "teahupoo",     country: "PF", name: "Teahupo'o",          region: "Tahiti",              lat: -17.8522, lng: -149.2672, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", heavy: true, idealTide: "mid" },

  // ─── South Africa ────────────────────────────────────────────────────
  { id: "jbay",         country: "ZA", name: "Jeffreys Bay (Supertubes)", region: "Eastern Cape", lat: -34.0500, lng: 24.9167, idealSwellDir: 225, offshoreWindDir: 315, idealTide: "mid" },

  // ─── Morocco ─────────────────────────────────────────────────────────
  { id: "taghazout",    country: "MA", name: "Anchor Point",       region: "Taghazout",           lat: 30.5422, lng: -9.7125, idealSwellDir: 300, offshoreWindDir: 90, type: "reef", idealTide: "mid" },
  { id: "imsouane",     country: "MA", name: "Imsouane (The Bay)", region: "Imsouane",            lat: 30.8404, lng: -9.8171, idealSwellDir: 290, offshoreWindDir: 90, idealTide: "mid" },
  { id: "boilers",      country: "MA", name: "Boilers",            region: "Taghazout",           lat: 30.5833, lng: -9.7361, idealSwellDir: 300, offshoreWindDir: 90, type: "reef", heavy: true, idealTide: "mid-high" },

  // ─── Sri Lanka ───────────────────────────────────────────────────────
  { id: "arugam",       country: "LK", name: "Arugam Bay Main Point", region: "Arugam Bay",       lat: 6.8406, lng: 81.8363, idealSwellDir: 180, offshoreWindDir: 270, idealTide: "mid" },
  { id: "peanut-farm",  country: "LK", name: "Peanut Farm",        region: "Arugam Bay",          lat: 6.7861, lng: 81.8386, idealSwellDir: 180, offshoreWindDir: 270, idealTide: "mid" },
  { id: "whiskey",      country: "LK", name: "Whiskey Point",      region: "Arugam Bay",          lat: 6.8889, lng: 81.8319, idealSwellDir: 180, offshoreWindDir: 270, idealTide: "mid" },
  { id: "hikkaduwa",    country: "LK", name: "Hikkaduwa Main Reef",region: "Southern Province",   lat: 6.1378, lng: 80.1019, idealSwellDir: 210, offshoreWindDir: 45, type: "reef", idealTide: "mid" },
  { id: "weligama",     country: "LK", name: "Weligama Bay",       region: "Southern Province",   lat: 5.9744, lng: 80.4197, idealSwellDir: 180, offshoreWindDir: 0, idealTide: "mid" },
  { id: "midigama",     country: "LK", name: "Midigama (Ram's)",   region: "Southern Province",   lat: 5.9681, lng: 80.4553, idealSwellDir: 195, offshoreWindDir: 0, type: "reef", idealTide: "mid" },
  { id: "mirissa",      country: "LK", name: "Mirissa",            region: "Southern Province",   lat: 5.9450, lng: 80.4564, idealSwellDir: 180, offshoreWindDir: 0, idealTide: "mid" },

  // ─── Maldives ────────────────────────────────────────────────────────
  { id: "cokes",        country: "MV", name: "Cokes",              region: "North Malé Atoll",    lat: 4.2094, lng: 73.4658, idealSwellDir: 180, offshoreWindDir: 0, type: "reef", idealTide: "mid-high" },
  { id: "chickens",     country: "MV", name: "Chickens",           region: "North Malé Atoll",    lat: 4.2097, lng: 73.4561, idealSwellDir: 180, offshoreWindDir: 90, type: "reef", idealTide: "mid-high" },
  { id: "pasta-point",  country: "MV", name: "Pasta Point",        region: "North Malé Atoll",    lat: 4.1747, lng: 73.5456, idealSwellDir: 180, offshoreWindDir: 0, type: "reef", idealTide: "mid" },
  { id: "sultans",      country: "MV", name: "Sultans",            region: "North Malé Atoll",    lat: 4.1772, lng: 73.5503, idealSwellDir: 180, offshoreWindDir: 0, type: "reef", idealTide: "mid" },

  // ─── France (additions) ──────────────────────────────────────────────
  { id: "seignosse",    country: "FR", name: "Les Bourdaines",     region: "Seignosse",           lat: 43.7063, lng: -1.4169, idealSwellDir: 295, offshoreWindDir: 90, idealTide: "mid" },
  { id: "guethary",     country: "FR", name: "Parlementia",        region: "Guéthary",            lat: 43.4272, lng: -1.6077, idealSwellDir: 295, offshoreWindDir: 90, type: "reef", idealTide: "mid" },
  { id: "anglet",       country: "FR", name: "Anglet (Sables d'Or)",region: "Anglet",             lat: 43.5083, lng: -1.5403, idealSwellDir: 295, offshoreWindDir: 135, idealTide: "mid" },
  { id: "capbreton",    country: "FR", name: "La Piste",           region: "Capbreton",           lat: 43.6436, lng: -1.4483, idealSwellDir: 295, offshoreWindDir: 90, idealTide: "mid" },
  { id: "st-girons",    country: "FR", name: "Saint-Girons",       region: "Landes",              lat: 43.9553, lng: -1.3542, idealSwellDir: 280, offshoreWindDir: 90, idealTide: "mid" },

  // ─── Portugal (additions) ────────────────────────────────────────────
  { id: "coxos",        country: "PT", name: "Coxos",              region: "Ericeira",            lat: 38.9872, lng: -9.4231, idealSwellDir: 310, offshoreWindDir: 90, type: "reef", idealTide: "mid-low" },
  { id: "cave-pt",      country: "PT", name: "The Cave",           region: "Ericeira",            lat: 38.9756, lng: -9.4211, idealSwellDir: 290, offshoreWindDir: 45, type: "reef", heavy: true, idealTide: "mid-low" },

  // ─── Spain (additions) ───────────────────────────────────────────────
  { id: "zarautz",      country: "ES", name: "Zarautz",            region: "Basque Country",      lat: 43.2850, lng: -2.1706, idealSwellDir: 315, offshoreWindDir: 180, idealTide: "mid" },
  { id: "pantin",       country: "ES", name: "Pantín",             region: "Galicia",             lat: 43.6125, lng: -8.0775, idealSwellDir: 295, offshoreWindDir: 180, idealTide: "mid" },
  { id: "sopelana",     country: "ES", name: "Sopelana",           region: "Basque Country",      lat: 43.3867, lng: -2.9861, idealSwellDir: 315, offshoreWindDir: 180, idealTide: "mid" },

  // ─── Ireland ─────────────────────────────────────────────────────────
  { id: "mullaghmore",  country: "IE", name: "Mullaghmore Head",   region: "Sligo",               lat: 54.4661, lng: -8.4547, idealSwellDir: 290, offshoreWindDir: 135, type: "reef", heavy: true, idealTide: "mid" },
  { id: "bundoran",     country: "IE", name: "Bundoran (The Peak)",region: "Donegal",             lat: 54.4811, lng: -8.2856, idealSwellDir: 290, offshoreWindDir: 135, type: "reef", idealTide: "mid-low" },
  { id: "lahinch",      country: "IE", name: "Lahinch",            region: "Clare",               lat: 52.9300, lng: -9.3461, idealSwellDir: 290, offshoreWindDir: 90, idealTide: "mid" },

  // ─── UK ──────────────────────────────────────────────────────────────
  { id: "fistral",      country: "GB", name: "Fistral Beach",      region: "Newquay, Cornwall",   lat: 50.4175, lng: -5.1003, idealSwellDir: 290, offshoreWindDir: 90, idealTide: "mid" },
  { id: "thurso",       country: "GB", name: "Thurso East",        region: "Caithness, Scotland", lat: 58.5950, lng: -3.5106, idealSwellDir: 300, offshoreWindDir: 180, type: "reef", idealTide: "mid-low" },
  { id: "porthleven",   country: "GB", name: "Porthleven",         region: "Cornwall",            lat: 50.0825, lng: -5.3169, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", heavy: true, idealTide: "mid-low" },

  // ─── USA (additions) ─────────────────────────────────────────────────
  { id: "mavericks",    country: "US", name: "Mavericks",          region: "California",          lat: 37.4958, lng: -122.5014, idealSwellDir: 290, offshoreWindDir: 90, type: "reef", heavy: true, idealTide: "mid-low" },
  { id: "steamer",      country: "US", name: "Steamer Lane",       region: "Santa Cruz, California", lat: 36.9514, lng: -122.0261, idealSwellDir: 270, offshoreWindDir: 45, type: "reef", idealTide: "mid" },
  { id: "huntington",   country: "US", name: "Huntington Pier",    region: "California",          lat: 33.6550, lng: -117.9994, idealSwellDir: 225, offshoreWindDir: 45, idealTide: "mid" },
  { id: "rockaway",     country: "US", name: "Rockaway Beach",     region: "New York",            lat: 40.5864, lng: -73.8153, idealSwellDir: 140, offshoreWindDir: 315, idealTide: "mid" },
  { id: "montauk",      country: "US", name: "Ditch Plains",       region: "Montauk, NY",         lat: 41.0350, lng: -71.9350, idealSwellDir: 160, offshoreWindDir: 315, idealTide: "mid" },
  { id: "cape-hatteras",country: "US", name: "Cape Hatteras",      region: "North Carolina",      lat: 35.2236, lng: -75.6306, idealSwellDir: 135, offshoreWindDir: 270, idealTide: "mid" },

  // ─── Mexico (additions) ──────────────────────────────────────────────
  { id: "sayulita",     country: "MX", name: "Sayulita",           region: "Nayarit",             lat: 20.8700, lng: -105.4389, idealSwellDir: 225, offshoreWindDir: 45, idealTide: "mid" },
  { id: "barra",        country: "MX", name: "Barra de la Cruz",   region: "Oaxaca",              lat: 15.8283, lng: -95.8019, idealSwellDir: 225, offshoreWindDir: 0, type: "reef", idealTide: "mid" },
  { id: "salina-cruz",  country: "MX", name: "Salina Cruz",        region: "Oaxaca",              lat: 16.1736, lng: -95.1956, idealSwellDir: 225, offshoreWindDir: 0, idealTide: "mid" },

  // ─── Costa Rica (additions) ──────────────────────────────────────────
  { id: "playa-hermosa",country: "CR", name: "Playa Hermosa",      region: "Guanacaste",          lat: 9.5847, lng: -84.6064, idealSwellDir: 225, offshoreWindDir: 45, idealTide: "mid" },
  { id: "santa-teresa", country: "CR", name: "Santa Teresa",       region: "Nicoya",              lat: 9.6436, lng: -85.1697, idealSwellDir: 225, offshoreWindDir: 45, idealTide: "mid" },
  { id: "tamarindo",    country: "CR", name: "Tamarindo",          region: "Guanacaste",          lat: 10.3028, lng: -85.8431, idealSwellDir: 225, offshoreWindDir: 45, idealTide: "mid" },

  // ─── Nicaragua ───────────────────────────────────────────────────────
  { id: "popoyo",       country: "NI", name: "Popoyo",             region: "Rivas",               lat: 11.5458, lng: -86.1886, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", idealTide: "mid-low" },
  { id: "lance-left",   country: "NI", name: "Lance's Left",       region: "Rivas",               lat: 11.5575, lng: -86.1861, idealSwellDir: 225, offshoreWindDir: 45, type: "reef", idealTide: "mid" },

  // ─── Peru ────────────────────────────────────────────────────────────
  { id: "chicama",      country: "PE", name: "Chicama",            region: "La Libertad",         lat: -7.9333, lng: -79.3333, idealSwellDir: 225, offshoreWindDir: 90, idealTide: "mid" },
  { id: "cabo-blanco",  country: "PE", name: "Cabo Blanco",        region: "Piura",               lat: -4.2500, lng: -81.2333, idealSwellDir: 200, offshoreWindDir: 90, type: "reef", idealTide: "mid" },
  { id: "mancora",      country: "PE", name: "Máncora",            region: "Piura",               lat: -4.1058, lng: -81.0500, idealSwellDir: 200, offshoreWindDir: 90, idealTide: "mid" },

  // ─── Ecuador ─────────────────────────────────────────────────────────
  { id: "montanita",    country: "EC", name: "Montañita",          region: "Santa Elena",         lat: -1.8264, lng: -80.7533, idealSwellDir: 225, offshoreWindDir: 90, idealTide: "mid" },

  // ─── Brazil (additions) ──────────────────────────────────────────────
  { id: "maresias",     country: "BR", name: "Maresias",           region: "São Paulo",           lat: -23.7958, lng: -45.5469, idealSwellDir: 180, offshoreWindDir: 0, idealTide: "mid" },
  { id: "noronha",      country: "BR", name: "Cacimba do Padre",   region: "Fernando de Noronha", lat: -3.8472, lng: -32.4467, idealSwellDir: 315, offshoreWindDir: 135, idealTide: "mid-low" },

  // ─── New Zealand (additions) ─────────────────────────────────────────
  { id: "whangamata",   country: "NZ", name: "Whangamata",         region: "Coromandel",          lat: -37.2108, lng: 175.8697, idealSwellDir: 90, offshoreWindDir: 270, idealTide: "mid" },

  // ─── Fiji ────────────────────────────────────────────────────────────
  { id: "cloudbreak",   country: "FJ", name: "Cloudbreak",         region: "Mamanuca Islands",    lat: -17.8733, lng: 177.1942, idealSwellDir: 195, offshoreWindDir: 45, type: "reef", heavy: true, idealTide: "mid" },
  { id: "restaurants",  country: "FJ", name: "Restaurants",        region: "Tavarua",             lat: -17.8581, lng: 177.1847, idealSwellDir: 195, offshoreWindDir: 45, type: "reef", idealTide: "mid" },

  // ─── Philippines ─────────────────────────────────────────────────────
  { id: "cloud9",       country: "PH", name: "Cloud 9",            region: "Siargao",             lat: 9.8136, lng: 126.1700, idealSwellDir: 90, offshoreWindDir: 270, type: "reef", heavy: true, idealTide: "mid" },

  // ─── Japan ───────────────────────────────────────────────────────────
  { id: "chiba",        country: "JP", name: "Ichinomiya",         region: "Chiba",               lat: 35.3686, lng: 140.4100, idealSwellDir: 140, offshoreWindDir: 270, idealTide: "mid" },
];

export function findBreak(id) {
  return BREAKS.find(b => b.id === id) || BREAKS[0];
}
