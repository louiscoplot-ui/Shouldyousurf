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
  faceMOf,
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

// ── Point d'échantillonnage MARIN ─────────────────────────────────────
// Les modèles de vagues tournent sur une grille de ~1/12° (≈ 9 km). Un spot
// posé sur le trait de côte tombe donc souvent dans une cellule à dominante
// TERRESTRE, dont la sortie est un artefact de bord, pas de la physique.
// Mesuré à Trigg (-31.8826, 115.7519) le 01/08 : l'API snappe sur la cellule
// centrée 115.79167 — soit 3.8 km vers l'INTÉRIEUR, une cellule qui court
// jusqu'à 115.83 en pleine banlieue de Perth. Comparaison à la même heure :
//   115.79167 (cellule de bord, terre) → 1.32 m   ← ce que l'app lisait
//   115.70836 (première cellule 100% eau) → 1.64 m  (+24 %)
//   115.62501 (au large du Five Fathom Bank) → 2.02 m  (+53 %)
// Le modèle avait donc DÉJÀ atténué 2.02 → 1.32 (×0.65) avant qu'on applique
// notre swellAttenuation 0.60 par-dessus : atténuation réelle 0.39, on jetait
// 61 % de la houle. D'où les "vagues bien plus grosses en vrai" du terrain.
//
// On décale le point d'interrogation MARIN vers le large. La direction du
// large est donnée par `idealSwellDir` : la houle vient de la mer, par
// définition. Ça généralise à n'importe quel spot du monde (côte est → décalé
// à l'est, côte ouest → à l'ouest) sans table codée en dur. `marineLat` /
// `marineLng` sur le spot permettent de forcer un point précis si besoin.
// Sans idealSwellDir (spot custom avant inférence) on garde les coordonnées
// du spot : comportement d'avant, jamais pire.
const MARINE_OFFSET_KM = 5;

// Déplace un point de `km` selon un cap (0 = N, 90 = E).
export function offsetPoint(lat, lng, bearingDeg, km) {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (km * Math.cos(rad)) / 110.574;
  const cosLat = Math.max(0.05, Math.cos((lat * Math.PI) / 180));
  const dLng = (km * Math.sin(rad)) / (111.320 * cosLat);
  return { lat: +(lat + dLat).toFixed(4), lng: +(lng + dLng).toFixed(4) };
}

// `bearing` explicite = cap du large. Sinon on prend idealSwellDir (la houle
// vient de la mer). Aucun des deux → coordonnées du spot, comportement d'avant.
export function marineSamplePoint(spot, bearing) {
  if (Number.isFinite(spot?.marineLat) && Number.isFinite(spot?.marineLng)) {
    return { lat: spot.marineLat, lng: spot.marineLng };
  }
  const dir = Number.isFinite(bearing) ? bearing : spot?.idealSwellDir;
  if (!Number.isFinite(dir) || !Number.isFinite(spot?.lat) || !Number.isFinite(spot?.lng)) {
    return { lat: spot.lat, lng: spot.lng };
  }
  return offsetPoint(spot.lat, spot.lng, dir, MARINE_OFFSET_KM);
}

// ── Spots PERSONNALISÉS : trouver où est la mer ───────────────────────
// Les 111 spots du catalogue portent tous `idealSwellDir`, donc le décalage
// vers le large marche pour eux. Un spot choisi par l'utilisateur (recherche
// libre, pin sur la carte, GPS) n'en a pas : `inferSpotProfile` ne tourne
// qu'APRÈS le fetch. Ces spots gardaient donc le bug de la cellule terrestre.
//
// On sonde une couronne de 8 caps à 5 km — l'API accepte plusieurs points en
// UNE requête (latitude=a,b,c). La cellule la plus au large est celle qui
// porte la plus grosse houle moyenne : les points à terre sont masqués,
// nuls ou fortement atténués. Ça donne le cap du large, qu'on réinjecte dans
// exactement la même logique que les spots curés — pas de traitement à part.
//
// Best-effort de bout en bout : une sonde qui échoue, qui est annulée ou qui
// ne conclut pas laisse le comportement d'avant. Le résultat est mis en cache
// par coordonnées (la position de la mer ne bouge pas), donc une seule sonde
// par spot et par appareil.
const PROBE_BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const PROBE_KEY = "surf-marine-bearing-";

export async function probeOffshoreBearing(spot, marineModels, signal) {
  if (!Number.isFinite(spot?.lat) || !Number.isFinite(spot?.lng)) return null;
  const key = `${PROBE_KEY}${spot.lat.toFixed(3)},${spot.lng.toFixed(3)}`;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (Number.isFinite(cached?.bearing)) return cached.bearing;
  } catch {}

  const pts = PROBE_BEARINGS.map((b) => offsetPoint(spot.lat, spot.lng, b, MARINE_OFFSET_KM));
  const url = `https://${OM_MARINE_HOST}/v1/marine?latitude=${pts.map((p) => p.lat).join(",")}`
    + `&longitude=${pts.map((p) => p.lng).join(",")}`
    + `&hourly=swell_wave_height&models=${marineModels}&forecast_days=1${OM_KEY_PARAM}`;

  let json = null;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    json = await res.json();
  } catch { return null; }

  // Multi-points → tableau ; point unique → objet. On normalise.
  const locs = Array.isArray(json) ? json : [json];
  let best = null;
  locs.forEach((loc, i) => {
    const series = loc?.hourly?.swell_wave_height;
    if (!Array.isArray(series)) return;
    const vals = series.filter((v) => Number.isFinite(v));
    if (vals.length < 6) return; // cellule à terre : masquée ou quasi vide
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (!best || mean > best.mean) best = { mean, bearing: PROBE_BEARINGS[i] };
  });
  if (!best) return null;

  try { localStorage.setItem(key, JSON.stringify({ bearing: best.bearing, at: Date.now() })); } catch {}
  return best.bearing;
}

// ── Endpoint Open-Meteo : gratuit (non-commercial) vs commercial ───────
// Le tier gratuit est non-commercial ET rate-limité. Quand il refuse une
// requête (429/403), la réponse d'erreur ne porte PAS les headers CORS →
// le navigateur ne voit jamais le code HTTP, il rejette avec un
// `TypeError: Load failed` générique → notre catch tombe sur le mock après
// timeout. C'est LE symptôme "charge 20s puis données fausses".
//
// Avec un abonnement Open-Meteo, on reçoit une clé et un endpoint dédié
// `customer-*.open-meteo.com` : mêmes params, on ajoute `&apikey=`. Dès que
// NEXT_PUBLIC_OPENMETEO_KEY est posée (Vercel env), on bascule dessus et
// l'accès est restauré — plus de blocage non-commercial, quota dédié.
const OM_KEY =
  (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_OPENMETEO_KEY) || "";
const OM_MARINE_HOST = OM_KEY ? "customer-marine-api.open-meteo.com" : "marine-api.open-meteo.com";
const OM_FORECAST_HOST = OM_KEY ? "customer-api.open-meteo.com" : "api.open-meteo.com";
const OM_KEY_PARAM = OM_KEY ? `&apikey=${encodeURIComponent(OM_KEY)}` : "";

// Un seul retry immédiat sur échec TRANSITOIRE (5xx, 429, ou rejet réseau
// type "Load failed"). Une abort réelle (timeout / changement de spot) n'est
// jamais retentée. Sans ça, un unique hoquet Open-Meteo = mock direct : le
// code n'avait aucune tolérance à la panne passagère.
async function fetchResilient(url, signal, tries = 2) {
  let lastErr = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { signal });
      // 4xx hors 429 = erreur permanente (mauvais param) : inutile de retenter.
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (signal?.aborted) throw e; // vrai timeout / annulation → on sort
      lastErr = e;
    }
  }
  throw lastErr || new Error("fetch failed");
}

// ── Point d'échantillonnage du VENT ───────────────────────────────────
// Même artefact de bord que la houle, mais sur la grille ATMOSPHÉRIQUE.
// L'API forecast snappe sur la cellule la plus proche d'un modèle global
// (0.1° à 0.25° = 11 à 28 km). Un spot posé sur le trait de côte tombe donc
// dans une cellule dont le CENTRE est à l'intérieur des terres — à Trigg,
// exactement la cellule banlieue déjà mesurée pour le marin (3.8 km inland).
//
// Ce n'est pas un détail de quelques pourcents : le vent 10 m est un
// DIAGNOSTIC, extrapolé depuis le vent d'altitude par la loi log avec la
// rugosité de la cellule. Banlieue z0 ≈ 0.3 m contre mer z0 ≈ 0.0002 m :
//   terre : ln(10/0.3)   / ln(60/0.3)    = 0.66
//   mer   : ln(10/2e-4)  / ln(60/2e-4)   = 0.86      → ×1.3 rien que là.
// Et pour un vent OFFSHORE (qui sort de la terre et passe sur l'eau) la
// couche limite interne se reconstruit sur les premiers kilomètres : le
// vent dans la zone de surf est couramment 1.5 à 2× celui lu 4 km à
// l'intérieur. C'est le cas terrain Trigg 14/09 : app 10 km/h SE, réel
// 20+ sur la plage. Le score, le verdict et le tip lisent tous
// `h.windSpeedKn` — une sous-lecture à la source rend TOUTE la chaîne
// optimiste, ce que l'utilisateur vit comme "conditions plus compliquées
// que ce qu'annonce l'app".
//
// On interroge donc le vent sur un point MER, avec exactement la même
// machinerie de cap que marineSamplePoint (idealSwellDir pour les spots
// curés, cap sondé pour les spots personnalisés). Décalage plus grand que
// le marin : il faut sortir de la cellule atmosphérique, pas seulement de
// la cellule de vagues. 12 km couvre une cellule jusqu'à ~0.22° tout en
// restant dans le régime de vent côtier (une brise de mer est à son
// maximum au niveau du trait de côte, pas 50 km au large).
// ⚠️ NON CALIBRÉ contre un anémomètre. La vérité terrain pour Perth ce
// sont les stations BoM Ocean Reef / Swanbourne. Ne pas bouger au doigt
// mouillé — c'est la même règle que swellAttenuation.
// Override possible par spot via `windLat` / `windLng`.
const WIND_OFFSET_KM = 12;

export function windSamplePoint(spot, bearing) {
  if (Number.isFinite(spot?.windLat) && Number.isFinite(spot?.windLng)) {
    return { lat: spot.windLat, lng: spot.windLng };
  }
  const dir = Number.isFinite(bearing) ? bearing : spot?.idealSwellDir;
  if (!Number.isFinite(dir) || !Number.isFinite(spot?.lat) || !Number.isFinite(spot?.lng)) {
    return null; // pas de cap connu → coordonnées du spot, comportement d'avant
  }
  return offsetPoint(spot.lat, spot.lng, dir, WIND_OFFSET_KM);
}

// Le point décalé peut retomber SUR LA TERRE : baie fermée, île en face,
// côte qui se replie. On lirait alors une AUTRE cellule terrestre — aucun
// gain, risque d'être pire. Le DEM Copernicus servi par Open-Meteo rend
// 0 m sur l'eau, donc `elevation` tranche. Absente → on fait confiance à
// la géométrie (idealSwellDir pointe vers la mer par définition).
function seaWindIsUsable(sea, base) {
  if (!sea?.hourly || !base?.hourly) return false;
  const spd = sea.hourly.wind_speed_10m;
  const dir = sea.hourly.wind_direction_10m;
  if (!Array.isArray(spd) || !Array.isArray(dir)) return false;
  // Les deux points partent des mêmes paramètres (même tz, mêmes dates) donc
  // les séries sont alignées par index. Si jamais elles ne le sont pas, on
  // ne tente pas de recoller : on garde la réponse du spot.
  if (spd.length !== base.hourly.wind_speed_10m?.length) return false;
  if (!spd.some((v) => Number.isFinite(v))) return false;
  if (Number.isFinite(sea.elevation) && sea.elevation > 2) return false;
  return true;
}

// Réponse multi-points = TABLEAU [spot, mer]. On prend le VENT sur la
// cellule mer et tout le reste (air, pluie, lever/coucher) sur la cellule
// du spot : c'est la température de la plage que l'utilisateur ressent,
// pas celle du large. Best-effort strict : pas de tableau, série
// inexploitable ou point retombé à terre → réponse du spot intégrale,
// exactement le comportement d'avant.
export function mergeSeaWind(json) {
  if (!Array.isArray(json)) return json;
  const base = json[0] || null;
  if (!base?.hourly) return base;
  const sea = json[1];
  if (!seaWindIsUsable(sea, base)) return base;
  return {
    ...base,
    hourly: {
      ...base.hourly,
      wind_speed_10m: sea.hourly.wind_speed_10m,
      wind_direction_10m: sea.hourly.wind_direction_10m,
      wind_gusts_10m: sea.hourly.wind_gusts_10m ?? base.hourly.wind_gusts_10m,
    },
    windSampledOffshore: true,
  };
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
    "swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height,wind_wave_period,wind_wave_direction,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction,sea_level_height_msl";
  const marineModels = "best_match";

  // Les requêtes MARINES partent du point au large (cf. marineSamplePoint).
  // Le VENT part lui aussi d'un point MER (cf. windSamplePoint) : la cellule
  // atmosphérique du trait de côte est à dominante TERRE et son vent 10 m est
  // diagnostiqué avec une rugosité de banlieue → sous-lecture systématique.
  // Spot personnalisé (pas d'idealSwellDir curé) : on sonde d'abord où est la
  // mer, une seule fois par appareil et par position. Échec → null → on
  // retombe sur les coordonnées du spot, exactement comme avant.
  const probedBearing = Number.isFinite(spot.idealSwellDir)
    ? null
    : await probeOffshoreBearing(spot, marineModels, signal);
  const mp = marineSamplePoint(spot, probedBearing);
  // Deux coordonnées dans la MÊME requête : [0] le spot (air, pluie,
  // lever/coucher), [1] la mer (vent). mergeSeaWind recolle et retombe sur
  // [0] seul si le point mer n'est pas exploitable.
  const wp = windSamplePoint(spot, probedBearing);
  const windLatParam = wp ? `${spot.lat},${wp.lat}` : `${spot.lat}`;
  const windLngParam = wp ? `${spot.lng},${wp.lng}` : `${spot.lng}`;

  const tzParam = encodeURIComponent(requestTz);
  const pastMarineUrl = `https://${OM_MARINE_HOST}/v1/marine?latitude=${mp.lat}&longitude=${mp.lng}&hourly=${marineFields}&models=${marineModels}&start_date=${pastStart}&end_date=${pastEnd}&timezone=${tzParam}${OM_KEY_PARAM}`;
  // Past wind from the FORECAST API (not the ERA5 archive). The archive has
  // a ~5-day reanalysis lag, so it returned nulls for yesterday / the day
  // before → the past hours got filtered out (windKn == null) → no past
  // days showed at all. The forecast API keeps recent past days from the
  // same GFS model with no lag and accepts start_date/end_date + timezone=auto.
  const pastWindUrl = `https://${OM_FORECAST_HOST}/v1/forecast?latitude=${windLatParam}&longitude=${windLngParam}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability&wind_speed_unit=kn&start_date=${pastStart}&end_date=${pastEnd}&timezone=${tzParam}${OM_KEY_PARAM}`;
  const futureMarineUrl = `https://${OM_MARINE_HOST}/v1/marine?latitude=${mp.lat}&longitude=${mp.lng}&hourly=${marineFields}&models=${marineModels}&timezone=${tzParam}&forecast_days=5${OM_KEY_PARAM}`;
  const futureWindUrl = `https://${OM_FORECAST_HOST}/v1/forecast?latitude=${windLatParam}&longitude=${windLngParam}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability&daily=sunrise,sunset&timezone=${tzParam}&wind_speed_unit=kn&forecast_days=5${OM_KEY_PARAM}`;

  // `signal` (AbortController) lets the caller actually cancel the four
  // requests on timeout / spot change — the previous Promise.race timeout
  // left them running and burning mobile data in the background. Les deux
  // requêtes FUTUR (critiques) passent par fetchResilient (1 retry sur panne
  // transitoire) ; le passé reste best-effort (.catch → null).
  const [pastMarineRes, pastWindRes, futureMarineRes, futureWindRes] = await Promise.all([
    fetch(pastMarineUrl, { signal }).catch(() => null),
    fetch(pastWindUrl, { signal }).catch(() => null),
    fetchResilient(futureMarineUrl, signal),
    fetchResilient(futureWindUrl, signal),
  ]);

  if (!futureMarineRes.ok) throw new Error(`Marine API: HTTP ${futureMarineRes.status}`);
  if (!futureWindRes.ok) throw new Error(`Wind API: HTTP ${futureWindRes.status}`);
  const futureMarine = await futureMarineRes.json();
  const futureWind = mergeSeaWind(await futureWindRes.json());
  if (!futureMarine.hourly || !futureWind?.hourly) throw new Error("Invalid API response");

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
        // Période + direction du windsea : sans elles la partition windswell
        // (swellPartitions) ne pourrait ni être pondérée ni convertie en face.
        windWavePeriod: marine.hourly.wind_wave_period?.[mi] ?? null,
        windWaveDir: marine.hourly.wind_wave_direction?.[mi] ?? null,
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
      const pastWind = mergeSeaWind(await pastWindRes.json());
      if (pastMarine.hourly && pastWind?.hourly) {
        pastRaw = buildRawHours(pastMarine, pastWind, true);
      }
    } catch {}
  }

  const allRaw = [...pastRaw, ...futureRaw];
  // Infer spot profile if the curated spot didn't pre-fill idealSwellDir.
  const needsInfer = spot.idealSwellDir == null || spot.offshoreWindDir == null;
  // inferSpotProfile lit la direction RÉELLE de la houle sur la période : plus
  // fin que le cap sondé (résolution 45°), on le garde en premier. Mais il
  // renvoie null quand il n'a pas assez d'heures exploitables — dans ce cas le
  // spot restait sans idealSwellDir DU TOUT (dirMult neutre, vent non
  // classifiable). Le cap du large fait alors un repli honnête.
  const inferred = needsInfer
    ? (inferSpotProfile(allRaw)
       || (Number.isFinite(probedBearing)
           ? { idealSwellDir: probedBearing, offshoreWindDir: (probedBearing + 180) % 360 }
           : null))
    : null;
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
    // `dom` nomme la partition qui porte le plus d'énergie (affichage de la
    // ligne SWELL : hauteur / période / direction). La FACE, elle, passe par
    // faceMOf : elle est FONDUE entre les deux partitions avec le même poids
    // que le blend de scoreV2, donc elle ne saute pas au basculement et
    // raconte toujours la même vague que le score affiché à côté.
    const domSwell = pickDominantSwell(raw, effectiveSpot);
    const faceM = faceMOf(raw, effectiveSpot);
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
  // Échec BRUYANT si l'API a répondu 200 mais qu'aucune heure exploitable
  // n'en sort (champs swell/vent tous null — typique d'un modèle qui ne sert
  // pas la zone, d'un rate-limit qui renvoie un corps vide, ou d'une réponse
  // partielle). Avant, `days` vide remontait en silence : MainScreen voyait
  // `real.days.length === 0`, n'entrait pas dans le `if`, et laissait le mock
  // + la bannière "Loading…" à l'écran POUR TOUJOURS, sans jamais tracker
  // `forecast_fetch_failed`. On était aveugles à cette panne. Maintenant on
  // throw → catch MainScreen → bannière rouge honnête + event tracké.
  if (!days.length) {
    throw new Error("Open-Meteo returned no usable hours (empty/null fields — likely rate-limited or blocked)");
  }
  return { days, sunByDay, effectiveSpot };
}
