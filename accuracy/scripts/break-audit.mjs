// Part 1 — break config audit (report only, edits nothing in the app).
//
//   cd accuracy && npm install && npm run audit
//
// Reads app/breaks.js, checks every Australian break against the coastline
// (lib/geo.mjs) and against the scoring engine's own rules, then writes:
//   data/break-audit.json  machine-readable results (reused by later steps)
//   break-audit.md         the human report
import { writeFileSync } from "node:fs";
import { BREAKS } from "../../app/breaks.js";
import { analyseCoast, arcs, inArcs, angDelta, compass, norm, isLand, STEP, WINDOW_FETCH_KM } from "../lib/geo.mjs";

// Mirror of realFetch.offsetPoint / marineSamplePoint (app/v2/lib/realFetch.js):
// the marine forecast is read 5 km from the break toward idealSwellDir,
// unless the break sets marineLat/marineLng. (On a device that has run the
// offshore-bearing probe, the app may use a probed bearing instead.)
const MARINE_OFFSET_KM = 5;
function marineSamplePoint(b) {
  if (Number.isFinite(b.marineLat) && Number.isFinite(b.marineLng)) return { lat: b.marineLat, lng: b.marineLng };
  const rad = (b.idealSwellDir * Math.PI) / 180;
  const dLat = (MARINE_OFFSET_KM * Math.cos(rad)) / 110.574;
  const dLng = (MARINE_OFFSET_KM * Math.sin(rad)) / (111.32 * Math.max(0.05, Math.cos((b.lat * Math.PI) / 180)));
  return { lat: +(b.lat + dLat).toFixed(4), lng: +(b.lng + dLng).toFixed(4) };
}

const COUNTRY = process.env.COUNTRY || "AU";
const here = (p) => new URL(`../${p}`, import.meta.url).pathname;

// Engine constants, mirrored from app/v2/lib/prodScoring.js (read-only):
//   DIR_NODES: dirMult 1.22 at 10°, 0.95 at 50°, 0.75 at 70°, 0.50 at 90°
//   windClass: offshore <= 45°, cross 45-135°, onshore >= 135°
const ENGINE_WINDOW_HALF = 70; // swell within ±70° of idealSwellDir keeps dirMult >= 0.75
const OFFSHORE_BAND = 45;

// Surf knowledge about break type — NOT verified from any data source.
// Listed so the report can flag where the engine's default ("not reef, not
// heavy") may be wrong. Confirm each before editing breaks.js.
const KNOWN_TYPE = {
  margaret: "reef (heavy on size)", gnaraloo: "reef (heavy)", yallingup: "reef",
  bells: "reef", winkipop: "reef", angourie: "reef point", lennox: "boulder point",
  crescent: "point (sand over rock)", snapper: "sand point", kirra: "sand point",
  burleigh: "sand point", noosa: "sand point", byron: "sand point", alexandra: "point",
};

const fmtArcs = (list) => (list.length ? list.map(([s, e]) => (s === e ? `${s}°` : `${s}–${e}°`)).join(", ") : "none");
const d0 = (v) => (v == null ? "—" : `${Math.round(v)}°`);

const rows = [];
for (const b of BREAKS.filter((x) => x.country === COUNTRY)) {
  const g = analyseCoast(b.lat, b.lng);
  const window = arcs(g.open);
  const expectedOffshore = g.facing == null ? null : norm(g.facing + 180);
  const offshoreErr = expectedOffshore == null ? null : angDelta(b.offshoreWindDir, expectedOffshore);
  const swellVsFacing = g.facing == null ? null : angDelta(b.idealSwellDir, g.facing);
  const swellInWindow = inArcs(b.idealSwellDir, window);
  // Internal consistency: the ideal swell should come from roughly the
  // opposite side to the offshore wind.
  const swellVsOffshore = angDelta(b.idealSwellDir, norm(b.offshoreWindDir + 180));
  // Directions the engine rewards (dirMult >= 0.75) that have no open water.
  const engineDirs = [];
  for (let d = -ENGINE_WINDOW_HALF; d <= ENGINE_WINDOW_HALF; d += STEP) engineDirs.push(norm(Math.round((b.idealSwellDir + d) / STEP) * STEP));
  const blocked = engineDirs.filter((d) => !g.open.includes(d));
  // Nearest island/reef shadow inside the window (land hit between 3 and 100 km).
  const shadows = g.rays
    // 5 km+ so the beach's own headland doesn't count; islands and capes do.
    .filter((r) => r.blockedAtKm != null && r.blockedAtKm >= 5 && r.blockedAtKm < WINDOW_FETCH_KM && angDelta(r.bearing, b.idealSwellDir) <= ENGINE_WINDOW_HALF)
    .map((r) => ({ bearing: r.bearing, km: Math.round(r.blockedAtKm) }));

  const mp = marineSamplePoint(b);
  const marineOnLand = isLand(mp.lat, mp.lng);
  const isPoint = /point/.test(KNOWN_TYPE[b.id] || "");

  const issues = [];
  const checks = [];
  if (marineOnLand) issues.push(`the marine forecast is read at ${mp.lat}, ${mp.lng} (5 km toward ${b.idealSwellDir}°), which is **on land** in the dataset: the swell numbers may come from a coastal/land model cell (the Trigg bug of 01/08). Candidate fix: set \`marineLat/marineLng\`${g.facing == null ? " on open water" : ` toward ${d0(g.facing)}`}`);
  if (offshoreErr != null && offshoreErr > OFFSHORE_BAND) issues.push(`offshoreWindDir ${b.offshoreWindDir}° is ${Math.round(offshoreErr)}° off the land-to-sea direction (${d0(expectedOffshore)}); the engine may call offshore winds cross-shore or worse`);
  else if (offshoreErr != null && offshoreErr > 30) checks.push(`offshoreWindDir ${b.offshoreWindDir}° is ${Math.round(offshoreErr)}° off ${d0(expectedOffshore)} (inside the ±45° offshore band, but close to the edge)`);
  if (!window.length) issues.push(`no bearing has ${WINDOW_FETCH_KM} km of open water from these coordinates (longest: ${g.longestFetch.km} km toward ${g.longestFetch.bearing}°). Either the break is deeply sheltered or the point sits in an estuary / behind a headland: check on a map`);
  else if (!swellInWindow) {
    const why = b.swellAttenuation != null ? ` Consistent with its swellAttenuation ${b.swellAttenuation} (sheltered).`
      : isPoint ? " Normal for a point break (swell wraps around the headland), but the engine gives this direction its best dirMult."
      : "";
    (why ? checks : issues).push(`idealSwellDir ${b.idealSwellDir}° has less than ${WINDOW_FETCH_KM} km of open water (geo window: ${fmtArcs(window)}).${why}`);
  }
  if (swellVsFacing != null && swellVsFacing > 60) checks.push(`idealSwellDir ${b.idealSwellDir}° is ${Math.round(swellVsFacing)}° off the open-ocean centre ${d0(g.facing)} (fine for a wrapping point break, suspicious for a beach)`);
  if (swellVsOffshore > 60) checks.push(`idealSwellDir and offshoreWindDir disagree by ${Math.round(swellVsOffshore)}° (expected roughly opposite)`);
  if (blocked.length > engineDirs.length / 2) checks.push(`${blocked.length}/${engineDirs.length} of the directions the engine rewards (±${ENGINE_WINDOW_HALF}°) have no open ocean: ${fmtArcs(arcs(blocked))}`);
  if (g.coastKm > 2) issues.push(`coordinates are ${g.coastKm.toFixed(1)} km ${g.inside ? "inland" : "offshore"} from the nearest coastline in the dataset (could be the dataset's resolution; check on a map)`);
  if (b.type == null && KNOWN_TYPE[b.id]) issues.push(`no \`type\`/\`heavy\`: engine treats it as a beach break, but it's a ${KNOWN_TYPE[b.id]} (surf knowledge, unverified)`);
  if (b.swellAttenuation == null && shadows.length) checks.push(`land inside the swell window (${shadows.slice(0, 4).map((s) => `${s.bearing}° at ${s.km} km`).join(", ")}${shadows.length > 4 ? ", ..." : ""}) but no swellAttenuation`);

  rows.push({
    id: b.id, name: b.name, region: b.region, lat: b.lat, lng: b.lng,
    config: {
      idealSwellDir: b.idealSwellDir, offshoreWindDir: b.offshoreWindDir, idealTide: b.idealTide ?? "any (default)",
      swellAttenuation: b.swellAttenuation ?? null, type: b.type ?? null, heavy: !!b.heavy,
      marineLat: b.marineLat ?? null, windLat: b.windLat ?? null, timezone: b.timezone ?? null,
    },
    geo: {
      facing: g.facing == null ? null : Math.round(g.facing), coastNormal: g.coastNormal == null ? null : Math.round(g.coastNormal),
      window, expectedOffshore: expectedOffshore == null ? null : Math.round(expectedOffshore),
      coastKm: +g.coastKm.toFixed(2), longestFetch: g.longestFetch, shadows, marineSample: mp, marineOnLand,
    },
    deltas: { offshoreErr, swellVsFacing, swellVsOffshore, engineBlocked: blocked.length, engineDirs: engineDirs.length },
    issues, checks,
  });
}

writeFileSync(here("data/break-audit.json"), JSON.stringify(rows, null, 2) + "\n");

// ── Markdown ────────────────────────────────────────────────────────────
const L = [];
L.push(`# Break config audit — ${COUNTRY}`, "");
L.push(`Generated by \`accuracy/scripts/break-audit.mjs\` from \`app/breaks.js\` (${rows.length} breaks). Report only: nothing in the app was changed. Re-run with \`npm run audit\` (or \`COUNTRY=FR npm run audit\`).`, "");
const names = (list) => (list.length ? list.map((r) => r.name).join(", ") : "none");
const byMarine = rows.filter((r) => r.geo.marineOnLand);
const byCoords = rows.filter((r) => r.geo.coastKm > 2 || !r.geo.window.length);
const byType = rows.filter((r) => r.config.type == null && KNOWN_TYPE[r.id]);
const byWind = rows.filter((r) => r.deltas.offshoreErr != null && r.deltas.offshoreErr > 30);
const byPointlessSwell = rows.filter((r) => r.geo.window.length && !inArcs(r.config.idealSwellDir, r.geo.window) && r.config.swellAttenuation == null && !/point/.test(KNOWN_TYPE[r.id] || ""));
L.push("## Summary", "");
L.push(`1. **Marine forecast read on land** (directly hurts accuracy): ${names(byMarine)}.`);
L.push(`2. **Coordinates more than 2 km from the shore, or with no open ocean** (check on a map): ${names(byCoords)}.`);
L.push(`3. **Reefs and points with no \`type\`**, so the engine treats them as beach breaks (learner reef warnings off, inside-reform rescue offered): ${names(byType)}. Types come from surf knowledge and need confirming.`);
L.push(`4. **Offshore wind more than 30° off the land-to-sea direction**: ${names(byWind)}.`);
L.push(`5. **Beach breaks whose ideal swell direction has no open ocean**: ${names(byPointlessSwell)}.`);
L.push(`6. **Defaults everywhere else**: every break sets \`idealTide\`; ${rows.filter((r) => r.config.swellAttenuation != null).length}/${rows.length} set \`swellAttenuation\` (Perth metro only); none set \`timezone\` or \`marineLat/marineLng\`.`);
L.push("");
L.push("## How to read this", "");
L.push("- **Config** columns are what `breaks.js` gives the scoring engine today.");
L.push(`- **Geo** columns are measured from the coastline alone (OpenStreetMap land polygons, 10 m accuracy, rays every ${STEP}°). *Facing* = centre of the open-ocean window. *Swell window* = bearings with at least ${WINDOW_FETCH_KM} km of open water. Islands inside that distance (Rottnest, Moreton, ...) cut the window.`);
L.push("- **Offshore Δ** = angle between the configured offshore wind and the land-to-sea direction (facing + 180°). The engine counts wind within 45° of `offshoreWindDir` as offshore, so above ~45° real offshore days get scored as cross-shore.");
L.push("- **Marine pt** = where the app reads the swell forecast (5 km from the break toward `idealSwellDir`, per `realFetch.marineSamplePoint`). *land* means that point is on land in the dataset. On a device that has run the app's offshore-bearing probe, the probe can move this point (within ±90° of `idealSwellDir`), so a *land* point hurts every first load and every device without that cache.");
L.push("- The coastline is precise, but it knows nothing about sandbars, reefs, the continental shelf or refraction. A flag means *look at this*, not *this is wrong*. Break types marked \"surf knowledge, unverified\" come from general surf knowledge, not from data.");
L.push("");
L.push("## What the engine reads from a break", "");
L.push("| Field | Used for | If missing |");
L.push("|---|---|---|");
L.push("| `lat`, `lng` | every API call; offshore sample point | required |");
L.push("| `idealSwellDir` | swell direction multiplier (1.22 on-axis → 0.75 at ±70° → 0.25 at ±110°); 5 km offshore sample point for marine data; swell partition weighting | dirMult neutral, sample point falls back to a probe |");
L.push("| `offshoreWindDir` | wind multiplier and offshore/cross/onshore class (±45° / ±135°); learner wind caps | wind neutral, never classified |");
L.push("| `idealTide` | tide multiplier (×1.06 in window → ×0.92 far off) and tide chips | `any` = no tide effect |");
L.push("| `swellAttenuation` | fraction of offshore Hs reaching the break | 1.0 (fully exposed) |");
L.push("| `type: \"reef\"`, `heavy` | learner safety (\"reef too much\"), no inside-reform rescue, no foamie advice | treated as a **beach break** |");
L.push("| `marineLat/Lng`, `windLat/Lng` | override the sample points | computed from `idealSwellDir` |");
L.push("| `timezone` | local hours | taken from the API (`timezone=auto`) |");
L.push("");
L.push("## Table", "");
L.push("| Break | Config swell | Config offshore | Tide | Atten. | Type | Geo facing | Geo swell window | Offshore Δ | Marine pt | Flags |");
L.push("|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  const c = r.config;
  const flag = r.issues.length ? `**${r.issues.length} review**` : r.checks.length ? `${r.checks.length} check` : "ok";
  L.push(`| ${r.name} | ${c.idealSwellDir}° ${compass(c.idealSwellDir)} | ${c.offshoreWindDir}° ${compass(c.offshoreWindDir)} | ${c.idealTide} | ${c.swellAttenuation ?? "1.0*"} | ${c.type ?? "—"}${c.heavy ? " heavy" : ""} | ${d0(r.geo.facing)} ${compass(r.geo.facing)} | ${fmtArcs(r.geo.window)} | ${r.deltas.offshoreErr == null ? "—" : Math.round(r.deltas.offshoreErr) + "°"} | ${r.geo.marineOnLand ? "**land**" : "sea"} | ${flag} |`);
}
L.push("", "\\* default, not set in `breaks.js`.", "");
L.push("## Needs review", "");
const review = rows.filter((r) => r.issues.length);
if (!review.length) L.push("Nothing.");
for (const r of review) {
  L.push(`**${r.name}** (\`${r.id}\`)`);
  for (const i of r.issues) L.push(`- ${i}`);
  for (const c of r.checks) L.push(`- (check) ${c}`);
  L.push("");
}
L.push("## Worth a second look", "");
const soft = rows.filter((r) => !r.issues.length && r.checks.length);
if (!soft.length) L.push("Nothing.");
for (const r of soft) {
  L.push(`**${r.name}** (\`${r.id}\`)`);
  for (const c of r.checks) L.push(`- ${c}`);
  L.push("");
}
writeFileSync(here("break-audit.md"), L.join("\n"));
console.log(`${rows.length} breaks · ${review.length} need review · ${soft.length} worth a look -> break-audit.md`);
