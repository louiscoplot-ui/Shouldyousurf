// v2 layout — scopes the prototype CSS to this route only so it doesn't
// collide with the production app at "/".

import "./v2.css";

// /v2 permanently redirects to "/" (next.config.mjs) — this metadata only
// exists as a fallback and must NOT read "Preview / not production": it was
// the title Google indexed and the one shown on shared links.
export const metadata = {
  title: "Should You Surf?",
  description: "Should you surf today? Instant GO / MAYBE / SKIP verdict for your level.",
};

export default function V2Layout({ children }) {
  return children;
}
