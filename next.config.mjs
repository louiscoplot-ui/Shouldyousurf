/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force every request for /version.json to bypass any CDN / browser
  // cache. The client-side heartbeat already adds a ?t= cache-buster,
  // but the explicit header is the belt-and-braces guarantee that a
  // fresh deploy reaches every user within one poll cycle.
  async headers() {
    return [
      {
        source: "/version.json",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
    ];
  },
};
export default nextConfig;
