// v2 realFetch — pulls Open-Meteo forecasts (same surface area as prod) and
// reshapes them into the structure v2's components expect (windType as
// "offshore"/"cross-shore"/"onshore", swellDir/windDir as 16-point cardinal
// strings for display, windKmh rather than knots, faceFtLow/faceFtHigh).
//
// Scoring delegates to the production engine in prodScoring.js so v2 stays in
// lock-step with the canonical verdict logic while evolving the visual design.

import {
  scoreV2,
  estimateFaceHeight,
  pickDominantSwell,
  spotAttenuation,
  windClass,
  angDelta,
  currentVelToMs,
  dayTideCtx,
  mToFt,
  knToKmh,
  degToCompass,
  offsetDate,
  inferSpotProfile,
} from "./prodScoring";
import { getLevel as getV2Level } from "./verdict";

// Default fallback only used if neither the spot has a curated timezone
// NOR Open-Meteo returns one (extremely rare — would mean the API call
// itself failed). The standard path now is `timezone=auto` → API picks
// the IANA tz from lat/lng, we read it back into effectiveSpot.timezone
// so every downstream toLocaleTimeString sees the right zone.
const FALLBACK_TZ = "Australia/Perth";

// Certains téléphones / navigateurs (privacy, VM, certaines configs iOS)
// renvoient "Etc/Unknown" ou une string non résolvable depuis Intl. On
// l'envoyait tel quel à toLocaleDateString → "Invalid time zone specified"
// throw → TOUT le fetch live échouait → fallback sur les données mock.
// C'est pour ça que ces devices ne voyaient jamais les vraies données.
// On valide la tz avant usage ; si invalide on retombe sur UTC pour le
// calcul de date local (l'API garde timezone=auto et géolocalise depuis
// lat/lng, donc l'heure d'affichage reste exacte pour le spot).
function isValidTz(tz) {
  if (!tz || tz === "Etc/Unknown") return false;
  try {
    new Date().toLocaleString("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function detectLocalTz() {
  if (typeof Intl === "undefined") return "UTC";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTz(tz) ? tz : "UTC";
}

function degToCardinal(deg) {
  if (deg == null || isNaN(deg)) return "—";
  return degToCompass(((deg % 360) + 360) % 360);
}

// Wraps the single shared windClass (prodScoring) — the UI string uses
// "cross-shore" where the engine says "cross"; unknown delta (no
// offshoreWindDir on the spot) maps to the explicit neutral "cross-shore".
function classifyWind(windDeg, offshoreWindDir) {
  const wc = offshoreWindDir == null ? null : windClass(angDelta(windDeg, offshoreWindDir));
  return wc === "offshore" ? "offshore" : wc === "onshore" ? "onshore" : "cross-shore";
}

function formatDayLabel(isoDate, todayStr) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dayDate = new Date(Date.UTC(y, mo - 1, d, 12));
  const diffDays = Math.round(
    (dayDate.getTime() - new Date(todayStr + "T12:00:00Z").getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return { label: "Today", isToday: true, isPast: false };
  if (diffDays === 1) return { label: "Tmrw", isToday: false, isPast: false };
  // Past days now show the weekday name (Mon / Tue / …) instead of generic
  // offsets like "-2d" or "-3d" — so the user can actually tell which day
  // it was. The jj/mm dateLabel stays on the tab so the exact date is
  // always visible alongside.
  const dayName = dayDate.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
  return { label: dayName, isToday: false, isPast: diffDays < 0 };
}

// ── Cache stale-while-revalidate du dernier forecast LIVE ──────────────
// À l'ouverture, MainScreen seed avec le dernier payload réel (re-étiqueté
// par date) au lieu du mock : les habitués voient leurs vraies données
// instantanément, le fetch frais les remplace en silence. 24h max — au-delà
// un forecast n'a plus de valeur de seed.
const CACHE_PREFIX = "surf-forecast-cache-";
const CACHE_MAX_AGE_MS = 24 * 3600 * 1000;

export function writeCachedPayload(spotId, payload) {
  try {
    localStorage.setItem(CACHE_PREFIX + spotId, JSON.stringify({ v: 1, cachedAt: Date.now(), payload }));
  } catch {} // quota plein / privé — le cache est un bonus, jamais bloquant
}

export function readCachedPayload(spotId) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + spotId);
    if (!raw) return null;
    const { v, cachedAt, payload } = JSON.parse(raw);
    if (v !== 1 || !payload?.days?.length || !Number.isFinite(cachedAt)) return null;
    if (Date.now() - cachedAt > CACHE_MAX_AGE_MS) return null;
    return rehydrateCachedPayload(payload, cachedAt);
  } catch { return null; }
}

// Re-étiquette les jours d'un payload mis en cache : un cache d'hier a un
// jour marqué isToday qui est en réalité le jour d'avant. Labels/isToday/
// isPast sont recalculés depuis dateStr dans le fuseau du spot ; si le
// cache ne couvre plus aujourd'hui, il est inutilisable (return null).
export function rehydrateCachedPayload(payload, cachedAt) {
  const tz = payload.effectiveSpot?.timezone;
  const todayStr = isValidTz(tz)
    ? new Date().toLocaleDateString("en-CA", { timeZone: tz })
    : new Date().toLocaleDateString("en-CA");
  const days = payload.days
    .filter((d) => typeof d.dateStr === "string")
    .map((d) => {
      const meta = formatDayLabel(d.dateStr, todayStr);
      return { ...d, label: meta.label, isToday: meta.isToday, isPast: meta.isPast };
    });
  if (!days.some((d) => d.isToday)) return null;
  return { payload: { ...payload, days }, cachedAt };
}

// Fetches marine + forecast data for a spot. Returns { days, sunByDay, spot }.
// `spot` on return is enriched with inferred idealSwellDir/offshoreWindDir when
// they weren't curated — so scoring works for any coordinate the user picks.
export async function fetchRealForecast(spot, signal) {
  // Prefer a curated spot.timezone when set (BREAKS could pre-fill it for
  // exact coastal accuracy). Otherwise ask Open-Meteo to auto-detect from
  // lat/lng — `timezone=auto` makes it return the IANA name in the response,
  // which we then reuse for every toLocaleTimeString downstream.
  const requestTz = spot.timezone || "auto";
  // For computing today's date locally we still need a real IANA string.
  // If the spot has no curated tz we use the browser's tz at first — the
  // API response will then refine effectiveSpot.timezone to the actual
  // coastal zone for every later format call.
  const localTz = (spot.timezone && isValidTz(spot.timezone)) ? spot.timezone : detectLocalTz();
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: localTz });
  const pastStart = offsetDate(todayStr, -3);
  const pastEnd = offsetDate(todayStr, -1);
  // wave_height (Hs totale) retirée : transportée dans chaque heure depuis
  // le début, consommée nulle part (audit). `models=best_match` est rendu
  // EXPLICITE pour tracer le choix — TODO reproductibilité : épingler le
  // modèle réel (probablement meteofrance_wave) après avoir vérifié que
  // sea_level_height_msl + courants restent servis pour tous les spots
  // (l'API est inaccessible depuis l'env de session, proxy 403).
  const marineFields =
    "swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction,sea_level_height_msl";
  const marineModels = "best_match";

  const tzParam = encodeURIComponent(requestTz);
  const pastMarineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${marineFields}&models=${marineModels}&start_date=${pastStart}&end_date=${pastEnd}&timezone=${tzParam}`;
  // Past wind from the FORECAST API (not the ERA5 archive). The archive has
  // a ~5-day reanalysis lag, so it returned nulls for yesterday / the day
  // before → the past hours got filtered out (windKn == null) → no past
  // days showed at all. The forecast API keeps recent past days from the
  // same GFS model with no lag and accepts start_date/end_date + timezone=auto.
  const pastWindUrl = `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability&wind_speed_unit=kn&start_date=${pastStart}&end_date=${pastEnd}&timezone=${tzParam}`;
  const futureMarineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${marineFields}&models=${marineModels}&timezone=${tzParam}&forecast_days=5`;
  const futureWindUrl = `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability&daily=sunrise,sunset&timezone=${tzParam}&wind_speed_unit=kn&forecast_days=5`;

  // `signal` (AbortController) lets the caller actually cancel the four
  // requests on timeout / spot change — the previous Promise.race timeout
  // left them running and burning mobile data in the background.
  const [pastMarineRes, pastWindRes, futureMarineRes, futureWindRes] = await Promise.all([
    fetch(pastMarineUrl, { signal }).catch(() => null),
    fetch(pastWindUrl, { signal }).catch(() => null),
    fetch(futureMarineUrl, { signal }),
    fetch(futureWindUrl, { signal }),
  ]);

  if (!futureMarineRes.ok) throw new Error(`Marine API: HTTP ${futureMarineRes.status}`);
  if (!futureWindRes.ok) throw new Error(`Wind API: HTTP ${futureWindRes.status}`);
  const futureMarine = await futureMarineRes.json();
  const futureWind = await futureWindRes.json();
  if (!futureMarine.hourly || !futureWind.hourly) throw new Error("Invalid API response");

  const buildRawHours = (marine, wind, isPast) => {
    // Wind rows are matched to marine rows by TIMESTAMP, not by array
    // index. The two APIs usually return aligned arrays, but if either
    // ever returns fewer hours (partial archive, model gap) an index
    // join silently pairs hour X's swell with hour Y's wind.
    const windIdxByTime = new Map(wind.hourly.time.map((t, i) => [t, i]));
    return marine.hourly.time.map((t, mi) => {
      const wi = windIdxByTime.get(t);
      if (wi == null) return null;
      const swellHeight = marine.hourly.swell_wave_height[mi];
      const swellPeriod = marine.hourly.swell_wave_period[mi];
      const swellDirDeg = marine.hourly.swell_wave_direction[mi];
      const windKn = wind.hourly.wind_speed_10m[wi];
      const windDirDeg = wind.hourly.wind_direction_10m[wi];
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
        windWaveHeight: marine.hourly.wind_wave_height?.[mi] ?? null,
        secSwellH: marine.hourly.secondary_swell_wave_height?.[mi] ?? null,
        secSwellP: marine.hourly.secondary_swell_wave_period?.[mi] ?? null,
        secSwellDir: marine.hourly.secondary_swell_wave_direction?.[mi] ?? null,
        tideM: marine.hourly.sea_level_height_msl?.[mi] ?? null,
        seaTemp: marine.hourly.sea_surface_temperature?.[mi] ?? null,
        airTemp: wind.hourly.temperature_2m?.[wi] ?? null,
        rainProb: wind.hourly.precipitation_probability?.[wi] ?? null,
        windGustKn: wind.hourly.wind_gusts_10m?.[wi] ?? null,
        // Normalisé en m/s d'après l'unité RÉELLE annoncée par la réponse —
        // les seuils hazard (0.28/0.56 m/s) et l'affichage (×3.6) supposent
        // des m/s, or l'API peut servir ce champ en km/h (son défaut doc).
        currentVel: currentVelToMs(
          marine.hourly.ocean_current_velocity?.[mi] ?? null,
          marine.hourly_units?.ocean_current_velocity,
        ),
        currentDir: marine.hourly.ocean_current_direction?.[mi] ?? null,
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
  // Resolve the spot's actual timezone from the API response (returned when
  // we sent `timezone=auto`). Fall back to whatever the spot already had,
  // then to the local browser tz, then to the safety net. After this point
  // every consumer reads effectiveSpot.timezone and gets the correct IANA
  // string for the actual coastal location — no more "Australia/Perth"
  // showing up for Bondi or Pipeline.
  const apiTz = futureMarine.timezone || futureWind.timezone || null;
  const resolvedTz = spot.timezone || apiTz || localTz;
  const effectiveSpot = {
    ...spot,
    ...(inferred || {}),
    timezone: resolvedTz,
  };

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
    // Face height display follows the DOMINANT swell partition (primary
    // or secondary) — same pick as scoreV2/classifyConditions, so the
    // "2–3 ft" the user reads is the wave the score is scoring. The
    // spot's swellAttenuation applies here too (once, inside
    // estimateFaceHeight).
    const domSwell = pickDominantSwell(raw, effectiveSpot);
    const faceM = estimateFaceHeight(domSwell.swellHeight, domSwell.swellPeriod, spotAttenuation(effectiveSpot));
    const faceFt = mToFt(faceM);
    // Score with the prod engine using the raw degrees — BEFORE we overwrite
    // swellDir/windDir below with the cardinal string the v2 components want.
    // scoreV2 niveau "intermediate" comme baseline level-agnostic : c'est
    // le niveau "session moyenne" affiché avant que l'utilisateur pick son
    // niveau, et c'est ce que adaptForecastToLevel surchargera dès que
    // userLevel arrive (toujours non-null via effectiveLevel || "intermediate"
    // dans MainScreen). Pré-FIX 4, ce calcul utilisait scoreSurf additif
    // → bestHour/bestLevel et notifications "best window" lisaient un
    // score qui ne matchait plus le scoring affiché.
    const { score, notes } = scoreV2(raw, effectiveSpot, "intermediate", tideCtx);
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
      // Partition dominante + face exacte, calculées UNE fois ici et lues
      // partout via getDominant()/faceFtOf() — aucun lecteur ne re-dérive
      // depuis la primaire.
      dom: domSwell,
      faceFt,
      faceFtLow: Math.max(0, Math.floor(faceFt - 0.5)),
      faceFtHigh: Math.max(1, Math.ceil(faceFt + 0.5)),
      score,
      notes,
    };
  };

  // "Today" must be the SPOT's current date, not the device's. A user in
  // Paris at 11pm looking at Perth (already tomorrow there) used to see
  // the spot's current day labelled "Tmrw". The device-tz todayStr above
  // is only used to pick the fetch window; labels use the resolved spot tz.
  const spotTodayStr = isValidTz(resolvedTz)
    ? new Date().toLocaleDateString("en-CA", { timeZone: resolvedTz })
    : todayStr;

  const days = [];
  for (let off = -4; off <= 5; off++) {
    const dateStr = offsetDate(spotTodayStr, off);
    const rawHours = byDay[dateStr];
    if (!rawHours || !rawHours.length) continue;
    const rawSurf = rawHours.filter((h) => h.hour >= 4 && h.hour <= 20);
    if (!rawSurf.length) continue;
    const tideCtx = dayTideCtx(rawSurf);
    const shaped = rawSurf.map((r) => shapeHour(r, tideCtx));
    const meta = formatDayLabel(dateStr, spotTodayStr);
    const [y, mo, d] = dateStr.split("-").map(Number);
    const bestHour = shaped.reduce((b, h) => (h.score > (b?.score ?? -1) ? h : b), null) || shaped[0];
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
