// Map each break to its most relevant active buoy.
//
//   npm run map          (needs data/buoys-au.json from `npm run buoys`)
//   -> data/break-buoys.json + data/break-buoys.md (table)
//
// Two buoys per break, because they answer two different questions:
//   offshore (depth >= 40 m): is the MODEL right? Compare Open-Meteo at the
//                             buoy's own position with what the buoy measured.
//   nearshore (depth < 40 m): what actually reaches the coast? Compare the
//                             app's prediction for the break with it.
// Within each group, "relevant" beats "nearest": the buoy must see the same
// swells (open-ocean window overlap >= 50%), then shortest distance, with a
// 30% distance penalty when the straight line crosses land (a headland or
// island in between usually means a different sea state).
import { readFileSync, writeFileSync } from "node:fs";
import { BREAKS } from "../../app/breaks.js";
import { analyseCoast, arcs, angDelta, STEP } from "../lib/geo.mjs";

const COUNTRY = process.env.COUNTRY || "AU";
const MAX_KM = 150; // further than this, a buoy says little about a break
const DEEP_M = 40;
const buoys = JSON.parse(readFileSync(new URL("../data/buoys-au.json", import.meta.url))).filter((b) => b.active);

function distKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return ((Math.atan2(y, x) / rad) + 360) % 360;
}
const overlap = (a, b) => (a.length ? a.filter((d) => b.includes(d)).length / a.length : 0);

const buoyGeo = new Map();
const geoOf = (b) => buoyGeo.get(b.site) ?? buoyGeo.set(b.site, analyseCoast(b.lat, b.lng)).get(b.site);

const out = [];
for (const brk of BREAKS.filter((x) => x.country === COUNTRY)) {
  const g = analyseCoast(brk.lat, brk.lng);
  const cands = buoys
    .map((b) => ({ b, km: distKm(brk, b) }))
    .filter((c) => c.km <= MAX_KM)
    .map((c) => {
      const brg = bearing(brk, c.b);
      // Ray from the break toward the buoy: water must start at the beach and
      // run at least as far as the buoy.
      const ray = g.rays.reduce((best, r) => (angDelta(r.bearing, brg) < angDelta(best.bearing, brg) ? r : best));
      const overWater = ray.waterStart <= 3 && ray.waterStart + ray.fetchKm >= c.km - 1;
      const windowOverlap = overlap(g.open, geoOf(c.b).open);
      return { ...c, bearing: Math.round(brg), overWater, windowOverlap: +windowOverlap.toFixed(2) };
    })
    .map((c) => ({ ...c, cost: c.km * (c.overWater ? 1 : 1.3) }))
    .sort((x, y) => (y.windowOverlap >= 0.5) - (x.windowOverlap >= 0.5) || x.cost - y.cost);
  const deep = cands.find((c) => c.b.depthM >= DEEP_M) || null;
  const shallow = cands.find((c) => c.b.depthM < DEEP_M) || null;
  // Match quality, so nobody over-reads a far or differently exposed buoy.
  const grade = (c) => (c.windowOverlap < 0.5 ? "weak" : c.km <= 30 && c.overWater ? "good" : c.km <= 80 ? "fair" : "weak");
  const fmt = (c) => c && { grade: grade(c), site: c.b.site, operator: c.b.operator, wmo: c.b.wmo, km: +c.km.toFixed(1), bearing: c.bearing, depthM: c.b.depthM, overWater: c.overWater, windowOverlap: c.windowOverlap, lastObs: c.b.lastObs };
  out.push({ id: brk.id, name: brk.name, region: brk.region, window: arcs(g.open), offshore: fmt(deep), nearshore: fmt(shallow) });
}
writeFileSync(new URL("../data/break-buoys.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
const line = (b) => (b ? `[${b.grade}] ${b.site} (${b.operator}${b.wmo ? " " + b.wmo : ""}) ${b.km} km, ${b.depthM} m${b.overWater ? "" : ", line crosses land"}${b.windowOverlap < 0.5 ? `, low overlap ${b.windowOverlap}` : ""}` : "none within " + MAX_KM + " km");
for (const r of out) console.log(`${r.name.padEnd(24)} OFF ${line(r.offshore).padEnd(62)} NEAR ${line(r.nearshore)}`);

// Markdown table (pasted into BUOY-PLAN.md as a snapshot).
const cell = (b) => (b ? `${b.site} · ${b.operator}${b.wmo ? " " + b.wmo : ""} · **${b.km} km** · ${b.depthM} m${b.overWater ? "" : " · crosses land"} · *${b.grade}*` : "—");
const md = [
  "| Break | Offshore reference (≥ 40 m) | Nearshore (< 40 m) |",
  "|---|---|---|",
  ...out.map((r) => `| ${r.name} | ${cell(r.offshore)} | ${cell(r.nearshore)} |`),
].join("\n");
writeFileSync(new URL("../data/break-buoys.md", import.meta.url), md + "\n");
