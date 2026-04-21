"use client";

// v2 LangPicker — ported from prod, wrapped in v2 visual.

import { LANGUAGES } from "../../i18n";

export default function LangPicker({ lang, setLang, onClose, customLangs, onDeleteCustom, onAddLang }) {
  const allLangs = [...LANGUAGES, ...customLangs.map(c => ({ code: c.code, name: c.name, flag: c.flag, isCustom: true }))];
  return (
    <div className="v2-overlay" onClick={onClose}>
      <div className="v2-sheet" onClick={e => e.stopPropagation()}>
        <div className="v2-handle"/>
        <div className="v2-sheet-body">
          <div className="v2-sheet-header">
            <div className="v2-sheet-title">Language</div>
            <button className="v2-close-btn" onClick={onClose}>✕</button>
          </div>
          <button className="v2-add-lang-btn" onClick={() => { onClose(); onAddLang(); }}>+ Add Language</button>
          {allLangs.map(l => (
            <div key={l.code} style={{ display: "flex", alignItems: "center" }}>
              <button className={`v2-lang-row ${lang === l.code ? "active" : ""}`}
                style={{ flex: 1 }}
                onClick={() => { setLang(l.code); try { localStorage.setItem("surf-lang", l.code); } catch {} onClose(); }}>
                <span className="v2-lang-flag">{l.flag}</span>
                <span className="v2-lang-name">{l.name}</span>
                {l.isCustom && <span className="v2-custom-tag">custom</span>}
                {lang === l.code && <span className="v2-lang-check">✓</span>}
              </button>
              {l.isCustom && (
                <button className="v2-del-custom" onClick={() => onDeleteCustom(l.code)}>✕</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
