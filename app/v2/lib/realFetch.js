// v2 realFetch — pulls Open-Meteo forecasts (same surface area as prod) and
// reshapes them into the structure v2's components expect (windType as
// "offshore"/"cross-shore"/"onshore", swellDir/windDir as 16-point cardinal
// strings for display, windKmh rather than knots, faceFtLow/faceFtHigh).
//
// Scoring delegates to the production engine in prodScoring.js so v2 stays in
// lock-step with the canonical verdict logic while evolving the visual design.

import {
  scoreSurf,
  estimateFaceHeight,
  dayTideCtx,
  mToFt,
  knToKmh,
  degToCompass,
  offsetDate,
  inferSpotProfile,
} from "./prodScoring";
import { getLevel as getV2Level } from "./verdict";

const TZ = "Australia/Perth";

function degToCardinal(deg) {
  if (deg == null || isNaN(deg)) return "—";
  return degToCompass(((deg % 360) + 360) % 360);
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

// Fetches marine + forecast data for a spot. Returns { days, sunByDay, spot }.
// `spot` on return is enriched with inferred idealSwellDir/offshoreWindDir when
// they weren't curated — so scoring works for any coordinate the user picks.
export async function fetchRealForecast(spot) {
  const tz = spot.timezone || TZ;
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const pastStart = offsetDate(todayStr, -3);
  const pastEnd = offsetDate(todayStr, -1);
  const marineFields =
    "wave_height,swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction,sea_level_height_msl";

  const pastMarineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${marineFields}&start_date=${pastStart}&end_date=${pastEnd}&timezone=${encodeURIComponent(tz)}`;
  const pastWindUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m&wind_speed_unit=kn&start_date=${pastStart}&end_date=${pastEnd}&timezone=${encodeURIComponent(tz)}`;
  const futureMarineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${marineFields}&timezone=${encodeURIComponent(tz)}&forecast_days=5`;
  const futureWindUrl = `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability&daily=sunrise,sunset&timezone=${encodeURIComponent(tz)}&wind_speed_unit=kn&forecast_days=5`;

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

  const buildRawHours = (marine, wind, isPast) => {
    return marine.hourly.time.map((t, i) => {
      const swellHeight = marine.hourly.swell_wave_height[i];
      const swellPeriod = marine.hourly.swell_wave_period[i];
      const swellDirDeg = marine.hourly.swell_wave_direction[i];
      const windKn = wind.hourly.wind_speed_10m[i];
      const windDirDeg = wind.hourly.wind_direction_10m[i];
      if (swellHeight == null || windKn == null) return null;
      return {
        time: t,
        hour: parseInt(t.split("T")[1].slice(0, 2), 10),
        isPast,
        swellHeight,
        swellPeriod,
        swellDir: swellDirDeg,
        windSpeedKn: windKn,
        windDir: windDirDeg,
        waveHeight: marine.hourly.wave_height?.[i] ?? null,
        windWaveHeight: marine.hourly.wind_wave_height?.[i] ?? null,
        secSwellH: marine.hourly.secondary_swell_wave_height?.[i] ?? null,
        secSwellP: marine.hourly.secondary_swell_wave_period?.[i] ?? null,
        secSwellDir: marine.hourly.secondary_swell_wave_direction?.[i] ?? null,
        tideM: marine.hourly.sea_level_height_msl?.[i] ?? null,
        seaTemp: marine.hourly.sea_surface_temperature?.[i] ?? null,
        airTemp: wind.hourly.temperature_2m?.[i] ?? null,
        rainProb: wind.hourly.precipitation_probability?.[i] ?? null,
        windGustKn: wind.hourly.wind_gusts_10m?.[i] ?? null,
        currentVel: marine.hourly.ocean_current_velocity?.[i] ?? null,
        currentDir: marine.hourly.ocean_current_direction?.[i] ?? null,
      };
    }).filter(Boolean);
  };

  const futureRaw = buildRawHours(futureMarine, futureWind, false);
  let pastRaw = [];
  if (pastMarineRes?.ok && pastWindRes?.ok) {
    try {
      const pastMarine = await pastMarineRes.json();
      const pastWind = await pastWindRes.json();
      if (pastMarine.hourly && pastWind.hourly) {
        pastRaw = buildRawHours(pastMarine, pastWind, true);
      }
    } catch {}
  }

  const allRaw = [...pastRaw, ...futureRaw];
  // Infer spot profile if the curated spot didn't pre-fill idealSwellDir.
  const needsInfer = spot.idealSwellDir == null || spot.offshoreWindDir == null;
  const inferred = needsInfer ? inferSpotProfile(allRaw) : null;
  const effectiveSpot = inferred ? { ...spot, ...inferred } : spot;

  // Now shape each hour for v2 components and score it with the prod engine.
  const byDay = {};
  allRaw.forEach((raw) => {
    const d = raw.time.split("T")[0];
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(raw);
  });

  const sunByDay = {};
  if (futureWind.daily?.time) {
    futureWind.daily.time.forEach((d, i) => {
      sunByDay[d] = {
        sunrise: futureWind.daily.sunrise?.[i] ?? null,
        sunset: futureWind.daily.sunset?.[i] ?? null,
      };
    });
  }

  const shapeHour = (raw, tideCtx) => {
    const faceM = estimateFaceHeight(raw.swellHeight, raw.swellPeriod);
    const faceFt = mToFt(faceM);
    // Score with the prod engine using the raw degrees — BEFORE we overwrite
    // swellDir/windDir below with the cardinal string the v2 components want.
    const { score, notes } = scoreSurf(raw, effectiveSpot, tideCtx);
    const swellDirDeg = raw.swellDir;
    const windDirDeg = raw.windDir;
    return {
      ...raw,
      // v2 components (StickyInfoBar, Hero, levelMatrixFor, drivingChipsFor)
      // read these as the compass string. Degree versions kept alongside for
      // components that need the raw number.
      swellDir: degToCardinal(swellDirDeg),
      windDir: degToCardinal(windDirDeg),
      swellDirDeg,
      windDirDeg,
      windKmh: knToKmh(raw.windSpeedKn),
      windType: classifyWind(windDirDeg, effectiveSpot.offshoreWindDir),
      faceFtLow: Math.max(1, Math.floor(faceFt - 0.5)),
      faceFtHigh: Math.ceil(faceFt + 0.5),
      score,
      notes,
    };
  };

  const days = [];
  for (let off = -3; off <= 4; off++) {
    const dateStr = offsetDate(todayStr, off);
    const rawHours = byDay[dateStr];
    if (!rawHours || !rawHours.length) continue;
    const rawSurf = rawHours.filter((h) => h.hour >= 4 && h.hour <= 20);
    if (!rawSurf.length) continue;
    const tideCtx = dayTideCtx(rawSurf);
    const shaped = rawSurf.map((r) => shapeHour(r, tideCtx));
    const meta = formatDayLabel(dateStr, todayStr);
    const [y, mo, d] = dateStr.split("-").map(Number);
    const bestHour = shaped.reduce((b, h) => (h.score > (b?.score ?? -1) ? h : b), null);
    days.push({
      dateStr,
      label: meta.label,
      dateLabel: `${d}/${mo}`,
      isToday: meta.isToday,
      isPast: meta.isPast,
      hours: shaped,
      bestHour,
      bestLevel: getV2Level(bestHour.score),
      tideCtx,
    });
  }
  return { days, sunByDay, effectiveSpot };
}
