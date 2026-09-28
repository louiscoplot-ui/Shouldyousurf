// Test preload: answers Open-Meteo requests with synthetic data so the
// forecast and model stages can run where the real API is unreachable.
// Other requests (AODN S3) go through untouched.
//   node --import ./lib/register-esm.mjs --import ./test/fixtures/fake-open-meteo.mjs scripts/daily-log.mjs ...
const realFetch = globalThis.fetch;

function hoursFor(url) {
  const q = url.searchParams;
  const start = q.get("start_date");
  const end = q.get("end_date");
  const days = [];
  const today = new Date().toISOString().slice(0, 10);
  const add = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  if (start && end) for (let d = start; d <= end; d = add(d, 1)) days.push(d);
  else for (let i = -1; i < +(q.get("forecast_days") || 5); i++) days.push(add(today, i));
  return days.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, "0")}:00`));
}
const fill = (n, f) => Array.from({ length: n }, (_, i) => f(i));

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (!url.hostname.endsWith("open-meteo.com")) return realFetch(input, init);
  if ((url.searchParams.get("latitude") || "").includes(",")) return new Response("", { status: 503 });
  const time = hoursFor(url);
  const n = time.length;
  const tz = url.searchParams.get("timezone") === "UTC" ? "UTC" : "Australia/Perth";
  const base = { latitude: +url.searchParams.get("latitude"), longitude: +url.searchParams.get("longitude"), elevation: 0, timezone: tz };
  let body;
  if (url.pathname.includes("marine")) {
    body = { ...base, hourly_units: { ocean_current_velocity: "m/s" }, hourly: {
      time,
      swell_wave_height: fill(n, () => 1.4), swell_wave_period: fill(n, () => 13), swell_wave_direction: fill(n, () => 245),
      wind_wave_height: fill(n, () => 0.2), wind_wave_period: fill(n, () => 4), wind_wave_direction: fill(n, () => 220),
      secondary_swell_wave_height: fill(n, () => null), secondary_swell_wave_period: fill(n, () => null), secondary_swell_wave_direction: fill(n, () => null),
      sea_level_height_msl: fill(n, (i) => 0.5 + 0.2 * Math.sin(i / 4)), sea_surface_temperature: fill(n, () => 19),
      ocean_current_velocity: fill(n, () => 0.1), ocean_current_direction: fill(n, () => 180),
      wave_height: fill(n, () => 1.6), wave_peak_period: fill(n, () => 13.5), wave_period: fill(n, () => 9), wave_direction: fill(n, () => 240),
    } };
  } else {
    const days = [...new Set(time.map((t) => t.slice(0, 10)))];
    body = { ...base, hourly: {
      time, wind_speed_10m: fill(n, (i) => (i % 24 < 10 ? 4 : 12)), wind_direction_10m: fill(n, (i) => (i % 24 < 10 ? 90 : 220)),
      wind_gusts_10m: fill(n, (i) => (i % 24 < 10 ? 6 : 17)), temperature_2m: fill(n, () => 20), precipitation_probability: fill(n, () => 0),
    }, daily: { time: days, sunrise: days.map((d) => `${d}T05:50`), sunset: days.map((d) => `${d}T18:10`) } };
  }
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
};
