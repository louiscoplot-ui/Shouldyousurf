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

// Clé de cache DATÉE. L'URL d'une prévision ("forecast_days=5", sans date) est
// identique tous les jours : sans ceci le CDN en gardait une copie du 17/11
// (qui s'arrête au 21/11) et la resservait indéfiniment à tout le monde →
// plus aucune prévision à partir du 22/11 et heures du passé en double.
// Le paramètre `d` change à chaque tranche de 30 min (prévisions) ou 6 h
// (jours passés) ; l'altitude ne change jamais, pas de tranche.
export function cacheBucket(url, now = Date.now()) {
  if (/\/v1\/elevation/.test(url)) return 0;
  const win = /[?&]start_date=/.test(url) ? 6 * 3600000 : 30 * 60000;
  return Math.floor(now / win);
}

export async function sharedFetch(url, opts = {}) {
  if (useProxy()) {
    try {
      const res = await fetch(`${PROXY_PATH}?u=${encodeURIComponent(url)}&d=${cacheBucket(url)}`, opts);
      if (res.ok) return res;
    } catch (e) {
      if (opts.signal?.aborted) throw e;
    }
  }
  return fetch(url, opts);
}
