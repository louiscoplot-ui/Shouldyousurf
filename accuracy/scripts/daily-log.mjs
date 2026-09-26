// Daily accuracy log. One run:
//   1. FORECAST  what the app would show for each AU break over the next
//                72 h, computed by the app's own code (realFetch.js +
//                prodScoring.js), frozen now, before the events happen.
//   2. MODEL     Open-Meteo at each offshore reference buoy's position,
//                same 72 h (checks the model where the truth is measured).
//   3. OBS       what the mapped buoys measured over the last 7 days
//                (AODN, hourly). Re-fetched every day because some operators
//                publish late; rows are merged, not duplicated.
//
//   node --import ./lib/register-esm.mjs scripts/daily-log.mjs --out <dir>
//     [--breaks trigg,bondi] [--skip forecast,model,obs]
//
// Exit code 1 when less than 80% of breaks or buoy sites produced data, so
// a half-empty day shows up as a failed run instead of passing silently.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { BREAKS } from "../../app/breaks.js";
import { fetchRealForecast } from "../../app/v2/lib/realFetch.js";
import { scoreForLevel, getPersonalVerdict, USER_LEVELS } from "../../app/v2/lib/prodScoring.js";
import { hourlyObservations } from "../lib/aodn.mjs";
import { localToUtc, hourKey } from "../lib/time.mjs";
import { appendByMonth, mergeByMonth, appendLine } from "../lib/log-store.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const OUT = args.out;
if (!OUT || OUT === true) { console.error("usage: daily-log.mjs --out <dir>"); process.exit(2); }
const skip = new Set(String(args.skip || "").split(",").filter(Boolean));
const only = args.breaks ? new Set(String(args.breaks).split(",")) : null;

const HORIZON_H = 72;
const OBS_DAYS = 7;
const HEALTH_MIN = 0.8;
const here = (p) => new URL(`../${p}`, import.meta.url);

const run = new Date();
const runUtc = run.toISOString().slice(0, 16) + "Z";
const appVersion = {
  sha: process.env.GITHUB_SHA || safe(() => execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()),
  cache_v: +(readFileSync(here("../app/v2/lib/realFetch.js"), "utf8").match(/const CACHE_V = (\d+)/) || [])[1] || null,
};
function safe(fn) { try { return fn(); } catch { return null; } }

const breaks = BREAKS.filter((b) => b.country === "AU" && (!only || only.has(b.id)));
const mapping = JSON.parse(readFileSync(here("data/break-buoys.json"), "utf8"));
const buoys = JSON.parse(readFileSync(here("data/buoys-au.json"), "utf8"));
const buoyBySite = new Map(buoys.map((b) => [b.site, b]));
const mapOf = new Map(mapping.map((m) => [m.id, m]));

const summary = { run_utc: runUtc, app: appVersion, breaks: breaks.length, errors: [] };
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// ── 1. FORECAST: the app's own numbers ─────────────────────────────────
if (!skip.has("forecast")) {
  const rows = [];
  let ok = 0;
  for (const spot of breaks) {
    try {
      const payload = await fetchRealForecast(spot, AbortSignal.timeout(30000));
      const tz = payload.effectiveSpot.timezone;
      let n = 0;
      for (const day of payload.days) {
        for (const h of day.hours) {
          const valid = localToUtc(h.time, tz);
          const lead = (valid - run) / 3600e3;
          if (lead < 0 || lead >= HORIZON_H) continue;
          // Scoring functions take directions in degrees (MainScreen does the same).
          const hDeg = { ...h, swellDir: h.swellDirDeg ?? h.swellDir, windDir: h.windDirDeg ?? h.windDir };
          const score = {}, verdict = {};
          for (const lvl of USER_LEVELS) {
            score[lvl] = scoreForLevel(hDeg, payload.effectiveSpot, lvl, day.tideCtx).score;
            verdict[lvl] = getPersonalVerdict(lvl, hDeg, payload.effectiveSpot);
          }
          rows.push({
            run_utc: runUtc, break_id: spot.id, valid_utc: hourKey(valid), local: h.time, lead_h: +lead.toFixed(1),
            swell_h: r2(h.dom?.swellHeight), swell_p: r2(h.dom?.swellPeriod), swell_dir: r2(h.dom?.swellDir), swell_is_wind: !!h.dom?.isWind,
            primary_h: r2(h.swellHeight ?? null), face_ft: r2(h.faceFt), face_low: h.faceFtLow, face_high: h.faceFtHigh,
            wind_kmh: r2(h.windKmh), wind_dir: h.windDirDeg ?? null, tide_m: r2(h.tideM),
            score, verdict, // app version: see runs.jsonl (same run_utc)
          });
          n++;
        }
      }
      if (n) ok++; else summary.errors.push(`${spot.id}: forecast had no hours in the next ${HORIZON_H} h`);
    } catch (e) {
      summary.errors.push(`${spot.id}: forecast ${e.message}`);
    }
  }
  appendByMonth(OUT, "forecast", rows, "valid_utc");
  summary.forecast = { breaks_ok: ok, rows: rows.length };
  console.log(`forecast: ${ok}/${breaks.length} breaks, ${rows.length} rows`);
}

// ── 2. MODEL at each offshore buoy ─────────────────────────────────────
const offshoreSites = [...new Set(breaks.map((b) => mapOf.get(b.id)?.offshore?.site).filter(Boolean))];
if (!skip.has("model")) {
  const rows = [];
  let ok = 0;
  for (const site of offshoreSites) {
    const b = buoyBySite.get(site);
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${b.lat}&longitude=${b.lng}`
      + `&hourly=wave_height,wave_peak_period,wave_period,wave_direction&models=best_match&timezone=UTC&forecast_days=4`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const H = j.hourly;
      let n = 0;
      H.time.forEach((t, i) => {
        const valid = new Date(`${t}Z`);
        const lead = (valid - run) / 3600e3;
        if (lead < 0 || lead >= HORIZON_H) return;
        rows.push({
          run_utc: runUtc, site, valid_utc: hourKey(valid), lead_h: +lead.toFixed(1),
          // tp (peak period) came back null everywhere on the first real run
          // (26/09, best_match); kept in case the model starts serving it.
          // Compare tm with the buoy's mean period and dir with its mean direction.
          hs: r2(H.wave_height[i]), tp: r2(H.wave_peak_period[i]), tm: r2(H.wave_period[i]), dir: r2(H.wave_direction[i]),
          grid: { lat: j.latitude, lng: j.longitude },
        });
        n++;
      });
      if (n) ok++;
    } catch (e) {
      summary.errors.push(`${site}: model ${e.message}`);
    }
  }
  appendByMonth(OUT, "model", rows, "valid_utc");
  summary.model = { sites_ok: ok, sites: offshoreSites.length, rows: rows.length };
  console.log(`model: ${ok}/${offshoreSites.length} offshore buoys, ${rows.length} rows`);
}

// ── 3. OBS from the buoys ──────────────────────────────────────────────
if (!skip.has("obs")) {
  const sites = [...new Set(breaks.flatMap((b) => [mapOf.get(b.id)?.offshore?.site, mapOf.get(b.id)?.nearshore?.site]).filter(Boolean))];
  const from = new Date(run.getTime() - OBS_DAYS * 864e5);
  const rows = [];
  let ok = 0;
  for (const site of sites) {
    const b = buoyBySite.get(site);
    try {
      const obs = await hourlyObservations(b.folder, from, run);
      for (const o of obs) rows.push({ site, operator: b.operator, wmo: b.wmo, ...o, fetched_utc: runUtc });
      if (obs.length) ok++; else summary.errors.push(`${site}: no observations in the last ${OBS_DAYS} days`);
    } catch (e) {
      summary.errors.push(`${site}: obs ${e.message}`);
    }
  }
  const merged = mergeByMonth(OUT, "obs", rows, "valid_utc", (r) => `${r.site}|${r.valid_utc}`);
  summary.obs = { sites_ok: ok, sites: sites.length, rows: rows.length, ...merged };
  console.log(`obs: ${ok}/${sites.length} buoy sites, ${rows.length} hours (${merged.added} new, ${merged.replaced} refreshed)`);
}

appendLine(join(OUT, "runs.jsonl"), summary);
for (const e of summary.errors) console.warn(`  ! ${e}`);

const ratios = [
  summary.forecast && summary.forecast.breaks_ok / breaks.length,
  summary.model && summary.model.sites_ok / Math.max(1, summary.model.sites),
  summary.obs && summary.obs.sites_ok / Math.max(1, summary.obs.sites),
].filter((v) => v != null);
if (ratios.some((r) => r < HEALTH_MIN)) {
  console.error(`health check failed: a stage produced data for less than ${HEALTH_MIN * 100}% of its targets`);
  process.exit(1);
}
