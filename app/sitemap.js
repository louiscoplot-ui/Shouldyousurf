// Native Next.js sitemap — served at /sitemap.xml. Spot deep-links use the
// ?spot= share param until dedicated /spot/[id] pages exist.
import { BREAKS } from "./breaks";

export default function sitemap() {
  const base = "https://shouldyousurf.com";
  return [
    { url: base, changeFrequency: "hourly", priority: 1 },
    ...BREAKS.map((b) => ({
      url: `${base}/?spot=${encodeURIComponent(b.id)}`,
      changeFrequency: "hourly",
      priority: 0.7,
    })),
  ];
}
