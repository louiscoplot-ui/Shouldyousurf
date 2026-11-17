// One upstream call serves every user.
//
// In the browser, weather / marine requests go through our own route
// (/api/wx), whose answers are cached by Vercel's CDN: the first person to
// open a spot pays the Open-Meteo call, everyone else in the next 30 min
// gets the cached copy. Why: Open-Meteo's free tier counts requests PER
// WEBSITE (measured 17/11: 429 "Daily API request limit exceeded" only with
// Origin shouldyousurf.com), so every user's own calls added up to one
// shared daily quota. With the shared cache, a spot costs at most ~48 calls a
// day whatever the number of users.
//
// If the route fails for any reason, the browser calls the API directly,
// exactly as before (and realFetch still has the MET Norway wind backup).
// Outside a browser (tests, scripts) it is a plain fetch.

export const PROXY_PATH = "/api/wx";

function useProxy() {
  return typeof window !== "undefined" && /^https?:$/.test(window.location?.protocol || "");
}

export async function sharedFetch(url, opts = {}) {
  if (useProxy()) {
    try {
      const res = await fetch(`${PROXY_PATH}?u=${encodeURIComponent(url)}`, opts);
      if (res.ok) return res;
    } catch (e) {
      if (opts.signal?.aborted) throw e;
    }
  }
  return fetch(url, opts);
}
