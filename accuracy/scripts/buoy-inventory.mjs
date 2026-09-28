// Inventory of every Australian wave buoy in the AODN near-real-time
// dataset: position, operator, last report, which parameters it sends.
//
//   npm run buoys        -> data/buoys-au.json
//
// Reads only the newest monthly file of each site (a few KB each).
import { writeFileSync } from "node:fs";
import { listSites, siteFiles, readParquet } from "../lib/aodn.mjs";

const ACTIVE_DAYS = 7;
const now = Date.now();
const sites = await listSites();
console.log(`${sites.length} site folders`);

async function inspect(site) {
  const files = await siteFiles(site);
  if (!files.length) return null;
  const rows = await readParquet(files.at(-1));
  if (!rows.length) return null;
  const last = rows.reduce((a, r) => (r.TIME > a.TIME ? r : a), rows[0]);
  const has = (k) => rows.some((r) => r[k] != null);
  const file = String(last.filename || files.at(-1).split("/").pop());
  return {
    site: decodeURIComponent(site),
    folder: site,
    operator: file.split("_")[0],
    wmo: last.wmo_id || null,
    lat: +(+last.LATITUDE).toFixed(4),
    lng: +(+last.LONGITUDE).toFixed(4),
    depthM: last.water_depth != null ? Number(last.water_depth) : null,
    lastObs: new Date(last.TIME).toISOString(),
    active: now - new Date(last.TIME).getTime() < ACTIVE_DAYS * 864e5,
    months: files.length,
    // Significant height (WSSH spectral / WHTH zero-crossing), peak period,
    // peak direction: the three values the daily log compares.
    height: has("WSSH") ? "WSSH" : has("WHTH") ? "WHTH" : null,
    period: has("WPPE") ? "WPPE" : null,
    direction: has("WPDI") ? "WPDI" : null,
  };
}

const out = [];
const queue = [...sites];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const s = queue.shift();
    try { const r = await inspect(s); if (r) out.push(r); }
    catch (e) { console.warn(`${s}: ${e.message}`); }
  }
}));
out.sort((a, b) => a.site.localeCompare(b.site));
writeFileSync(new URL("../data/buoys-au.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`${out.length} sites read · ${out.filter((b) => b.active).length} active in the last ${ACTIVE_DAYS} days -> data/buoys-au.json`);
