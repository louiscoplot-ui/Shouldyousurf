"use client";

// Analytics wrapper — fires to PostHog + Microsoft Clarity when they're
// loaded. All calls are no-ops if the scripts haven't loaded (env keys
// not set, ad-blockers, SSR) so the app still works without data.
//
// Setup: set NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_CLARITY_ID in
// Vercel env vars. The <Script> tags in app/layout.js load the SDKs
// only if those vars exist.
//
// Event vocabulary — keep consistent so dashboards stay clean:
//   level_picked          { level }
//   spot_selected         { id, name, country, type }
//   day_switched          { dayIdx, label }
//   hour_selected         { hour, score }
//   score_sheet_opened    { score, verdict }
//   pwa_installed         {}
//   notif_opted_in        { state }
//   share_clicked         { spotId }
//   favorite_added        { spotId, country }
//   favorite_removed      { spotId }
//   language_changed      { from, to }
//   custom_spot_added     { lat, lng }
//   faq_opened            {}
//   theme_changed         { theme }

export function track(event, props = {}) {
  if (typeof window === "undefined") return;
  try {
    if (window.posthog && typeof window.posthog.capture === "function") {
      window.posthog.capture(event, props);
    }
    if (window.clarity && typeof window.clarity === "function") {
      // Clarity's "event" API takes a single string
      window.clarity("event", event);
      // Attach props as custom tags (shown in the session filter UI)
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v == null) continue;
        window.clarity("set", k, String(v));
      }
    }
  } catch {
    // swallow — analytics must never break the app
  }
}

export function identify(id, traits = {}) {
  if (typeof window === "undefined" || !id) return;
  try {
    if (window.posthog && typeof window.posthog.identify === "function") {
      window.posthog.identify(id, traits);
    }
    if (window.clarity && typeof window.clarity === "function") {
      window.clarity("identify", id);
    }
  } catch {}
}
