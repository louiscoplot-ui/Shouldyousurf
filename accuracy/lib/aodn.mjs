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
