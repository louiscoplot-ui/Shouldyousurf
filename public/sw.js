// Service worker — v2026-04-22-minimal
//
// IMPORTANT: no fetch/navigate interception. Letting the browser handle
// HTML/JS/CSS natively via its HTTP cache is FASTER on iOS PWA than any
// SW strategy — intercepting navigations was adding 2-6s of black screen
// on cold PWA launches because iOS has to wait for the SW to handshake
// before it can paint the HTML.
//
// Freshness of the Open-Meteo API responses is already guaranteed by the
// `fetch(url, {cache: "no-store"})` calls in page.js — no SW required.
//
// This file only exists for:
// - future Web Push notifications (handlers below)
// - satisfying the manifest registration so iOS treats the app as a PWA
//
// When a previously-installed aggressive SW is on someone's device, this
// minimal one replaces it on next app open (skipWaiting + clients.claim).
// The old fetch handler is gone, so the browser immediately resumes its
// native (fast) HTML loading.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Blow away any cache the previous aggressive SW had created — we don't
    // want stale HTML sitting around and confusing anyone.
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// No `fetch` listener — browser handles everything natively.

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
