"use client";

// Vercel Web Analytics — le SEUL des trois outils de mesure que Claude peut
// lire directement depuis une session (MCP Vercel `get_web_analytics`).
// PostHog et GA4 n'ont pas de MCP ici : leurs chiffres ne sont consultables
// qu'à la main dans leurs dashboards respectifs.
//
// ⚠️ Ce wrapper CLIENT existe pour une raison précise : `app/layout.js` est un
// Server Component (il exporte `metadata`), donc il ne peut pas passer une
// FONCTION en prop. Or `beforeSend` est une fonction, et sans elle Vercel
// compterait Louis parmi ses propres visiteurs — exactement le problème que
// `?noanalytics=1` vient de régler pour GA4 et PostHog. Les trois outils
// doivent honorer le MÊME interrupteur, sinon on se retrouve avec deux
// tableaux de bord qui se contredisent.
//
// `window.__ssNoAnalytics` est posé par le script inline du <head>, donc
// bien avant l'hydratation : le drapeau est déjà là quand beforeSend tourne.

import { Analytics } from "@vercel/analytics/next";

export default function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          if (typeof window !== "undefined" && window.__ssNoAnalytics) return null;
        } catch {}
        return event;
      }}
    />
  );
}
