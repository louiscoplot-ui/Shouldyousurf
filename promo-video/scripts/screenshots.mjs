// Reference screenshots of the REAL app, local only (nothing is deployed).
//
// 1. In the repo root:  npm ci && npx next dev -p 3100
// 2. In promo-video/:   npm run screenshots   (APP_URL overrides the URL)
//
// Open-Meteo is intercepted and answered with src/scenario.js, and the clock
// is frozen at 6:00am Perth, so the app shows exactly the Trigg morning the
// video animates. Output: reference/*.png (iPhone 14 size, 390x844 @3x).
import { chromium } from "playwright";
import { mkdirSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { SPOT, TIMEZONE, rawHour, SUNRISE, SUNSET } from "../src/scenario.js";

const APP_URL = process.env.APP_URL || "http://localhost:3100/";
const TODAY = process.env.PROMO_DATE || "2026-09-26";
const OUT = new URL("../reference/", import.meta.url).pathname;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
mkdirSync(OUT, { recursive: true });

const addDays = (d, n) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
function datesFor(url) {
  const s = url.searchParams.get("start_date");
  const e = url.searchParams.get("end_date");
  const out = [];
  if (s && e) { for (let d = s; d <= e; d = addDays(d, 1)) out.push(d); return out; }
  const n = +(url.searchParams.get("forecast_days") || 5);
  for (let i = 0; i < n; i++) out.push(addDays(TODAY, i));
  return out;
}
const hoursFor = (url) => datesFor(url).flatMap((d) => Array.from({ length: 24 }, (_, h) => rawHour(d, h)));

function marineJson(url) {
  const H = hoursFor(url);
  const col = (k) => H.map((h) => h[k]);
  return {
    latitude: SPOT.lat, longitude: SPOT.lng, elevation: 0, timezone: TIMEZONE,
    hourly_units: { ocean_current_velocity: "m/s" },
    hourly: {
      time: col("time"),
      swell_wave_height: col("swellHeight"), swell_wave_period: col("swellPeriod"), swell_wave_direction: col("swellDir"),
      wind_wave_height: col("windWaveHeight"), wind_wave_period: col("windWavePeriod"), wind_wave_direction: col("windWaveDir"),
      secondary_swell_wave_height: col("secSwellH"), secondary_swell_wave_period: col("secSwellP"), secondary_swell_wave_direction: col("secSwellDir"),
      sea_level_height_msl: col("tideM"), sea_surface_temperature: col("seaTemp"),
      ocean_current_velocity: col("currentVel"), ocean_current_direction: col("currentDir"),
    },
  };
}
function windJson(url) {
  const H = hoursFor(url);
  const col = (k) => H.map((h) => h[k]);
  const days = datesFor(url);
  return {
    latitude: SPOT.lat, longitude: SPOT.lng, elevation: 3, timezone: TIMEZONE,
    hourly: {
      time: col("time"), wind_speed_10m: col("windSpeedKn"), wind_direction_10m: col("windDir"),
      wind_gusts_10m: col("windGustKn"), temperature_2m: col("airTemp"), precipitation_probability: col("rainProb"),
    },
    daily: { time: days, sunrise: days.map((d) => `${d}T${SUNRISE}`), sunset: days.map((d) => `${d}T${SUNSET}`) },
  };
}

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  timezoneId: TIMEZONE, locale: "en-AU",
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("ss-no-analytics", "1");
    localStorage.setItem("surf-onboarded-v2", "1");
    localStorage.setItem("surf-user-level", "intermediate");
    localStorage.setItem("surf-last-break", "trigg");
    localStorage.setItem("surf-lang", "en");
    localStorage.setItem("surf-pwa-dismissed-at", String(Date.now()));
  } catch {}
});
await ctx.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.hostname.endsWith("open-meteo.com")) {
    // The multi-coordinate offshore-bearing probe is best-effort in the app:
    // failing it keeps the curated behaviour, which is what we want.
    if ((url.searchParams.get("latitude") || "").includes(",")) return route.fulfill({ status: 503, body: "" });
    const body = url.pathname.includes("marine") ? marineJson(url) : windJson(url);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  }
  // Google Fonts go through curl: headless Chromium doesn't pick up an HTTPS
  // proxy from the environment, and without the real fonts the layout
  // reflows (fallback glyphs are wider) and no longer matches the app.
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    try {
      const body = execFileSync("curl", ["-sSf", "-A", UA, url.href], { maxBuffer: 1 << 24 });
      const contentType = url.hostname.endsWith("gstatic.com") ? "font/woff2" : "text/css";
      return route.fulfill({ status: 200, contentType, body, headers: { "access-control-allow-origin": "*" } });
    } catch { return route.abort(); }
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return local ? route.continue() : route.abort(); // analytics etc.
});

const page = await ctx.newPage();
await page.clock.install({ time: new Date(`${TODAY}T06:05:00+08:00`) });
await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__appReady === true, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2500);

await page.screenshot({ path: `${OUT}01-score.png` });
const shoot = async (selector, name) => {
  const el = page.locator(selector).first();
  if (!(await el.count())) { console.warn(`missing ${selector}`); return; }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}${name}.png` });
};
await shoot(".best", "02-best-window");
await shoot(".hly", "03-hourly");
await shoot(".lvl-block", "04-verdicts");
await page.screenshot({ path: `${OUT}05-full.png`, fullPage: true });
await browser.close();
// The hero screenshot doubles as the phone mockup shown in the video.
copyFileSync(`${OUT}01-score.png`, new URL("../public/app-screenshot.png", import.meta.url).pathname);
console.log("screenshots ->", OUT);
