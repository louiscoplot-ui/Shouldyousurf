"use client";

// v2 LoadingScreen — stub. The actual visual splash now lives in
// layout.js as native HTML (video + veil + wordmark + dots + tagline)
// so it starts playing from the first byte of HTML, before React
// hydrates. This component returns null — it exists only as the
// placeholder React renders while payload is null.
//
// Previously this component rendered its OWN splash on top of the
// layout.js preload, which produced two visible splashes in sequence.
// Keeping everything in static HTML = one seamless splash.

export default function LoadingScreen() {
  return null;
}
