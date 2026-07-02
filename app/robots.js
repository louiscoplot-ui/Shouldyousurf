// Native Next.js robots.txt — served at /robots.txt.
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://shouldyousurf.com/sitemap.xml",
  };
}
