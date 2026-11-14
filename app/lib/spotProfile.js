// Spot profile produced by the AI spot agent (app/lib/spotAgent.server.js).
//
// Pure module: no network, no React, no SDK. Imported by the API route, the
// client hook and the offline CLI, so the "is this safe to apply?" rule lives
// in ONE place.
//
// What a profile may change: the break's bottom (`type`) and `heavy`.
// What it may NEVER change: `swellAttenuation`, coordinates, swell/wind
// directions. Those are numbers the engine multiplies with; a figure found
// on a web page is not a measurement (CLAUDE.md, rules n°0 and n°1). The
// agent reports what it read about exposure in `exposureNote`, for a human.

export const PROFILE_VERSION = 1;

// The engine only knows these two bottoms (prodScoring.js tests
// `spot.type === "reef"`; anything else is treated as sand). A rocky point
// counts as "reef": what matters for the verdict is the bottom you fall on.
export const BOTTOM_TYPES = ["beach", "reef"];

export const MIN_SOURCE_HOSTS = 2;

export function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function distinctSourceHosts(profile) {
  const hosts = new Set();
  for (const s of profile?.sources || []) {
    const h = hostOf(s?.url);
    if (h) hosts.add(h);
  }
  return hosts;
}

// The "high confidence" gate. All three must hold:
//  1. the model itself said "high";
//  2. at least two DIFFERENT websites back it (sources are filtered against
//     the URLs the web search really returned, see spotAgent.server.js, so a
//     made-up link cannot count);
//  3. the bottom is one the engine understands.
// Anything less: the profile is shown to nobody and changes nothing.
export function isHighConfidence(profile) {
  if (!profile || profile.version !== PROFILE_VERSION) return false;
  if (profile.confidence !== "high") return false;
  if (!BOTTOM_TYPES.includes(profile.bottom)) return false;
  if (typeof profile.heavy !== "boolean") return false;
  return distinctSourceHosts(profile).size >= MIN_SOURCE_HOSTS;
}

export function isCustomSpot(spot) {
  return !!spot && typeof spot.id === "string" && spot.id.startsWith("custom-");
}

// Returns the spot the engine should score with. Same object when nothing
// applies, so React memo dependencies stay stable.
// Curated spots are never touched here: their type is reviewed by hand
// (scripts/spot-agent.mjs reports disagreements, a human decides).
export function applyProfileToSpot(spot, profile) {
  if (!spot || !isCustomSpot(spot) || !isHighConfidence(profile)) return spot;
  const next = { ...spot, type: profile.bottom, profileSource: "agent" };
  if (profile.heavy) next.heavy = true;
  else delete next.heavy;
  return next;
}

// Request validation for the API route. Returns { ok, value } or { ok:false, error }.
export function validateProfileRequest(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "body must be a JSON object" };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, error: "lat out of range" };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, error: "lng out of range" };
  const clean = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");
  const name = clean(body.name, 120);
  const region = clean(body.region, 120);
  if (!name) return { ok: false, error: "name required" };
  return { ok: true, value: { lat, lng, name, region } };
}

// ~1 km rounding: two searches for the same beach share one research.
export function profileCacheKey({ lat, lng }) {
  return `${Number(lat).toFixed(2)},${Number(lng).toFixed(2)}`;
}
