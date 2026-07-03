// v2 mock data — ported from export-v2/mock.js. Kept deterministic per spot id.
// TODO: replace with a fetch to the real forecast API when wiring prod data.

import { getLevel } from "./verdict";
import { estimateFaceHeight, mToFt, spotAttenuation } from "./prodScoring";
import { BREAKS } from "../../breaks";

export const BREAKS_MOCK = [
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

function seeded(seed) {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

// Cardinal-to-degree map matching the cardinal labels mock uses below.
// scoreV2 (post-multiplicatif) reads swellDirDeg/windDirDeg numerically;
// without these the dir/wind multipliers fall through NaN guards and
// the user sees "Skip 5" partout sur fallback mock (audit BLOQUANT #2).
const SWELL_DIR_OPTIONS = [
  { card: "SSW", deg: 202.5 },
  { card: "SW",  deg: 225.0 },
  { card: "S",   deg: 180.0 },
  { card: "WSW", deg: 247.5 },
];
const WIND_DIR_OPTIONS = [
  { card: "E",   deg: 90.0 },
  { card: "ESE", deg: 112.5 },
  { card: "SE",  deg: 135.0 },
  { card: "NE",  deg: 45.0 },
];

function buildDay(seed, dateIso, peakHour, peakScore, spread, attenuation) {
  const r = seeded(seed);
  const hours = [];
  for (let h = 4; h <= 20; h++) {
    const dist = Math.abs(h - peakHour);
    const score = Math.max(0, Math.min(100, Math.round(peakScore - dist * spread + (r() - 0.5) * 10)));
    const swellHeight = 0.8 + r() * 1.6;
    const swellPeriod = 8 + r() * 8;
    const windKmh = 6 + r() * 28;
    // Même formule de face que le moteur (atténuation du spot incluse) —
    // l'ancienne copie locale non atténuée affichait "3–5 ft" à Trigg
    // pendant que score/verdict/planche raisonnaient sur ~2.6 ft.
    const faceFt = mToFt(estimateFaceHeight(swellHeight, swellPeriod, attenuation));
    const swellOpt = SWELL_DIR_OPTIONS[h % SWELL_DIR_OPTIONS.length];
    const windOpt = WIND_DIR_OPTIONS[h % WIND_DIR_OPTIONS.length];
    hours.push({
      time: `${dateIso}T${String(h).padStart(2, "0")}:00`,
      hour: h,
      score,
      swellHeight,
      swellPeriod,
      swellDir: swellOpt.card,
      swellDirDeg: swellOpt.deg,
      windKmh,
      windDir: windOpt.card,
      windDirDeg: windOpt.deg,
      windSpeedKn: windKmh / 1.852,
      windType: windKmh < 15 ? "offshore" : windKmh < 25 ? "cross-shore" : "onshore",
      // Match realFetch — faceFtLow can be 0 on a tiny day. Keep faceFtHigh
      // at minimum 1 so we never display "0–0 ft" (cosmetic, the high band
      // is what reads as the "size" in the UI).
      faceFtLow: Math.max(0, Math.floor(faceFt - 0.5)),
      faceFtHigh: Math.max(1, Math.ceil(faceFt + 0.5)),
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function makeForecast(spotId) {
  const seed = spotId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 37;
  // Atténuation du vrai spot (Trigg 0.60, etc.) pour que la face mock
  // affiche la même chose que ce que le moteur score. Spot custom/inconnu
  // → 1.0 (spotAttenuation gère le défaut).
  const attenuation = spotAttenuation(BREAKS.find((b) => b.id === spotId));
  // Dates are generated from the device clock so the fallback never shows
  // a frozen calendar (the old hardcoded "13/4" read as a real forecast
  // for the wrong date whenever the live fetch failed).
  const dayMeta = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = offset === -1 ? "Yest." : offset === 0 ? "Today" : offset === 1 ? "Tmrw" : WEEKDAYS[d.getDay()];
    return { iso, label, dateLabel: `${d.getDate()}/${d.getMonth() + 1}` };
  };
  const PROFILES = [
    { off: -1, peakHour: 9,  peakScore: 48, spread: 5 },
    { off: 0,  peakHour: 8,  peakScore: 82, spread: 7 },
    { off: 1,  peakHour: 10, peakScore: 66, spread: 6 },
    { off: 2,  peakHour: 11, peakScore: 42, spread: 5 },
    { off: 3,  peakHour: 7,  peakScore: 58, spread: 6 },
    { off: 4,  peakHour: 9,  peakScore: 30, spread: 4 },
  ];
  const days = PROFILES.map((p, i) => {
    const m = dayMeta(p.off);
    return {
      label: m.label,
      dateLabel: m.dateLabel,
      dateStr: m.iso,
      isPast: p.off < 0,
      isToday: p.off === 0,
      hours: buildDay(seed + i, m.iso, p.peakHour, p.peakScore, p.spread, attenuation),
    };
  });
  days.forEach((d) => {
    d.bestHour = d.hours.reduce((b, h) => (h.score > (b?.score ?? -1) ? h : b), null);
    d.bestLevel = getLevel(d.bestHour.score);
  });
  return days;
}
