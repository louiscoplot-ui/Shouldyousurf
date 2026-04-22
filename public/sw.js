// Service worker — v2025.11 (force-refresh + network-first HTML + push scaffold)
//
// Strategy:
// - network-first for navigations / HTML → the page is ALWAYS fresh on open.
//   The browser cache is bypassed entirely for the document; hashed JS / CSS
//   chunks are still cache-able by the browser normally (their URLs change
//   on every deploy so staleness is impossible).
// - On activation of a NEW version of this SW, force-reload every open
//   client with client.navigate(client.url). That means every existing user
//   who already has the old version installed as a PWA will automatically
//   pick up the latest bundle on their very next app open, no action needed.
// - Cache the latest HTML only as an offline fallback (not for serving while
//   online), so zero network = app still opens, with the most recent HTML.

const VERSION = "2026-04-22-splash";
const HTML_CACHE = "html-" + VERSION;

self.addEventListener("install", (event) => {
  // Claim activation immediately — don't wait for tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Drop any cache from previous SW versions.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== HTML_CACHE).map((k) => caches.delete(k)));
    // Take over all existing pages for future navigations.
    await self.clients.claim();
    // NOTE: we deliberately do NOT force-reload existing clients here
    // (was causing a visible flash on every open + broke the app for
    // some users whose network choked mid-navigate). The network-first
    // HTML strategy below guarantees freshness on the NEXT natural load
    // — users always get the latest bundle within one open.
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const isNav =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
  if (!isNav) return; // let the browser handle hashed assets normally

  event.respondWith((async () => {
    try {
      // Always hit the network first — `cache: "no-store"` also blocks the
      // browser HTTP cache from returning a stale HTML.
      const res = await fetch(req, { cache: "no-store" });
      // Refresh the offline fallback copy in the background.
      try {
        const cache = await caches.open(HTML_CACHE);
        cache.put(req, res.clone());
      } catch {}
      return res;
    } catch {
      // Network failed — serve the last-known HTML if we have one.
      const cached = await caches.match(req);
      return cached || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
    }
  })());
});

// ── Push notification handlers (unchanged from previous SW version) ───
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || "Should You Surf?";
  const body  = data.body  || "Good conditions coming up.";
  const url   = data.url   || "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin)) { c.focus(); return c.navigate(url); }
      }
      return self.clients.openWindow(url);
    })
  );
});
