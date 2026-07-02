/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Force every request for /version.json to bypass any CDN / browser
        // cache. The client-side heartbeat already adds a ?t= cache-buster,
        // but the explicit header is the belt-and-braces guarantee that a
        // fresh deploy reaches every user within one poll cycle.
        source: "/version.json",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
      {
        // Baseline security headers — static client app, no auth, but these
        // cost nothing: no MIME sniffing, no framing (clickjacking), tight
        // referrer, and geolocation restricted to same-origin (used by the
        // "nearest spot" feature).
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        // /v2 was the redesign preview; it now renders the exact same app
        // as "/" and was getting indexed as a duplicate titled "Not the
        // production experience". Query params (?spot=…) are preserved.
        source: "/v2",
        destination: "/",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
