// Backup wind source: MET Norway Locationforecast 2.0 (api.met.no).
//
// Why: Open-Meteo's free forecast API applies a DAILY quota per website
// (it counts requests by Origin/Referer). Measured 17/11: the same request
// answered 200 without an Origin and 429 "Daily API request limit exceeded"
// with Origin shouldyousurf.com. Once the quota is spent, every user
// everywhere lost the wind, so no score, so sample data. The marine API
// kept answering. MET Norway is free (CC BY 4.0, credit in the footer),
// global, sends CORS headers, and is used ONLY when Open-Meteo's wind
// request fails.
//
// Output: an object shaped like Open-Meteo's /v1/forecast response
// (hourly.time in the spot's local time, wind in knots, daily sunrise /
// sunset), so the rest of realFetch does not know which source answered.
// Locationforecast is hourly for ~2.5 days, then 6-hourly: hours in between
// are interpolated (speed linearly, direction as a vector). No past hours:
// the dimmed "yesterday" days simply do not show while on backup.

import { sharedFetch } from "./sharedFetch";

export const METNO_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete";
const MS_TO_KN = 1.943844;

const pad = (n) => String(n).padStart(2, "0");
// "YYYY-MM-DDTHH:MM" in a fixed UTC offset
function localStamp(ms, offsetSec) {
  const d = new Date(ms + offsetSec * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// NOAA sunrise equation (accuracy ~1-2 min, plenty for a daylight filter).
export function sunTimesUtc(dateStr, lat, lng) {
  const rad = Math.PI / 180;
  const [y, m, d] = dateStr.split("-").map(Number);
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const n = jd - 2451545.0 + 0.0008;
  const jStar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDec = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDec) / (Math.cos(lat * rad) * cosDec);
  if (cosH < -1 || cosH > 1) return null; // polar day / night
  const H = Math.acos(cosH) / rad;
  const toMs = (j) => (j - 2440587.5) * 86400000;
  return { rise: toMs(jTransit - H / 360), set: toMs(jTransit + H / 360) };
}

function interpolate(series, ms) {
  // series: sorted [{ t, speed, dir, gust, temp, rain }]
  if (!series.length || ms < series[0].t || ms > series[series.length - 1].t) return null;
  let i = 0;
  while (i < series.length - 1 && series[i + 1].t < ms) i++;
  const a = series[i], b = series[Math.min(i + 1, series.length - 1)];
  if (b.t === a.t || ms === a.t) return a;
  if (b.t - a.t > 6 * 3600000) return null;
  const f = (ms - a.t) / (b.t - a.t);
  const lerp = (x, y) => (x == null || y == null ? (f < 0.5 ? x : y) : x + (y - x) * f);
  const r = Math.PI / 180;
  const u = (1 - f) * a.speed * Math.sin(a.dir * r) + f * b.speed * Math.sin(b.dir * r);
  const v = (1 - f) * a.speed * Math.cos(a.dir * r) + f * b.speed * Math.cos(b.dir * r);
  return {
    speed: lerp(a.speed, b.speed),
    dir: ((Math.atan2(u, v) / r) + 360) % 360,
    gust: lerp(a.gust, b.gust),
    temp: lerp(a.temp, b.temp),
    rain: lerp(a.rain, b.rain),
  };
}

// json: Locationforecast response. localTimes: the marine API's hourly
// local times ("YYYY-MM-DDTHH:00"), offsetSec: its utc_offset_seconds.
export function metnoToOpenMeteo(json, localTimes, offsetSec, lat, lng, timezone) {
  const ts = json?.properties?.timeseries;
  if (!Array.isArray(ts) || !ts.length) return null;
  const series = ts.map((e) => {
    const det = e.data?.instant?.details || {};
    const next = e.data?.next_1_hours?.details || e.data?.next_6_hours?.details || {};
    return {
      t: Date.parse(e.time),
      speed: Number.isFinite(det.wind_speed) ? det.wind_speed : null,
      dir: Number.isFinite(det.wind_from_direction) ? det.wind_from_direction : null,
      gust: Number.isFinite(det.wind_speed_of_gust) ? det.wind_speed_of_gust : null,
      temp: Number.isFinite(det.air_temperature) ? det.air_temperature : null,
      rain: Number.isFinite(next.probability_of_precipitation) ? next.probability_of_precipitation : null,
    };
  }).filter((s) => Number.isFinite(s.t) && s.speed != null && s.dir != null).sort((a, b) => a.t - b.t);
  if (!series.length) return null;

  const time = [], speed = [], dir = [], gust = [], temp = [], rain = [];
  for (const t of localTimes) {
    const ms = Date.parse(`${t}:00Z`) - offsetSec * 1000;
    const p = interpolate(series, ms);
    if (!p) continue;
    time.push(t);
    speed.push(+(p.speed * MS_TO_KN).toFixed(2));
    dir.push(Math.round(p.dir));
    gust.push(p.gust == null ? null : +(p.gust * MS_TO_KN).toFixed(2));
    temp.push(p.temp == null ? null : +p.temp.toFixed(1));
    rain.push(p.rain == null ? null : Math.round(p.rain));
  }
  if (!time.length) return null;

  const days = [...new Set(time.map((t) => t.slice(0, 10)))];
  const daily = { time: [], sunrise: [], sunset: [] };
  for (const day of days) {
    const s = sunTimesUtc(day, lat, lng);
    daily.time.push(day);
    daily.sunrise.push(s ? localStamp(s.rise, offsetSec) : null);
    daily.sunset.push(s ? localStamp(s.set, offsetSec) : null);
  }
  return {
    latitude: lat, longitude: lng, timezone, utc_offset_seconds: offsetSec, source: "metno",
    hourly: { time, wind_speed_10m: speed, wind_direction_10m: dir, wind_gusts_10m: gust, temperature_2m: temp, precipitation_probability: rain },
    daily,
  };
}

export async function fetchMetnoWind(spot, marine, signal) {
  const lat = Number(spot.lat).toFixed(4), lng = Number(spot.lng).toFixed(4);
  const res = await sharedFetch(`${METNO_URL}?lat=${lat}&lon=${lng}`, { signal });
  if (!res.ok) throw new Error(`MET Norway: HTTP ${res.status}`);
  const json = await res.json();
  return metnoToOpenMeteo(json, marine?.hourly?.time || [], marine?.utc_offset_seconds || 0, spot.lat, spot.lng, marine?.timezone || null);
}
