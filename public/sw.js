// Minimal service worker scaffold — registers for future Web Push support.
// When a push payload arrives it shows the notification. No backend wired yet.
self.addEventListener("install", (event) => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

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
