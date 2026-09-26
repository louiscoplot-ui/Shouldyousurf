// Coastline geometry from OpenStreetMap land polygons at 10 m absolute error
// (@geo-maps/earth-lands-10m, data (c) OpenStreetMap contributors, ODbL).
// No network, no API: everything is derived from a break's coordinates, so
// the same code works for any beach in the world.
//
// Method: from the break, cast one ray every STEP degrees and intersect it
// with the land polygon edges. Along each ray we get where the water starts
// and how far it runs before the next land. That gives:
//   - facing: circular mean of the directions where open water starts
//     right at the beach (the seaward side),
//   - fetch per bearing: how much open water lies in that direction,
//   - swell window: bearings with fetch >= WINDOW_FETCH_KM.
//
// The coastline is precise (10 m), but it's the OSM mean-high-water line:
// sandbars, reefs and bathymetry are not in it. Geometry says where swell
// CAN come from, not how much of it survives the continental shelf.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// 135 MB of GeoJSON: loaded once, takes a few seconds.
const land = JSON.parse(readFileSync(require.resolve("@geo-maps/earth-lands-10m/map.geo.json"), "utf8"));

// Every land ring as [lon, lat] arrays, with a bbox for fast pre-filtering.
const RINGS = [];
for (const geom of land.geometries) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) for (const ring of poly) {
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    RINGS.push({ ring, minX, maxX, minY, maxY });
  }
}

export const STEP = 5;              // degrees between rays
export const MAX_KM = 400;          // how far each ray looks
export const NEAR_KM = 3;           // "water starts at the beach" tolerance
export const WINDOW_FETCH_KM = 100; // open water needed to count as swell window

export const norm = (d) => ((d % 360) + 360) % 360;
export const angDelta = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

export function circularMean(degs) {
  if (!degs.length) return null;
  let x = 0, y = 0;
  for (const d of degs) { x += Math.cos((d * Math.PI) / 180); y += Math.sin((d * Math.PI) / 180); }
  if (Math.hypot(x, y) < 1e-9) return null;
  return norm((Math.atan2(y, x) * 180) / Math.PI);
}

// Local flat projection in km around the break. Fine within a few hundred km
// for an audit (distortion well under the dataset's own error).
function projector(lat0, lon0) {
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110.57;
  return ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky];
}

// Distance along the ray (bearing, clockwise from north) to the segment, or null.
function raySegment(bx, by, ax, ay, cx, cy) {
  const ex = cx - ax, ey = cy - ay;
  const den = bx * ey - by * ex;
  if (Math.abs(den) < 1e-12) return null;
  const t = (ax * ey - ay * ex) / den;   // distance along ray
  const u = (ax * by - ay * bx) / den;   // position along segment
  return t > 0 && u >= 0 && u <= 1 ? t : null;
}

export function analyseCoast(lat, lng) {
  const P = projector(lat, lng);
  const dLat = MAX_KM / 110.57, dLon = MAX_KM / (111.32 * Math.cos((lat * Math.PI) / 180));
  const segs = [];
  for (const r of RINGS) {
    if (r.maxX < lng - dLon || r.minX > lng + dLon || r.maxY < lat - dLat || r.minY > lat + dLat) continue;
    for (let i = 1; i < r.ring.length; i++) {
      const [ax, ay] = P(r.ring[i - 1]);
      const [cx, cy] = P(r.ring[i]);
      segs.push([ax, ay, cx, cy]);
    }
  }

  const rays = [];
  for (let b = 0; b < 360; b += STEP) {
    const rad = (b * Math.PI) / 180;
    const bx = Math.sin(rad), by = Math.cos(rad); // x = east, y = north
    const hits = [];
    for (const [ax, ay, cx, cy] of segs) {
      const t = raySegment(bx, by, ax, ay, cx, cy);
      if (t != null) hits.push(t);
    }
    hits.sort((a, c) => a - c);
    rays.push({ bearing: b, hits });
  }

  // Is the break point itself inside a land polygon? (odd number of
  // crossings on any ray.) Natural Earth often puts the beach just inland.
  const inside = rays[0].hits.length % 2 === 1;
  const coastKm = Math.min(...rays.map((r) => (r.hits.length ? r.hits[0] : Infinity)));
  // A break that sits inland in the dataset (coarse coastline, or wrong
  // coordinates) still gets analysed from the nearest shore.
  const near = inside ? Math.max(NEAR_KM, coastKm + 1) : NEAR_KM;

  for (const r of rays) {
    // Water intervals along the ray: [start, end). Parity flips at each hit.
    let onLand = inside, pos = 0;
    const water = [];
    for (const h of r.hits) {
      if (!onLand) water.push([pos, h]);
      onLand = !onLand; pos = h;
    }
    if (!onLand) water.push([pos, Infinity]);
    r.waterStart = water.length ? water[0][0] : Infinity;
    // Fetch = first stretch of water that starts near the beach.
    const first = water.find((w) => w[0] <= near);
    r.fetchKm = first ? Math.min(first[1], MAX_KM) - first[0] : 0;
    r.blockedAtKm = first && Number.isFinite(first[1]) && first[1] < MAX_KM ? first[1] : null;
  }

  // Seaward = directions with at least 5 km of water starting at the beach
  // (works whether the point sits just inland or just offshore).
  const seaward = rays.filter((r) => r.fetchKm >= 5).map((r) => r.bearing);
  const open = rays.filter((r) => r.fetchKm >= WINDOW_FETCH_KM).map((r) => r.bearing);
  // "Facing" = centre of the open-ocean window. The local coast normal
  // (seaward mean within NEAR_KM) is also returned, but at this dataset's
  // resolution it's noisy next to headlands and bays.
  const facing = circularMean(open) ?? circularMean(seaward);
  const coastNormal = circularMean(seaward);
  const longest = rays.reduce((a, r) => (r.fetchKm > a.fetchKm ? r : a), rays[0]);
  return { inside, facing, coastNormal, coastKm, open, rays, longestFetch: { bearing: longest.bearing, km: Math.round(longest.fetchKm) } };
}

// Point-in-land test (even-odd rule on lon/lat), for the API sample points.
export function isLand(lat, lng) {
  let inside = false;
  for (const r of RINGS) {
    if (lng < r.minX || lng > r.maxX || lat < r.minY || lat > r.maxY) continue;
    const g = r.ring;
    for (let i = 0, j = g.length - 1; i < g.length; j = i++) {
      const [xi, yi] = g[i], [xj, yj] = g[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Group bearings into contiguous arcs, e.g. [[200, 320]] (inclusive, wraps).
export function arcs(bearings) {
  if (!bearings.length) return [];
  if (bearings.length === 360 / STEP) return [[0, 360 - STEP]];
  const set = new Set(bearings);
  const out = [];
  for (const b of bearings) {
    if (set.has(norm(b - STEP))) continue; // not the start of an arc
    let e = b;
    while (set.has(norm(e + STEP))) e = norm(e + STEP);
    out.push([b, e]);
  }
  return out;
}

export const inArcs = (deg, list) =>
  list.some(([s, e]) => (s <= e ? deg >= s && deg <= e : deg >= s || deg <= e));

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (d) => (d == null ? "—" : COMPASS[Math.round(norm(d) / 22.5) % 16]);
