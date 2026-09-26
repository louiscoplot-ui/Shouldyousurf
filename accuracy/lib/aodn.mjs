// Read-only client for the AODN "Wave buoys Observations - Australia -
// near real-time" dataset on AWS Open Data (public S3, no key, CC BY 4.0).
//   Registry: https://registry.opendata.aws/aodn_wave_buoy_realtime_nonqc/
//   Layout:   wave_buoy_realtime_nonqc.parquet/site_name=<site>/timestamp=<month>/polygon=<wkb>/<file>.parquet
// It gathers WA DoT, MHL NSW, QLD DES, BoM, IMOS, Gippsland Ports, UWA,
// Deakin, Flinders/SARDI and Pilbara Ports buoys in one place.
import { parquetReadObjects } from "hyparquet";

export const BUCKET = "https://aodn-cloud-optimised.s3.ap-southeast-2.amazonaws.com";
export const DATASET = "wave_buoy_realtime_nonqc.parquet";

async function list(prefix, { delimiter } = {}) {
  const out = { keys: [], prefixes: [] };
  let token = null;
  do {
    const q = new URLSearchParams({ "list-type": "2", prefix });
    if (delimiter) q.set("delimiter", delimiter);
    if (token) q.set("continuation-token", token);
    const res = await fetch(`${BUCKET}/?${q}`);
    if (!res.ok) throw new Error(`S3 list ${prefix}: HTTP ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) out.keys.push(m[1]);
    for (const m of xml.matchAll(/<CommonPrefixes><Prefix>([^<]+)<\/Prefix>/g)) out.prefixes.push(m[1]);
    token = /<IsTruncated>true/.test(xml) ? (xml.match(/<NextContinuationToken>([^<]+)</) || [])[1] : null;
  } while (token);
  return out;
}

// Site folder names as stored (they contain a literal "%20" for spaces).
export async function listSites() {
  const { prefixes } = await list(`${DATASET}/`, { delimiter: "/" });
  return prefixes.map((p) => p.slice(`${DATASET}/site_name=`.length, -1));
}

// Parquet files of one site, newest month last.
export async function siteFiles(site) {
  const { keys } = await list(`${DATASET}/site_name=${site}/`);
  return keys.filter((k) => k.endsWith(".parquet")).sort((a, b) => monthOf(a) - monthOf(b));
}
const monthOf = (key) => +(key.match(/timestamp=(\d+)/) || [0, 0])[1];

// Keys contain "%20": encode "%" so S3 gets the literal key.
const keyUrl = (key) => `${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;

export async function readParquet(key) {
  const res = await fetch(keyUrl(key));
  if (!res.ok) throw new Error(`S3 get ${key}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return parquetReadObjects({ file: buf });
}

// Observations of one site between two instants, averaged to the hour.
// Keeps QC flags 1 (good) and 2 (not evaluated); drops 3 questionable,
// 4 bad, 9 missing (flag meanings from the dataset's own metadata).
const QC_KEEP = new Set([1, 2]);

export async function hourlyObservations(folder, from, to) {
  const files = await siteFiles(folder);
  const fromMonth = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1) / 1000;
  const wanted = files.filter((k) => monthOf(k) >= fromMonth);
  const rows = [];
  for (const key of wanted) rows.push(...(await readParquet(key)));
  const buckets = new Map();
  for (const r of rows) {
    const t = new Date(r.TIME);
    if (!(t >= from && t < to)) continue;
    const qc = r.WAVE_quality_control == null ? null : Number(r.WAVE_quality_control);
    if (qc != null && !QC_KEEP.has(qc)) continue;
    const hs = r.WSSH ?? r.WHTH;
    if (hs == null) continue;
    const hour = new Date(Math.floor(t.getTime() / 3600e3) * 3600e3).toISOString();
    if (!buckets.has(hour)) buckets.set(hour, []);
    buckets.get(hour).push({ ...r, hs, qc });
  }
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const circ = (a) => {
    if (!a.length) return null;
    const x = a.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
    const y = a.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };
  const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
  return [...buckets.entries()].map(([hour, list]) => ({
    valid_utc: hour.slice(0, 13) + ":00Z",
    hs: r2(mean(list.map((r) => r.hs))),
    hs_field: list.some((r) => r.WSSH != null) ? "WSSH" : "WHTH",
    // Peak period / peak direction (WPPE, WPDI) and mean period / mean
    // direction (WPFM spectral or WPMH time-domain, SSWMD). Open-Meteo only
    // serves mean period and mean direction reliably, so both are kept.
    tp: r2(mean(list.map((r) => r.WPPE).filter((v) => v != null))),
    tm: r2(mean(list.map((r) => r.WPFM ?? r.WPMH).filter((v) => v != null))),
    tm_field: list.some((r) => r.WPFM != null) ? "WPFM" : list.some((r) => r.WPMH != null) ? "WPMH" : null,
    dir: r2(circ(list.map((r) => r.WPDI).filter((v) => v != null))),
    dir_mean: r2(circ(list.map((r) => r.SSWMD).filter((v) => v != null))),
    n: list.length,
    qc: Math.max(...list.map((r) => r.qc ?? 0)) || null,
  }));
}
