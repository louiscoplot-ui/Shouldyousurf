// v2 realFetch — pulls Open-Meteo forecasts and reshapes them into the
// structure v2's components expect (windType as "offshore"/"cross-shore"/
// "onshore", swellDir/windDir as 16-point cardinal strings, windKmh rather
// than knots, faceFtLow/faceFtHigh, etc.).
//
// Deliberately self-contained — v2 stays decoupled from app/page.js while
// we're iterating on the design.

import { scoreBreakdown, getLevel } from "./verdict";

const TZ = "Australia/Perth";
const CARDINALS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

function degToCardinal(deg) {
  if (deg == null || isNaN(deg)) return "—";
  return CARDINALS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

function knToKmh(kn) { return kn * 1.852; }
function mToFt(m) { return m * 3.281; }
function estimateFaceHeight(swellHeight, swellPeriod) {
  const p = Math.min(1.8, Math.max(0.7, swellPeriod / 10));
  return swellHeight * p;
}

function classifyWind(windDeg, offshoreWindDir) {
  if (offshoreWindDir == null) return "cross-shore";
  const delta = Math.abs((((windDeg - offshoreWindDir) + 540) % 360) - 180);
  if (delta <= 45) return "offshore";
  if (delta >= 135) return "onshore";
  return "cross-shore";
}

function formatDayLabel(isoDate, todayStr) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dayDate = new Date(Date.UTC(y, mo - 1, d, 12));
  const diffDays = Math.round(
    (dayDate.getTime() - new Date(todayStr + "T12:00:00Z").getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return { label: "Today", isToday: true, isPast: false };
  if (diffDays === 1) return { label: "Tmrw", isToday: false, isPast: false };
  if (diffDays === -1) return { label: "Yest.", isToday: false, isPast: true };
  if (diffDays === -2) return { label: "-2d", isToday: false, isPast: true };
  if (diffDays === -3) return { label: "-3d", isToday: false, isPast: true };
  const dayName = dayDate.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
  return { label: dayName, isToday: false, isPast: diffDays < 0 };
}

function offsetDate(isoDate, n) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Fetches marine + forecast data for a spot with lat/lng/idealSwellDir/offshoreWindDir.
// Returns days[] in v2's shape. Throws on hard API failure.
export async function fetchRealForecast(spot) {
  const tz = spot.timezone || TZ;
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const pastStart = offsetDate(todayStr, -3);
  const pastEnd = offsetDate(todayStr, -1);
  const marineFields =
    "wave_height,swell_wave_height,swell_wave_period,swell_wave_direction,sea_surface_temperature,sea_level_height_msl";

  const pastMarineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${marineFields}&start_date=${pastStart}&end_date=${pastEnd}&timezone=${encodeURIComponent(tz)}`;
  const pastWindUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m&wind_speed_unit=kn&start_date=${pastStart}&end_date=${pastEnd}&timezone=${encodeURIComponent(tz)}`;
  const futureMarineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${marineFields}&timezone=${encodeURIComponent(tz)}&forecast_days=5`;
  const futureWindUrl = `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wind_speed_10m,wind_direction_10m,precipitation_probability,temperature_2m&timezone=${encodeURIComponent(tz)}&wind_speed_unit=kn&forecast_days=5`;

  const [pastMarineRes, pastWindRes, futureMarineRes, futureWindRes] = await Promise.all([
    fetch(pastMarineUrl).catch(() => null),
    fetch(pastWindUrl).catch(() => null),
    fetch(futureMarineUrl),
    fetch(futureWindUrl),
  ]);

  if (!futureMarineRes.ok) throw new Error(`Marine API: HTTP ${futureMarineRes.status}`);
  if (!futureWindRes.ok) throw new Error(`Wind API: HTTP ${futureWindRes.status}`);
  const futureMarine = await futureMarineRes.json();
  const futureWind = await futureWindRes.json();
  if (!futureMarine.hourly || !futureWind.hourly) throw new Error("Invalid API response");

  const buildHours = (marine, wind, isPast) => {
    return marine.hourly.time.map((t, i) => {
      const swellHeight = marine.hourly.swell_wave_height[i];
      const swellPeriod = marine.hourly.swell_wave_period[i];
      const swellDirDeg = marine.hourly.swell_wave_direction[i];
      const windKn = wind.hourly.wind_speed_10m[i];
      const windDirDeg = wind.hourly.wind_direction_10m[i];
      if (swellHeight == null || windKn == null) return null;
      const faceM = estimateFaceHeight(swellHeight, swellPeriod);
      const faceFt = mToFt(faceM);
      const h = {
        time: t,
        hour: parseInt(t.split("T")[1].slice(0, 2), 10),
        isPast,
        swellHeight,
        swellPeriod,
        swellDir: degToCardinal(swellDirDeg),
        swellDirDeg,
        windKmh: knToKmh(windKn),
        windDir: degToCardinal(windDirDeg),
        windDirDeg,
        windType: classifyWind(windDirDeg, spot.offshoreWindDir),
        faceFtLow: Math.max(1, Math.floor(faceFt - 0.5)),
        faceFtHigh: Math.ceil(faceFt + 0.5),
        airTemp: wind.hourly.temperature_2m?.[i] ?? null,
        seaTemp: marine.hourly.sea_surface_temperature?.[i] ?? null,
        rainProb: wind.hourly.precipitation_probability?.[i] ?? null,
        tideM: marine.hourly.sea_level_height_msl?.[i] ?? null,
        notes: [],
      };
      // Score using v2's own breakdown (0-100)
      h.score = scoreBreakdown(h).total;
      return h;
    }).filter(Boolean);
  };

  const futureHours = buildHours(futureMarine, futureWind, false);
  let pastHours = [];
  if (pastMarineRes?.ok && pastWindRes?.ok) {
    try {
      const pastMarine = await pastMarineRes.json();
      const pastWind = await pastWindRes.json();
      if (pastMarine.hourly && pastWind.hourly) {
        pastHours = buildHours(pastMarine, pastWind, true);
      }
    } catch {}
  }

  const allHours = [...pastHours, ...futureHours];
  const byDay = {};
  allHours.forEach((h) => {
    const d = h.time.split("T")[0];
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(h);
  });

  const days = [];
  for (let off = -3; off <= 4; off++) {
    const dateStr = offsetDate(todayStr, off);
    const hours = byDay[dateStr];
    if (!hours || !hours.length) continue;
    // Clip to 4am-8pm like the prototype
    const surfHours = hours.filter((h) => h.hour >= 4 && h.hour <= 20);
    if (!surfHours.length) continue;
    const meta = formatDayLabel(dateStr, todayStr);
    const [y, mo, d] = dateStr.split("-").map(Number);
    const bestHour = surfHours.reduce((b, h) => (h.score > (b?.score ?? -1) ? h : b), null);
    days.push({
      label: meta.label,
      dateLabel: `${d}/${mo}`,
      isToday: meta.isToday,
      isPast: meta.isPast,
      hours: surfHours,
      bestHour,
      bestLevel: getLevel(bestHour.score),
    });
  }
  return days;
}
