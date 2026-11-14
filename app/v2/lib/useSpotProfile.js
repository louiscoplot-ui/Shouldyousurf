"use client";
// Asks the server's AI spot agent what a SEARCHED beach really is (sand or
// reef, heavy or not). Curated spots never call it: their profile is in
// breaks.js and reviewed by hand.
//
// - One research per spot per device: the answer is kept 30 days in
//   localStorage (`ssurf-spot-profile-v1:<spot id>`).
// - Fire and forget: the forecast never waits for it. The profile lands a few
//   seconds to a minute later, and the verdict is recomputed then.
// - Any failure (feature off = 503, network, rate limit) returns null and the
//   app behaves exactly as before. A 503 is remembered for the session so a
//   disabled server is not asked again on every spot change.

import { useEffect, useState } from "react";
import { isCustomSpot, PROFILE_VERSION } from "../../lib/spotProfile";

const KEY_PREFIX = "ssurf-spot-profile-v1:";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
let serverDisabled = false;

function readStored(id) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + id);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || v.profile?.version !== PROFILE_VERSION || Date.now() - v.savedAt > TTL_MS) return null;
    return v.profile;
  } catch {
    return null;
  }
}

function store(id, profile) {
  try { localStorage.setItem(KEY_PREFIX + id, JSON.stringify({ savedAt: Date.now(), profile })); } catch {}
}

export function useSpotProfile(spot) {
  const id = isCustomSpot(spot) ? spot.id : null;
  const [state, setState] = useState({ id: null, profile: null });

  useEffect(() => {
    if (!id) return undefined;
    const stored = readStored(id);
    if (stored) { setState({ id, profile: stored }); return undefined; }
    setState({ id, profile: null });
    if (serverDisabled) return undefined;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 75000);
    fetch("/api/spot-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: spot.name, region: spot.region || "", lat: spot.lat, lng: spot.lng }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (res.status === 503) { serverDisabled = true; return; }
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.profile) return;
        store(id, data.profile);
        setState((s) => (s.id === id ? { id, profile: data.profile } : s));
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctrl.abort(); };
    // spot.name / lat / lng are fixed for a given custom id (the id is built from the coordinates)
  }, [id]);

  return state.id === id ? state.profile : null;
}
