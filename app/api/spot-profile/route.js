// POST /api/spot-profile  { name, region?, lat, lng }
// -> 200 { profile, applied }   applied = passes the high-confidence gate
// -> 503 when the feature is off (no key, or SPOT_AGENT_ENABLED not "1")
//
// Off by default. Two Vercel environment variables turn it on:
//   ANTHROPIC_API_KEY   the key (secret, never in the repo)
//   SPOT_AGENT_ENABLED  "1"
// The client treats any non-200 as "no profile" and the app behaves exactly
// as before.

/* global Response */ // Web API global in the Node runtime of Next route handlers
import Anthropic from "@anthropic-ai/sdk";
import { researchSpot, SpotAgentError } from "../../lib/spotAgent.server.js";
import { validateProfileRequest, profileCacheKey, isHighConfidence } from "../../lib/spotProfile.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A research with web search takes 20-50 s. 60 s is the limit Vercel documents
// for Hobby functions; not verified on this project from here.
export const maxDuration = 60;

// Per-instance memory only: a cold start forgets both. The client keeps its
// own 30-day copy, so a repeat search costs nothing either way.
const cache = new Map();
const CACHE_MAX = 500;
const hits = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;

function rateLimited(ip, now) {
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function POST(req) {
  if (process.env.SPOT_AGENT_ENABLED !== "1" || !process.env.ANTHROPIC_API_KEY) {
    return json(503, { error: "disabled" });
  }
  let body;
  try { body = await req.json(); } catch { return json(400, { error: "invalid JSON" }); }
  const v = validateProfileRequest(body);
  if (!v.ok) return json(400, { error: v.error });

  const key = profileCacheKey(v.value);
  const cached = cache.get(key);
  if (cached) return json(200, { profile: cached, applied: isHighConfidence(cached), cached: true });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip, Date.now())) return json(429, { error: "rate limited" });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const profile = await researchSpot(v.value, { client });
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, profile);
    return json(200, { profile, applied: isHighConfidence(profile) });
  } catch (e) {
    const code = e instanceof SpotAgentError ? e.code : "upstream";
    console.error("spot-profile:", code, e?.message);
    return json(502, { error: code });
  }
}
