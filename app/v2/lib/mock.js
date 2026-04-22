// v2 mock data — ported from export-v2/mock.js. Kept deterministic per spot id.
// TODO: replace with a fetch to the real forecast API when wiring prod data.

import { getLevel } from "./verdict";

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

function buildDay(seed, dayIdx, peakHour, peakScore, spread) {
  const r = seeded(seed);
  const hours = [];
  for (let h = 4; h <= 20; h++) {
    const dist = Math.abs(h - peakHour);
    const score = Math.max(0, Math.min(100, Math.round(peakScore - dist * spread + (r() - 0.5) * 10)));
    const swellHeight = 0.8 + r() * 1.6;
    const swellPeriod = 8 + r() * 8;
    const windKmh = 6 + r() * 28;
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
      windType: windKmh < 15 ? "offshore" : windKmh < 25 ? "cross-shore" : "onshore",
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

export function makeForecast(spotId) {
  const seed = spotId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 37;
  const days = [
    { label: "Yest.",  dateLabel: "12/4", isPast: true,  hours: buildDay(seed + 0, 0, 9,  48, 5) },
    { label: "Today",  dateLabel: "13/4", isPast: false, hours: buildDay(seed + 1, 1, 8,  82, 7), isToday: true },
    { label: "Tmrw",   dateLabel: "14/4", isPast: false, hours: buildDay(seed + 2, 2, 10, 66, 6) },
    { label: "Wed",    dateLabel: "15/4", isPast: false, hours: buildDay(seed + 3, 3, 11, 42, 5) },
    { label: "Thu",    dateLabel: "16/4", isPast: false, hours: buildDay(seed + 4, 4, 7,  58, 6) },
    { label: "Fri",    dateLabel: "17/4", isPast: false, hours: buildDay(seed + 5, 5, 9,  30, 4) },
  ];
  days.forEach((d) => {
    d.bestHour = d.hours.reduce((b, h) => (h.score > (b?.score ?? -1) ? h : b), null);
    d.bestLevel = getLevel(d.bestHour.score);
  });
  return days;
}
