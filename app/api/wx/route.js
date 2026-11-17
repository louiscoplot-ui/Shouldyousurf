// GET /api/wx?u=<upstream URL>
// Shared, CDN-cached pass-through to the free weather APIs the app uses
// (see app/v2/lib/sharedFetch.js for why). Only these hosts and paths are
// allowed, so it cannot be used as an open proxy.
/* global Response, URL, AbortSignal */ // Web API globals in the Node runtime of Next route handlers

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = {
  "marine-api.open-meteo.com": ["/v1/marine"],
  "api.open-meteo.com": ["/v1/forecast", "/v1/elevation"],
  "api.met.no": ["/weatherapi/locationforecast/2.0/complete", "/weatherapi/locationforecast/2.0/compact"],
};

// How long one answer is shared. Forecasts: 30 min (models update a few
// times a day). Past days and elevation never change for a given URL.
function ttlFor(u) {
  if (u.pathname === "/v1/elevation") return 30 * 24 * 3600;
  if (u.searchParams.has("start_date")) return 6 * 3600;
  return 30 * 60;
}

export async function GET(req) {
  const raw = new URL(req.url).searchParams.get("u") || "";
  let u;
  try { u = new URL(raw); } catch { return new Response("bad url", { status: 400 }); }
  if (u.protocol !== "https:" || raw.length > 4000 || !(ALLOWED[u.hostname] || []).includes(u.pathname)) {
    return new Response("not allowed", { status: 403 });
  }
  let upstream;
  try {
    upstream = await fetch(u.toString(), {
      // MET Norway's terms ask callers to identify themselves.
      headers: { "user-agent": "ShouldYouSurf/1.0 (+https://shouldyousurf.com)" },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return new Response("upstream unreachable", { status: 502, headers: { "cache-control": "no-store" } });
  }
  const body = await upstream.text();
  if (!upstream.ok) {
    // Never cache an error: the next request tries again.
    return new Response(body, { status: upstream.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  const ttl = ttlFor(u);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      // Shared by everyone at the CDN; a stale copy is still served for a
      // day while a fresh one is fetched, so an upstream hiccup is invisible.
      "cache-control": `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=86400`,
      "cdn-cache-control": `public, s-maxage=${ttl}, stale-while-revalidate=86400`,
    },
  });
}
