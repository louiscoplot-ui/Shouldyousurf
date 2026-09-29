"use client";

// v2 BreakPicker — spot selector with country filter, GPS nearest, map picker,
// worldwide geocoding search, and favourites. Ported from prod.

import { useEffect, useMemo, useState } from "react";
import { BREAKS, COUNTRIES } from "../../breaks";
import { distanceKm } from "../lib/prodScoring";
import MapPicker from "./MapPicker";

// Spots curés triés par distance. Le GPS envoyait TOUJOURS sur le plus
// proche, même à 800 km (un surfeur à Kuta atterrissait sur un reef à
// Uluwatu, un autre au Brésil sur le spot le plus proche du catalogue).
// Au-delà de NEAR_KM on montre la liste avec les distances ET la position
// exacte, qui passe par l'inférence des spots libres (côte + houle).
const NEAR_KM = 15;
function breaksByDistance(lat, lng) {
  return BREAKS.map((b) => ({ spot: b, distanceKm: distanceKm(lat, lng, b.lat, b.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function BreakRow({ b, onSelect, toggleFav, isFav, current, t }) {
  return (
    <div className={`v2-break-row ${current ? "current" : ""}`}>
      <button className="v2-break-row-main" onClick={() => onSelect(b)}>
        <div className="v2-break-row-title">{b.name}</div>
        <div className="v2-break-row-sub">{b.region} · {t(b.type || "beach")}{b.heavy ? ` · ${t("heavy")}` : ""}</div>
      </button>
      <button className={`v2-break-row-fav ${isFav ? "active" : ""}`}
        onClick={e => { e.stopPropagation(); toggleFav(b.id); }}>
        {isFav ? "★" : "☆"}
      </button>
    </div>
  );
}

export default function BreakPicker({ onSelect, onClose, favorites, toggleFav, currentId, t, country, setCountry }) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [nearby, setNearby] = useState(null);

  function useMyLocation() {
    if (!navigator.geolocation) { alert(t("gps_unsupported")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        const list = breaksByDistance(lat, lng);
        if (list.length && list[0].distanceKm <= NEAR_KM) { onSelect(list[0].spot); return; }
        setNearby({ lat, lng, list: list.slice(0, 5) });
        // La liste du dessous suit le pays du spot le plus proche.
        if (list.length && setCountry) setCountry(list[0].spot.country);
      },
      () => { setLocating(false); alert(t("gps_denied")); },
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  const countryBreaks = useMemo(() => BREAKS.filter(b => b.country === country), [country]);

  const grouped = useMemo(() => {
    const filtered = query.trim()
      ? countryBreaks.filter(b => (b.name + " " + b.region).toLowerCase().includes(query.toLowerCase()))
      : countryBreaks;
    const out = {};
    const order = [];
    filtered.forEach(b => {
      const r = b.region.split(",").slice(-1)[0].trim();
      if (!out[r]) { out[r] = []; order.push(r); }
      out[r].push(b);
    });
    return { out, order };
  }, [query, countryBreaks]);

  async function geoSearch(q) {
    const term = (q ?? query).trim();
    if (!term) { setSearchResults([]); setSearchError(null); return; }
    setSearching(true);
    setSearchError(null);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=10&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      console.warn("[v2] geocoding search failed:", e);
      setSearchResults([]);
      setSearchError(e?.message || "Search unavailable — check your connection");
    } finally { setSearching(false); }
  }

  const currentCountry = COUNTRIES.find(c => c.code === country) || COUNTRIES[0];

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => { geoSearch(term); }, 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return BREAKS.filter(b => (b.name + " " + b.region).toLowerCase().includes(q));
  }, [query]);

  const isSearching = query.trim().length >= 2;

  return (
    <div className="v2-overlay" onClick={onClose}>
      <div className="v2-sheet" onClick={e => e.stopPropagation()}>
        <div className="v2-handle"/>
        <div className="v2-sheet-body">
          <div className="v2-sheet-header">
            <div className="v2-sheet-title">{t("choose_break")}</div>
            <button className="v2-close-btn" onClick={onClose}>✕</button>
          </div>
          <button className="v2-country-btn" onClick={() => setCountryOpen(v => !v)}>
            <span>{currentCountry.flag} {currentCountry.name}</span>
            <span style={{ color: "var(--text-mu)" }}>▾</span>
          </button>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button className="v2-locate-btn" style={{ flex: 1, margin: 0 }} onClick={useMyLocation} disabled={locating}>
              {locating ? t("locating") : <>📍 {t("nearest_spot")}</>}
            </button>
            <button className="v2-locate-btn" style={{ flex: 1, margin: 0 }} onClick={() => setMapOpen(true)}>
              🗺️ {t("pick_on_map")}
            </button>
          </div>
          {countryOpen && (
            <div className="v2-country-list">
              {COUNTRIES.map(c => (
                <button key={c.code}
                  className={`v2-country-row ${c.code === country ? "active" : ""}`}
                  onClick={() => { setCountry(c.code); setCountryOpen(false); setQuery(""); setSearchResults([]); }}>
                  <span>{c.flag} {c.name}</span>
                  {c.code === country && <span style={{ color: "var(--accent)" }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input className="v2-input" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && geoSearch()}
              placeholder={t("search_placeholder")}/>
            <button className="v2-search-btn" onClick={() => geoSearch()}>{searching ? "…" : "🔍"}</button>
          </div>

          {nearby && !isSearching && (
            <>
              <button className="v2-locate-btn" style={{ width: "100%", margin: "0 0 6px" }} onClick={() => onSelect({
                id: `custom-${nearby.lat.toFixed(4)}-${nearby.lng.toFixed(4)}`,
                name: t("my_location"),
                region: `${nearby.lat.toFixed(3)}, ${nearby.lng.toFixed(3)}`,
                lat: nearby.lat, lng: nearby.lng,
                // Pas d'orientation en dur : realFetch l'infère (côte + houle).
                type: "beach",
              })}>
                📍 {t("use_exact_location")}
              </button>
              <div className="v2-region-header">{t("nearby_spots")}</div>
              {nearby.list.map(({ spot: b, distanceKm: d }) => (
                <div key={b.id} style={{ position: "relative" }}>
                  <BreakRow b={b} onSelect={onSelect} toggleFav={toggleFav} isFav={favorites.includes(b.id)} current={currentId===b.id} t={t}/>
                  <span className="mono" style={{ position: "absolute", right: 44, top: 12, fontSize: 11, color: "var(--text-mu)" }}>{Math.round(d)} km</span>
                </div>
              ))}
            </>
          )}

          {isSearching && (
            <>
              {localMatches.length > 0 && (
                <>
                  <div className="v2-region-header">{t("known_breaks")}</div>
                  {localMatches.map(b => (
                    <BreakRow key={b.id} b={b} onSelect={onSelect} toggleFav={toggleFav} isFav={favorites.includes(b.id)} current={currentId===b.id} t={t}/>
                  ))}
                </>
              )}
              <div className="v2-region-header">
                {searching ? t("searching") : t("search_results")}
              </div>
              {searchResults.map((r, i) => {
                const ccode = r.country_code ? `${r.country_code}` : "";
                const regionLabel = [r.admin1, r.admin2].filter(Boolean).join(" · ");
                return (
                  <div key={i} className="v2-break-row">
                    <button className="v2-break-row-main" onClick={() => onSelect({
                      id: `custom-${r.latitude.toFixed(4)}-${r.longitude.toFixed(4)}`,
                      name: r.name,
                      region: [regionLabel, ccode].filter(Boolean).join(", ") || r.name,
                      lat: r.latitude, lng: r.longitude,
                      // PAS de idealSwellDir/offshoreWindDir hardcodés —
                      // realFetch.js détecte leur absence et appelle
                      // inferSpotProfile sur les vraies données swell de
                      // ce spot. Avant le fix, 225/90 (WA-only) écrasait
                      // l'inférence et donnait "Skip" sur les bons spots
                      // hors Australie occidentale.
                      type: "beach",
                    })}>
                      <div className="v2-break-row-title">{r.name} <span className="v2-break-row-flag">{ccode}</span></div>
                      <div className="v2-break-row-sub">{regionLabel || "—"}</div>
                    </button>
                  </div>
                );
              })}
              {!searching && searchResults.length === 0 && localMatches.length === 0 && !searchError && (
                <div className="v2-break-empty mono">{t("search_none")}</div>
              )}
              {!searching && searchError && (
                <div className="v2-break-empty mono" style={{ color: "var(--bad)" }}>{searchError}</div>
              )}
            </>
          )}

          {favorites.length > 0 && (
            <>
              <div className="v2-region-header">{t("favourites")}</div>
              {favorites.map(id => {
                const b = BREAKS.find(x => x.id === id);
                if (!b) return null;
                return <BreakRow key={b.id} b={b} onSelect={onSelect} toggleFav={toggleFav} isFav={true} current={currentId===b.id} t={t}/>;
              })}
            </>
          )}

          {!isSearching && grouped.order.map(region => (
            <div key={region}>
              <div className="v2-region-header">{region}</div>
              {grouped.out[region].map(b => (
                <BreakRow key={b.id} b={b} onSelect={onSelect} toggleFav={toggleFav} isFav={favorites.includes(b.id)} current={currentId===b.id} t={t}/>
              ))}
            </div>
          ))}
        </div>
      </div>
      {mapOpen && (
        <MapPicker t={t} onClose={() => setMapOpen(false)} onSelect={(spot) => { onSelect(spot); setMapOpen(false); }}/>
      )}
    </div>
  );
}
