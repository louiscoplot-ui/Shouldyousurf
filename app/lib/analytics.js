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

// ── UN APPAREIL = UNE PERSONNE, POUR TOUJOURS ─────────────────────────
// Le besoin : savoir combien de GENS distincts utilisent l'app, pas combien
// de fois ils l'ouvrent. Les trois outils ne répondent pas pareil :
//   GA4    — "Users" est déjà unique par appareil (cookie `_ga` persistant).
//   Vercel — cookieless, donc visiteur unique PAR JOUR : quelqu'un qui
//            revient 5 jours compte 5 fois sur la période. Limite du
//            produit, rien à corriger côté code.
//   PostHog— c'est ici qu'il y avait un VRAI trou.
//
// ⚠️ LE BUG : `posthog.init` tourne avec `person_profiles: 'identified_only'`
// et `identify()` n'était appelé NULLE PART dans l'app. Cette combinaison ne
// crée AUCUN profil de personne : le compteur "combien de gens" de PostHog
// était vide par construction, alors que les events partaient bien.
//
// Le correctif : un identifiant ALÉATOIRE généré une fois et gardé en
// localStorage. Aucune donnée personnelle, aucune empreinte de navigateur —
// juste un UUID first-party. Un appareil qui revient garde le même, donc il
// compte pour UNE personne quel que soit le nombre d'ouvertures.
//
// ⚠️ Un appareil qui vide son stockage (ou un autre navigateur sur le même
// téléphone) repart avec un nouvel ID et compte comme une personne de plus.
// C'est inhérent à toute mesure sans compte utilisateur : la seule façon de
// faire mieux serait un login, ce que l'app n'a pas.
const DEVICE_KEY = "ss-device-id";

export function deviceId() {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : "d-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch { return null; }
}

// Appelé UNE fois au montage. Honore le même interrupteur `?noanalytics=1`
// que GA4, PostHog et Vercel : sans ça Louis se compterait lui-même comme
// une personne de plus à chaque appareil.
export function identifyDevice() {
  if (typeof window === "undefined" || window.__ssNoAnalytics) return;
  const id = deviceId();
  if (id) identify(id);
}
