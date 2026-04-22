"use client";

// v2 BreakPicker — spot selector with country filter, GPS nearest, map picker,
// worldwide geocoding search, and favourites. Ported from prod.

import { useEffect, useMemo, useState } from "react";
import { BREAKS, COUNTRIES } from "../../breaks";
import { distanceKm } from "../lib/prodScoring";
import MapPicker from "./MapPicker";

function nearestBreak(lat, lng) {
  let best = null, bestD = Infinity;
  for (const b of BREAKS) {
    const d = distanceKm(lat, lng, b.lat, b.lng);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best ? { spot: best, distanceKm: bestD } : null;
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
  const [countryOpen, setCountryOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) { alert(t("gps_unsupported")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        const r = nearestBreak(pos.coords.latitude, pos.coords.longitude);
        if (r) onSelect(r.spot);
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
    if (!term) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=10&language=en&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {} finally { setSearching(false); }
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
                      idealSwellDir: 225, offshoreWindDir: 90, type: "beach",
                    })}>
                      <div className="v2-break-row-title">{r.name} <span className="v2-break-row-flag">{ccode}</span></div>
                      <div className="v2-break-row-sub">{regionLabel || "—"}</div>
                    </button>
                  </div>
                );
              })}
              {!searching && searchResults.length === 0 && localMatches.length === 0 && (
                <div className="v2-break-empty mono">{t("search_none")}</div>
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
