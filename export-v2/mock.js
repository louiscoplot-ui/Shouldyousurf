// Fake forecast mock for the UI kit — no API calls.
// Mirrors the shape the real app's scoreSurf() expects.

window.BREAKS = [
  { id: "trigg",       name: "Trigg Beach",        region: "Perth, WA",    type: "beach" },
  { id: "scarborough", name: "Scarborough",        region: "Perth, WA",    type: "beach" },
  { id: "cottesloe",   name: "Cottesloe",          region: "Perth, WA",    type: "beach" },
  { id: "margaret",    name: "Margaret River Main",region: "Margaret River, WA", type: "reef" },
  { id: "snapper",     name: "Snapper Rocks",      region: "Gold Coast, QLD", type: "beach" },
  { id: "kirra",       name: "Kirra",              region: "Gold Coast, QLD", type: "beach" },
  { id: "burleigh",    name: "Burleigh Heads",     region: "Gold Coast, QLD", type: "beach" },
  { id: "bondi",       name: "Bondi Beach",        region: "Sydney, NSW",  type: "beach" },
  { id: "manly",       name: "Manly",              region: "Sydney, NSW",  type: "beach" },
  { id: "byron",       name: "The Pass (Byron)",   region: "Byron Bay, NSW", type: "beach" },
  { id: "bells",       name: "Bells Beach",        region: "Torquay, VIC", type: "reef" },
  { id: "noosa",       name: "Noosa (First Point)",region: "Sunshine Coast, QLD", type: "beach" },
];

// Hand-picked, surf-plausible scores so the demo shows the palette.
window.SCORE_SCALE = [
  { min: 75, max: 100, color: "#15803d", label: "Pumping", sub: "Prime conditions" },
  { min: 55, max: 74,  color: "#16a34a", label: "Great",   sub: "Proper good session" },
  { min: 45, max: 54,  color: "#65a30d", label: "Good",    sub: "Solid session" },
  { min: 35, max: 44,  color: "#84cc16", label: "Fun",     sub: "Nice little surf, worth paddling out" },
  { min: 15, max: 34,  color: "#ea580c", label: "Small",   sub: "Groms only" },
  { min: 0,  max: 14,  color: "#dc2626", label: "Flat",    sub: "Stay home" },
];

window.getLevel = function(s) {
  return window.SCORE_SCALE.find(x => s >= x.min && s <= x.max) || window.SCORE_SCALE[5];
};

// Deterministic pseudo-random so refreshes keep the same mock.
function seeded(seed) {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

function buildDay(seed, dayIdx, peakHour, peakScore, spread) {
  const r = seeded(seed);
  const hours = [];
  // Show 4am → 8pm so users see dawn + evening
  for (let h = 4; h <= 20; h++) {
    const dist = Math.abs(h - peakHour);
    const score = Math.max(0, Math.min(100, Math.round(peakScore - dist * spread + (r() - 0.5) * 10)));
    const swellHeight = 0.8 + r() * 1.6;           // 0.8 – 2.4 m
    const swellPeriod = 8 + r() * 8;                // 8 – 16 s
    const windKmh = 6 + r() * 28;                   // 6 – 34 km/h
    const faceFt = (swellHeight * Math.min(1.8, Math.max(0.7, swellPeriod / 10))) * 3.281;
    hours.push({
      time: `2026-04-${String(13 + dayIdx).padStart(2, "0")}T${String(h).padStart(2, "0")}:00`,
      hour: h,
      score,
      swellHeight,
      swellPeriod,
      swellDir: ["SSW", "SW", "S", "WSW"][h % 4],
      windKmh,
      windDir: ["E", "ESE", "SE", "NE"][h % 4],
      windType: windKmh < 15 ? "offshore" : (windKmh < 25 ? "cross-shore" : "onshore"),
      faceFtLow: Math.max(1, Math.floor(faceFt - 0.5)),
      faceFtHigh: Math.ceil(faceFt + 0.5),
      airTemp: 22 + Math.round(r() * 5),
      seaTemp: 19 + Math.round(r() * 3),
      notes: (() => {
        const all = [];
        if (swellPeriod >= 14) all.push("Long-period groundswell");
        else if (swellPeriod >= 11) all.push("Decent groundswell");
        else all.push("Short-period swell");
        if (swellHeight >= 1.8) all.push("Solid size");
        else if (swellHeight >= 1.0) all.push("Good size");
        else all.push("Small");
        all.push("Ideal swell direction");
        if (windKmh < 10) all.push("Light offshore — glassy");
        else if (windKmh < 25) all.push("Offshore wind");
        else all.push("Cross-shore texture");
        return all;
      })(),
    });
  }
  return hours;
}

window.makeForecast = function(spotId) {
  // Seed from spotId so each spot has its own mock.
  const seed = spotId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 37;
  const days = [
    { label: "Yest.",  dateLabel: "12/4", isPast: true,  hours: buildDay(seed + 0, 0, 9,  48, 5) },
    { label: "Today",  dateLabel: "13/4", isPast: false, hours: buildDay(seed + 1, 1, 8,  82, 7), isToday: true },
    { label: "Tmrw",   dateLabel: "14/4", isPast: false, hours: buildDay(seed + 2, 2, 10, 66, 6) },
    { label: "Wed",    dateLabel: "15/4", isPast: false, hours: buildDay(seed + 3, 3, 11, 42, 5) },
    { label: "Thu",    dateLabel: "16/4", isPast: false, hours: buildDay(seed + 4, 4, 7,  58, 6) },
    { label: "Fri",    dateLabel: "17/4", isPast: false, hours: buildDay(seed + 5, 5, 9,  30, 4) },
  ];
  days.forEach(d => {
    d.bestHour = d.hours.reduce((b, h) => h.score > (b?.score ?? -1) ? h : b, null);
    d.bestLevel = window.getLevel(d.bestHour.score);
  });
  return days;
};

window.fmtHour = function(h) {
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "am" : "pm";
  return `${hh}:00${ampm}`;
};

window.LEVELS = [
  { key: "first_timer",  name: "First-timer",         sub: "Never surfed, or just a couple of tries in whitewash." },
  { key: "beginner",     name: "Beginner",            sub: "Comfortable on foam, starting to catch unbroken waves." },
  { key: "early_int",    name: "Early intermediate",  sub: "Paddling out past the break, still working on bigger waves." },
  { key: "intermediate", name: "Intermediate",        sub: "Confident duck-diving, comfortable up to head-high." },
  { key: "advanced",     name: "Advanced",            sub: "Comfortable in powerful overhead surf, any board." },
  { key: "expert",       name: "Expert / Pro",        sub: "Reef, heavy, big-wave — you know the game." },
];

// Per-level verdict + reason for a given hour. 5 levels, contextual messages.
window.levelMatrixFor = function(h) {
  const face = (h.faceFtLow + h.faceFtHigh) / 2;       // ft
  const wind = h.windKmh;
  const period = h.swellPeriod;
  const type = (h.windType || "").toLowerCase();
  const clean = type === "offshore" || wind < 12;
  const choppy = type.includes("onshore") || wind >= 25;
  const cross = type.includes("cross");
  const longP = period >= 11;

  // Shorthand message builders
  const blownMsg = (who) => choppy ? `Too choppy for ${who}` : cross ? `Side-chop, messy` : "";
  const sizeMsg = (lo, hi) => face < lo ? "Too small" : face > hi ? "Too big" : "";

  const rows = [];

  // 1) Beginner — comfort zone is 1–3ft, clean or light wind only
  rows.push((() => {
    const tooBig  = face > 3.5;
    const tooMess = choppy && face > 2;
    const ok      = face >= 1 && face <= 3 && clean;
    if (tooBig) return { key:"beginner", name:"Beginner", verdict:"no",
      reason: face > 6 ? "Way overhead — dangerous" : "Too big, stay out" };
    if (tooMess) return { key:"beginner", name:"Beginner", verdict:"no",
      reason: "Choppy + too big — wait" };
    if (face < 0.8) return { key:"beginner", name:"Beginner", verdict:"no",
      reason: "Flat — nothing to catch" };
    if (ok) return { key:"beginner", name:"Beginner", verdict:"yes",
      reason: "Small clean waves — learn now" };
    return { key:"beginner", name:"Beginner", verdict:"ok",
      reason: clean ? "Fun little peelers" : "Workable if you paddle inside" };
  })());

  // 2) Early intermediate — 1.5–4ft sweet spot, can handle some wind
  rows.push((() => {
    if (face < 1.2) return { key:"eint", name:"Early Int.", verdict:"no",
      reason: "Too small — mushy" };
    if (face > 5 && choppy) return { key:"eint", name:"Early Int.", verdict:"no",
      reason: "Overhead + windy — too much" };
    if (face > 6) return { key:"eint", name:"Early Int.", verdict:"no",
      reason: "Way beyond comfort zone" };
    if (face >= 1.5 && face <= 4 && clean) return { key:"eint", name:"Early Int.", verdict:"yes",
      reason: longP ? "Clean groundswell, good size" : "Clean, rideable" };
    if (face >= 2 && face <= 4) return { key:"eint", name:"Early Int.", verdict:"ok",
      reason: choppy ? "Bumpy but ridable" : "Workable side-wind" };
    return { key:"eint", name:"Early Int.", verdict:"ok",
      reason: face < 2 ? "Small but clean" : "A bit messy, still doable" };
  })());

  // 3) Intermediate — 2–6ft sweet spot, handles cross/light onshore
  rows.push((() => {
    if (face < 1.5) return { key:"int", name:"Intermediate", verdict:"no",
      reason: "Too small and slow" };
    if (face > 8 && !clean) return { key:"int", name:"Intermediate", verdict:"no",
      reason: "Big + blown out — wait" };
    if (face >= 2 && face <= 6 && clean) return { key:"int", name:"Intermediate", verdict:"yes",
      reason: longP ? "Prime groundswell — go" : "Clean, well-sized" };
    if (face >= 2 && face <= 6) return { key:"int", name:"Intermediate", verdict:"ok",
      reason: choppy ? "Workable onshore texture" : "Ridable cross-shore" };
    return { key:"int", name:"Intermediate", verdict:"ok",
      reason: face > 6 ? "Stepping up in size" : "Small but clean" };
  })());

  // 4) Advanced — wants 3–10ft, cleaner wind ideal but can ride messy
  rows.push((() => {
    if (face < 2) return { key:"adv", name:"Advanced", verdict:"no",
      reason: "Too small to enjoy" };
    if (face >= 3 && face <= 10 && clean) return { key:"adv", name:"Advanced", verdict:"yes",
      reason: longP ? "Powerful groundswell — go now" : "Proper size, clean wind" };
    if (face >= 3 && face <= 10) return { key:"adv", name:"Advanced", verdict:"ok",
      reason: choppy ? "Solid but blown-out" : "Ridable, bumpy face" };
    if (face > 10 && clean) return { key:"adv", name:"Advanced", verdict:"ok",
      reason: "Big — paddle with care" };
    return { key:"adv", name:"Advanced", verdict:"ok",
      reason: "Below your threshold but fun" };
  })());

  // 5) Expert — wants 5ft+, okay with heavy conditions
  rows.push((() => {
    if (face < 2.5) return { key:"exp", name:"Expert", verdict:"no",
      reason: "Nothing to charge" };
    if (face >= 5 && clean && longP) return { key:"exp", name:"Expert", verdict:"yes",
      reason: "Prime conditions — this is why you wake up" };
    if (face >= 5 && clean) return { key:"exp", name:"Expert", verdict:"yes",
      reason: "Proper size, clean — go" };
    if (face >= 5) return { key:"exp", name:"Expert", verdict:"ok",
      reason: choppy ? "Big + messy — doable" : "Cross-shore chop, workable" };
    return { key:"exp", name:"Expert", verdict:"ok",
      reason: "Fun but below threshold" };
  })());

  return rows;
};

window.LEVEL_TO_MATRIX_IDX = {
  first_timer: 0, beginner: 0, early_int: 1, intermediate: 1, advanced: 2, expert: 3,
};
