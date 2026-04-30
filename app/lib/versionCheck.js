// Client-side version heartbeat.
//
// Vercel serves fresh JS chunks on every deploy, but iOS Safari / installed
// PWAs cache the HTML itself aggressively and can keep running old code for
// hours after we ship a fix. This module polls /version.json (always
// no-store) and force-reloads the page with a cache-busting query when the
// server version moves forward — so a bug fix reaches users within ~1 min
// without them re-installing anything.

const POLL_MS = 20_000;
let startedAt = null;
let seenVersion = null;
let reloading = false;
let started = false;

async function fetchVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.version || null;
  } catch { return null; }
}

function reloadBypassingCache(nextVersion) {
  if (reloading) return;
  reloading = true;
  const url = new URL(window.location.href);
  url.searchParams.set("v", nextVersion);
  window.location.replace(url.toString());
}

async function check() {
  const v = await fetchVersion();
  if (!v) return;
  if (seenVersion == null) { seenVersion = v; return; }
  if (v !== seenVersion) reloadBypassingCache(v);
}

export function startVersionCheck() {
  if (typeof window === "undefined" || started) return;
  started = true;
  startedAt = Date.now();

  // First check runs ~3s after mount so we don't compete with the initial
  // paint, then every POLL_MS while the tab stays visible.
  setTimeout(check, 3000);
  setInterval(() => { if (document.visibilityState === "visible") check(); }, POLL_MS);

  // Also check every time the PWA comes back to foreground — that's the
  // most common moment users encounter a stale cache. Always run (no
  // mount-age threshold): the seenVersion guard inside check() already
  // prevents an instant reload on fresh opens (first call just records
  // the version, only subsequent calls compare).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}
