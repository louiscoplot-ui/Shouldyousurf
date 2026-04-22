// Service worker — v2026-04-22-fast (stale-while-revalidate HTML)
//
// Strategy for the HTML navigation document:
// - Stale-while-revalidate: if we have a cached copy of the HTML, serve it
//   IMMEDIATELY (PWA boots instantly, no multi-second black while iOS waits
//   on the network). In the background, fetch a fresh copy from the network
//   and update the cache — so the NEXT open picks up the latest deploy.
// - If we don't have a cached copy yet (very first install), do a plain
//   network fetch with no-store so we don't trap the user on stale data.
// - Hashed JS / CSS chunks aren't intercepted here — the browser handles
//   them with its own cache, and their URLs rotate on every deploy so the
//   'cached HTML' never references stale chunks once the user has loaded
//   the latest HTML at least once.
//
// The small trade-off is that deploys take ONE extra open to show up:
// user opens the app → instant boot from cache (yesterday's bundle) +
// background fetch of latest HTML → next open, latest bundle runs.
//
// Also:
// - skipWaiting / claim so the new SW takes over all open pages.
// - Old caches from previous SW versions are dropped on activate.
// - Push notification + notificationclick handlers kept unchanged.

const VERSION = "2026-04-22-fast";
const HTML_CACHE = "html-" + VERSION;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== HTML_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const isNav =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
  if (!isNav) return;

  event.respondWith((async () => {
    const cache = await caches.open(HTML_CACHE);
    const cached = await cache.match(req);

    // Fire off the revalidation regardless — this updates the cache for
    // the next open. Detached from the response so it never blocks serve.
    const revalidate = fetch(req, { cache: "no-store" })
      .then((res) => {
        // Only cache successful responses. Don't poison cache with 500s.
        if (res && res.ok) {
          try { cache.put(req, res.clone()); } catch {}
        }
        return res;
      })
      .catch(() => null);

    if (cached) {
      // Keep the revalidate alive after we've responded.
      event.waitUntil(revalidate);
      return cached;
    }

    // No cache yet (very first install) → wait for the network.
    const fresh = await revalidate;
    return fresh || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
  })());
});

// ── Push notification handlers ───────────────────────────────────────
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
