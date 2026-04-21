"use client";

// v2 MapPicker — Leaflet satellite/street + Nominatim reverse geocoding.
// Ported from prod. Spot pins + click-to-pick any coordinate.

import { useEffect, useRef, useState } from "react";
import { BREAKS } from "../../breaks";

function loadLeaflet() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet", "1");
      document.head.appendChild(link);
    }
    if (window.__leafletLoading) {
      window.__leafletLoading.then(() => resolve(window.L));
      return;
    }
    window.__leafletLoading = new Promise((done) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => done();
      document.body.appendChild(script);
    });
    window.__leafletLoading.then(() => resolve(window.L));
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&accept-language=en`);
    const data = await res.json();
    const addr = data.address || {};
    const name =
      addr.beach || addr.natural || addr.suburb || addr.village || addr.town ||
      addr.city || addr.county || (data.display_name || "").split(",")[0] ||
      `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    const regionBits = [addr.suburb || addr.village || addr.town || addr.city, addr.state, addr.country].filter(Boolean);
    return { name: name.trim(), region: regionBits.join(", ") };
  } catch {
    return { name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, region: "" };
  }
}

const MAP_TILES = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "&copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
};

export default function MapPicker({ onSelect, onClose, t, initialCenter }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileRef = useRef(null);
  const markerRef = useRef(null);
  const [pickedLatLng, setPickedLatLng] = useState(null);
  const [suggestedName, setSuggestedName] = useState("");
  const [suggestedRegion, setSuggestedRegion] = useState("");
  const [editedName, setEditedName] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [tileKey, setTileKey] = useState("satellite");

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || !mapContainerRef.current || mapRef.current) return;
      const center = initialCenter || [-31.88, 115.75];
      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView(center, initialCenter ? 13 : 4);
      const t0 = MAP_TILES[tileKey];
      tileRef.current = L.tileLayer(t0.url, { attribution: t0.attr, maxZoom: t0.maxZoom }).addTo(map);

      const spotIcon = L.divIcon({
        className: "spot-pin",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#d99e4a;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      BREAKS.forEach(b => {
        const m = L.marker([b.lat, b.lng], { icon: spotIcon })
          .addTo(map)
          .bindTooltip(b.name, { direction: "top", offset: [0, -8], className: "spot-pin-tip" });
        m.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelect(b);
        });
      });

      map.on("click", async (e) => {
        if (markerRef.current) map.removeLayer(markerRef.current);
        markerRef.current = L.marker(e.latlng).addTo(map);
        setPickedLatLng(e.latlng);
        setGeocoding(true);
        const r = await reverseGeocode(e.latlng.lat, e.latlng.lng);
        setSuggestedName(r.name || "");
        setSuggestedRegion(r.region || "");
        setEditedName(r.name || "");
        setGeocoding(false);
      });
      mapRef.current = map;
      setTimeout(() => { try { map.invalidateSize(); } catch {} }, 80);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchTile(key) {
    if (!mapRef.current || !window.L || tileKey === key) return;
    if (tileRef.current) mapRef.current.removeLayer(tileRef.current);
    const cfg = MAP_TILES[key];
    tileRef.current = window.L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: cfg.maxZoom }).addTo(mapRef.current);
    setTileKey(key);
  }

  function useMe() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapRef.current.setView(latlng, 14);
      },
      () => {}
    );
  }

  async function confirm() {
    if (!pickedLatLng) return;
    setConfirming(true);
    const name = (editedName || suggestedName || `${pickedLatLng.lat.toFixed(3)}, ${pickedLatLng.lng.toFixed(3)}`).trim();
    onSelect({
      id: `custom-${pickedLatLng.lat.toFixed(4)}-${pickedLatLng.lng.toFixed(4)}`,
      name,
      region: suggestedRegion,
      lat: pickedLatLng.lat,
      lng: pickedLatLng.lng,
      type: "beach",
    });
  }

  return (
    <div className="v2-overlay" onClick={onClose}>
      <div className="v2-sheet" style={{ maxHeight: "94vh" }} onClick={e => e.stopPropagation()}>
        <div className="v2-handle"/>
        <div className="v2-sheet-body">
          <div className="v2-sheet-header">
            <div className="v2-sheet-title">{t("map_picker_title")}</div>
            <button className="v2-close-btn" onClick={onClose}>✕</button>
          </div>
          <p className="v2-sheet-sub" style={{ margin: "0 0 10px" }}>{t("map_picker_hint")}</p>
          <div style={{ position: "relative" }}>
            <div ref={mapContainerRef} style={{ height: "46vh", minHeight: 300, borderRadius: 10, overflow: "hidden", background: "var(--bg-hi)" }}/>
            <div style={{ position: "absolute", top: 10, right: 10, display: "flex", background: "rgba(251,245,234,0.95)", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", zIndex: 500 }}>
              <button onClick={() => switchTile("satellite")} className="mono" style={{ border: "none", background: tileKey === "satellite" ? "var(--accent)" : "transparent", color: tileKey === "satellite" ? "#fff" : "var(--text-mu)", padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🛰️ {t("map_tile_satellite")}</button>
              <button onClick={() => switchTile("street")} className="mono" style={{ border: "none", background: tileKey === "street" ? "var(--accent)" : "transparent", color: tileKey === "street" ? "#fff" : "var(--text-mu)", padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗺️ {t("map_tile_street")}</button>
            </div>
          </div>
          {pickedLatLng && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg-el)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>{t("map_picker_name_label")}</div>
              <input
                type="text"
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                placeholder={geocoding ? t("locating") : t("map_picker_name_placeholder")}
                style={{ width: "100%", border: "none", background: "transparent", fontSize: 15, fontWeight: 500, color: "var(--text)", fontFamily: "inherit", outline: "none", padding: 0 }}/>
              {suggestedRegion && (
                <div className="mono" style={{ fontSize: 10, color: "var(--text-mu)", marginTop: 3 }}>{suggestedRegion}</div>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="v2-locate-btn" style={{ flex: "0 0 auto", width: "auto", margin: 0, padding: "10px 14px" }} onClick={useMe}>📍</button>
            <button
              className="v2-primary-btn"
              style={{ margin: 0, flex: 1, opacity: pickedLatLng ? 1 : 0.55 }}
              disabled={!pickedLatLng || confirming}
              onClick={confirm}>
              {confirming ? "…" : pickedLatLng ? t("map_picker_use") : t("map_picker_tap_hint")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
